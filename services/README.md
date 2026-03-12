# DeepScholar Services

这里放的是 `DeepScholar-Claw` 新增的科研服务层骨架。

定位：

- `src/` 提供轻量 CLI 作为控制面与人机入口（命令行先跑通闭环）。
- `services/` 负责真正的科研重逻辑：流程编排、文献情报、实验执行、论文打包、评审、审计等。
- 服务之间共享的结构化数据模型不直接散落在各自目录里，而是统一放到 `packages/deepscholar-contracts/`。

当前规划：

- `orchestrator/`：流程推进、阶段门控、审批暂停/恢复。
- `paper-intel/`：文献采集、知识图谱、证据检索。
- `runner/`：实验任务提交、状态查询、失败分型。
- `provenance/`：结论-证据账本、审计与可追溯性。
 - `writing/`：论文包落盘、LaTeX 渲染/编译。
 - `review/`：模拟同行评审与裁决汇总。

后续扩展：

- `reviewer/`：模拟同行评审。
- `notifier/`：消息播报与审批通知。
