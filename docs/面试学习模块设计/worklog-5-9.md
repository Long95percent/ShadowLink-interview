# Worklog 2026-05-09

## 1. 文档与方案

### 技术选型方案

- 新增 `docs/面试学习模块设计/技术选型方案.md`。
- 明确整体技术栈：React + Vite + TypeScript、FastAPI、HTTP REST、短轮询、SSE、SQLite、SQLAlchemy、Chroma、LangChain / LangGraph。
- 明确前后端不使用 WebSocket，采用 HTTP REST + 短轮询 + SSE。
- 明确多岗位、多 Resume、多 JD、多 Session 隔离策略。
- 明确数据库写入不让 Agent 直接拼 SQL，默认走后端 Service / ORM。
- 明确本地代码查看默认使用 `ripgrep + MCP Filesystem + Chroma + Serena`。
- 明确 Codex CLI 作为“专家模式”，不作为默认代码检索链路。
- 明确网页搜索当前不强依赖付费 API，预留 `WebResearchProvider`。
- 记录后续可接 OpenAI / Claude / Gemini / DeepSeek 等模型内置网页搜索能力。

### 执行方案

- 新增 `docs/面试学习模块设计/执行方案.md`。
- 梳理现有工程结构：`shadowlink-ai`、`shadowlink-web`、`shadowlink-server`。
- 确定不推倒重来，基于现有框架增量扩充。
- 规划新增后端目录：`interview`、`integrations/codex`、`integrations/web_research`。
- 规划新增前端目录：`components/interview`、`services/interview.ts`、`stores/interview-store.ts`、`types/interview.ts`。
- 拆解 Phase 1 到 Phase 6：Space/Profile、Session、Review、Codex 专家模式、网页能力预留、阅读工作台。

---

## 2. 后端实现

### Interview 领域模型

- 新增 `shadowlink-ai/app/interview/__init__.py`。
- 新增 `shadowlink-ai/app/interview/models.py`。
- 实现：
  - `SpaceType`
  - `ReviewStatus`
  - `TaskStatus`
  - `SessionMode`
  - `JobSpace`
  - `SpaceProfile`
  - `InterviewSession`
  - `InterviewReview`

### Interview API Schema

- 新增 `shadowlink-ai/app/interview/schemas.py`。
- 实现：
  - `CreateSpaceRequest`
  - `UpdateProfileRequest`
  - `CreateSessionRequest`
  - `CreateReviewRequest`
  - `UpdateReviewStatusRequest`
  - `SpaceDetail`
  - `SessionDetail`
  - `TaskStatusResponse`

### 本地持久化 Repository

- 新增 `shadowlink-ai/app/interview/repository.py`。
- 第一阶段使用 JSON 本地持久化，降低数据库迁移成本。
- 实现：
  - `create_space`
  - `list_spaces`
  - `get_profile`
  - `update_profile`
  - `create_session`
  - `list_sessions`
  - `create_review`
  - `list_reviews`
  - `update_review_status`
- 数据隔离按 `space_id` 和 `session_id` 实现。

### Interview Router

- 新增 `shadowlink-ai/app/api/v1/interview_router.py`。
- 挂载到 `shadowlink-ai/app/main.py` 的 `/v1/interview`。
- 实现接口：
  - `GET /v1/interview/spaces`
  - `POST /v1/interview/spaces`
  - `PUT /v1/interview/spaces/{space_id}/profile`
  - `GET /v1/interview/spaces/{space_id}/sessions`
  - `POST /v1/interview/spaces/{space_id}/sessions`
  - `GET /v1/interview/spaces/{space_id}/sessions/{session_id}/reviews`
  - `POST /v1/interview/spaces/{space_id}/sessions/{session_id}/reviews`
  - `PUT /v1/interview/reviews/{review_id}/status`
- 增加 Space 存在性校验。
- 增加 Session 必须属于当前 Space 的校验，防止跨岗位串线。

### 审阅草稿服务

- 新增 `shadowlink-ai/app/interview/review_service.py`。
- 实现 `InterviewReviewDraftService`。
- 当前为确定性本地草稿生成，不依赖外部 LLM。
- 行为：
  - Resume + JD 已填写时，生成岗位对齐式 `suggested_answer` 和 `critique`。
  - Resume 或 JD 缺失时，只保存原始回答，并提示补充资料。
  - 不覆盖 `original_answer`。

---

## 3. Codex CLI 专家模式

### 后端集成

- 新增 `shadowlink-ai/app/integrations/__init__.py`。
- 新增 `shadowlink-ai/app/integrations/codex/__init__.py`。
- 新增 `shadowlink-ai/app/integrations/codex/schemas.py`。
- 新增 `shadowlink-ai/app/integrations/codex/detector.py`。
- 新增 `shadowlink-ai/app/integrations/codex/adapter.py`。

### 能力

- 检测 Codex CLI 是否安装。
- Windows 下优先检测 `codex.cmd`，避免 PowerShell 拦截 `codex.ps1`。
- 未安装时返回安装引导：Node.js、`npm install -g @openai/codex`、`codex login`。
- `CodexExpertAdapter` 默认使用：
  - `codex exec`
  - `--sandbox read-only`
  - `--ask-for-approval never`
  - `--json`
- 默认只读，不修改本地代码。

### Integrations Router

- 新增 `shadowlink-ai/app/api/v1/integrations_router.py`。
- 挂载到 `shadowlink-ai/app/main.py` 的 `/v1/integrations`。
- 实现接口：
  - `GET /v1/integrations/codex/status`

---

## 4. 网页搜索能力预留

- 新增 `shadowlink-ai/app/integrations/web_research/__init__.py`。
- 新增 `shadowlink-ai/app/integrations/web_research/schemas.py`。
- 新增 `shadowlink-ai/app/integrations/web_research/base.py`。
- 新增 `shadowlink-ai/app/integrations/web_research/disabled.py`。
- 实现 `WebResearchProvider` 抽象。
- 实现 `DisabledWebResearchProvider`。
- 当前明确返回“网页搜索未启用”，避免 Agent 假装联网搜索。
- 后续可接 OpenAI Web Search、Claude Web Search、Gemini Grounding、DeepSeek Search 或本地抓取 Provider。

---

## 5. 前端实现

### 类型与 Service

- 新增 `shadowlink-web/src/types/interview.ts`。
- 新增 `shadowlink-web/src/services/interview.ts`。
- 新增 `shadowlink-web/src/services/integrations.ts`。
- 新增 `shadowlink-web/src/stores/interview-store.ts`。
- `interviewApi` 支持：
  - Space 列表 / 创建。
  - Profile 更新。
  - Session 列表 / 创建。
  - Review 列表 / 创建 / 状态更新。
- `integrationsApi` 支持 Codex 状态检测。

### 页面与组件

