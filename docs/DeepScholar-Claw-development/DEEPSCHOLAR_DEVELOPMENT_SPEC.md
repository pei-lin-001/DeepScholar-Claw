# DeepScholar-Claw 开发规格（当前工程版）

> 版本: 2.0  
> 日期: 2026-03-12  
> 说明: 本文档描述 **Phase 4.5 精简后** 的真实工程形态。项目最初借鉴过 OpenClaw 的组织方式，但当前仓库已收敛为 DeepScholar-Claw 的最小工程，不再假设 OpenClaw 的多通道网关/App/Web UI/插件 SDK 作为基座存在。

---

## 1. 我们到底在做什么

DeepScholar-Claw 的目标不是“让模型写一篇看起来像论文的长文”，而是把科研过程变成一条 **可发车、可追踪、可刹车、可对账、可复盘** 的流水线。

用一句更直白的话说:

- 你不需要相信聊天记录里那句“我跑过实验了”
- 你只需要看磁盘上那份 run 目录和论文包目录，就能知道它到底跑了什么、产出了什么、失败在哪里

### 1.1 核心能力的“硬标准”

系统里任何一个“结论”想要站得住，必须满足两件事:

1. 它能回指到具体产物: run、metrics、日志、引用来源、编译出的 PDF 等
2. 它能被审计: 谁批准的预算、谁冻结的计划、何时从哪一步推进到下一步，全部有落盘记录

### 1.2 明确的非目标

为了保证系统锋利而不臃肿，我们明确不做:

- 多通道消息网关（Telegram/Discord/Slack 等）集成
- Web UI / 移动端 App
- OpenClaw 插件生态与 plugin-sdk 兼容
- 多租户 SaaS 形态

DeepScholar-Claw 当前阶段的中心是: **科研闭环在本地可运行、可验证、可复盘。**

---

## 2. 工程边界（Phase 4.5 之后）

Phase 4.5 之后，仓库只保留 3 层:

1. 控制面（CLI）: `src/`
2. 科研服务层（重逻辑）: `services/*`
3. 共享契约层（制度底座）: `packages/deepscholar-contracts/`

这三层的关系是:

- CLI 不“想当然”推进流程，只负责把输入翻译成一次明确的服务调用，并把结果以 JSON 或可读摘要输出
- Services 承担所有科研重逻辑: 状态机、门控、审批、落盘、诊断
- Contracts 定义“系统里允许存在什么对象”，并提供运行时校验，避免外部 JSON/脏数据把 CLI 直接撞崩

---

## 3. 模块与职责（读代码从这里开始）

### 3.1 `packages/deepscholar-contracts/`（制度底座）

这里定义整个系统的“制度语言”:

- 研究项目与阶段/步骤状态
- 冻结后的研究计划（避免见数据改故事）
- 预算审批对象（申请/批准/拒绝，状态不可乱跳）
- 实验 run（目录结构、状态、指标、日志）
- 论文 draft（LaTeX 包、编译结果）
- 同行评审 rubric 与聚合裁决（含混稿保护）
- Claim-Evidence Ledger（结论与证据绑定）

并且所有关键枚举/时间戳/结构都会做运行时校验，保证错误“当场说清楚”，而不是默默混过去。

### 3.2 `services/orchestrator/`（编排器）

它是科研闭环的“交通警察 + 记账员”:

- 12 步工作流状态机推进（不能乱跳）
- gates 门闩评估（预算是否盖章、实验是否完成、论文是否编译成功等）
- 审计日志与 checkpoint（中断可恢复）
- 预算审批闭环（申请会暂停，批准才解锁下一步）
- 熔断暂停（连续失败达到 stopRules 直接拉闸并留痕）

### 3.3 `services/runner/`（执行器）

它负责把“实验”变成可复盘的作业包:

- 每次执行都会生成独立 `runId` 目录
- 产出 `run.json/stdout.log/stderr.log/metrics.json`
- Docker 沙箱三档: `compat | hardened | gvisor`（显式开关，不静默回退）
- `collect/diagnose/retry` 把“失败”变成可定位、可讨论、可复现的报告

