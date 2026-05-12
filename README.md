# ShadowLink

ShadowLink 是一个本地优先的 AI 工作台项目。当前仓库同时保留早期 PyQt 桌面能力，并重点推进新的三端架构：React Web 前端、FastAPI AI 服务、Java Spring Boot 网关/业务服务。

当前主线功能包括 Agent 对话、RAG 检索、文件处理、工具调用、面试学习工作台、阅读理解工作台、Codex CLI 专家模式预留和网页搜索 Provider 预留。

## 当前架构

```text
shadowlink-web      React + Vite 前端，默认端口 3000
shadowlink-ai       FastAPI AI 服务，默认端口 8000
shadowlink-server   Spring Boot Java 服务，默认端口 8080
shadowlink-electron Electron 壳，后续桌面化预留
```

一键启动会同时拉起 Python AI、Java Gateway 和 Web 前端。手动开发时也可以只启动 `shadowlink-ai` 和 `shadowlink-web`；前端 Vite 已配置 `/v1` 直连 Python AI 服务，`/api` 和 `/api/ai` 代理到 Java 服务。

## 新增：面试学习与阅读工作台

面试学习模块位于 Web 页面“面试学习工作台”，后端接口挂载在 `/v1/interview`。

已具备能力：

- Job Space：按岗位/考试方向隔离资料。
- Space Profile：每个 Space 独立保存 Resume、JD、目标公司、目标岗位和备注。
- Interview Review：保留面试回答审阅草稿能力，当前是确定性占位实现，可后续接 LLM Reviewer。
- External Agent Run：Codex CLI 专家模式的异步运行记录骨架。
- Reading Workspace：文章切分、句子解释占位、阅读进度保存、难句标记、Space 隔离。
- Web Research：网页搜索 Provider 抽象与禁用占位实现，当前不强依赖外部搜索 API。

相关设计文档：

- `docs/Agents.md`
- `docs/面试学习模块设计/技术选型方案.md`
- `docs/面试学习模块设计/执行方案.md`
- `docs/面试学习模块设计/阅读工作台Review修复执行文档.md`
- `docs/面试学习模块设计/worklog-5-9.md`

## 环境要求

### 必需

- Python 3.10+，推荐 Python 3.11 或 3.12
- Node.js 18+
- npm

### 可选

- Java 21：仅在启动 `shadowlink-server` 时需要。
- Maven Wrapper：仓库已包含 `shadowlink-server/mvnw.cmd`。
- Codex CLI：仅在使用 Codex 专家模式时需要；当前可检测/预留，不是基础启动必需项。
- Ollama / 本地模型：仅在本地模型或旧桌面 RAG 流程中需要。

## 快速启动

## LLM Prompt 调试清单

项目里给 LLM 的 prompt 主要分为三类：后端源码内置 prompt、前端/用户配置 prompt、以及运行时用户输入。调试时优先看下面这些文件。

### 后端内置 Prompt 文件

| 文件 | 用途 | 热启动情况 |
| --- | --- | --- |
| `shadowlink-ai/app/agent/engine.py` | Agent 模式默认 system prompt（`MODE_SYSTEM_PROMPTS`），没有前端自定义 system prompt 时使用。 | Python 后端以 `--reload` 启动时，保存后会自动重载。 |
| `shadowlink-ai/app/agent/react/executor.py` | ReAct 执行器把 system prompt 和用户消息组装成 `SystemMessage` / `HumanMessage`。 | 自动重载。 |
| `shadowlink-ai/app/agent/react/graph.py` | ReAct 反思/质量检查 prompt（reasoning reflection）。 | 自动重载。 |
| `shadowlink-ai/app/agent/react/nodes.py` | ReAct graph 注入 system prompt 的节点逻辑。 | 自动重载。 |
| `shadowlink-ai/app/agent/plan_execute/planner.py` | Plan & Execute 的规划器 prompt（生成步骤计划）。 | 自动重载。 |
| `shadowlink-ai/app/agent/plan_execute/replan.py` | Plan & Execute 的重规划 prompt。 | 自动重载。 |
| `shadowlink-ai/app/agent/plan_execute/graph.py` | Plan & Execute 汇总已完成步骤、生成最终回答的 prompt。 | 自动重载。 |
| `shadowlink-ai/app/agent/plan_execute/executor.py` | Plan & Execute 执行入口，负责把请求上下文交给 planner/graph。 | 自动重载。 |
| `shadowlink-ai/app/agent/plan_execute/stream_executor.py` | Plan & Execute 流式执行入口。 | 自动重载。 |
| `shadowlink-ai/app/agent/multi_agent/supervisor.py` | 多 Agent supervisor 路由/决策 prompt。 | 自动重载。 |
| `shadowlink-ai/app/agent/multi_agent/hierarchical.py` | 分层多 Agent 编排 prompt/消息组装。 | 自动重载。 |
| `shadowlink-ai/app/agent/multi_agent/swarm.py` | Swarm 多 Agent 协作 prompt/消息组装。 | 自动重载。 |
| `shadowlink-ai/app/codebase/service.py` | 代码库技术档案生成的默认 prompt（`DEFAULT_CODEBASE_PROMPT`），会发给 Codex 专家适配器。 | 自动重载；已在跑的后台任务不会中途换 prompt。 |
| `shadowlink-ai/app/interview/review_service.py` | 面试题生成 prompt、面试回答审阅 prompt、`revision_instruction` 重生成逻辑、本地 fallback 模板。 | 自动重载。 |
| `shadowlink-ai/app/api/v1/interview_router.py` | 面试审阅/出题接口入口，决定把前端参数传给 `review_service.py`。 | 自动重载。 |
| `shadowlink-ai/app/rag/retrieval/multi_query.py` | RAG 多查询改写 prompt。 | 自动重载。 |
| `shadowlink-ai/app/rag/retrieval/self_rag.py` | Self-RAG 检索/判断相关 prompt。 | 自动重载。 |
| `shadowlink-ai/app/rag/reranking/llm_rerank.py` | LLM rerank 相关性打分 prompt（`LLM_RERANK_PROMPT`）。 | 自动重载。 |
| `shadowlink-ai/app/rag/chunking/agentic.py` | Agentic chunking 分块/摘要类 prompt。 | 自动重载。 |
| `shadowlink-ai/app/llm/providers/openai.py` | OpenAI-compatible provider 的最终 `messages` 组装位置；通常不改 prompt 内容，只用于确认最终请求结构。 | 自动重载。 |
| `shadowlink-ai/app/llm/providers/anthropic.py` | Anthropic provider 的最终消息组装位置。 | 自动重载。 |