- 新增 `shadowlink-web/src/pages/InterviewLearningPage.tsx`。
- 新增 `shadowlink-web/src/components/interview/JobSpaceSwitcher.tsx`。
- 新增 `shadowlink-web/src/components/interview/SpaceProfilePanel.tsx`。
- 新增 `shadowlink-web/src/components/interview/ExpertModePanel.tsx`。
- 新增 `shadowlink-web/src/components/interview/InterviewReviewPanel.tsx`。
- 新增 `shadowlink-web/src/components/interview/index.ts`。

### 页面接入

- 修改 `shadowlink-web/src/App.tsx`，新增 `/interview` 路由。
- 修改 `shadowlink-web/src/pages/index.ts`，导出 `InterviewLearningPage`。
- 修改 `shadowlink-web/src/components/layout/TopBar.tsx`，增加 `Interview` 和 `Chat` 入口。

### 前端功能

- 可创建默认岗位 Space。
- 可切换 Job Space。
- 可保存当前 Space 的 Resume、JD、目标公司、目标岗位、备注。
- 可检测 Codex CLI 安装状态。
- 未安装 Codex 时显示安装引导。
- 可创建面试 Session。
- 可提交原始回答并生成审阅草稿。
- 可查看 `[你的原始回答] vs [导师建议]`。
- 可点击“采纳”或“保留原样”更新 Review 状态。
- 会提示当前 Space 是否已配置 Resume + JD。

---

## 6. 前端类型修复

- 修改 `shadowlink-web/src/vite-env.d.ts`，补充 `window.shadowlink` 全局类型。
- 修改 `shadowlink-web/src/hooks/useAgent.ts`，补充 `AgentStrategy` 类型导入。
- 修改 `shadowlink-web/src/pages/SettingsPage.tsx`，移除未使用的 `useEffect` 导入。
- 修改 `shadowlink-web/src/App.tsx`，移除未使用的 `Navigate` 导入。

---

## 7. 测试与验证

### 后端新增测试

- 新增 `shadowlink-ai/tests/unit/test_interview_models.py`。
- 新增 `shadowlink-ai/tests/unit/test_interview_repository.py`。
- 新增 `shadowlink-ai/tests/unit/test_interview_api.py`。
- 新增 `shadowlink-ai/tests/unit/test_interview_review_service.py`。
- 新增 `shadowlink-ai/tests/unit/test_codex_detector.py`。
- 新增 `shadowlink-ai/tests/unit/test_web_research_disabled.py`。

### 已通过验证

```bash
cd shadowlink-ai
pytest tests/unit/test_interview_models.py tests/unit/test_interview_repository.py tests/unit/test_interview_api.py tests/unit/test_interview_review_service.py tests/unit/test_codex_detector.py tests/unit/test_web_research_disabled.py -v
```

结果：`16 passed`。

```bash
cd shadowlink-web
npx.cmd tsc -b
```

结果：TypeScript 类型检查通过。

### 未完全通过项

```bash
cd shadowlink-web
npm.cmd run build
```

当前 Vite 阶段失败于 `esbuild spawn EPERM`，TypeScript 阶段已通过。该问题更像 Windows 本机子进程权限 / 安全策略问题，不是当前新增代码类型错误。

---

## 8. 注意事项

- `git status` 中出现若干旧 `docs/*.md` 删除状态，这些不是本次主动删除，需要单独确认。
- `shadowlink-ai/.pytest-tmp/pytest-of-22641/` 曾出现权限残留，建议重启或手动删除。
- 当前后端持久化为 JSON，本阶段用于快速验证业务闭环；后续可迁移 SQLite / SQLAlchemy。
- 当前审阅草稿服务为确定性实现，后续应抽象为 Reviewer Provider，接外部 LLM API 或 Codex 专家模式。

---

## 9. 下一步建议

1. 抽象 `ReviewerProvider`。
2. 保留当前确定性实现为 `LocalHeuristicReviewerProvider`。
3. 预留 `ExternalLLMReviewerProvider`，后续接 OpenAI-compatible API、DeepSeek、硅基流动等。
4. 将 Codex CLI 作为 `CodeExpertReviewerProvider`，用于复杂本地代码项目深挖。
5. 将 Review 创建流程升级为：本地资料上下文 + Reviewer Provider + SSE 事件流。

---

## 10. 追加记录：2026-05-09 13:45:44 +08:00

### Reviewer Provider 继续扩展

- 在 `shadowlink-ai/app/interview/review_service.py` 中新增 `CodeExpertReviewerProvider`。
- 将 `code_expert` 注册到 `ReviewerProviderRegistry`。
- `code_expert` 当前为 Codex CLI 专家模式预留 Provider，不在同步 Review 创建接口中直接执行 Codex。
- 未传 `repo_path` 时，明确返回“未配置本地代码仓库路径”。
- 传入 `repo_path` 时，返回 Codex 专家模式已预留的说明，后续应通过异步任务 / SSE 执行只读代码分析。

### Review API 预留 repo_path

- 在 `shadowlink-ai/app/interview/schemas.py` 的 `CreateReviewRequest` 中新增 `repo_path`。
- 在 `shadowlink-ai/app/api/v1/interview_router.py` 中把 `repo_path` 作为 Provider context 传入 `InterviewReviewDraftService`。
- 保持 Review 创建流程不覆盖 `original_answer`。

### 前端 Provider 选择扩展

- 在 `shadowlink-web/src/components/interview/InterviewReviewPanel.tsx` 中新增 `Codex 代码专家 Reviewer（预留）` 选项。
- 当选择 `code_expert` 时，展示本地代码仓库路径输入框。
- 前端通过 `shadowlink-web/src/services/interview.ts` 将 `repo_path` 传给后端。

### 测试补充

- 在 `shadowlink-ai/tests/unit/test_interview_review_service.py` 中新增 Code Expert Provider 测试。
- 覆盖：缺少 `repo_path` 时明确提示、Registry 可选择 `code_expert`。

---

## 11. 追加记录：2026-05-09 13:52:21 +08:00

### external_agent_runs 运行记录骨架

- 在 `shadowlink-ai/app/interview/models.py` 中新增：
  - `ExternalAgentProvider`
  - `ExternalAgentRun`
- `ExternalAgentRun` 默认 provider 为 `codex_cli`，默认状态为 `queued`。
- 用于记录 Codex CLI / Claude Code 等外部代码专家 Agent 的运行状态。

### Repository 持久化扩展

- 在 `shadowlink-ai/app/interview/repository.py` 中新增 `external_agent_runs.json` 持久化。
- 新增方法：
  - `create_external_agent_run`
  - `list_external_agent_runs`
  - `update_external_agent_run`
- 当前只记录任务，不在同步接口中直接执行 Codex，避免阻塞普通 Review 请求。

### API 骨架

- 在 `shadowlink-ai/app/interview/schemas.py` 中新增：
  - `CreateExternalAgentRunRequest`
  - `ExternalAgentRunDetail`
- 在 `shadowlink-ai/app/api/v1/interview_router.py` 中新增：
  - `GET /v1/interview/spaces/{space_id}/sessions/{session_id}/external-runs`
  - `POST /v1/interview/spaces/{space_id}/sessions/{session_id}/external-runs`
