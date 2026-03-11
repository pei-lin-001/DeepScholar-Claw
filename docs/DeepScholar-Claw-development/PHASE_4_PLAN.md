# Phase 4 Plan（论文生成 + 评审）

## 当前目标

把“实验结果”升级为一份**可编译、可引用、可评审、可复盘**的论文包，并把流程推进到 Step9-12 的核心闭环：

- Step9：结果验证（结果必须可对账，不能只靠口头总结）
- Step10：论文撰写（分章节内容 + 图表 + refs）
- Step11：模拟同行评审（3 评委独立评分 + 汇总裁决 + 分歧门控）
- Step12：人类终审（把最终包推给人类做最后决策）

## 阶段任务看板（Phase 4）

| 状态 | 任务               | 结果                                                                 |
| ---- | ------------------ | -------------------------------------------------------------------- |
| TODO | LaTeX 模板管理     | 支持至少一种可编译模板（如 arXiv），可扩展到 NeurIPS/ICML 等         |
| TODO | 学术可视化引擎     | 从真实数据生成图表/表格（带生成代码与 LaTeX 引用锚点），禁止手工截图 |
| TODO | 分章节撰写流程     | 论文按章节生成/管理，草稿可落盘、可版本化                            |
| TODO | 引用一致性检查     | 所有 `\\cite{}` 必须能在本地文献库/知识图谱里找到来源                |
| TODO | LaTeX 编译流水线   | 编译成功产出 PDF；失败显式报错并保留编译日志                         |
| TODO | 评审系统（3 评委） | 结构化打分表 + 汇总裁决（accept/minor/major/reject）                 |
| TODO | 分歧辩论机制       | 分歧过大触发 debate，要求评委读对方意见并更新分数                    |
| TODO | 大修/小修循环      | major revision 回到写作阶段；minor/accept 进入人类终审               |

## 目录与落盘约定（Paper/Review）

默认 home 为 `~/.deepscholar`（可用 CLI `--home` 覆盖）。

建议落盘结构（与开发规格一致）：

```text
~/.deepscholar/
  projects/
    <projectId>/
      paper/
        drafts/           # 草稿 JSON（结构化，便于审计）
        figures/          # 图表（PDF/PGF/PNG）
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

## 本阶段验收（开发者侧）

### 1) 单元测试（60 秒超时）

```bash
perl -e 'alarm 60; exec @ARGV' pnpm exec vitest run \
  services/orchestrator/src/*.test.ts \
  services/runner/src/*.test.ts \
  services/paper-intel/src/*.test.ts \
  packages/deepscholar-contracts/src/*.test.ts \
  src/cli/*.test.ts
```
