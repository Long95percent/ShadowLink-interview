# ShadowLink RAG 与 GraphRAG 扩展设计方案

> 日期：2026-05-09  
> 状态：设计稿，未进入实现  
> 范围：扩充现有 RAG 能力，并为代码库技术档案、面试题生成、AI 审阅提供更低成本、更准确的上下文检索。

## 1. 背景与目标

当前 ShadowLink 已具备基础 RAG 管线：文档切分、Embedding、向量索引、BM25/Hybrid 检索、Rerank、CRAG 质量门控、回答生成与 Trace。面试模块近期又引入了“代码库技术档案”：Codex 深度扫描代码库后生成 Markdown 技术文档，再由普通 LLM 在出题和审阅时读取上下文。

现阶段的问题是：

1. 技术档案直接截取最多 8000 字符塞入 prompt，简单可用，但 token 成本会随档案变长增长。
2. 普通向量 RAG 擅长“找相似片段”，但不擅长回答跨模块、跨实体关系、全局架构主题类问题。
3. 面试场景经常需要“项目链路解释”：例如从前端按钮到后端接口、再到 LLM Provider、再到数据持久化，这类问题天然适合实体关系图。
4. Codex 不应每次被调用；更合理的是先生成可检索档案，普通模型用 RAG/GraphRAG 检索，只有信息不足时再触发 Codex 定向查询。

目标：

- 建立“技术档案 -> Chunk -> 向量索引 -> 可选知识图谱”的分层检索体系。
- 让面试题生成、AI 审阅、项目问答优先使用低成本检索上下文。
- GraphRAG 作为增强层，不替代现有 RAG，而是在跨模块、全局总结、实体关系问题上启用。
- 保持本地优先，优先兼容当前 FastAPI + JSON/本地文件 + FAISS/Hybrid RAG 架构。

## 2. 成熟 GraphRAG 框架调研结论

### 2.1 Microsoft GraphRAG

定位：偏“离线索引 + 全局/局部查询”的完整 GraphRAG 方法论与实现。

核心能力：

- 索引阶段从非结构化文本抽取实体、关系、claims。
- 对实体图做 community detection。
- 生成多层级 community reports。
- 查询阶段提供 Local Search、Global Search、DRIFT Search、Basic Search、Question Generation。
- 默认输出 Parquet 表，Embedding 写入配置的向量存储。

优点：

- GraphRAG 方法论最完整，尤其适合“全局问题”和“跨文档主题总结”。
- Local/Global/DRIFT 的查询模式和 ShadowLink 的“项目局部链路 vs 全技术栈总结”非常匹配。
- 适合做代码库技术档案的二级索引：不是每次扫源码，而是对 Codex 产出的技术文档、README、架构文档进行图谱化。

限制：

- 官方仓库说明其代码是 demonstration，不是 Microsoft 官方支持产品。
- 索引成本可能高，官方也提醒 GraphRAG indexing 可能昂贵，需要从小数据集开始。
- 引入后会多一套项目目录、配置、Parquet 输出和索引生命周期管理。

适合 ShadowLink 的用法：

- 作为“可选高级索引器”，用于技术档案、长文档集合、全局复习资料。
- 不作为 MVP 默认检索链路，避免资源和复杂度一次性上升。

### 2.2 Neo4j GraphRAG Python

定位：Neo4j 官方的一方 Python GraphRAG 包，偏“图数据库 + Retriever + RAG pipeline”。

核心能力：

- Knowledge Graph Construction Pipeline。
- Graph search、vector search、Vector Cypher Retriever、Vector Database Retriever。
- 支持 Neo4j / Neo4j Aura，Python 版本覆盖主流版本。
- 可接 OpenAI、Ollama、Anthropic、Google、Cohere、MistralAI 等 LLM Provider。

优点：

- 官方长期维护，工程成熟度和生产可用性更强。
- Neo4j 对实体关系查询、路径查询、Cypher 可解释性很好。
- 适合未来做“代码实体图”：文件、模块、API、类、函数、数据模型、LLM Provider、配置项之间的关系。

限制：

- 需要引入 Neo4j 服务或 Aura，和当前“轻量本地优先”的路线相比更重。
- Windows 本地一键启动会增加依赖和运维成本。
- 对个人学习系统而言，第一阶段可能过度工程。

适合 ShadowLink 的用法：

- 作为第二阶段/增强版 Graph Store。
- 当用户明确需要跨多个代码库、长期沉淀技术栈图谱、复杂路径查询时引入。

### 2.3 LlamaIndex PropertyGraphIndex