- 接口会校验 Space 存在，并校验 Session 属于当前 Space。

### 测试补充

- `test_interview_models.py` 增加 external agent run 默认值测试。
- `test_interview_repository.py` 增加 external agent run 创建、查询、状态更新测试。
- `test_interview_api.py` 增加 external-runs API 创建和查询测试。

### 验证记录

```bash
cd shadowlink-ai
pytest tests/unit/test_interview_models.py tests/unit/test_interview_repository.py tests/unit/test_interview_api.py tests/unit/test_interview_review_service.py tests/unit/test_codex_detector.py tests/unit/test_web_research_disabled.py -v
```

结果：`24 passed, 1 warning`。

```bash
cd shadowlink-web
npx.cmd tsc -b
```

结果：通过，无 TypeScript 错误。

---

## 12. 追加记录：2026-05-09 14:19:39 +08:00

### 本轮目标

- 按要求将测试结果持续写入同一个 worklog 文件。
- 开始实现 external agent run 后台执行器骨架。
- 目标是让 `external_agent_runs` 具备从 `queued` 到 `running/completed/failed` 的状态推进能力。

---

## 13. 追加记录：2026-05-09 14:24:05 +08:00

### External Agent Run Executor

- 新增 `shadowlink-ai/app/interview/external_runner.py`。
- 实现 `ExternalAgentRunExecutor`。
- 执行流程：
  - 读取 `external_agent_runs` 中的 run。
  - 将状态更新为 `running`。
  - 调用 `CodexExpertAdapter.run_readonly(repo_path, prompt)`。
  - 收集 `codex_event` 的 raw 输出到 `output_summary`。
  - 遇到 `error` event 时将状态更新为 `failed` 并写入 `error_message`。
  - 正常结束时将状态更新为 `completed`。

### Repository 能力补充

- 在 `shadowlink-ai/app/interview/repository.py` 中新增 `get_external_agent_run`。
- `update_external_agent_run` 支持更新状态、输出摘要、错误信息。

### API 后台任务接入

- 在 `shadowlink-ai/app/api/v1/interview_router.py` 中为 `POST /external-runs` 接入 FastAPI `BackgroundTasks`。
- 创建 run 后立即返回 `queued` 记录。
- 后台任务调用 `ExternalAgentRunExecutor(repo).execute(run.run_id)`。
- API 测试中通过 monkeypatch 使用 noop executor，避免单测真实调用 Codex CLI。

### 测试补充

- 新增 `shadowlink-ai/tests/unit/test_external_agent_runner.py`。
- 覆盖：
  - fake Codex adapter 正常输出时 run 变为 `completed`。
  - fake Codex adapter 返回 error event 时 run 变为 `failed`。

### 验证记录

```bash
cd shadowlink-ai
pytest tests/unit/test_interview_models.py tests/unit/test_interview_repository.py tests/unit/test_interview_api.py tests/unit/test_interview_review_service.py tests/unit/test_external_agent_runner.py tests/unit/test_codex_detector.py tests/unit/test_web_research_disabled.py -v
```

结果：`26 passed, 1 warning`。

```bash
cd shadowlink-web
npx.cmd tsc -b
```

结果：通过，无 TypeScript 错误。

---

## 14. 追加记录：2026-05-09 14:31:57 +08:00

### 前端 external run 接入

- 在 `shadowlink-web/src/types/interview.ts` 中新增 `ExternalAgentRun` 类型。
- 在 `shadowlink-web/src/services/interview.ts` 中新增：
  - `listExternalRuns(spaceId, sessionId)`
  - `createExternalRun(spaceId, sessionId, repoPath, prompt)`
- 在 `shadowlink-web/src/components/interview/InterviewReviewPanel.tsx` 中接入 Codex 专家任务 UI。

### Codex 专家模式短轮询 UI

- 当 Reviewer Provider 选择 `code_expert` 时，显示本地代码仓库路径输入框。
- 新增“启动 Codex 任务”按钮。
- 点击后调用 `POST /external-runs` 创建后台任务。
- 前端保存 `externalRuns` 状态。
- 如果存在 `queued` 或 `running` 任务，每 2.5 秒短轮询 `GET /external-runs`。
- UI 展示：
  - run id
  - run status
  - repo path
  - output summary
  - error message

### 验证记录

```bash
cd shadowlink-web
npx.cmd tsc -b
```

结果：通过，无 TypeScript 错误。

```bash
cd shadowlink-ai
pytest tests/unit/test_interview_models.py tests/unit/test_interview_repository.py tests/unit/test_interview_api.py tests/unit/test_interview_review_service.py tests/unit/test_external_agent_runner.py tests/unit/test_codex_detector.py tests/unit/test_web_research_disabled.py -v
```

结果：`26 passed, 1 warning`。

---

## 15. 追加记录：2026-05-09 14:45:15 +08:00

### 工程整理：External Run 前端拆分

- 新增 `shadowlink-web/src/hooks/useExternalRuns.ts`。
- `useExternalRuns` 负责：
  - 加载当前 Space + Session 下的 external runs。
  - 创建 external run。
  - 对 `queued/running` 状态每 2.5 秒短轮询刷新。
  - 对外暴露 `externalRuns`、`refreshExternalRuns`、`createExternalRun`。
- 更新 `shadowlink-web/src/hooks/index.ts` 导出 `useExternalRuns`。

### 工程整理：ExternalRunPanel 组件

- 新增 `shadowlink-web/src/components/interview/ExternalRunPanel.tsx`。
- 组件负责展示：
  - run id
  - status
  - repo path
  - output summary
  - error message
  - 启动 Codex 任务按钮
- 更新 `shadowlink-web/src/components/interview/index.ts` 导出 `ExternalRunPanel`。

### InterviewReviewPanel 简化

- `InterviewReviewPanel` 不再直接维护 `externalRuns` state。
- `InterviewReviewPanel` 不再直接写短轮询 `setInterval`。
- Codex external run 的状态和展示逻辑移入 `useExternalRuns` 与 `ExternalRunPanel`。
- `InterviewReviewPanel` 继续负责审阅主流程：Session、原始回答、Review 创建、采纳/保留。

### 验证记录

```bash
cd shadowlink-web
npx.cmd tsc -b
```

结果：通过，无 TypeScript 错误。

```bash
cd shadowlink-ai
pytest tests/unit/test_interview_models.py tests/unit/test_interview_repository.py tests/unit/test_interview_api.py tests/unit/test_interview_review_service.py tests/unit/test_external_agent_runner.py tests/unit/test_codex_detector.py tests/unit/test_web_research_disabled.py -v
```

结果：`26 passed, 1 warning`。

---

## 16. 追加记录：2026-05-09 14:54:36 +08:00

### 阅读理解工作台后端 MVP

