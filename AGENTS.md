# DeepScholar-Claw — Agent Working Agreement

本文件约束整个仓库范围内的协作与编码风格。

## 语言与沟通

- 默认使用中文回复（除非用户明确要求其他语言）。
- 完成工作后的说明要“生动、具体、讲效果”：先讲用户能感受到的变化，再附带少量必要的文件路径/实现点。避免堆一串生硬英文名或晦涩函数名。
- 最终答复结尾不要追加“后续增强建议/下一步可以做什么”一类内容（除非用户明确要求规划/列计划）。

## Debug-First（不吞错）

- 不允许为了“看起来能跑”引入静默兜底、假成功路径、吞异常或隐藏失败原因。
- 失败要显式暴露：报错信息清晰、日志可追溯、必要时新增单测把坑钉死。

## 工程质量硬约束

- 函数长度 <= 50 行（不含空行）；超过立刻拆分 helper。
- 单文件 <= 300 行；超过按职责拆分。
- 逻辑嵌套深度 <= 3；用 guard clause/early return 拉平。
- 位置参数 <= 3；更多用 options 对象。
- 禁止魔法数字：抽成常量并命名。
- 依赖注入优先：业务逻辑不直接 new 具体实现，外层注入接口/工厂。
- 不可变优先：不修改入参；返回新对象；优先 `readonly`。

## 安全基线

- 不在代码里硬编码任何密钥、token、账号密码。
- 所有外部输入（CLI 参数、文件内容、API 响应）都要在边界处校验。

## 测试与验收

- 优先补单测，让回归成本可控。
- 后端单测跑不完时，要给出可执行的“定向闸门命令”作为验收口径。
- 跑测试时给 60 秒硬超时，避免卡住：

```bash
perl -e 'alarm 60; exec @ARGV' pnpm test
```

## 仓库结构约定（DeepScholar 最小工程）

- `packages/deepscholar-contracts/`：共享契约与运行时校验（系统的“制度底座”）
- `services/*/`：科研重逻辑服务（编排/runner/写作/评审/情报/证据）
- `src/`：轻量 CLI 控制面（命令行先跑通闭环）
- `docs/DeepScholar-Claw-development/`：项目开发文档与阶段计划（所有工作记录写这里）

## 常用命令

- 安装依赖：`pnpm install`
- 类型检查（build）：`pnpm build`
- 单测：`pnpm test`
- 运行 CLI（开发态）：`pnpm deepscholar -- research status --project-id p1 --home /tmp/ds`

## 长时任务（Taskmaster）

当用户明确这是“长时间/大工作量/持续推进”的任务时，使用 `taskmaster`（FULL）在 `.codex-tasks/` 下建立：

- `SPEC.md`（冻结目标与约束）
- `TODO.csv`（每步都有验收命令）
- `PROGRESS.md`（决策与问题审计）