定位：应用框架内的轻量属性图索引，适合快速从文档抽取 property graph 并查询。

核心能力：

- `PropertyGraphIndex` 支持构建和查询属性图。
- 支持 LLM triplet/path extraction。
- 可配 `SimplePropertyGraphStore`，也可接 Neo4j、Memgraph 等后端。
- Retriever 可以同时包含图路径和源文本。

优点：

- Python 集成较轻，适合快速验证 GraphRAG 思路。
- 可先用内存/本地 store，未来再迁移 Neo4j。
- 和“先做技术档案 chunk 图谱，不直接扫全源码”的策略兼容。

限制：

- 对完整工程级 GraphRAG 生命周期的约束不如 Microsoft GraphRAG 明确。
- 如果后期要做生产级图数据库，仍需切换到 Neo4j/Memgraph 等后端。

适合 ShadowLink 的用法：

- 第一阶段 GraphRAG 实验层的首选。
- 在不引入 Neo4j 服务的情况下，实现“技术档案实体关系图 + 图增强检索”。

### 2.4 LangChain + Neo4j 组合

定位：自行组合 Neo4j Vector、Cypher QA、Graph Retriever、LLM chain。

优点：

- 与当前 LangChain/LangGraph 技术方向一致。
- 灵活，可按需接入现有 RAGEngine。

限制：

- 框架本身不是完整 GraphRAG 产品，需要自己设计抽取、索引、检索融合、质量评估。
- 工程自由度高，但也意味着更多自研成本。

适合 ShadowLink 的用法：

- 在第二阶段引入 Neo4j 后，用 LangChain 作为编排层，而不是一开始就重写 RAG。

## 3. 推荐路线

推荐采用“三层递进”路线：

### 阶段 A：扩充现有 RAG，先解决 token 成本

目标：把代码库技术档案从“整段塞 prompt”改成“可检索上下文”。

设计：

1. 每份 `CodebaseTechnicalDoc.raw_markdown` 生成后，自动切分为 chunks。
2. chunk metadata 至少包含：
   - `repo_id`
   - `doc_type=codebase_technical_doc`
   - `section_title`
   - `source=codebase_profile`
   - `updated_at`
3. 写入现有 RAG 索引，建议新增 mode/index：`codebase:{repo_id}`。
4. 面试题生成和审阅时：
   - 根据当前问题、JD、简历摘要构造检索 query。
   - 从 `codebase:{repo_id}` 检索 top_k 片段。
   - 只把命中的片段注入 prompt，而不是固定塞 8000 字。
5. 保留当前 8000 字直塞作为 fallback：当索引未生成或检索失败时才使用。

收益：

- 实现成本最低。
- 直接降低 prompt token。
- 不引入新基础设施。
- 与现有 RAGEngine、Hybrid Retriever、Reranker 复用度最高。

### 阶段 B：轻量 GraphRAG，给技术档案建立实体关系索引

目标：让系统能回答“模块关系、调用链路、技术栈汇总、跨文件架构解释”等图谱型问题。

推荐方案：优先使用 LlamaIndex PropertyGraphIndex 做本地轻量验证。

图谱输入：

- Codex 生成的技术档案 Markdown。
- README、架构文档、模块设计文档。
- 后续可选：Codex 定向输出的“模块关系 JSON”。

建议实体类型：

- `Repo`：代码库。
- `Module`：前端模块、后端模块、AI/RAG 模块、配置模块。
- `File`：关键文件路径。
- `API`：后端接口、前端调用服务。
- `Component`：React 组件、后端 service、repository、adapter。
- `DataModel`：Pydantic model、JSON 持久化结构、数据库表。
- `Provider`：LLM Provider、Codex CLI、Embedding、Reranker。
- `Flow`：业务链路，如“生成面试题”“AI 审阅”“代码库档案生成”。

建议关系类型：

- `CONTAINS`：Repo 包含 Module/File。
- `CALLS`：组件调用服务/接口。
- `IMPLEMENTS`：文件实现能力。
- `READS_FROM` / `WRITES_TO`：读写 JSON、索引、配置。
- `USES_PROVIDER`：使用 LLM/Codex/Embedding Provider。
- `PART_OF_FLOW`：节点属于某条业务链路。
- `DEPENDS_ON`：模块依赖。

查询策略：

1. 先跑普通 Hybrid RAG，拿到文本片段。
2. 如果 query 命中以下意图，则启用 GraphRAG：
   - “链路怎么走”
   - “模块之间关系”
   - “整体架构”
   - “为什么这样设计”
   - “面试官追问项目细节”
