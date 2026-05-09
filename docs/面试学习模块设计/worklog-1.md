# worklog-1

记录时间：2026-05-09
项目目录：`D:\github_desktop\ShadowLink`

## 会话总览

本轮围绕 ShadowLink 的“面试学习模块 / 阅读工作台”持续增量开发。核心原则是不推倒现有框架，在已存在工程架构上逐步扩充代码、文档、测试和本地持久化能力。

用户明确要求：

- 所有进展持续写入 worklog。
- 每轮执行都要记录测试结果。
- 本地轻量运行优先。
- 当前不优先处理安全漏洞、鉴权、跨用户安全隔离。
- 后续外部 LLM API、网页搜索能力、Agent 能力都先保留扩展口。

## 技术方向

已确认的技术选型方向：

- 前后端基于 HTTP。
- 前端与后端通信采用短轮询 + SSE，不采用 WebSocket。
- 多 Space / 多 Session 隔离。
- 不同岗位学习需要分别上传简历和岗位 JD，因此后端数据模型需要围绕 Space/Profile/Session 隔离。
- LLM 外部 API 当前先预留，不强依赖购买。
- Codex CLI 作为专家模式，默认只读，不阻塞普通 Review 流程。
- 网页搜索能力先预留 Provider，当前不做本地爬取实现。
- Agent 框架推荐 LangChain，但当前先做轻量接口和 Provider 抽象。

## 已新增/更新文档

- `docs/面试学习模块设计/技术选型方案.md`
- `docs/面试学习模块设计/执行方案.md`
- `docs/面试学习模块设计/worklog-5-9.md`
- `docs/面试学习模块设计/阅读工作台Review修复执行文档.md`

其中 `worklog-5-9.md` 已持续记录多轮执行过程、测试命令和结果。

## 后端实现概览

主要目录：`shadowlink-ai/app/interview/`

已实现文件：

- `models.py`
- `schemas.py`
- `repository.py`
- `review_service.py`
- `external_runner.py`
- `reading.py`

已挂载 API：

- `shadowlink-ai/app/api/v1/interview_router.py`
- `shadowlink-ai/app/api/v1/integrations_router.py`
- `shadowlink-ai/app/main.py`

### 领域模型

已实现模型：

- `SpaceType`
- `ReviewStatus`
- `TaskStatus`
- `SessionMode`
- `ExternalAgentProvider`
- `JobSpace`
- `SpaceProfile`
- `InterviewSession`
- `InterviewReview`
- `ExternalAgentRun`
- `ReadingProgress`

`ReadingProgress` 当前字段：

- `space_id`
- `article_id`
- `article_title`
- `completed_count`
- `total_count`
- `difficult_sentences`
- `updated_at`

最新修复：

- `completed_count` 和 `total_count` 增加非负约束。
- 如果 `completed_count > total_count`，模型自动收敛为 `total_count`。

### 本地仓储

仓储文件：`shadowlink-ai/app/interview/repository.py`

当前采用 JSON 本地持久化，数据文件包括：

- `spaces.json`
- `profiles.json`
- `sessions.json`
- `reviews.json`
- `external_agent_runs.json`
- `reading_progress.json`

已实现仓储能力：

- Space 创建/列表。
- Profile 获取/更新。
- Session 创建/列表。
- Review 创建/列表/状态更新。
- ExternalAgentRun 创建/列表/获取/状态更新。
- ReadingProgress 获取/更新。

阅读进度按 `space_id + article_id` 隔离。

### API 能力

已实现路由：

- `GET /v1/interview/spaces`
- `POST /v1/interview/spaces`
- `PUT /v1/interview/spaces/{space_id}/profile`
- `GET /v1/interview/spaces/{space_id}/sessions`
- `POST /v1/interview/spaces/{space_id}/sessions`
- `GET /v1/interview/spaces/{space_id}/sessions/{session_id}/reviews`
- `POST /v1/interview/spaces/{space_id}/sessions/{session_id}/reviews`
- `PUT /v1/interview/reviews/{review_id}/status`
- `GET /v1/interview/spaces/{space_id}/sessions/{session_id}/external-runs`
- `POST /v1/interview/spaces/{space_id}/sessions/{session_id}/external-runs`
- `POST /v1/interview/reading/split`
- `POST /v1/interview/reading/explain`
- `GET /v1/interview/spaces/{space_id}/reading/progress/{article_id}`
- `PUT /v1/interview/spaces/{space_id}/reading/progress/{article_id}`

## Reviewer Provider

文件：`shadowlink-ai/app/interview/review_service.py`

已实现：

- `ReviewerProvider`
- `LocalHeuristicReviewerProvider`
- `ExternalLLMReviewerProvider`
- `CodeExpertReviewerProvider`
- `ReviewerProviderRegistry`
- `InterviewReviewDraftService`

行为：

- `local_heuristic` 基于 Resume/JD 生成确定性建议。
- `external_llm` 当前返回“未配置”的占位提示。
- `code_expert` 当前返回 repo_path 缺失或 Codex reserved message。
- Review 创建不会覆盖用户原始答案 `original_answer`。

## Codex CLI 集成

相关文件：

- `shadowlink-ai/app/integrations/codex/detector.py`
- `shadowlink-ai/app/integrations/codex/adapter.py`
- `shadowlink-ai/app/integrations/codex/schemas.py`
- `shadowlink-ai/app/api/v1/integrations_router.py`

已实现路由：

- `GET /v1/integrations/codex/status`

行为：