- 新增 `shadowlink-ai/app/interview/reading.py`。
- 实现 `split_reading_sentences(text)`。
- 实现 `SentenceExplanation`。
- 实现 `explain_sentence(sentence, article_title)` 占位解释。
- 当前解释为确定性占位，后续可接 LLM Reviewer 做真正语法拆解。

### 阅读 API

- 在 `shadowlink-ai/app/interview/schemas.py` 中新增：
  - `SplitReadingRequest`
  - `SplitReadingResponse`
  - `ExplainSentenceRequest`
- 在 `shadowlink-ai/app/api/v1/interview_router.py` 中新增：
  - `POST /v1/interview/reading/split`
  - `POST /v1/interview/reading/explain`

### 阅读工作台前端

- 在 `shadowlink-web/src/types/interview.ts` 中新增 `SentenceExplanation` 类型。
- 在 `shadowlink-web/src/services/interview.ts` 中新增：
  - `splitReading(text)`
  - `explainSentence(sentence, articleTitle)`
- 新增 `shadowlink-web/src/components/interview/ReadingWorkspace.tsx`。
- 更新 `shadowlink-web/src/components/interview/index.ts` 导出 `ReadingWorkspace`。
- 在 `shadowlink-web/src/pages/InterviewLearningPage.tsx` 中接入阅读理解工作台。

### 当前阅读工作台能力

- 粘贴日语文章 / 职场邮件。
- 设置文章标题。
- 调用后端切分句子。
- 点击句子后调用后端解释接口。
- 侧栏展示：
  - 当前句子
  - 语法拆解占位
  - 语境说明
  - 词汇提示
- 根据已点击句子数量显示阅读进度。

### 测试补充

- 新增 `shadowlink-ai/tests/unit/test_reading_workspace.py`。
- `test_interview_api.py` 增加 `test_reading_split_and_explain`。

### 验证记录

```bash
cd shadowlink-web
npx.cmd tsc -b
```

结果：通过，无 TypeScript 错误。

```bash
cd shadowlink-ai
pytest tests/unit/test_interview_models.py tests/unit/test_interview_repository.py tests/unit/test_interview_api.py tests/unit/test_interview_review_service.py tests/unit/test_external_agent_runner.py tests/unit/test_codex_detector.py tests/unit/test_web_research_disabled.py tests/unit/test_reading_workspace.py -v
```

结果：`29 passed, 1 warning`。

## 2026-05-09 15:08:03 +08:00

### 本轮目标
- 继续工程整理后的下一步：补齐阅读工作台的 Space 级阅读进度持久化。
- 保持现有框架增量扩充，不引入重型依赖。

### 后端改动
- 在 shadowlink-ai/app/interview/models.py 新增 ReadingProgress 领域模型。
- 在 shadowlink-ai/app/interview/repository.py 新增 eading_progress.json 本地 JSON 持久化。
- 新增 get_reading_progress(space_id, article_id)，按 space_id + article_id 隔离读取。
- 新增 update_reading_progress(progress)，保存已读进度、总句数、文章标题和难句列表。
- 在 shadowlink-ai/app/interview/schemas.py 新增 UpdateReadingProgressRequest。
- 在 shadowlink-ai/app/api/v1/interview_router.py 新增：
  - GET /v1/interview/spaces/{space_id}/reading/progress/{article_id}
  - PUT /v1/interview/spaces/{space_id}/reading/progress/{article_id}

### 前端改动
- 在 shadowlink-web/src/types/interview.ts 新增 ReadingProgress 类型。
- 在 shadowlink-web/src/services/interview.ts 新增：
  - getReadingProgress(spaceId, articleId)
  - updateReadingProgress(spaceId, articleId, progress)
- 重写 shadowlink-web/src/components/interview/ReadingWorkspace.tsx：
  - 接收 spaceId，未选择 Space 时提示先选择岗位空间。
  - 基于标题 + 正文生成稳定 rticleId。
  - 切分文章后加载/初始化阅读进度。
  - 点击句子后保存最大已读句子序号。
  - 支持标记/取消标记难句，难句按文章和 Space 持久化。
- 更新 shadowlink-web/src/pages/InterviewLearningPage.tsx，将 ctiveSpaceId 传入阅读工作台。

### TDD / 测试记录
- RED：运行 cd shadowlink-ai; pytest tests/unit/test_interview_models.py -v，因 ReadingProgress 未定义，收集时报 ImportError。
- RED：新增仓储测试后运行 cd shadowlink-ai; pytest tests/unit/test_interview_models.py tests/unit/test_interview_repository.py -v，因 InterviewRepository 缺少 update_reading_progress 失败。
- GREEN：实现模型和仓储后，同一命令通过：12 passed, 1 warning。
- RED：新增 API 测试后运行 cd shadowlink-ai; pytest tests/unit/test_interview_api.py -k reading_progress -v，因路由未实现返回 404。
- GREEN：实现 API 后，同一命令通过：1 passed, 7 deselected, 1 warning。
- 全量后端相关测试：cd shadowlink-ai; pytest tests/unit/test_interview_models.py tests/unit/test_interview_repository.py tests/unit/test_interview_api.py tests/unit/test_interview_review_service.py tests/unit/test_external_agent_runner.py tests/unit/test_codex_detector.py tests/unit/test_web_research_disabled.py tests/unit/test_reading_workspace.py -v，结果：32 passed, 1 warning。
- 前端类型检查：cd shadowlink-web; npx.cmd tsc -b，结果：通过，退出码 0。

### 注意事项
- 仍保留 LLM 外部 API 与网页搜索 Provider 的空挡，当前不强依赖付费 API。
- 阅读正文和句子原文当前不单独入库，只保存 rticleId、标题、进度和难句列表；后续如果要支持历史文章列表，需要新增 ArticleSource 模型。

## 2026-05-09 15:20:48 +08:00

### 本轮目标
- 根据 Review 结果先沉淀修复执行文档，再按文档逐项修复。
- 按用户要求，本轮不处理本地运行场景下的安全漏洞问题，只处理稳定性、数据一致性和前端体验问题。

### 新增文档
- 新增 docs/面试学习模块设计/阅读工作台Review修复执行文档.md。
- 文档明确不纳入本轮的事项：鉴权、Web 安全加固、复杂并发控制、完整文章正文持久化。
- 文档列出本轮修复项：文章 ID 稳定性、进度字段一致性、解释失败不阻断进度、Space 切换清空状态、前端错误提示。

### 后端修复
- ReadingProgress.completed_count 和 ReadingProgress.total_count 增加非负约束。
- ReadingProgress 增加模型级收敛：当 completed_count > total_count 时自动收敛到 	otal_count。
- UpdateReadingProgressRequest 使用 Field(default_factory=list) 定义 difficult_sentences，避免可变默认值写法。
- 新增回归测试：
  - 	est_reading_progress_clamps_completed_count_to_total_count
  - 	est_update_reading_progress_clamps_invalid_completed_count

