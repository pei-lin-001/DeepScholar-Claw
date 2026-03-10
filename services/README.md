# DeepScholar Services

这里放的是 `DeepScholar-Claw` 新增的科研服务层骨架。

定位：

- `openclaw/` 这一整套现有代码继续做控制面和人机入口。
- `services/` 负责真正的科研重逻辑：流程编排、文献情报、实验执行、证据核验等。
- 服务之间共享的结构化数据模型不直接散落在各自目录里，而是统一放到 `packages/deepscholar-contracts/`。

当前规划：

- `orchestrator/`：流程推进、阶段门控、审批暂停/恢复。
- `paper-intel/`：文献采集、知识图谱、证据检索。
- `runner/`：实验任务提交、状态查询、失败分型。
- `provenance/`：结论-证据账本、审计与可追溯性。

后续扩展：

- `reviewer/`：模拟同行评审。
- `notifier/`：消息播报与审批通知。
