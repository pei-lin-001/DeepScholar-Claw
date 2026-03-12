# Phase 5 Plan（端到端真实验收：把“闭环”跑成可复盘的项目）

## 当前目标

Phase 1-4 解决的是“各个模块能用”，Phase 4.5 解决的是“仓库不再臃肿”。

Phase 5 要解决的是更硬的一件事：

> 把整个科研流程从“你知道怎么拼这些命令”升级为“给一台干净机器，也能照着跑出一份完整产物包，并且每一步失败都能解释原因”。

也就是说，Phase 5 的成果不是新增一堆新功能点，而是把已经有的能力串成 **可演示、可验收、可复盘** 的端到端黄金路径。

---

## Phase 5 的“用户能感受到的效果”

完成后，你会明显感觉到：

- 你不需要在脑子里记“下一步该敲什么命令”，文档会给出一条可复制的黄金路径。
- 你不需要把 `meta.json / audit_log.jsonl / runs/* / paper/* / reviews/*` 到处翻：
  - CLI 会给你一个清晰的“现场摘要”，告诉你现在卡在哪、该去看哪个文件。
- 你不需要担心“我跑完了，但系统不知道它跑完了”：
  - Step12 会有明确的“人类终审落槌”动作，项目会进入 `completed`，而不是永远停在最后一步悬空。

---

## 本阶段范围（明确要做什么）

### 1) Step12：人类终审落槌（补上最后一锤）

当前系统会在评审裁决后进入 `step12_human_final`，但缺少一个明确的“终审动作”把项目收口为 `completed`。

Phase 5 已新增一条终审命令：

- 输入：项目 id、终审结论（通过/撤回/需要重开一轮等）、简短说明
- 输出：写入审计与 checkpoint，项目 `lifecycle=completed`（或显式进入终止态）

命令形态：

```bash
pnpm deepscholar -- research complete \
  --project-id p1 \
  --summary "ship it"
```

### 2) 文献真实拉取：把 openAccess PDF 变成落盘文件

当前文献 ingest 主要落盘元数据；GROBID 解析需要你手动提供 PDF 路径。

Phase 5 已补齐“把论文 PDF 真正拉到本地”的能力：

- 新增文献 PDF 下载命令（按 paperId 下载到项目目录）
- 下载失败时必须给出可诊断原因（HTTP 状态码、content-type、重定向等）

命令形态：

```bash
pnpm deepscholar -- research literature download-pdf \
  --project-id p1 \
  --paper-id P1
```

下载产物默认落在：

- `~/.deepscholar/projects/<projectId>/literature/pdfs/<paperId>.pdf`
- `~/.deepscholar/projects/<projectId>/literature/pdfs/<paperId>.pdf.json`（校验信息与下载元数据）

### 3) 端到端黄金路径 Runbook（可复制、可验收）

现已把“从 0 到 1 跑完整闭环”的 runbook 固定在本文件中，覆盖：

- 准备一个临时 `--home`
- 创建项目、冻结计划、审批预算
- 跑一次 Runner（产出 metrics）
- 验证结果、写论文包、LaTeX 编译
- 聚合评审裁决、进入 Step12
- 人类终审落槌完成项目

---

## 非目标（本阶段明确不做）

- 不在 Phase 5 引入 Temporal/Argo 这类外部工作流引擎
- 不在 Phase 5 实现“真实 LLM 写作/评审生成”（仍以结构化输入为主）
- 不在 Phase 5 扩展到更复杂的多图联排、自动图注润色、或图表审美打分代理

---

## 验收口径（闸门）

### 1) 单测闸门

```bash
perl -e 'alarm 60; exec @ARGV' pnpm test
```

### 2) 手工黄金路径（以临时目录为 home）

本文件末尾已固定完整命令序列，可复制执行并产出完整落盘目录。

---

## 交付物清单

- `docs/DeepScholar-Claw-development/PHASE_5_PLAN.md`（本文件，持续更新）
- Step12 终审 CLI + 编排器落盘动作
- 文献 PDF 下载 CLI + 存储目录约定
- Phase5 黄金路径 runbook（追加到本文件末尾，或拆分成单独 RUNBOOK 文档）

---

## 黄金路径 Runbook（已落地，可复制执行）

下面这条链路按“最小可跑通闭环”设计，目标是在一台干净机器上，把项目从创建一路推到 `completed`。

### 前置条件

- 已执行 `pnpm install`
- 本机可用 Node.js `>=22.12.0`
- 本机 Docker 可用
- 当前仓库根目录为 `DeepScholar-Claw`

### 0) 准备临时 home 与计划文件

```bash
export DS_HOME="$(mktemp -d /tmp/deepscholar-phase5-XXXXXX)"
export PROJECT_ID="demo-phase5"
export PLAN_PATH="$DS_HOME/plan.json"
export REVIEWS_PATH="$DS_HOME/reviews.json"
```

