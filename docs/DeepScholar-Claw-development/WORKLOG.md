# DeepScholar-Claw Worklog

## 2026-03-11

### 已完成

- 建立 `services/` 层并纳入 workspace。
- 建立 `packages/deepscholar-contracts/` 作为共享契约层。
- 建立四个核心服务骨架：
  - orchestrator
  - paper-intel
  - runner
  - provenance
- 为各服务写清“负责什么 / 不负责什么”。
- 修正服务入口默认打印副作用，避免后续服务日志被动污染。
- 为共享契约补齐核心对象与校验函数：
  - 项目章程
  - 研究计划
  - 实验规格
  - 结论账本
- 为服务层补齐第一批真正工作的基础规则：
  - 阶段状态机
  - 预算门控
  - 失败分型
  - 结论账本汇总
- 把 `packages/` 和 `services/` 纳入 Vitest 测试视野。
- 跑通第二轮定向测试：7 个测试文件、13 条测试全部通过。

### 新增交付（Phase 2 开始：计划冻结 + 证据账本升级）

- 把“研究计划”从一张松散清单升级为可冻结、可审批、可校验的结构化对象：
  - 计划草案（ResearchPlanDraft）用于承载假设、成功阈值、baseline、数据集、评估指标、预算 envelope、停止规则。
  - 冻结计划（ResearchPlan）携带 `frozenAt/approvedBy/approvedAt`，为后续“不能见数据改故事”提供制度底座。
- 把“结论账本”从“只写一句话+一个指标”升级为 Claim-Evidence Ledger：
  - 结论（Claim）包含多个断言（Assertion），每个断言都必须绑定到证据（EvidenceBinding）。
  - 证据明确记录：runGroup、metric、values、seedCount、可选 CI/p-value、以及对比型断言的 baselineComparison。
  - 审计状态从 boolean 变为更贴近真实流程的 `draft/verified/disputed`，并要求 verified 断言必须带签名人与签名时间。
- Provenance 服务的账本汇总不再只会“数个数”：
  - 现在能输出断言级别的审计状态分布（verified/draft/disputed）。
  - 还能标出证据缺口（比如强断言缺少统计支撑、对比断言缺 baselineComparison 等），用于后续在编排层做硬门控。

### 本轮验证

- contracts 与 provenance 的定向单测保持在 60 秒内通过（使用 `perl -e 'alarm 60; ...'` 约束）。

### 当前判断

- 项目最重要的第一步不是做功能堆砌，而是把控制面和科研重逻辑切开。
- 现在的骨架已经让后续开发可以按服务边界推进，而不是继续在大仓库里到处散点开工。
- 第二轮之后，项目已经不只是“搭好了空车间”，而是给几条最关键的制度上了锁：
  - 研究阶段不能乱跳
  - 大额/高风险资源会被门控拦下
  - 失败不再是一锅粥，而是开始分型
  - 论文结论有没有盖章，系统已经能数得出来

### 清理审计

- 已检查当前仓库是否存在可以立即删除的 repo 追踪冗余文件。
- 结论：本轮暂未发现“当前证据足以证明冗余且删除不会伤及控制面复用”的上游源码/文档。
- 当前只保留“保守清理”策略：先建立替代结构，再按功能替换结果做定点裁剪。
