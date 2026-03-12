# DeepScholar-Claw Architecture

## 1. 项目定位

DeepScholar-Claw 是一个面向“纯计算型深度学习科研”的自动化闭环系统：把研究过程从零散对话升级为**可落盘、可审计、可门控、可复盘**的流水线。

本项目最初借鉴过 OpenClaw 的工程组织方式，但当前仓库已经完成 Phase 4.5 的精简收敛，**不再包含 OpenClaw 的多通道网关、App、Web UI、插件 SDK 等大体量模块**。仓库现在以 DeepScholar 的科研闭环为唯一中心。

## 2. 分层与职责

### 2.1 控制面（CLI）

`src/` 只做一件事：提供一个轻量的命令行入口，把“科研服务层”的制度能力接到人手上。

它不承载重业务逻辑，不做隐式兜底，只负责：

- 参数解析与输入校验（边界）
- 调用 services 的用例函数
- 输出可读摘要或 JSON（便于脚本化）

### 2.2 科研服务层（重逻辑）

`services/` 负责真正的科研闭环能力，每个服务边界清晰、职责单一：

- `services/orchestrator/`
  状态机推进、门闩（gates）校验、审批暂停/恢复、审计日志与 checkpoint 落盘
- `services/runner/`
  Docker 沙箱执行、run 产物落盘、诊断/重试、与编排器的熔断协作
- `services/writing/`
  论文草稿包管理、LaTeX 渲染与 Docker 编译、失败日志留痕
- `services/review/`
  结构化打分表、评审聚合裁决、分歧检测与混稿保护
- `services/paper-intel/`
  文献检索/入库、GROBID 解析、图谱写入与检索（memory/neo4j）
- `services/provenance/`
  Claim-Evidence Ledger 的汇总与缺口识别（为防造假审计提供基础）

### 2.3 共享契约层（制度底座）

`packages/deepscholar-contracts/` 统一定义并校验系统内的结构化对象：

- 研究项目、研究计划、预算审批、实验 run、论文草稿、评审裁决、审计条目
- 运行时校验函数（防止 CLI 读到脏 JSON 时直接崩溃）

## 3. 落盘约定（事实来源）

默认 home 为 `~/.deepscholar`（CLI 可用 `--home` 覆盖），所有“关键事实”都必须落盘：

- `meta.json`：项目主状态
- `audit_log.jsonl`：不可变审计日志
- `checkpoints/`：关键节点快照（中断可恢复）
- `runs/<runId>/`：实验产物（run.json + stdout/stderr + metrics）
- `paper/drafts/<draftId>/`：论文包（draft.json + main.tex + refs.bib + compiled.pdf + compile.log）
- `reviews/`：评审输入与裁决产物

## 4. 当前目录结构（仓库内）

```text
docs/DeepScholar-Claw-development/
  DEEPSCHOLAR_DEVELOPMENT_SPEC.md
  README.md
  ARCHITECTURE.md
  ChatGPT初次建议.md
  PHASE_1_PLAN.md
  PHASE_2_PLAN.md
  PHASE_3_PLAN.md
  PHASE_4_PLAN.md
  PHASE_4_5_PLAN.md
  PHASE_5_PLAN.md
  PHASE_6_PLAN.md
  SPEC_PHASE_1_LITERATURE_PLAN.md
  WORKLOG.md

packages/
  deepscholar-contracts/

services/
  orchestrator/
  runner/
  writing/
  review/
  paper-intel/
  provenance/

src/
  index.ts                # CLI 入口
  cli/                    # research 子命令
```