### 3.4 `services/writing/`（写作与 LaTeX 编译）

它负责把“论文草稿”变成能编译、可查错的论文包:

- draft 目录落盘: `draft.json/main.tex/refs.bib`
- Docker LaTeX 编译输出 `compiled.pdf`
- `compile.log` 必须保留可读失败原因（包括 stderr/退出码/超时信息）
- Docker 编译时工作目录与挂载策略要能覆盖“带 figures 的论文”

### 3.5 `services/review/`（模拟同行评审）

它负责把“写完了”变成“有人按规则挑刺并给结论”:

- 结构化 rubric（每个维度有 score + evidence）
- 三评委聚合裁决（平均分、分歧 spread、是否触发 debate）
- 混稿保护（不同 projectId/draftId 的评审混进来会直接拒绝聚合）

### 3.6 `services/paper-intel/`（文献情报）

它负责把“找论文”变成工程动作:

- Semantic Scholar / OpenAlex 检索
- 文献去重与质量过滤
- PDF -> TEI（GROBID）
- 图谱写入与检索（memory/neo4j）

### 3.7 `services/provenance/`（证据账本）

它负责把“结论像不像真的”变成结构化检查:

- 统计各类 Claim/Assertion 的审计状态分布
- 找出证据缺口（强断言缺统计支撑、对比断言缺 baselineComparison 等）

---

## 4. 落盘约定（真相源）

默认 home 为 `~/.deepscholar`，也可通过 CLI `--home` 覆盖。

核心原则:

- **meta.json** 是项目主状态的单一事实来源
- **audit_log.jsonl** 记录每次关键动作（不可变追加）
- **checkpoints/** 为恢复提供锚点（中断后可回放）

目录形态（简化）:

```text
~/.deepscholar/
  projects/
    <projectId>/
      meta.json
      audit_log.jsonl
      checkpoints/

      runs/
        <runId>/
          run.json
          stdout.log
          stderr.log
          metrics.json

      paper/
        drafts/
          <draftId>/
            draft.json
            main.tex
            refs.bib
            compiled.pdf
            compile.log

      reviews/
        round_1/
          reviewer_1.json
          reviewer_2.json
          reviewer_3.json
          meta_review.json
```

> 注: 所有会写入磁盘的 ID 会被清洗，避免路径穿越与跨平台路径问题。

---

## 5. CLI 命令面（人类如何“发车”）

开发态推荐用:

```bash
pnpm deepscholar -- research --help
```

典型闭环动作包括:

- `research start/status`：项目创建与状态查看
- `research plan freeze`：冻结计划（盖章后才能往后跑）
- `research budget request/approve/reject`：预算审批闭环
- `research runner smoke/list/collect/diagnose/retry/abort`：执行与复盘
- `research paper write/compile`：论文包生成与编译
- `research review decide`：评审聚合与写回

---

## 6. 验收口径（可执行的闸门）

Phase 4.5 精简后的仓库，以两个命令作为硬闸门:

```bash
pnpm build
pnpm test
```

如果要防卡死（60 秒超时）:

```bash
perl -e 'alarm 60; exec @ARGV' pnpm test
```

---

## 7. 分期计划（概览）

本仓库的阶段计划与实施记录，按以下文件维护（细节以各 Phase 文档为准）:

- `PHASE_1_PLAN.md`: 文献情报模块
- `PHASE_2_PLAN.md`: 编排器 + 审计 + 预算审批
- `PHASE_3_PLAN.md`: Runner（Docker 沙箱 + 诊断 + 复盘）
- `PHASE_4_PLAN.md`: 写作与评审（LaTeX 编译 + rubric + 聚合裁决）
- `PHASE_4_5_PLAN.md`: 仓库精简（从“大而全”收敛为最小工程）
- `PHASE_5_PLAN.md`: 端到端真实验收（把闭环跑成可复盘的项目）
- `PHASE_6_PLAN.md`: 补齐半落地能力（评审档案、Claim Ledger、run 分派、预算 envelope）
