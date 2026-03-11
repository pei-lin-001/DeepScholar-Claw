# Phase 3 Plan

## 当前目标

把“实验”从一句描述升级为一张**可发车、可追踪、可刹车、可复盘**的作业单。

Phase 3 的第一步只做一件事：跑通**本地冒烟 Runner + Docker 沙箱**的最小闭环，让系统能稳定产出下面这些“硬证据”：

- run 状态（queued/running/succeeded/failed/aborted/timeout）
- stdout/stderr 日志
- metrics.json（最小指标）
- run.json（结构化运行记录）

## 阶段任务看板（Phase 3.1）

| 状态 | 任务                                   | 结果                                               |
| ---- | -------------------------------------- | -------------------------------------------------- |
| DONE | 新增 Run 契约（ExperimentRun 等）      | 运行记录结构化 + 运行时校验 + 单测护栏             |
| DONE | Runner RunStore（落盘目录 + run.json） | 每个 runId 有独立目录，状态可读可写                |
| DONE | Docker 冒烟执行器（可注入）            | 单测不依赖真实 Docker，也能证明状态流转            |
| DONE | OpenClaw CLI 接入                      | `openclaw research runner smoke/status/abort` 可用 |

## 阶段任务看板（Phase 3.2）

Phase 3.1 解决的是“能发车”；Phase 3.2 解决的是“出了事故能定位、跑多趟能管理”。

| 状态 | 任务                                 | 结果                                                          |
| ---- | ------------------------------------ | ------------------------------------------------------------- |
| DONE | Runner 可诊断性增强                  | `stderr.log` 能看出卡在拉镜像/起容器/执行/清理哪个阶段        |
| DONE | RunStore.list 排序稳定化             | `list` 默认按 `updatedAt` 倒序，输出可复现，不再像“翻抽屉”    |
| DONE | OpenClaw CLI 增加 runner list        | `openclaw research runner list --project-id p1 [--json]` 可用 |
| DONE | Docker stop 幂等（容器已消失不报错） | abort/timeout cleanup 不因 `No such container` 这类情况失败   |

## 阶段任务看板（Phase 3.3）

Phase 3.3 的目标是把“产物散落在目录里”升级为“一键可复盘的汇总包”。

| 状态 | 任务                       | 结果                                                     |
| ---- | -------------------------- | -------------------------------------------------------- |
| DONE | Runner collect（汇总复盘） | 可输出 run 状态、metrics 摘要、日志尾部片段、artifacts   |
| DONE | OpenClaw CLI 接入 collect  | `openclaw research runner collect --project-id --run-id` |

## 阶段任务看板（Phase 3.4）

Phase 3.4 的目标是把 “Step8 只是停在那” 升级为 “Step8 会真的发车跑一次实验，并把结果写回项目状态”。

| 状态 | 任务                                   | 结果                                                             |
| ---- | -------------------------------------- | ---------------------------------------------------------------- |
| DONE | 编排器记录 latestRunId/latestRunStatus | 项目能记住最近一次 run 的编号与状态，作为后续证据与复盘锚点      |
| DONE | 编排器接入 Runner（Step8 -> Step9）    | run 成功则拉起 experimentCompleted 门闩并推进到 step9            |
| DONE | OpenClaw CLI 接入 experiment run       | `openclaw research experiment run --project-id p1 [--json]` 可用 |

## 阶段任务看板（Phase 3.5）

Phase 3.5 的目标是让 Docker 沙箱更像“安全箱”，而不是“随便跑个容器”：

| 状态 | 任务                                   | 结果                                        |
| ---- | -------------------------------------- | ------------------------------------------- |
| DONE | Docker 沙箱 profile（hardened/gvisor） | 支持更严格隔离参数；`stderr.log` 有阶段留痕 |

## 阶段任务看板（Phase 3.6）

Phase 3.6 的目标是把“实验=一句描述”推进到“实验=一份可执行的代码包”：

| 状态 | 任务                  | 结果                                                          |
| ---- | --------------------- | ------------------------------------------------------------- |
| DONE | 代码模板与落盘 bundle | 能渲染 Python 模板、落盘到 run 目录并在容器内执行产出 metrics |

## 阶段任务看板（Phase 3.7）

Phase 3.7 的目标是把“云 GPU 平台”从文档名词变成可接入模块（先做接口与配置闭环）：

| 状态 | 任务                        | 结果                                                   |
| ---- | --------------------------- | ------------------------------------------------------ |
| DONE | CloudGPUProvider 接口与骨架 | AutoDL/RunPod 的配置加载、显式报错、可注入 HTTP 客户端 |

## 阶段任务看板（Phase 3.8）

Phase 3.8 的目标是让失败不再是一坨日志：能诊断、能建议、能显式重试、能熔断暂停：