### 前端修复
- ReadingWorkspace 在 spaceId 变化时清空文章 ID、句子、选中句、解释、进度和提示，避免显示上一个 Space 的状态。
- 文章 ID 生成加入时间戳和随机片段，降低本地使用时不同文章进度覆盖概率。
- 点击句子时调整为先保存阅读进度，再请求解释；解释失败不再阻断进度保存。
- 切分、解释、保存难句增加 	ry/catch 和 message 提示。
- 增加 usy 状态，异步操作期间显示“处理中...”并禁用相关按钮。

### TDD / 测试记录
- RED：运行 cd shadowlink-ai; pytest tests/unit/test_interview_models.py tests/unit/test_interview_repository.py -v，新增两个进度收敛测试失败，符合预期。
- GREEN：实现模型约束后，同一命令通过：14 passed, 1 warning。
- 后端文档指定测试：cd shadowlink-ai; pytest tests/unit/test_interview_models.py tests/unit/test_interview_repository.py tests/unit/test_interview_api.py tests/unit/test_reading_workspace.py -v，结果：24 passed, 1 warning。
- 前端类型检查：cd shadowlink-web; npx.cmd tsc -b，结果：通过，退出码 0。

### 后续建议
- 如果后续要支持历史文章列表，新增 ArticleSource 或 ReadingArticle 模型，由后端创建并返回 rticle_id。
- 如果后续从本地单用户变为多用户，再补鉴权、权限隔离和更严格的数据写入校验。

## 2026-05-09 16:10:00 +08:00

### 本轮目标
- 按 `阅读工作台Review修复执行文档.md` 继续核对并补齐修复方案。
- 在已有修复基础上补强回归测试、后端防御性收敛和前端错误边界。

### 后端补强
- 在 `tests/unit/test_interview_models.py` 新增 `test_reading_progress_default_difficult_sentences_are_isolated`，验证 `difficult_sentences` 默认列表不会跨实例共享。
- 在 `app/interview/repository.py` 的 `update_reading_progress` 内增加仓储层防御性收敛：保存前再次保证 `completed_count <= total_count`。
- 保留模型层 `ReadingProgress` 的非负约束和模型级收敛，形成请求层/模型层/仓储层的轻量一致性保护。

### 前端补强
- 在 `ReadingWorkspace.tsx` 中将 `articleId` 扩展为 `article-{timestamp}-{random}-{hash}` 格式，直接保留时间戳和随机片段，进一步降低本地文章进度覆盖概率。
- 在 `spaceId` 切换清空阅读状态时同步重置 `busy`，避免切换 Space 后残留“处理中...”状态。
- 将点击句子的保存进度与解释请求拆成两个 `try/catch`：进度保存失败显示保存错误；解释失败只提示解释错误，不影响已经保存的阅读进度。

### 验证记录
- 后端文档指定测试：`cd shadowlink-ai; pytest tests/unit/test_interview_models.py tests/unit/test_interview_repository.py tests/unit/test_interview_api.py tests/unit/test_reading_workspace.py -v`
- 结果：`25 passed, 1 warning`。
- 前端类型检查：`cd shadowlink-web; npx.cmd tsc -b`
- 结果：通过，退出码 `0`。

### 注意事项
- 本轮仍不引入完整文章正文持久化、鉴权、复杂并发控制或 Web 安全加固，保持本地轻量运行边界。
- 阅读工作台解释内容仍是确定性占位，后续如接 LLM Reviewer，需要在解释接口内替换 Provider 实现。

## 2026-05-09 16:45:00 +08:00

### 本轮目标
- 根据实际使用反馈，把面试学习从“手动粘贴回答审阅”调整为“系统先自动生成面试题”。
- 前端把面试练习入口做明显，避免用户保存岗位资料后不知道下一步。
- 支持上传 PDF / DOCX / TXT / MD 简历文件并解析填入 Resume 文本框。

### 后端改动
- 在 `app/interview/schemas.py` 新增 `InterviewQuestion`、`GenerateInterviewQuestionsRequest`、`GenerateInterviewQuestionsResponse` 和 `ParsedResumeResponse`。
- 在 `app/interview/review_service.py` 新增 `InterviewQuestionService`，基于当前 Space 的简历、JD、目标公司、目标岗位生成确定性面试题。
- 在 `app/api/v1/interview_router.py` 新增：
  - `POST /v1/interview/spaces/{space_id}/interview/questions`
  - `POST /v1/interview/spaces/{space_id}/profile/resume/parse`
- 简历解析复用现有 `FileProcessingPipeline`，支持 PDF、DOCX、TXT、Markdown。

### 前端改动
- 在 `SpaceProfilePanel` 中新增简历文件上传控件，上传解析后自动填入 Resume 文本框，用户确认后再点击“保存资料”。
- 在 `InterviewReviewPanel` 中把入口升级为醒目的“面试练习区：生成题目 → 回答 → 审阅”。
- 新增“生成面试题 / 重新生成”按钮，题目列表和当前作答题目卡片。
- 提交回答时会把当前面试题和用户回答一起保存进 Review，方便后续回看。
- 在 `InterviewLearningPage` 顶部增加 1/2/3 步操作提示：上传/粘贴资料 → 生成面试题 → 作答并审阅。

### 测试记录
- 新增 API 测试：`test_generate_interview_questions_from_profile`。
- 新增 API 测试：`test_parse_resume_txt_file`。
- 后端相关测试：`cd shadowlink-ai; pytest tests/unit/test_interview_models.py tests/unit/test_interview_repository.py tests/unit/test_interview_api.py tests/unit/test_reading_workspace.py -v`
- 结果：`27 passed, 1 warning`。
- 前端类型检查：`cd shadowlink-web; npx.cmd tsc -b`
- 结果：通过，退出码 `0`。

### 注意事项
- 当前自动出题仍是本地确定性实现，优先保证 MVP 可用；后续可替换为真实 LLM 出题 Provider。
- PDF / DOCX 解析依赖 `PyMuPDF` 和 `python-docx`，二者已在 `shadowlink-ai/pyproject.toml` 基础依赖中声明。

## 2026-05-09 17:05:00 +08:00

### 本轮目标
- 修正“自动生成面试题”能力：不再把本地模板当作智能能力，改为优先调用当前已配置的 OpenAI-compatible LLM API。
- 保留本地模板仅作为 LLM 未配置或调用失败时的降级兜底。

### 后端改动
- `InterviewQuestionService.generate_questions` 改为异步 LLM 优先流程。
- 通过 `app.core.dependencies.get_resource("llm_client")` 复用现有运行时 LLM Client。
- LLM Prompt 会传入当前 Space 的简历、JD、目标公司、目标岗位和备注，要求模型只返回 JSON 面试题列表。
- 增加 LLM JSON 解析逻辑，支持去除 Markdown code fence 后解析。
- `GenerateInterviewQuestionsResponse` 新增 `provider` 和 `message` 字段，用于告诉前端当前是 `llm` 还是 `local_fallback`。
- LLM 调用异常时返回本地 fallback 题目，并在 message 中说明降级原因。