3. GraphRAG 返回：
   - 相关实体路径。
   - 关联源文本 chunk。
   - 可解释引用，如 `InterviewReviewPanel -> interviewApi.createReview -> /reviews -> InterviewReviewDraftService -> OpenAIProvider`。
4. 最终上下文由 `RAGContextAssembler` 合并：文本 chunk + 图路径 + community/section summary。

收益：

- 不需要一开始引入 Neo4j。
- 可验证“GraphRAG 是否真的提升面试问答质量”。
- 图谱来自技术档案，不直接让 LLM 扫全仓库，成本可控。

### 阶段 C：Neo4j / Microsoft GraphRAG 作为高级能力

当满足以下条件时再引入：

- 用户有多个代码库，需要跨仓库技术栈汇总。
- 技术档案数量明显增长，普通本地图 store 不够用。
- 需要复杂路径查询、可视化图谱、长期知识库维护。
- 需要 Global Search/DRIFT Search 支持大规模文档整体洞察。

推荐分工：

- Neo4j GraphRAG Python：用于生产化图数据库、路径查询、长期知识图谱。
- Microsoft GraphRAG：用于离线批处理、community reports、global search、跨文档全局总结。
- LangChain/LangGraph：继续作为 ShadowLink 内部工作流编排层。

## 4. ShadowLink 目标架构

```text
[Codex CLI 只读分析]
        |
        v
[CodebaseTechnicalDoc Markdown]
        |
        +--> [Chunker] --> [Vector/BM25/Hybrid Index]
        |
        +--> [Entity/Relation Extractor] --> [Property Graph Store]
        |
        v
[Retrieval Router]
        |-- factual/local --> Hybrid RAG
        |-- module/path --> GraphRAG Local Search
        |-- global/summary --> Community Summary / Global Search
        |-- insufficient --> Codex Targeted Query
        v
[Context Assembler]
        |
        v
[普通 LLM：出题 / 审阅 / 项目问答]
```

## 5. 数据结构设计

### 5.1 RAG chunk metadata

```json
{
  "repo_id": "repo-xxxx",
  "doc_id": "codebase-doc-repo-xxxx",
  "doc_type": "codebase_technical_doc",
  "section_title": "后端架构",
  "source": "codebase_profile",
  "source_path": "technical_docs.json",
  "updated_at": "2026-05-09T23:20:00+08:00"
}
```

### 5.2 Graph node

```json
{
  "node_id": "module:interview",
  "repo_id": "repo-xxxx",
  "label": "Module",
  "name": "Interview Learning Module",
  "description": "面试题生成、AI 审阅、Skill 管理、代码库档案选择",
  "source_chunks": ["chunk-1", "chunk-8"]
}
```

### 5.3 Graph edge

```json
{
  "edge_id": "edge-xxxx",
  "repo_id": "repo-xxxx",
  "source_id": "component:InterviewReviewPanel",
  "target_id": "api:/v1/interview/spaces/{space_id}/interview/questions",
  "relation": "CALLS",
  "evidence": "前端 generateQuestions 调用 interviewApi.generateQuestions"
}
```

## 6. 检索路由设计

新增 `RetrievalRouter`，根据 query 类型选择策略：

| Query 类型 | 示例 | 检索方式 |
| --- | --- | --- |
| 精确事实 | “审阅接口在哪个文件？” | Hybrid RAG |
| 局部链路 | “生成面试题从前端到后端怎么走？” | Graph Local Search + Hybrid RAG |
| 全局总结 | “这个项目最适合怎么在面试里讲？” | Section Summary / Global Search |
| 对比分析 | “Codex 专家模式和普通 LLM 审阅区别？” | Hybrid RAG + Graph paths |
| 信息不足 | “某个具体函数内部怎么实现？” | 先 RAG，不足时 Codex targeted query |

## 7. 和面试模块的集成方式

### 7.1 生成面试题

当前：简历 + JD + Skill + 技术档案前 8000 字。

改造后：

1. 构造检索 query：
   - `target_role`
   - JD keywords
   - resume project keywords
   - interviewer_skill
2. 从代码库档案 RAG index 取 top 5。
3. 如果是 `project_deep_dive` 或 `system_design`，额外启用 GraphRAG 获取关键链路。
4. Prompt 中注入：
   - “项目事实片段”
   - “模块关系路径”
   - “可追问技术亮点”

### 7.2 AI 审阅

当前：问题 + 用户回答 + 简历 + JD + 技术档案前 8000 字。

改造后：

