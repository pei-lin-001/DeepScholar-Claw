# DeepScholar-Claw Architecture

## 1. 项目定位

DeepScholar-Claw 不是对 OpenClaw 的一次零散二改，而是在 OpenClaw 之上搭一条面向深度学习科研闭环的“生产线”。

它的基本分工是：

- OpenClaw 继续做控制面和人机入口。
- DeepScholar 新增的服务层负责科研主流程、文献情报、实验执行和证据核验。
- 共享契约层负责让这些服务使用同一套结构化对象。

## 2. 分层原则

### 控制面

现有 OpenClaw 代码继续承担：

- 消息入口
- 常驻 agent 运行时
- skills / plugins
- cron / heartbeat / Lobster
- 审批消息和状态播报

### 科研服务层

`services/` 负责真正的重业务逻辑：

- `orchestrator/`
  研究阶段推进、审批暂停/恢复、任务编排
- `paper-intel/`
  文献抓取、知识图谱、证据卡片
- `runner/`
  实验提交、冒烟验证、作业状态、失败分型
- `provenance/`
  结论-证据账本、图表来源、审计状态

### 共享契约层

`packages/deepscholar-contracts/` 统一定义：

- 项目章程
- 研究计划
- 实验规格
- 结论账本
- 服务描述模型

## 3. 当前目录约定

```text
docs/DeepScholar-Claw-development/
  README.md
  DEEPSCHOLAR_DEVELOPMENT_SPEC.md
  ChatGPT初次建议.md
  ARCHITECTURE.md
  PHASE_1_PLAN.md
  WORKLOG.md

packages/
  deepscholar-contracts/

services/
  orchestrator/
  paper-intel/
  runner/
  provenance/
```

## 4. 这一版骨架解决了什么问题

在这次整理之前，仓库里只有“大的方向图纸”，还没有真正能支撑开发推进的“施工分区”。

现在解决的是三个基础问题：

1. 把控制面和科研重逻辑分开，避免以后越改越糊。
2. 给核心服务先立清职责牌子，避免不同模块互相抢活。
3. 先统一数据结构语言，防止后面服务间接口各说各话。

## 5. 第一阶段不做什么

当前骨架阶段明确不做：

- 不接真实学术 API
- 不接真实数据库或对象存储
- 不接真实 GPU 平台
- 不直接实现完整研究流水线
- 不大规模裁剪 OpenClaw 上游核心代码

## 6. 已落地的控制面桥接方式

当前已经通过 OpenClaw CLI 把科研服务层的关键制度能力“接到手上”：

- `openclaw research literature ...`：文献检索/入库/解析/建图/查询
- `openclaw research start/status/plan freeze/...`：项目编排、阶段门控、预算审批闭环

## 7. 已落地的基础规则

截至当前阶段，下面这些基础规则已经不再只是文档描述，而是仓库里的可测试代码：

- 项目章程的基础校验
- 研究计划与实验规格的基础校验
- 结论账本条目的基础校验
- 研究阶段的顺序推进规则
- 预算门控与审批闭环（申请 -> 暂停 -> 通过/拒绝 -> 留痕）
- 实验失败的初版分类规则
- 结论账本的汇总与未验证条目识别
- Turn-based 决策总线（串行化避免乱序）
- 分层记忆（Working/Recall/Archival）与显式压缩策略
- 检查点保存/恢复（关键动作落盘可追溯）