### 前端改动
- `interviewApi.generateQuestions` 返回完整响应，不再只返回 questions 数组。
- 面试练习区显示题目来源：`LLM API` 或 `本地降级`。
- 生成题目后的提示信息使用后端 message，用户能看到是否真正走了 LLM。

### 测试记录
- 新增 `FakeQuestionLLMClient`，验证出题接口确实调用已配置 LLM Client。
- 新增/更新测试：`test_generate_interview_questions_uses_configured_llm`。
- 针对性测试：`cd shadowlink-ai; pytest tests/unit/test_interview_api.py -k "generate_interview_questions" -v`
- 结果：`2 passed, 9 deselected, 1 warning`。
- 后端相关测试：`cd shadowlink-ai; pytest tests/unit/test_interview_models.py tests/unit/test_interview_repository.py tests/unit/test_interview_api.py tests/unit/test_reading_workspace.py -v`
- 结果：`28 passed, 1 warning`。
- 前端类型检查：`cd shadowlink-web; npx.cmd tsc -b`
- 结果：通过，退出码 `0`。

### 使用说明
- 只要在设置页配置并启用 OpenAI-compatible Provider，点击“生成面试题”就会走 LLM。
- 如果前端显示“当前来源：本地降级”，说明 LLM Client 未配置、未初始化或 API 调用失败。

## 2026-05-09 17:20:00 +08:00

### 本轮目标
- 给面试学习模块增加“面试官 Skill”选择能力。
- 将 Skill 注入 LLM 出题 Prompt，让不同面试官风格生成不同问题。

### 后端改动
- `GenerateInterviewQuestionsRequest` 新增 `interviewer_skill` 字段，默认 `technical_interviewer`。
- `InterviewQuestionService.generate_questions` 新增 `interviewer_skill` 参数。
- LLM Prompt 中加入 Skill ID 和 Skill 要求。
- 当前内置 Skill：
  - `technical_interviewer`：技术面试官
  - `project_deep_dive`：项目深挖面试官
  - `system_design`：系统设计面试官
  - `hr_interviewer`：HR 面试官
  - `behavioral_interviewer`：行为面试官
- 本地 fallback 也会带上 Skill 标签，避免 LLM 不可用时完全丢失用户选择。

### 前端改动
- 面试题区域新增 Skill 下拉选择器。
- 点击“生成面试题 / 重新生成”时会把当前 Skill 一起传给后端。
- 可在同一份简历和 JD 下切换不同面试官 Skill 重新生成题目。

### 测试记录
- 更新 `FakeQuestionLLMClient`，断言 Prompt 中包含 `project_deep_dive` 和“连续深挖”。
- 针对性测试：`cd shadowlink-ai; pytest tests/unit/test_interview_api.py -k "generate_interview_questions" -v`
- 结果：`2 passed, 9 deselected, 1 warning`。
- 后端相关测试：`cd shadowlink-ai; pytest tests/unit/test_interview_models.py tests/unit/test_interview_repository.py tests/unit/test_interview_api.py tests/unit/test_reading_workspace.py -v`
- 结果：`28 passed, 1 warning`。
- 前端类型检查：`cd shadowlink-web; npx.cmd tsc -b`
- 结果：通过，退出码 `0`。

### 后续建议
- 下一步可把“回答审阅”也接入同一 Skill，让技术面试官/HR/项目深挖的批改风格保持一致。
- 也可以把 Skill 定义从代码常量迁移到 JSON 配置，方便用户自定义面试官。

## 2026-05-09 17:45:00 +08:00

### 本轮目标
- 为了扩展性，支持用户上传、创建、查看、删除自己的面试官 Skill。
- 自定义 Skill 保存后可直接出现在面试题生成区域的 Skill 下拉框中，并注入 LLM Prompt。

### 后端改动
- 新增 `InterviewSkill` 领域模型，字段包括 `skill_id`、`name`、`description`、`instruction`、`source`、时间戳。
- Repository 新增 `interview_skills.json` 本地持久化。
- Repository 新增：
  - `list_interview_skills`
  - `get_interview_skill`
  - `upsert_interview_skill`
  - `delete_interview_skill`
- Interview API 新增：
  - `GET /v1/interview/skills`
  - `POST /v1/interview/skills`
  - `PUT /v1/interview/skills/{skill_id}`
  - `DELETE /v1/interview/skills/{skill_id}`
  - `POST /v1/interview/skills/upload`
- 上传支持 JSON / TXT / MD。
- JSON 格式支持 `id` / `skill_id`、`name`、`description`、`instruction` / `prompt`。
- TXT / MD 会把全文作为 `instruction`，文件名作为 Skill 名称来源。
- LLM 出题时如果 `interviewer_skill` 命中自定义 Skill，会使用自定义 `name` 和 `instruction` 注入 Prompt。

### 前端改动
- 新增 `InterviewSkillManager` 组件。
- 支持上传 Skill 文件、手动创建 Skill、查看 Skill 列表、删除 Skill。
- `InterviewLearningPage` 接入 Skill 管理面板，并把自定义 Skill 传给 `InterviewReviewPanel`。
- `InterviewReviewPanel` 的 Skill 下拉框追加自定义 Skill 选项。
- 选择自定义 Skill 后生成题目，会把自定义 Skill ID 发给后端。

### Skill 文件示例
```json
{
  "id": "custom-ai-infra",
  "name": "AI Infra 面试官",
  "description": "严格追问 RAG、Agent 和系统设计",
  "instruction": "你是一个严格的 AI Infra 面试官。重点追问 RAG、Agent、FastAPI、系统设计、工程稳定性。每个问题都要追问真实贡献、指标、失败案例和替代方案。不要问泛泛的问题。"
}
```

### 测试记录
- 新增 Repository 测试：`test_upsert_and_delete_interview_skill`。
- 新增 API 测试：`test_upload_list_and_delete_interview_skill`。
- 针对性测试：`cd shadowlink-ai; pytest tests/unit/test_interview_repository.py tests/unit/test_interview_api.py -k "skill or generate_interview_questions" -v`
- 结果：`4 passed, 16 deselected, 1 warning`。
- 后端相关测试：`cd shadowlink-ai; pytest tests/unit/test_interview_models.py tests/unit/test_interview_repository.py tests/unit/test_interview_api.py tests/unit/test_reading_workspace.py -v`
- 结果：`30 passed, 1 warning`。
- 前端类型检查：`cd shadowlink-web; npx.cmd tsc -b`
- 结果：通过，退出码 `0`。

### 后续建议
- 下一步可把“回答审阅”和“追问生成”也接入同一个自定义 Skill。
- 后续可增加 Skill 导出、复制、禁用、版本号和按 Space 绑定默认 Skill。

## 2026-05-09 18:05:00 +08:00