### 前端/用户可编辑 Prompt 入口

| 文件 | 用途 | 热启动情况 |
| --- | --- | --- |
| `shadowlink-web/src/components/ambient/ModeSettingsModal.tsx` | Agent 模式的自定义 System Prompt 编辑 UI。 | Vite 热更新；保存到前端状态/localStorage 后，下次请求立即生效。 |
| `shadowlink-web/src/hooks/useAgent.ts` | 把当前模式的 `systemPrompt` 作为请求 context 传给后端 Agent。 | Vite 热更新。 |
| `shadowlink-web/src/components/interview/InterviewSkillManager.tsx` | 自定义面试官 Skill 的 instruction 编辑/上传 UI。 | Vite 热更新；保存后后端 JSON 数据立即被后续请求读取。 |
| `shadowlink-web/src/components/interview/InterviewReviewPanel.tsx` | 面试出题、审阅、重生成审阅时传入 `interviewerSkill`、`revisionInstruction`、当前题目和回答。 | Vite 热更新；正在进行中的请求不会中途改变。 |
| `shadowlink-web/src/services/interview.ts` | 前端面试模块请求体组装，包括 `interviewer_skill`、`revision_instruction`、LLM 配置。 | Vite 热更新。 |
| `shadowlink-web/src/services/codebase.ts` | 代码库文档生成请求体，可传自定义 prompt。 | Vite 热更新。 |
| `shadowlink-ai/app/interview/repository.py` | 自定义面试官 Skill 持久化到 `storage/interview/interview_skills.json`。 | 数据文件保存后后续请求立即读取，无需重启。 |

### 运行时数据型 Prompt

这些不是固定源码 prompt，但会进入 LLM 请求：

- Agent 用户消息：前端聊天输入，经 `shadowlink-web/src/hooks/useAgent.ts` 发送。
- 面试回答审阅：练习界面的题目、用户回答、简历、JD、目标岗位、代码库技术档案，由 `shadowlink-ai/app/interview/review_service.py` 拼入审阅 prompt。
- 重新生成审阅：练习界面的修改意见 `revisionInstruction`，最终进入 `revision_instruction`。
- 代码库技术档案：`shadowlink-web/src/services/codebase.ts` 可传 prompt；为空时使用 `shadowlink-ai/app/codebase/service.py` 的默认 prompt。
- RAG 查询：用户 query 会进入 multi-query、self-rag、rerank 等 RAG prompt。

### Prompt 热启动/热更新说明

- `start.bat` 启动 Python AI 服务时使用的是 `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`，所以修改 `shadowlink-ai/app/**.py` 里的 prompt 后，后端会自动重载；下一次请求使用新 prompt。
- `start.bat` 启动 Web 时使用 `npx vite --port 3000`，所以修改 `shadowlink-web/src/**` 后前端会热更新；下一次前端请求使用新请求体逻辑。
- 运行中的 LLM 请求、后台任务、流式响应不会中途切换 prompt；需要重新点一次生成/审阅/聊天。
- 修改 `llm_config.json`、环境变量、依赖、Java 网关代码或启动参数时，建议手动重启对应服务。
- 自定义面试官 Skill 保存在 `storage/interview/interview_skills.json`，通过 UI 保存后后续请求立即生效；如果直接手改 JSON，也建议刷新页面以更新下拉框。