- Windows 下优先检测 `codex.cmd`。
- 专家模式使用只读方式运行 Codex：
  - `codex exec`
  - `--cd <repo_path>`
  - `--sandbox read-only`
  - `--ask-for-approval never`
  - `--json`
- `ExternalAgentRunExecutor` 后台执行并更新 run 状态。

## Web Research 预留

相关目录：`shadowlink-ai/app/integrations/web_research/`

当前实现：

- Disabled Provider placeholder。
- 明确提示网页搜索未启用。
- 不假装搜索。
- 后续可接入具备网页搜索能力的大模型 API 或独立搜索 Provider。

## Reading MVP

文件：`shadowlink-ai/app/interview/reading.py`

已实现：

- `split_reading_sentences(text)`
- `SentenceExplanation`
- `explain_sentence(sentence, article_title)` placeholder

已接入 API：

- `POST /v1/interview/reading/split`
- `POST /v1/interview/reading/explain`

## 前端实现概览

主要文件：

- `shadowlink-web/src/types/interview.ts`
- `shadowlink-web/src/services/interview.ts`
- `shadowlink-web/src/stores/interview-store.ts`
- `shadowlink-web/src/pages/InterviewLearningPage.tsx`
- `shadowlink-web/src/components/interview/JobSpaceSwitcher.tsx`
- `shadowlink-web/src/components/interview/SpaceProfilePanel.tsx`
- `shadowlink-web/src/components/interview/InterviewReviewPanel.tsx`
- `shadowlink-web/src/components/interview/ExternalRunPanel.tsx`
- `shadowlink-web/src/components/interview/ExpertModePanel.tsx`
- `shadowlink-web/src/components/interview/ReadingWorkspace.tsx`
- `shadowlink-web/src/hooks/useExternalRuns.ts`

路由：

- `shadowlink-web/src/App.tsx` 已添加 `/interview`。
- `TopBar.tsx` 已添加 Interview 和 Chat 链接。

### ReadingWorkspace 当前能力

文件：`shadowlink-web/src/components/interview/ReadingWorkspace.tsx`

当前能力：

- 接收 `spaceId`。
- 未选择 Space 时提示先选择岗位空间。
- 粘贴文章并切分句子。
- 基于当前文章生成 `articleId`。
- 加载或初始化阅读进度。
- 点击句子后保存最大已读进度。
- 请求句子解释。
- 标记/取消标记难句。
- `spaceId` 变化时清空旧文章进度、句子、选中句、解释和提示。
- 异步操作期间显示“处理中...”。
- 异步失败时展示错误提示。

最新修复：

- 点击句子时先保存进度，再请求解释，避免解释失败阻断进度保存。
- 文章 ID 生成加入时间戳和随机片段，降低本地碰撞概率。
- 增加 `busy` 状态，避免快速重复操作造成体验混乱。

## Review 修复执行

用户要求先审查是否有漏洞。审查结论：

- 当前是本地运行，安全漏洞暂不处理。
- 优先修复稳定性、数据一致性和前端体验问题。

已新增文档：

- `docs/面试学习模块设计/阅读工作台Review修复执行文档.md`

文档明确不纳入本轮：

- 登录鉴权。
- Web 安全加固。
- 复杂并发控制。
- 完整文章正文持久化。

已修复问题：

- 阅读进度字段基础一致性。
- 前端 Space 切换状态重置。
- 解释失败不阻断进度保存。
- 前端错误提示。
- 难句列表默认值写法。

## 测试记录

最近一次后端指定测试：

```powershell
cd shadowlink-ai
pytest tests/unit/test_interview_models.py tests/unit/test_interview_repository.py tests/unit/test_interview_api.py tests/unit/test_reading_workspace.py -v
```

结果：

- `24 passed, 1 warning`

最近一次前端类型检查：

```powershell
cd shadowlink-web
npx.cmd tsc -b
```

结果：

- 通过，退出码 0。

此前后端更完整测试也通过过：

```powershell
cd shadowlink-ai
pytest tests/unit/test_interview_models.py tests/unit/test_interview_repository.py tests/unit/test_interview_api.py tests/unit/test_interview_review_service.py tests/unit/test_external_agent_runner.py tests/unit/test_codex_detector.py tests/unit/test_web_research_disabled.py tests/unit/test_reading_workspace.py -v
```

结果：

- `32 passed, 1 warning`

## 当前注意事项

- Windows 下建议使用 `npm.cmd` / `npx.cmd`，避免 PowerShell ExecutionPolicy 拦截 `npm.ps1`。
- `codex.cmd` 可用，`codex.ps1` 可能被 ExecutionPolicy 拦截。
- `npm.cmd run build` 曾在 Vite/esbuild 阶段因 `spawn EPERM` 失败，但 `npx.cmd tsc -b` 通过。
- `worklog-5-9.md` 最新段落中有少量 Markdown 反引号被 PowerShell here-string 转义成反斜杠，可后续修正文档格式。
- 当前仓库中存在一些此前已有的 docs 删除项，不要贸然处理，除非用户明确要求。

## 后续建议

优先级建议：

1. 修正 `worklog-5-9.md` 中最新几处 Markdown 格式问题。
2. 删除未使用的 `ReadingProgressDetail`。
3. 统一前端中文乱码文案。
4. 将 `ReadingWorkspace` 的进度逻辑抽成 `useReadingProgress`。
5. 如需支持历史文章列表，新增 `ReadingArticle` / `ArticleSource` 模型，由后端创建并返回 `article_id`。
6. 后续从本地单用户扩展到多用户时，再补鉴权、权限隔离和更严格的数据写入校验。
