# Phase 6 Plan（把“半落地能力”补成真正的硬闭环）

## 为什么要开 Phase 6

经过前几轮开发，DeepScholar-Claw 的主闭环已经能从项目创建一路跑到论文完结。

但项目专属文档与代码对照后，仍然有几块“看起来已经有了，实际上还没彻底接上”的地方：

- 文档承诺有 `reviews/*` 评审档案，但当前评审结果主要还是外部 JSON 输入，项目目录里没有成体系留档
- Claim-Evidence Ledger 已有契约和汇总器，但还没真正成为论文生成与终审的硬门闩
- Phase 3 的模板 / program 运行能力底层已长出来，但项目级 `research experiment run` 还主要是 smoke 通道
- 预算控制仍偏“单次申请”，还没完全收敛到项目级 envelope + 异常追加审批
- 少量文档还存在“描述比代码快一步”或“路径已经变了但文档没改”的漂移

Phase 6 的目标，就是把这些“半截楼梯”全部补平。

---

## 本阶段目标

把系统从“主线能跑”推进到“关键承诺都能对账”：

1. 评审档案要真正落进项目目录，不能只停留在命令行输入文件
2. 论文中的关键结论要能被 Claim Ledger 审核，不能只靠 `resultsVerified=true`
3. 实验执行入口要能从 smoke 升级到模板 / program 分派
4. 预算要逐步从单次申请收敛到 envelope 模式
5. 项目专属文档要重新和代码完全对齐

---

## 阶段任务看板（Phase 6）

| 状态 | 任务 | 结果 |
| ---- | ---- | ---- |
| TODO | 评审档案落盘化 | `reviews/round_*/reviewer_*.json + meta_review.json` 真正写入项目目录，并接入 CLI 输出 |
| TODO | Claim Ledger 接入写作/终审闸门 | 关键 claims 可落盘、可汇总、可校验，未通过时不能假装论文已准备好 |
| TODO | experiment run 分派升级 | 项目级发车口不再只会 smoke，能根据执行请求分派到 template/program |
| TODO | 预算 envelope v1 | 项目级预算边界可落盘，只有异常超额动作才额外审批 |
| TODO | 文档与验收口径收口 | 修正文档漂移，补充 Phase 6 验收与 runbook 说明 |

---

## 交付边界

### Phase 6 明确要做

- 让 `reviews/*` 成为真实项目资产
- 让 Claim/Evidence 不再只是 contracts 里的名词
- 让 Runner 的“可执行模板能力”真正接入项目编排入口
- 让预算审批向 envelope 模式迈进至少一版
- 让开发文档重新成为可信真相源

### Phase 6 明确不做

- 不在本阶段引入 Temporal / Argo / K8s 等外部工作流系统
- 不在本阶段接入真实 LLM Writer / Reviewer 自动生成正文与评审文本
- 不在本阶段重做 Web UI / OpenClaw 控制面

---

## 本阶段验收（开发者侧）

### 1) Build + Test

```bash
pnpm build
perl -e 'alarm 60; exec @ARGV' pnpm test
```

### 2) 功能对账点

- `research review decide` 后，项目目录下出现 `reviews/round_*/reviewer_*.json` 与 `meta_review.json`
- 至少一条 claim ledger 路径能从落盘 JSON 进入写作 / 终审闸门
- `research experiment run` 不再写死只调用 smoke runner
- 文档中提到的 CLI 命令与路径，必须能在当前仓库中找到对应实现