### 问题背景
- 用户反馈面试题生成显示 DashScope `401 Unauthorized`，但 Chat 模式可以使用外接 API。
- 排查发现 Chat 模式会把前端当前选中的 `llm_config` 随请求传给后端，而面试题生成接口只使用后端全局 `llm_client`。
- 因此当后端全局 active provider 仍是旧的/无效的 DashScope key 时，面试题生成会 401；但 Chat 因为使用前端当前配置，所以可以正常工作。

### 修复方案
- `GenerateInterviewQuestionsRequest` 新增 `llm_config` 字段。
- 前端 `InterviewReviewPanel` 读取 `useSettingsStore` 当前 active LLM 配置。
- `interviewApi.generateQuestions` 调用时携带当前 `llm_config`。
- 后端新增 `build_request_llm_client`，如果请求携带 `llm_config`，创建一次性 OpenAI-compatible `LLMClient`，与 Chat 模式保持一致。
- 若请求没有携带 `llm_config`，仍回退使用后端全局 `llm_client`。

### 测试记录
- 新增测试：`test_generate_interview_questions_uses_request_llm_config`，验证接口使用请求级 `baseUrl`、`apiKey`、`model`。
- 针对性测试：`cd shadowlink-ai; pytest tests/unit/test_interview_api.py -k "request_llm_config or generate_interview_questions" -v`
- 结果：`3 passed, 10 deselected, 1 warning`。
- 后端相关测试：`cd shadowlink-ai; pytest tests/unit/test_interview_models.py tests/unit/test_interview_repository.py tests/unit/test_interview_api.py tests/unit/test_reading_workspace.py -v`
- 结果：`31 passed, 1 warning`。
- 前端类型检查：`cd shadowlink-web; npx.cmd tsc -b`
- 结果：通过，退出码 `0`。

## 2026-05-09 18:35:00 +08:00

### 本轮目标
- 将“保存并生成审阅草稿”接入 LLM，不再只使用本地启发式模板。
- 增加低开销 token 消耗统计，避免引入额外模型请求或重型 tokenizer。

### Token 统计方案
- 当前采用轻量估算：按文本长度近似估算 prompt/completion/total tokens。
- 不调用额外 API，不加载 tokenizer，不增加明显 CPU/内存开销。
- 统计结果标记 `estimated: true`，避免误认为是账单级精确值。
- 这套方案资源占用极低，可以保留；后续如需要精确账单统计，再读取模型 API 返回的 `usage` 字段或接 tokenizer。

### 后端改动
- `InterviewReview` 新增 `token_usage` 字段，用于保存审阅 token 估算。
- `CreateReviewRequest` 新增 `interviewer_skill` 和 `llm_config`，与出题链路一致。
- `InterviewReviewDraftService` 新增 `generate_llm_draft`：
  - 优先使用请求级 LLM Client 审阅回答。
  - Prompt 注入当前 Space 的简历、JD、目标岗位、目标公司、面试题、用户回答和面试官 Skill。
  - 要求 LLM 返回 JSON：`critique` 和 `suggested_answer`。
  - LLM 失败时降级本地模板，并在 critique 中说明降级原因。
- `estimate_token_usage` 负责低开销 token 估算。
- 创建 Review 时保存 `token_usage`。

### 前端改动
- 提交审阅时携带当前 active LLM 配置和当前面试官 Skill。
- Review 卡片中显示 Token 估算：总量、Prompt、Completion、来源。

### 测试记录
- 新增测试：`test_create_review_uses_request_llm_and_records_token_usage`。
- 更新旧占位测试为 `test_create_review_without_llm_config_falls_back_locally`。
- 针对性测试：`cd shadowlink-ai; pytest tests/unit/test_interview_api.py -k "create_review_uses_request_llm or create_session_and_review" -v`
- 结果：`2 passed, 12 deselected, 1 warning`。
- 后端相关测试：`cd shadowlink-ai; pytest tests/unit/test_interview_models.py tests/unit/test_interview_repository.py tests/unit/test_interview_api.py tests/unit/test_reading_workspace.py -v`
- 结果：`32 passed, 1 warning`。
- 前端类型检查：`cd shadowlink-web; npx.cmd tsc -b`
- 结果：通过，退出码 `0`。

### 后续建议
- 如果后续想做更精确的 token 账单统计，可以改造 `OpenAIProvider.chat` 返回原始 `usage`，优先使用 API 返回值，估算作为 fallback。

## 2026-05-09 19:05:00 +08:00

### 本轮目标
- 将 Interview 练习区重构成独立训练页式体验。
- 顶部展示悬浮题目卡片，下面分区显示“我的回答”和“AI 审阅”。
- 支持查看简历/JD、收藏题目、上一题/下一题、复习推荐。

### 前端改动
- 新增 `questionReviewState.ts`，使用 localStorage 保存题目收藏与复习状态。
- `InterviewReviewPanel` 重写为训练页布局：
  - 顶部操作区：查看简历、查看 JD、生成面试题。
  - 悬浮题目卡片：显示当前题、来源、复习提示、Skill 选择器。
  - 题目操作：上一题、下一题、收藏/取消收藏、标记已复习。
  - 主体分栏：左侧“我的回答”，右侧“AI 审阅”。
  - 侧边栏：题目列表、推荐复习、审阅 Provider。
  - 简历/JD 通过弹窗查看，避免占用训练主区域。
- `InterviewLearningPage` 调整顺序：面试训练区提前展示，资料与 Skill 管理改为可折叠区域。

### 复习推荐规则
- 收藏题目时记录 `favoritedAt`。
- 打开页面时按收藏时间计算间隔。
- 大于等于 1 天：建议复习。
- 大于等于 3 天：重点复习。
- 大于等于 7 天：必须复盘。
- 当前规则完全在前端 localStorage 计算，不增加后端资源开销。

### 验证记录
- 前端类型检查：`cd shadowlink-web; npx.cmd tsc -b`
- 结果：通过，退出码 `0`。

### 注意事项
- 收藏与复习状态当前是浏览器本地状态，不跨设备同步。
- 后续如果要跨设备/多用户同步，需要把题目状态迁移到后端持久化。

## 2026-05-09 19:25:00 +08:00

### 本轮目标
- 修正面试训练页题目卡片固定效果。
- 核对 Codex 代码专家模式当前是否真实可用。

### 前端修复
- 调整题目卡片 sticky 样式为 `top-4 z-30`，增强背景遮罩和阴影。
- 主训练区域改为 `minmax(0,1fr)`，左侧内容加 `min-w-0`，降低布局挤压导致 sticky 失效的概率。
- 前端类型检查通过：`cd shadowlink-web; npx.cmd tsc -b`，退出码 `0`。

### Codex 专家模式核对
- 后端已有真实执行链路：`ExternalAgentRunExecutor` 会调用 `CodexExpertAdapter.run_readonly`。
- Adapter 会检测本机 `codex.cmd` / `codex`，然后执行：
  - `codex exec --cd <repo_path> --sandbox read-only --ask-for-approval never --json <prompt>`
- 执行输出会进入 `external_agent_runs.json`，前端通过短轮询展示状态和 output_summary。
- 因此能力不是纯占位，但依赖本机 Codex CLI 已安装、已登录、命令参数兼容当前 Codex 版本。