1. 用“面试题 + 用户回答”作为检索 query。
2. 检索与回答相关的项目片段。
3. GraphRAG 查找回答中提到的模块/技术点对应链路。
4. LLM 审阅时判断：
   - 回答是否符合真实项目事实。
   - 是否遗漏关键模块。
   - 是否能补充更强的技术链路。
   - 是否有“编造项目细节”的风险。

### 7.3 Codex 定向升级

当普通 LLM 返回“技术档案不足以判断”或检索置信度低时：

1. 前端提示：“当前档案不足，是否调用 Codex 定向查询？”
2. 后端生成 targeted prompt，例如：
   - “只分析面试题生成链路，从前端组件到后端服务，列出关键文件和函数。”
3. Codex 输出追加到：
   - `technical_docs.json`
   - RAG chunks
   - Graph nodes/edges
4. 后续同类问题不再重复调用 Codex。

## 8. 实施阶段建议

### Phase 1：Codebase Doc RAG 化

- 新增 codebase doc chunker。
- 技术档案生成后写入现有 RAG index。
- 面试题生成和审阅从 RAG 检索上下文。
- 保留 8000 字 fallback。

验收标准：

- 生成题和审阅 prompt 中只包含 top_k 相关片段。
- token 估算显著下降。
- 不影响无档案、无索引场景。

### Phase 2：轻量 Property Graph

- 新增本地 property graph repository。
- 从技术档案抽取实体/关系。
- 新增 GraphRAG local search：实体召回 + 关系扩展 + source chunk。
- 前端在技术档案面板展示“实体数 / 关系数 / 最近构建时间”。

验收标准：

- 能回答“某链路涉及哪些模块/文件/API”。
- 能在审阅建议里补充真实项目链路。
- GraphRAG 可关闭，不影响普通 RAG。

### Phase 3：Neo4j / Microsoft GraphRAG 可选增强

- 增加 Graph Store Provider 抽象：`local_property_graph` / `neo4j` / `microsoft_graphrag`。
- Neo4j 用于长期图谱和路径查询。
- Microsoft GraphRAG 用于离线 global search 和 community reports。
- 前端设置页提供 Provider 配置，不默认启用重依赖。

验收标准：

- 小项目仍可无 Neo4j 运行。
- 大项目可启用 Neo4j/Microsoft GraphRAG。
- 同一套面试模块通过 `RetrievalRouter` 无感切换检索能力。

## 9. 风险与控制

| 风险 | 控制策略 |
| --- | --- |
| GraphRAG 索引成本高 | 先对 Codex 技术档案建图，不直接对全源码建图 |
| 本地启动变重 | Phase 1 不引入新服务，Phase 2 用本地 store，Neo4j 放到 Phase 3 |
| LLM 抽取关系不稳定 | 使用固定 schema、低温度、JSON 输出、保留 evidence/source chunk |
| 图谱错误污染回答 | GraphRAG 结果必须带 source chunk，最终回答要求基于证据 |
| token 仍然过高 | top_k 控制、section summary、Graph path 限长、必要时 rerank |
| 多代码库串线 | 所有 chunk/node/edge 必须带 `repo_id`，检索强制过滤 |

## 10. 推荐技术选型

短期推荐：

- 继续使用现有 RAGEngine + FAISS/BM25/Hybrid。
- 新增 codebase doc chunk index。
- GraphRAG 实验层优先选 LlamaIndex PropertyGraphIndex 或自研轻量 property graph JSON store。

中期推荐：

- 引入 Neo4j GraphRAG Python 作为可选 Provider。
- 用 Neo4j 存储长期项目图谱。

长期推荐：

- Microsoft GraphRAG 用于大型资料库、全局总结、community reports。
- Neo4j 用于交互式路径查询和长期知识图谱。
- ShadowLink 保持 RetrievalRouter 抽象，避免被单一框架绑定。

## 11. 参考资料

- Microsoft GraphRAG GitHub：`https://github.com/microsoft/graphrag`
- Microsoft GraphRAG Indexing 文档：`https://microsoft.github.io/graphrag/index/overview/`
- Microsoft GraphRAG Query 文档：`https://microsoft.github.io/graphrag/query/overview/`
- Neo4j GraphRAG Python 文档：`https://neo4j.com/docs/neo4j-graphrag-python/current/index.html`
- Neo4j GraphRAG Python 开发者指南：`https://neo4j.com/developer/genai-ecosystem/graphrag-python/`
- LlamaIndex PropertyGraphIndex 文档：`https://docs.llamaindex.ai/en/stable/module_guides/indexing/lpg_index_guide/`
