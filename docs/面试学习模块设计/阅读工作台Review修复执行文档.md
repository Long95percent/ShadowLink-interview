# 阅读工作台 Review 修复执行文档

## 背景

本轮审查对象是面试学习模块中的阅读工作台进度持久化能力。项目当前定位为本地轻量运行，因此本阶段不处理安全漏洞、鉴权、恶意输入攻击防护等问题，只处理会影响本地使用稳定性、数据一致性和用户体验的问题。

## 不纳入本轮的问题

- 不做登录鉴权、跨用户隔离和权限模型。
- 不做 Web 安全加固。
- 不引入数据库锁、队列或复杂并发控制。
- 不保存完整文章正文；后续如需要历史文章列表，再新增 ArticleSource 模型。

## 本轮需要修复的问题

### 1. 文章 ID 生成不够稳

当前 `articleId` 由前端 32-bit hash 生成，长期使用可能出现碰撞。虽然本地风险较低，但会导致两个不同文章共享进度。

修复方案：
- 前端生成 `articleId` 时加入时间戳和随机片段，避免覆盖。
- 同一篇已切分文章在当前组件状态内保持原 `articleId`。
- 后续如果增加历史文章列表，再改为后端创建文章并返回 `articleId`。

验收：
- 新切分文章生成不易碰撞的 ID。
- 已切分文章点击句子时继续使用当前 `articleId`。

### 2. 阅读进度字段缺少基础一致性保护

当前 `completed_count` 和 `total_count` 没有非负和上限关系约束，可能因前端状态错误写入不合理进度。

修复方案：
- 后端模型/请求层增加基础约束：`completed_count >= 0`、`total_count >= 0`。
- 保存前将 `completed_count` 收敛到 `total_count` 以内。
- `difficult_sentences` 使用 `Field(default_factory=list)`，避免可变默认值写法。

验收：
- `completed_count > total_count` 保存后会被收敛。
- 默认难句列表不共享。

### 3. 解释失败会阻断进度保存

当前点击句子时先调用解释接口，再保存阅读进度；如果解释失败，已读进度不会保存。

修复方案：
- 点击句子后先保存进度，再请求解释。
- 解释失败只展示错误提示，不回滚已读进度。

验收：
- 解释失败时进度仍保存。
- 前端有明确错误提示。

### 4. 切换 Space 后组件状态未重置

当前切换岗位 Space 后阅读工作台仍保留上一个 Space 的句子、解释和进度，容易误解。

修复方案：
- `spaceId` 变化时清空 `articleId`、句子、选中句、解释、进度和提示。
- 保留输入框正文与标题，方便用户切换后重新切分。

验收：
- 切换 Space 后不再显示上一个 Space 的进度和难句。

### 5. 前端异步操作缺少错误提示

当前切分、读取进度、保存进度、解释句子失败时缺少统一错误提示。

修复方案：
- 为阅读工作台增加简单 loading 状态和错误提示。
- 异步失败时设置 message，不让异常直接打断 UI。

验收：
- API 失败时页面显示可理解提示。
- TypeScript 编译通过。

## 执行顺序

1. 先补后端测试：进度收敛、默认难句列表隔离。
2. 实现后端模型和仓储收敛逻辑。
3. 补前端状态逻辑：Space 切换清空、点击先存进度再解释、错误提示。
4. 运行后端相关测试和前端 `tsc -b`。
5. 将执行过程和测试结果追加到 `worklog-5-9.md`。

## 测试命令

```bash
cd shadowlink-ai
pytest tests/unit/test_interview_models.py tests/unit/test_interview_repository.py tests/unit/test_interview_api.py tests/unit/test_reading_workspace.py -v
```

```bash
cd shadowlink-web
npx.cmd tsc -b
```