### Windows 一键启动

在仓库根目录运行：

```bat
start.bat
```

该脚本现在是唯一保留的启动入口，会启动三项服务：

- Python AI 服务：`http://localhost:8000`
- Java Gateway：`http://localhost:8080`
- React 前端：`http://localhost:3000`

脚本启动后会等待服务初始化并自动打开浏览器。

API 文档地址：

```text
http://localhost:8000/docs
```

运行前请确保命令行可以直接使用：

```bat
python --version
node --version
npm --version
```

如果是第一次运行，还需要先安装依赖：

```bat
cd shadowlink-ai
python -m pip install -e .

cd ..\shadowlink-web
npm install
```

Java Gateway 第一次启动时脚本会自动执行 Maven 构建；如果修改过 Java 代码且想强制干净重建，可以删除 `shadowlink-server\shadowlink-starter\target` 后重新运行 `start.bat`。

## 手动启动

### 1. 启动 Python AI 服务

```bash
cd shadowlink-ai
python -m pip install -e .
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

也可以使用项目 CLI：

```bash
cd shadowlink-ai
python -m app.cli --host 0.0.0.0 --port 8000 --reload
```

### 2. 启动 Web 前端

```bash
cd shadowlink-web
npm install
npm run dev
```

访问：

```text
http://localhost:3000
```

### 3. 可选：启动 Java 服务

只有需要 Java 网关、认证、业务模块或 `/api` 代理时才需要启动。

```bash
cd shadowlink-server
mvnw.cmd spring-boot:run -pl shadowlink-starter -am
```

Java 服务默认端口：

```text
http://localhost:8080
```

Java 服务默认配置会连接 Python AI 服务：

```text
shadowlink.ai-service.rest-base-url=http://localhost:8000
shadowlink.ai-service.grpc-target=localhost:50051
```

## 依赖说明

### Python AI 服务

依赖定义在：

```text
shadowlink-ai/pyproject.toml
```

基础安装：

```bash
cd shadowlink-ai
python -m pip install -e .
```

开发依赖安装：

```bash
cd shadowlink-ai
python -m pip install -e ".[dev]"
```

可选重型能力：

```bash
cd shadowlink-ai
python -m pip install -e ".[rerank]"
python -m pip install -e ".[ocr]"
python -m pip install -e ".[dev,rerank,ocr]"
```

说明：

- `rerank` 会安装重排模型相关依赖。
- `ocr` 会安装 PaddleOCR/PaddlePaddle，体积较大。
- 面试学习与阅读工作台当前不需要新增额外 Python 包。

### Web 前端

依赖定义在：

```text
shadowlink-web/package.json
```

安装：

```bash
cd shadowlink-web
npm install
```

常用命令：

```bash
npm run dev
npm run build
npm run type-check
npm run lint
```

面试学习工作台使用已有 React、TypeScript、Zustand、Vite 能力，不需要新增前端依赖。

### Java 服务

依赖定义在：

```text
shadowlink-server/pom.xml
```

使用 Spring Boot 3.2.5、Java 21、多模块 Maven 工程。当前前端开发可以不启动 Java 服务，因为 `/v1` 已直接代理到 Python AI 服务。

## 配置项

Python AI 服务使用 `.env` 和 `SHADOWLINK_` 前缀环境变量。

常用配置：

```env
SHADOWLINK_DEBUG=true
SHADOWLINK_ENV=dev
SHADOWLINK_LOG_LEVEL=INFO
SHADOWLINK_DATA_DIR=./data

# 旧桌面应用聊天数据库；默认 data/chat_history.db，可按需改到仓库外
SHADOWLINK_CHAT_DB=./data/chat_history.db

