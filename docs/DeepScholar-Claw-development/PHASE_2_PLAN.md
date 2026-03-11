# Phase 2 Plan

## 当前目标

把 DeepScholar-Claw 的“制度性铁律”从文档变成可执行的工程事实，让系统不靠“会话记忆”也能持续推进：

- 研究计划能冻结：避免见数据改故事
- 结论必须绑定证据：避免凭空编数字
- 审计状态可追踪：避免“说自己验过了”
- 长任务可暂停/可恢复：避免“跑一半断电就全没了”
- 人类审批能闭环：避免高成本动作“默认放行”

## 阶段任务看板

| 状态 | 任务                                               | 结果                                                                    |
| ---- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| DONE | 研究计划契约升级：草案 + 冻结 + 审批字段           | 计划对象与校验函数落地，冻结后可追溯审批人/审批时间                     |
| DONE | 结论-证据账本升级：Claim/Assertion/EvidenceBinding | 断言必须绑定证据；审计状态支持 draft/verified/disputed                  |
| DONE | Provenance 汇总升级                                | 不只“数个数”，还能输出审计状态分布与证据缺口提示                        |
| DONE | Turn-based Message Bus                             | 决策串行化，避免多个角色同时推进导致状态乱跳                            |
| DONE | 12 步流程状态机 + 阶段门控                         | 每一步有进入条件，禁止跳步；缺前置条件会明确报错                        |
| DONE | 固定 Bot 定义 + 动态模板注册                       | 主编/审计/财务有明确身份与职责；支持注册特战队模板                      |
| DONE | 分层记忆系统 + 显式压缩策略                        | Working/Recall/Archival 三层落盘；提供显式 compact 行为                 |
| DONE | 检查点保存/恢复 + 审计日志                         | 关键动作写 checkpoint；`audit_log.jsonl` 追加不可变                     |
| DONE | 财务审批闭环（先以 CLI 跑通）                      | request -> pending -> approve/reject -> resume/停留，状态与审计同步落盘 |
| DONE | 单测护栏                                           | contracts + orchestrator + CLI 定向测试在 60 秒内通过                   |

## 清理原则

- 保持“先替代后裁剪”的策略：当新结构完整覆盖旧路径时，再做定点清理，避免误删控制面能力。

## 本阶段验收（开发者侧）

### 1) 单元测试（60 秒超时）

```bash
perl -e 'alarm 60; exec @ARGV' pnpm exec vitest run \
  services/orchestrator/src/*.test.ts \
  packages/deepscholar-contracts/src/*.test.ts \
  src/cli/research-orchestrator-cli.test.ts
```

### 2) CLI 最小闭环（可写到临时目录）

```bash
# 以临时目录作为 DeepScholar home，避免污染真实 ~/.deepscholar
HOME_DIR="$(mktemp -d)"

node --import tsx src/index.ts research start --project-id p1 --topic "graph rag" --home "$HOME_DIR"

cat > "$HOME_DIR/draft.json" <<'JSON'
{
  "planId": "plan-1",
  "projectId": "p1",
  "hypothesis": "Works better",
  "successCriteria": {
    "primaryMetric": "accuracy",
    "targetValue": 0.85,
    "improvementOverBaseline": 0.05
  },
  "baselines": [
    {
      "name": "baseline",
      "source": "official",
      "metricValues": { "accuracy": 0.8 }
    }
  ],
  "datasets": [
    { "name": "mnist", "version": "1.0", "split": "train" }
  ],
  "evaluationMetrics": ["accuracy"],
  "budgetEnvelope": { "maxGpuHours": 0, "maxCostUsd": 0, "maxExperiments": 1 },
  "stopRules": { "maxFailedAttempts": 1, "budgetDepletionPercent": 80, "timeLimitHours": 12 }
}
JSON

node --import tsx src/index.ts research plan freeze --project-id p1 --draft "$HOME_DIR/draft.json" --approved-by human --home "$HOME_DIR"
node --import tsx src/index.ts research budget request --project-id p1 --purpose GPU --cost-usd 10 --duration 2h --total-usd 100 --home "$HOME_DIR" --json

# 读取 requestId 后执行：
node --import tsx src/index.ts research approve --project-id p1 --request-id "<requestId>" --decided-by finance --home "$HOME_DIR"
node --import tsx src/index.ts research status --project-id p1 --home "$HOME_DIR"
```

## Phase 2 加固补丁（重要但不抢戏）

Phase 2 主体完成后，补了一轮“把坑堵死”的工程加固，目标是让系统更不容易出现半吊子状态或脏数据混入：

- 编排器保存动作具备回滚能力：checkpoint/audit 写入失败会回滚 `meta.json`
- 记忆压缩保留原始 Working 条目：先归档原文，再写压缩摘要
- 预算门控提前拦截：超预算申请会被明确拒绝并给出原因
- 审批状态保护：只能处理 `pending` 的请求，避免重复审批污染链路
- 时间戳与枚举字段校验更严格：更早暴露脏数据，而不是“先跑起来再说”
