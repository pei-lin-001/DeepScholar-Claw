# DeepScholar-Claw

DeepScholar-Claw 是一个面向“纯计算型深度学习科研”的自动化研究闭环系统：把研究过程从零散的聊天记录，升级为一条 **可发车、可追踪、可刹车、可对账、可复盘** 的工作流。

它解决的不是“让模型写出一段看起来很像论文的话”，而是科研里更硬的那几件事：

- 结论是不是来自真实产物，而不是编造出来的漂亮数字
- 失败后能不能定位到“到底坏在哪里”，而不是只会重复重试
- 预算与资源能不能制度化管理，避免无效燃烧
- 每一步关键决策有没有审计留痕，之后能不能回放与追责

本仓库最初借鉴过 OpenClaw 的工程组织方式，但 **DeepScholar-Claw 已经不属于 OpenClaw 项目**，也不再包含 OpenClaw 的多通道网关、App、Web UI、插件 SDK 等大体量模块。当前仓库以 DeepScholar 的科研闭环为唯一中心。

## 已落地能力（按 Phase）

### Phase 1：文献模块（从“找论文”到“可追溯产物”）

- 论文搜索：Semantic Scholar / OpenAlex
- 文献入库：去重与质量过滤后落盘到项目目录
- PDF 解析：对接 GROBID 产出 TEI XML（用于后续引用核对与结构化理解）
- 知识图谱：写入 Neo4j（可选）
- 检索：本地可解释检索 + 图邻域扩展（Graph-RAG 的最小形态）

### Phase 2：编排器（从“想法”到“有制度的研究项目”）

- 研究项目结构化落盘：`meta.json` 成为单一事实来源
- 审计与 checkpoint：关键动作写入 `audit_log.jsonl` + `checkpoints/`（中断可恢复）
- 12 步工作流状态机：步骤不可乱跳，门闩（gates）明确且可解释
- 预算审批闭环：申请会暂停项目；批准后盖章推进；拒绝保持暂停并留痕
- Debug-first：失败显式暴露，不吞错、不伪造成功

### Phase 3：Runner（从“能冒烟”到“能执行、能诊断、能熔断”）

- Docker 本地执行 + 落盘：每次 run 有独立目录，产出 `run.json/stdout.log/stderr.log/metrics.json`
- 沙箱档位：`compat | hardened | gvisor` 三档隔离（显式开关，不静默回退）
- 一键复盘：`collect` 汇总 run 状态、metrics 与日志尾部片段
- 失败诊断：`diagnose` 输出三段式报告 `rootCause/suggestedFix/policy`
- 显式重试：`retry` 克隆执行请求生成新 runId 再跑，并标注 `retryOfRunId`
- 编排器熔断：连续失败达到阈值会把项目拉闸暂停，并写审计留痕

### Phase 4：论文生成 + 评审（从“实验结果”到“可编译、可引用、可评审”）

- 论文包落盘：draft.json + main.tex + refs.bib + compiled.pdf + compile.log
- LaTeX 编译：Docker 编译，失败保留可读日志（不吞 stderr/不丢原因）
- 引用一致性：`\\cite{}` 必须能在本地文献库中找到来源
- 模拟同行评审：3 评委结构化打分表 + 聚合裁决，混稿会被拒绝
- 大修/小修循环：major revision 回退到写作阶段，accept/minor 进入终审阶段

### Phase 4.5：仓库精简（从“大而全”收敛为“DeepScholar 最小工程”）

- 移除 OpenClaw 冗余模块（apps/ui/extensions/skills/plugin-sdk/多通道网关等）
- 收敛 build/test 入口到 DeepScholar 最小集合
- 更新开发文档与根 README，使仓库身份与边界清晰

## 快速开始（开发者）

### 环境要求

- Node.js >= 22.12
- pnpm
- Docker
  - Runner 真跑容器时需要
  - 单测默认不依赖真实 Docker（使用可注入 fake docker client）

