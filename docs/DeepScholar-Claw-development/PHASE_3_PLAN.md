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
