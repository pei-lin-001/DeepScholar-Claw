# Phase 4 Plan（论文生成 + 评审）

## 当前目标

把“实验结果”升级为一份**可编译、可引用、可评审、可复盘**的论文包，并把流程推进到 Step9-12 的核心闭环：

- Step9：结果验证（结果必须可对账，不能只靠口头总结）
- Step10：论文撰写（分章节内容 + 图表 + refs）
- Step11：模拟同行评审（3 评委独立评分 + 汇总裁决 + 分歧门控）
- Step12：人类终审（把最终包推给人类做最后决策）

## 阶段任务看板（Phase 4）

| 状态 | 任务               | 结果                                                                   |
| ---- | ------------------ | ---------------------------------------------------------------------- |
| DONE | LaTeX 模板管理     | 支持 arXiv 模板（`latex-template.ts`），可扩展到 NeurIPS/ICML 等       |
| DONE | 学术可视化引擎     | 从真实 `metrics.json` 生成 `table.tex/chart.tex` 与 source/spec 落盘，并自动缝进草稿 |
| DONE | 分章节撰写流程     | 论文按章节生成/管理，草稿可落盘、可版本化（`paper-bundle-fs.ts`）      |
| DONE | 引用一致性检查     | 所有 `\\cite{}` 必须能在本地文献库里找到来源（`citations.ts`）         |
| DONE | LaTeX 编译流水线   | Docker 编译产出 PDF；失败显式报错并保留编译日志（`latex-compiler.ts`） |
| DONE | 评审系统（3 评委） | 结构化打分表 + 汇总裁决（`review-aggregation.ts` + `ReviewRubric`）    |
| DONE | 分歧辩论机制       | 分歧触发时项目会停在 Step11；`review debate-resolve` 明确决定前进或打回 |
| DONE | 大修/小修循环      | major revision 回到 step10；minor/accept 进入 step12                   |

## 目录与落盘约定（Paper/Review）

默认 home 为 `~/.deepscholar`（可用 CLI `--home` 覆盖）。

建议落盘结构（与开发规格一致）：

```text
~/.deepscholar/
  projects/
    <projectId>/
      paper/
        drafts/
          <draftId>/
            draft.json      # 结构化草稿（PaperDraft JSON）
            main.tex         # 渲染后的 LaTeX 主文件
            refs.bib         # BibTeX 引用文件
            compiled.pdf     # 编译产出
            compile.log      # 编译日志
        figures/             # 图表（PDF/PGF/PNG）
      reviews/
        round_1/
          reviewer_1.json
          reviewer_2.json
          reviewer_3.json
          meta_review.json
```

> **注意：** `<projectId>` 和 `<draftId>` 在写入磁盘时会经过 `safeIdForFileName` 清洗——非 `[a-zA-Z0-9._-]` 字符统一替换为 `_`。

## 本阶段验收（开发者侧）

### 1) 单元测试（60 秒超时）

```bash
perl -e 'alarm 60; exec @ARGV' pnpm exec vitest run \
  services/orchestrator/src/*.test.ts \
  services/runner/src/*.test.ts \
  services/writing/src/*.test.ts \
  services/review/src/*.test.ts \
  packages/deepscholar-contracts/src/*.test.ts \
  src/cli/*.test.ts
```