```bash
cat > "$PLAN_PATH" <<'EOF'
{
  "planId": "demo-plan",
  "projectId": "demo-phase5",
  "hypothesis": "A tiny smoke experiment can still drive a full paper/demo pipeline.",
  "successCriteria": {
    "primaryMetric": "health",
    "targetValue": 1,
    "improvementOverBaseline": 0
  },
  "baselines": [
    {
      "name": "smoke-baseline",
      "source": "internal",
      "metricValues": {
        "health": 1
      }
    }
  ],
  "datasets": [
    {
      "name": "fixture",
      "version": "1.0",
      "split": "train"
    }
  ],
  "evaluationMetrics": ["health"],
  "budgetEnvelope": {
    "maxGpuHours": 1,
    "maxCostUsd": 20,
    "maxExperiments": 1
  },
  "stopRules": {
    "maxFailedAttempts": 1,
    "budgetDepletionPercent": 80,
    "timeLimitHours": 12
  }
}
EOF
```

### 1) 创建项目

```bash
pnpm deepscholar -- research start \
  --project-id "$PROJECT_ID" \
  --title "DeepScholar Phase5 Demo" \
  --topic "Smoke pipeline with paper-ready artifacts" \
  --home "$DS_HOME" \
  --json
```

### 2) 冻结研究计划

```bash
pnpm deepscholar -- research plan freeze \
  --project-id "$PROJECT_ID" \
  --draft "$PLAN_PATH" \
  --approved-by "director" \
  --home "$DS_HOME" \
  --json
```

### 3) 发起预算审批并批准

```bash
pnpm deepscholar -- research budget request \
  --project-id "$PROJECT_ID" \
  --purpose "Smoke experiment budget" \
  --cost-usd 1 \
  --duration "10m" \
  --total-usd 20 \
  --home "$DS_HOME" \
  --json
```

```bash
REQUEST_ID="$(
  pnpm deepscholar -- research status \
    --project-id "$PROJECT_ID" \
    --home "$DS_HOME" \
    --json | node -e '
      let text = "";
      process.stdin.on("data", (chunk) => (text += chunk));
      process.stdin.on("end", () => {
        const data = JSON.parse(text);
        process.stdout.write(String(data.project.pendingApprovalRequestIds[0] ?? ""));
      });
    '
)"
```

```bash
pnpm deepscholar -- research approve \
  --project-id "$PROJECT_ID" \
  --request-id "$REQUEST_ID" \
  --decided-by "finance-chair" \
  --home "$DS_HOME" \
  --json
```

### 4) 跑一次真实 Runner，并抓住 runId

```bash
RUN_ID="$(
  pnpm deepscholar -- research experiment run \
    --project-id "$PROJECT_ID" \
    --home "$DS_HOME" \
    --json | node -e '
      let text = "";
      process.stdin.on("data", (chunk) => (text += chunk));
      process.stdin.on("end", () => {
        const data = JSON.parse(text);
        process.stdout.write(String(data.run.runId ?? ""));
      });
    '
)"
```

运行成功后，至少应出现：

- `"$DS_HOME/projects/$PROJECT_ID/runs/$RUN_ID/run.json"`
- `"$DS_HOME/projects/$PROJECT_ID/runs/$RUN_ID/metrics.json"`
- `"$DS_HOME/projects/$PROJECT_ID/runs/$RUN_ID/stdout.log"`
- `"$DS_HOME/projects/$PROJECT_ID/runs/$RUN_ID/stderr.log"`

### 5) 验证结果，推进到论文撰写

```bash
pnpm deepscholar -- research validate \
  --project-id "$PROJECT_ID" \
  --summary "Smoke metrics and artifacts are consistent." \
  --home "$DS_HOME" \
  --json
```

### 6) 生成论文草稿包

```bash
pnpm deepscholar -- research paper write \
  --project-id "$PROJECT_ID" \
  --draft-id "draft-1" \
  --plan-id "demo-plan" \
  --title "DeepScholar Phase5 Demo Paper" \
  --home "$DS_HOME" \
  --json
```

### 7) 把 run 里的 metrics 直接长成论文里的表格和图形

```bash
pnpm deepscholar -- research paper visualize \
  --project-id "$PROJECT_ID" \
  --draft-id "draft-1" \
  --visual-id "smoke-health" \
  --run-ids "$RUN_ID" \
  --metrics "health" \
  --caption "Smoke experiment health metric" \
  --home "$DS_HOME" \
  --json
```

这一步会额外产出：

- `paper/figures/smoke-health/table.tex`
- `paper/figures/smoke-health/chart.tex`
- `paper/figures/smoke-health/visual-spec.json`
- `paper/figures/smoke-health/source-metrics.json`
- `paper/figures/smoke-health/render-visual.mjs`

### 8) 编译论文

```bash
pnpm deepscholar -- research paper compile \
  --project-id "$PROJECT_ID" \
  --draft-id "draft-1" \
  --home "$DS_HOME" \
  --json
```

编译成功后，至少应出现：

- `paper/drafts/draft-1/main.tex`
- `paper/drafts/draft-1/refs.bib`
- `paper/drafts/draft-1/compiled.pdf`
- `paper/drafts/draft-1/compile.log`

### 9) 准备三份评审意见并做汇总裁决