### 限制
- 当前没有真正的实时 SSE，只是短轮询。
- 当前只读 sandbox，不会修改代码。
- 如果 Codex CLI 未安装/未登录/版本参数不兼容，会显示 failed 和 error_message。

## 2026-05-09 22:55:00 +08:00

### 本轮目标
- 按用户确认的成本优化方案，新增“代码库技术档案”能力。
- 让 Codex 只在新代码库或手动刷新时深度扫描，生成可复用技术文档。
- 在面试学习页提供可见入口，后续普通 LLM 可优先基于技术档案回答与审阅。

### 后端改动
- 新增 `app.codebase` 模块：
  - `CodebaseProfile`：记录代码库名称、路径、生成状态、最近索引时间和错误信息。
  - `CodebaseTechnicalDoc`：保存 Codex 生成的 Markdown 技术档案和结构化字段预留。
  - `CodebaseRepository`：使用 JSON 文件持久化 `profiles.json` 和 `technical_docs.json`。
  - `CodebaseProfileService`：调用现有 `CodexExpertAdapter.run_readonly` 生成详细代码库技术文档。
- 新增 `/v1/codebase` API：
  - `GET /profiles`：列出代码库档案。
  - `POST /profiles`：添加本地代码库。
  - `GET /profiles/{repo_id}`：查看代码库与技术文档详情。
  - `POST /profiles/{repo_id}/generate`：后台触发 Codex 生成/刷新技术档案。
- 在 `app/main.py` 注册 `codebase_router`。

### 前端改动
- 新增 `src/types/codebase.ts`，定义代码库档案相关类型。
- 新增 `src/services/codebase.ts`，封装 `/v1/codebase` 请求。
- 新增 `CodebaseProfilePanel`：
  - 支持输入代码库名称和本地仓库路径。
  - 支持添加代码库、选择档案、生成/刷新技术文档。
  - 支持轮询生成状态，并在面板内滚动查看 Markdown 技术档案。
- 在 `InterviewLearningPage` 的“资料与 Skill 配置”折叠区加入“代码库技术档案”入口。

### 验证记录
- 后端新增测试：`cd shadowlink-ai; pytest tests/unit/test_codebase_repository.py tests/unit/test_codebase_api.py -v`
- 结果：`3 passed, 1 warning`，退出码 `0`。
- 前端类型检查：`cd shadowlink-web; npx.cmd tsc -b`
- 结果：通过，退出码 `0`。

### 当前限制与后续方向
- 当前已完成“Codex 一次性生成技术档案 + 前端查看/刷新”的 MVP。
- 下一步可把选中的代码库技术档案注入面试题生成和 AI 审阅 prompt，让普通 LLM 优先基于档案回答。
- 更进一步可做“普通 LLM 判断信息不足 -> 再调用 Codex 定向查询链路”的按需专家升级机制。

## 2026-05-09 23:20:00 +08:00

### 本轮目标
- 将“代码库技术档案”真正接入普通 LLM 的面试题生成和 AI 审阅。
- 避免 Codex 每次都重新扫代码：Codex 只负责生成/刷新档案，普通 LLM 日常读取档案上下文。

### 后端改动
- `GenerateInterviewQuestionsRequest` 和 `CreateReviewRequest` 新增 `codebase_repo_id` 字段。
- `interview_router` 新增 `get_codebase_repo()` 与 `get_codebase_context()`：
  - 当请求带 `codebase_repo_id` 时，从 `/data/codebase/technical_docs.json` 读取对应 Markdown 档案。
  - 找不到或未选择时自动传空上下文，不影响原流程。
- `InterviewQuestionService.generate_questions()` 新增 `codebase_context` 参数。
- `InterviewReviewDraftService.generate_llm_draft()` 新增 `codebase_context` 参数。
- 出题 prompt 与审阅 prompt 均新增“代码库技术档案”段落，最多截取 8000 字符，控制 token 成本。

### 前端改动
- `interviewApi.generateQuestions()` 与 `interviewApi.createReview()` 支持传 `codebaseRepoId`。
- `InterviewReviewPanel` 启动时加载 `/v1/codebase/profiles`。
- 面试训练页右侧新增“代码库技术档案”选择器：
  - 默认优先选择第一个已完成档案。
  - 未完成档案置灰，不参与普通 LLM 上下文。
  - 选择后，生成面试题和提交 AI 审阅都会带上该档案 ID。

### 验证记录
- 后端相关测试：`cd shadowlink-ai; pytest tests/unit/test_interview_api.py tests/unit/test_codebase_repository.py tests/unit/test_codebase_api.py -v`
- 结果：`19 passed, 1 warning`，退出码 `0`。
- 前端类型检查：`cd shadowlink-web; npx.cmd tsc -b`
- 结果：通过，退出码 `0`。

### 当前效果
- 用户先用 Codex 生成代码库技术档案。
- 面试训练页选择该档案。
- 后续“生成面试题”和“AI 审阅”走普通 LLM，但 prompt 会携带技术档案，因此能结合真实代码库架构、模块、技术亮点回答。

### 后续可扩展
- 增加“普通 LLM 判断档案不足 -> 触发 Codex 定向查询”的升级链路。
- 将 Markdown 技术档案拆成 chunk 并建立检索索引，减少每次 prompt 直接塞 8000 字的 token 成本。

## 2026-05-09 23:45:00 +08:00

### 本轮目标
- 仅做设计，不改实现代码。
- 调研 GraphRAG 成熟框架，并为 ShadowLink 设计 RAG/GraphRAG 扩展路线。

### 调研结论
- Microsoft GraphRAG：适合离线索引、community reports、Global/Local/DRIFT Search，方法论完整，但索引成本和工程复杂度较高，适合作为高级可选能力。
- Neo4j GraphRAG Python：官方一方包，适合长期图数据库、路径查询、生产级知识图谱，但需要引入 Neo4j 服务，放到中后期更稳。
- LlamaIndex PropertyGraphIndex：更轻量，适合在 ShadowLink 本地优先路线中先验证技术档案实体关系图。
- LangChain + Neo4j：适合作为编排层和后期灵活组合，不建议第一阶段自研完整 GraphRAG。

### 设计文档
- 新增 `docs/面试学习模块设计/RAG与GraphRAG扩展设计方案.md`。
- 方案核心路线：
  1. Phase 1：先把 Codebase Technical Doc RAG 化，用 top_k 相关片段替代固定塞 8000 字上下文。
  2. Phase 2：轻量 Property Graph，对技术档案抽取实体/关系，支持链路型问题。
  3. Phase 3：Neo4j / Microsoft GraphRAG 作为可选增强，处理多代码库、全局总结和长期图谱。

### 当前建议
- 下一步优先实现 Phase 1：技术档案 chunk 化并接入现有 Hybrid RAG。
- GraphRAG 不应第一步引入重依赖，先用轻量本地 store 验证收益。
