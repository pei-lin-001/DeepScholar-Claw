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
| TODO | Runner collect（汇总复盘） | 可输出 run 状态、metrics 摘要、日志尾部片段、artifacts   |
| TODO | OpenClaw CLI 接入 collect  | `openclaw research runner collect --project-id --run-id` |

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