```bash
cat > "$REVIEWS_PATH" <<'EOF'
[
  {
    "reviewId": "r1",
    "projectId": "demo-phase5",
    "draftId": "draft-1",
    "reviewerId": "reviewer-1",
    "persona": "theory",
    "createdAt": "2026-03-12T00:00:00.000Z",
    "rubric": {
      "dimensions": {
        "originality": { "score": 8, "evidence": "clear novelty statement" },
        "soundness": { "score": 8, "evidence": "pipeline is coherent" },
        "experimentalRigor": { "score": 8, "evidence": "artifacts are reproducible" },
        "clarity": { "score": 8, "evidence": "paper structure is readable" },
        "relatedWorkCompleteness": { "score": 8, "evidence": "adequate for smoke demo" },
        "practicalImpact": { "score": 8, "evidence": "full loop is demonstrated" },
        "ethicsAndReproducibility": { "score": 8, "evidence": "audit trail is explicit" }
      },
      "totalScore": 56,
      "thresholds": { "accept": 7, "minorRevision": 5.5, "majorRevision": 4, "reject": 0 }
    },
    "summary": "solid demo",
    "strengths": ["reproducible", "auditable"],
    "weaknesses": ["toy experiment"],
    "questions": [],
    "recommendation": "accept"
  },
  {
    "reviewId": "r2",
    "projectId": "demo-phase5",
    "draftId": "draft-1",
    "reviewerId": "reviewer-2",
    "persona": "experimental",
    "createdAt": "2026-03-12T00:00:00.000Z",
    "rubric": {
      "dimensions": {
        "originality": { "score": 8, "evidence": "clear novelty statement" },
        "soundness": { "score": 8, "evidence": "pipeline is coherent" },
        "experimentalRigor": { "score": 8, "evidence": "artifacts are reproducible" },
        "clarity": { "score": 8, "evidence": "paper structure is readable" },
        "relatedWorkCompleteness": { "score": 8, "evidence": "adequate for smoke demo" },
        "practicalImpact": { "score": 8, "evidence": "full loop is demonstrated" },
        "ethicsAndReproducibility": { "score": 8, "evidence": "audit trail is explicit" }
      },
      "totalScore": 56,
      "thresholds": { "accept": 7, "minorRevision": 5.5, "majorRevision": 4, "reject": 0 }
    },
    "summary": "solid demo",
    "strengths": ["reproducible", "auditable"],
    "weaknesses": ["toy experiment"],
    "questions": [],
    "recommendation": "accept"
  },
  {
    "reviewId": "r3",
    "projectId": "demo-phase5",
    "draftId": "draft-1",
    "reviewerId": "reviewer-3",
    "persona": "application",
    "createdAt": "2026-03-12T00:00:00.000Z",
    "rubric": {
      "dimensions": {
        "originality": { "score": 8, "evidence": "clear novelty statement" },
        "soundness": { "score": 8, "evidence": "pipeline is coherent" },
        "experimentalRigor": { "score": 8, "evidence": "artifacts are reproducible" },
        "clarity": { "score": 8, "evidence": "paper structure is readable" },
        "relatedWorkCompleteness": { "score": 8, "evidence": "adequate for smoke demo" },
        "practicalImpact": { "score": 8, "evidence": "full loop is demonstrated" },
        "ethicsAndReproducibility": { "score": 8, "evidence": "audit trail is explicit" }
      },
      "totalScore": 56,
      "thresholds": { "accept": 7, "minorRevision": 5.5, "majorRevision": 4, "reject": 0 }
    },
    "summary": "solid demo",
    "strengths": ["reproducible", "auditable"],
    "weaknesses": ["toy experiment"],
    "questions": [],
    "recommendation": "accept"
  }
]
EOF
```

```bash
pnpm deepscholar -- research review decide \
  --project-id "$PROJECT_ID" \
  --draft-id "draft-1" \
  --reviews "$REVIEWS_PATH" \
  --home "$DS_HOME" \
  --json
```

如果这一步输出里出现 `debateTriggered=true`，项目会停在 `step11_peer_review` 且 `lifecycle=paused`。这时使用：

```bash
pnpm deepscholar -- research review debate-resolve \
  --project-id "$PROJECT_ID" \
  --draft-id "draft-1" \
  --verdict accept \
  --summary "chair resolved review disagreement" \
  --home "$DS_HOME" \
  --json
```

### 10) Step12 人类终审落槌

```bash
pnpm deepscholar -- research complete \
  --project-id "$PROJECT_ID" \
  --summary "ship it" \
  --home "$DS_HOME" \
  --json
```

### 11) 最终检查

```bash
pnpm deepscholar -- research status \
  --project-id "$PROJECT_ID" \
  --home "$DS_HOME" \
  --json
```

最终应看到：

- `project.lifecycle = "completed"`
- `project.step = "step12_human_final"`
- `project.gates.reviewCompleted = true`

同时项目目录中至少应存在：

- `meta.json`
- `audit_log.jsonl`
- `checkpoints/*.json`
- `runs/<runId>/*`
- `paper/drafts/draft-1/*`
- `paper/figures/smoke-health/*`