### 安装依赖

```bash
pnpm install
```

### 查看 CLI 能做什么

```bash
pnpm deepscholar -- --help
pnpm deepscholar -- research --help
```

### 最小闭环 1：跑一次 Runner 冒烟实验（产出可复盘证据包）

```bash
HOME_DIR="$(mktemp -d)"

pnpm deepscholar -- research runner smoke \
  --project-id p1 \
  --home "$HOME_DIR" \
  --json

pnpm deepscholar -- research runner list \
  --project-id p1 \
  --home "$HOME_DIR"

pnpm deepscholar -- research runner collect \
  --project-id p1 \
  --run-id "<runId>" \
  --home "$HOME_DIR"
```

### 最小闭环 2：预算审批（制度化“停一下再烧钱”）

```bash
HOME_DIR="$(mktemp -d)"

pnpm deepscholar -- research start \
  --project-id p1 \
  --topic "mnist augmentation" \
  --home "$HOME_DIR" \
  --json

# 你需要准备一份 ResearchPlanDraft 的 JSON（参考 docs/DeepScholar-Claw-development/PHASE_2_PLAN.md）
pnpm deepscholar -- research plan freeze \
  --project-id p1 \
  --draft "/path/to/plan-draft.json" \
  --approved-by human \
  --home "$HOME_DIR" \
  --json

pnpm deepscholar -- research budget request \
  --project-id p1 \
  --purpose "GPU for ablation runs" \
  --cost-usd 10 \
  --duration 2h \
  --total-usd 100 \
  --home "$HOME_DIR" \
  --json

pnpm deepscholar -- research approve \
  --project-id p1 \
  --request-id "<budgetRequestId>" \
  --decided-by finance \
  --home "$HOME_DIR" \
  --json
```

## 数据落盘约定（事实来源）

默认 home 为 `~/.deepscholar`（可通过 CLI `--home` 覆盖）。

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

> 注意：`projectId/draftId/runId` 等写入磁盘前会经过清洗（非 `[a-zA-Z0-9._-]` 字符会被替换），避免路径穿越与跨平台路径问题。

## 项目结构（从哪里开始读代码）

```text
packages/
  deepscholar-contracts/    # 共享契约与运行时校验（类型 + validate）

services/
  orchestrator/             # 编排：状态机、门控、审批、审计、checkpoint、熔断暂停
  runner/                   # 执行：Docker 沙箱、run 落盘、collect/diagnose/retry
  writing/                  # 写作：论文包、LaTeX 渲染/编译、引用一致性
  review/                   # 评审：结构化 rubric + 聚合裁决 + 混稿保护
  paper-intel/              # 文献：搜索、入库、GROBID、图谱、检索
  provenance/               # 证据：Claim-Evidence Ledger 汇总与缺口识别

src/
  index.ts                  # CLI 入口
  cli/                      # research 子命令

docs/DeepScholar-Claw-development/
  # 项目开发规格、分期计划、工作日志
```

## 测试与验收

- 类型检查：`pnpm build`
- 单测：`pnpm test`
- 60 秒闸门（防卡死）：

```bash
perl -e 'alarm 60; exec @ARGV' pnpm test
```

## 开发文档

本项目的开发规格与阶段计划集中在：

- `docs/DeepScholar-Claw-development/DEEPSCHOLAR_DEVELOPMENT_SPEC.md`
- `docs/DeepScholar-Claw-development/PHASE_1_PLAN.md`
- `docs/DeepScholar-Claw-development/PHASE_2_PLAN.md`
- `docs/DeepScholar-Claw-development/PHASE_3_PLAN.md`
- `docs/DeepScholar-Claw-development/PHASE_4_PLAN.md`
- `docs/DeepScholar-Claw-development/PHASE_4_5_PLAN.md`
- `docs/DeepScholar-Claw-development/WORKLOG.md`