SHADOWLINK_LLM_BASE_URL=https://api.openai.com/v1
SHADOWLINK_LLM_MODEL=gpt-4o-mini
SHADOWLINK_LLM_API_KEY=
SHADOWLINK_LLM_TEMPERATURE=0.7
SHADOWLINK_LLM_MAX_TOKENS=4096
```

RAG 相关配置：

```env
SHADOWLINK_RAG_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
SHADOWLINK_RAG_EMBEDDING_DEVICE=cpu
SHADOWLINK_RAG_FAISS_INDEX_PATH=./data/faiss_index
```

文件上传相关配置：

```env
SHADOWLINK_FILE_UPLOAD_DIR=./data/uploads
SHADOWLINK_FILE_MAX_FILE_SIZE_MB=100
SHADOWLINK_FILE_OCR_ENABLED=false
```

## 数据与持久化

当前本地数据默认写入：

```text
shadowlink-ai/data
data/chat_history.db
```

如果需要长期使用并保留数据，建议保持 `SHADOWLINK_DATA_DIR=./data`，让运行期 JSON、上传文件和索引落在本地 `data/` 下；旧桌面端聊天历史默认写入 `data/chat_history.db`。这些路径已在 `.gitignore` 中忽略，不会随普通提交上传。

面试学习模块使用 JSON 过渡层：

```text
shadowlink-ai/data/interview/spaces.json
shadowlink-ai/data/interview/profiles.json
shadowlink-ai/data/interview/sessions.json
shadowlink-ai/data/interview/reviews.json
shadowlink-ai/data/interview/external_agent_runs.json
shadowlink-ai/data/interview/reading_progress.json
```

阅读工作台当前只保存文章 ID、标题、进度和难句列表，不保存完整文章正文。后续如果需要历史文章列表，可新增 `ArticleSource` 或 `ReadingArticle` 模型。

旧桌面应用和本地 RAG 可能使用以下目录或文件：

```text
models/
rag_indexes/
chat_history.db
data/chat_history.db
llm_config.json
tasks_config.json
```

这些通常属于本地运行产物，不建议提交到 Git。API Key 推荐放在本地 `.env` 或运行后的 `shadowlink-ai/data/llm_providers.json` 中；不要把真实 Key 写入示例配置。

## 测试与检查

### 后端单测

```bash
cd shadowlink-ai
pytest tests/unit/test_interview_models.py tests/unit/test_interview_repository.py tests/unit/test_interview_api.py tests/unit/test_reading_workspace.py -v
```

完整单测可按需要运行：

```bash
cd shadowlink-ai
pytest -v
```

### 前端类型检查

```bash
cd shadowlink-web
npx.cmd tsc -b
```

或：

```bash
cd shadowlink-web
npm run type-check
```

### 前端构建

```bash
cd shadowlink-web
npm run build
```

## 主要目录

```text
shadowlink-ai/app/main.py                 FastAPI 应用入口
shadowlink-ai/app/api/v1                  REST API 路由
shadowlink-ai/app/agent                   Agent 引擎、状态、策略、记忆
shadowlink-ai/app/rag                     RAG、切片、索引、检索、重排
shadowlink-ai/app/tools                   工具体系
shadowlink-ai/app/interview               面试学习领域模型、仓储、阅读工作台、外部 Agent 运行
shadowlink-ai/app/integrations/codex      Codex CLI 检测与适配器
shadowlink-ai/app/integrations/web_research 网页搜索 Provider 抽象与禁用实现
shadowlink-web/src/pages                  Web 页面
shadowlink-web/src/components/interview   面试学习与阅读工作台组件
shadowlink-web/src/services               前端 API service
shadowlink-web/src/stores                 Zustand 状态管理
shadowlink-server                         Java Spring Boot 多模块服务
```

## 旧桌面入口

仓库根目录仍保留早期 PyQt 桌面入口：

```bash
python launcher.py
```

相关兼容模块包括根目录下的 `main.py`、`llm_client.py`、`rag_engine.py`、`history_manager.py`、`skill_interface.py`、`my_skills.py` 等。当前新功能开发优先在 `shadowlink-ai` 与 `shadowlink-web` 内完成，不建议把新业务直接写入根目录旧入口。

## 开发约定

- 所有文件按 UTF-8 读写。
- 不随意转换已有文件编码。
- 不无必要整文件重写。
- 新业务优先放在清晰模块目录中，不塞进入口文件。
- 面试学习模块保持 Space 隔离，所有相关接口显式携带 `space_id`。
- 本地轻量阶段优先使用 JSON/SQLite 过渡，不提前引入复杂多用户权限模型。
- 外部 LLM、网页搜索、Codex CLI 只作为可选集成，基础运行不依赖它们。

## Git 忽略建议

不要提交：

```text
__pycache__/
.pytest_cache/
.venv/
node_modules/
dist/
build/
*.db
models/
rag_indexes/
llm_config.json
tasks_config.json
shadowlink-ai/data/
```

应提交：

```text
README.md
docs/
shadowlink-ai/app/
shadowlink-ai/tests/
shadowlink-ai/pyproject.toml
shadowlink-web/src/
shadowlink-web/package.json
shadowlink-web/package-lock.json
shadowlink-server/
scripts/
```

## 当前状态说明

截至本次 README 更新：

- 阅读工作台 Review 修复已执行并验证。
- 后端指定测试结果：`25 passed, 1 warning`。
- 前端 TypeScript 检查：`npx.cmd tsc -b` 通过。
- 面试学习模块仍处于本地轻量 MVP 阶段，Reviewer、Codex 专家模式和网页搜索 Provider 仍保留后续接入空间。