| 状态 | 任务                    | 结果                                                          |
| ---- | ----------------------- | ------------------------------------------------------------- |
| DONE | runner diagnose + retry | CLI 可输出诊断报告；对 docker runs 支持显式 retry（新 runId） |
| DONE | orchestrator 熔断暂停   | 达到 stopRules.maxFailedAttempts 后暂停并写审计留痕           |

## 目录与落盘约定

默认 home 为 `~/.deepscholar`（可用 CLI `--home` 覆盖），运行产物落在：

```
~/.deepscholar/
  projects/
    <projectId>/
      runs/
        <runId>/
          run.json
          stdout.log
          stderr.log
          metrics.json
```

> **注意：** `<projectId>` 和 `<runId>` 在写入磁盘时会经过 `safeIdForFileName` 清洗——非 `[a-zA-Z0-9._-]` 字符统一替换为 `_`。例如 projectId 为 `my/project` 时，实际目录名为 `my_project`。

## 本阶段验收（开发者侧）

### 1) 单元测试（60 秒超时）

```bash
perl -e 'alarm 60; exec @ARGV' pnpm exec vitest run \
  packages/deepscholar-contracts/src/*.test.ts \
  services/runner/src/*.test.ts \
  src/cli/research-runner-cli.test.ts
```

### 2) CLI 最小闭环（建议使用临时目录）

```bash
HOME_DIR="$(mktemp -d)"

# 1) 发起一次 smoke run（会等待 docker run 执行结束后返回）
node --import tsx src/index.ts research runner smoke \
  --project-id p1 \
  --home "$HOME_DIR" \
  --json

# 2) 用上一步输出的 runId 查询状态
node --import tsx src/index.ts research runner status \
  --project-id p1 \
  --run-id "<runId>" \
  --home "$HOME_DIR" \
  --json

# 3) 如果你想演示 abort，可把 hold 时间拉长，然后在另一个终端执行 abort：
node --import tsx src/index.ts research runner smoke \
  --project-id p1 \
  --home "$HOME_DIR" \
  --hold-seconds 300

node --import tsx src/index.ts research runner abort \
  --project-id p1 \
  --run-id "<runId>" \
  --home "$HOME_DIR" \
  --json
```

## Phase 3.2 验收（开发者侧）

### 1) 单元测试（60 秒超时）

```bash
perl -e 'alarm 60; exec @ARGV' pnpm exec vitest run \
  services/runner/src/*.test.ts \
  packages/deepscholar-contracts/src/*.test.ts \
  src/cli/research-runner-cli.test.ts
```

### 2) CLI（run 管理）

```bash
HOME_DIR="$(mktemp -d)"

# 先跑一次 smoke
node --import tsx src/index.ts research runner smoke \
  --project-id p1 \
  --home "$HOME_DIR" \
  --json

# 列出该项目下所有 runs（json / 人类可读都行）
node --import tsx src/index.ts research runner list \
  --project-id p1 \
  --home "$HOME_DIR" \
  --json
```

## Phase 3.3 验收（开发者侧）

### 1) 单元测试（60 秒超时）

```bash
perl -e 'alarm 60; exec @ARGV' pnpm exec vitest run \
  services/runner/src/*.test.ts \
  src/cli/research-runner-cli.test.ts
```

### 2) CLI（一键复盘）

```bash
HOME_DIR="$(mktemp -d)"

node --import tsx src/index.ts research runner smoke \
  --project-id p1 \
  --home "$HOME_DIR" \
  --json

node --import tsx src/index.ts research runner collect \
  --project-id p1 \
  --run-id "<runId>" \
  --home "$HOME_DIR" \
  --json
```

## Phase 3.4 验收（开发者侧）

### 1) 单元测试（60 秒超时）

```bash
perl -e 'alarm 60; exec @ARGV' pnpm exec vitest run \
  services/orchestrator/src/*.test.ts \
  services/runner/src/*.test.ts \
  packages/deepscholar-contracts/src/*.test.ts \
  src/cli/*.test.ts
```

### 2) CLI（编排器发车）

```bash
HOME_DIR="$(mktemp -d)"

# 注意：此命令需要项目处于 step8_cloud_experiment（预算已批准）才能执行。
node --import tsx src/index.ts research experiment run \
  --project-id p1 \
  --home "$HOME_DIR" \
  --json
```

## Phase 3.5-3.8 验收（开发者侧）

### 1) 单元测试（60 秒超时）

```bash
perl -e 'alarm 60; exec @ARGV' pnpm exec vitest run \
  services/orchestrator/src/*.test.ts \
  services/runner/src/*.test.ts \
  packages/deepscholar-contracts/src/*.test.ts \
  src/cli/*.test.ts
```
