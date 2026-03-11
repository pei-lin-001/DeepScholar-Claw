# DeepScholar-Claw

DeepScholar-Claw 是一个面向科研的自动化研究引擎：把“研究过程”从零散的聊天记录，变成一条**可发车、可追踪、可刹车、可复盘**的工作流。

本仓库最初基于 OpenClaw 的工程底座演化而来，但 **DeepScholar-Claw 已经不属于 OpenClaw 项目**，与 `openclaw/openclaw` 官方仓库没有从属关系或官方支持关系。
当前代码仍保留了 OpenClaw 的 CLI/工程结构与部分基础设施，用来承载 DeepScholar 的研究工作流与落盘证据链。

## 这项目解决什么问题

在真实科研场景里，最难的不是“让模型说出一个看起来合理的答案”，而是：

- 这次结论是不是来自真实运行，而不是编造
- 失败后能不能快速定位是哪里坏了，而不是“再试试”
- 预算和资源能不能被制度化管理，别在无效重试上烧穿
- 每一步关键决策有没有证据留底，能不能回看、能不能追责

DeepScholar-Claw 的目标就是把这些“硬问题”落到可执行、可测试、可审计的工程链路里。

## 当前已落地能力（按 Phase 演进）

### Phase 1: 文献模块（从“找论文”到“可追溯产物”）

- 论文搜索与落盘：支持 Semantic Scholar / OpenAlex 搜索并保存到本地项目目录
- PDF 解析：可将本地 PDF 交给 GROBID 解析为 TEI XML 产物
- 知识图谱：支持把论文与引用关系写入 Neo4j
- 检索：支持本地可解释的检索 + 图邻域扩展（Graph-RAG 的最小形态）

### Phase 2: 编排器（从“想法”到“能落盘的研究项目”）

- 研究项目结构化落盘：项目元信息写入 `meta.json`
- 审计与 checkpoint：关键动作追加到 `audit_log.jsonl`，并落 checkpoint 便于中断恢复
- 12 步工作流状态机：步骤不可乱跳，门闩（gates）明确
- 预算审批闭环：申请会暂停项目，批准后盖章推进，拒绝则保持暂停并留痕
- Debug-first：不吞错、不假成功，失败会显式暴露并可定位

### Phase 3: Runner（从“能冒烟”到“能执行、能诊断、能熔断”）

- Docker 本地执行 + 落盘：每次 run 有独立目录，产出 `run.json/stdout.log/stderr.log/metrics.json`
- 沙箱 profile：`compat | hardened | gvisor` 三档隔离（显式开关，不静默回退）
- 一键复盘：`collect` 汇总 run 状态、metrics 与日志尾部片段
- 失败诊断：`diagnose` 输出三段式报告 `rootCause/suggestedFix/policy`
- 显式重试：`retry` 读取旧 run 的执行请求并克隆为新 runId，再跑一遍，并标注 `retryOfRunId`
- 最小代码模板：支持渲染并执行一个 Python 模板（把实验从“描述”推进为“可执行代码包”）
- 编排器熔断：在 Step8 写回 run 结果时累积失败次数，达到阈值自动暂停项目并写审计留痕

## 快速开始（开发者）

### 环境要求

- Node >= 22
- pnpm
- Docker（Runner 真跑容器时需要；单测不依赖真实 Docker）

### 安装依赖

```bash
pnpm install
```

### 最小闭环：跑一次本地 Runner 冒烟实验

下面这组命令会在一个临时目录里完成一次 run，并把产物落盘，最后你能拿到可复盘的证据包。

```bash
HOME_DIR="$(mktemp -d)"

# 1) 跑一次冒烟实验（Docker 容器内执行）
pnpm openclaw research runner smoke \
  --project-id p1 \
  --home "$HOME_DIR" \
  --json

# 2) 用上一步输出的 runId 查询状态
pnpm openclaw research runner status \
  --project-id p1 \
  --run-id "<runId>" \
  --home "$HOME_DIR" \
  --json

# 3) 一键复盘：把 metrics + stdout/stderr 尾部片段汇总出来
pnpm openclaw research runner collect \
  --project-id p1 \
  --run-id "<runId>" \
  --home "$HOME_DIR" \
  --json
```

### 失败时怎么处理：诊断与显式重试

```bash
HOME_DIR="$(mktemp -d)"

pnpm openclaw research runner diagnose \
  --project-id p1 \
  --run-id "<runId>" \
  --home "$HOME_DIR" \
  --json

pnpm openclaw research runner retry \
  --project-id p1 \
  --run-id "<runId>" \
  --home "$HOME_DIR" \
  --json
```

### 沙箱档位（compat/hardened/gvisor）

```bash
HOME_DIR="$(mktemp -d)"

pnpm openclaw research runner smoke \
  --project-id p1 \
  --home "$HOME_DIR" \
  --sandbox-profile hardened \
  --json
```

说明：

- `compat`：最兼容（默认）。
- `hardened`：更严格隔离（只读、去权限、tmpfs、pids-limit 等）。
- `gvisor`：在 hardened 基础上要求 `runsc` runtime；宿主机未安装会直接失败并把错误写进日志（不静默降级）。

## 数据落盘约定

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
```

## 项目结构（你应该从哪里读代码）

```text
packages/
  deepscholar-contracts/    # 研究对象契约与运行时校验（类型 + validate）

services/
  orchestrator/             # 工作流编排：项目状态、审计、checkpoint、预算门控、熔断暂停
  runner/                   # 实验执行：Docker 沙箱、run 落盘、collect/diagnose/retry
  paper-intel/              # 文献：搜索、落盘、GROBID、图谱、检索
  provenance/               # 证据与结论账本（Claim/Evidence 等聚合与校验）

src/cli/                    # CLI 控制面（当前仍沿用 openclaw 的命令名）
docs/DeepScholar-Claw-development/
                            # 本项目的开发规格、分期计划、工作日志
```

## 文档

本项目的开发文档与阶段计划集中在：

- `docs/DeepScholar-Claw-development/DEEPSCHOLAR_DEVELOPMENT_SPEC.md`
- `docs/DeepScholar-Claw-development/ARCHITECTURE.md`
- `docs/DeepScholar-Claw-development/PHASE_1_PLAN.md`
- `docs/DeepScholar-Claw-development/PHASE_2_PLAN.md`
- `docs/DeepScholar-Claw-development/PHASE_3_PLAN.md`
- `docs/DeepScholar-Claw-development/WORKLOG.md`

## 测试

本仓库在研究模块上的定向验收命令（带 60 秒闸门）：

```bash
perl -e 'alarm 60; exec @ARGV' pnpm exec vitest run \
  services/orchestrator/src/*.test.ts \
  services/runner/src/*.test.ts \
  packages/deepscholar-contracts/src/*.test.ts \
  src/cli/*.test.ts
```

## 许可与来源

本仓库遵循根目录 `LICENSE`。
DeepScholar-Claw 的工程底座最初源自 OpenClaw 生态，但本项目是独立演化出的研究工作流系统。
