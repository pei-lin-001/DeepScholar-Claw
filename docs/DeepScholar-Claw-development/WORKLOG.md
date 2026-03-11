# DeepScholar-Claw Worklog

## 2026-03-11

### 已完成

- 建立 `services/` 层并纳入 workspace。
- 建立 `packages/deepscholar-contracts/` 作为共享契约层。
- 建立四个核心服务骨架：
  - orchestrator
  - paper-intel
  - runner
  - provenance
- 为各服务写清“负责什么 / 不负责什么”。
- 修正服务入口默认打印副作用，避免后续服务日志被动污染。
- 为共享契约补齐核心对象与校验函数：
  - 项目章程
  - 研究计划
  - 实验规格
  - 结论账本
- 为服务层补齐第一批真正工作的基础规则：
  - 阶段状态机
  - 预算门控
  - 失败分型
  - 结论账本汇总
- 把 `packages/` 和 `services/` 纳入 Vitest 测试视野。
- 跑通第二轮定向测试：7 个测试文件、13 条测试全部通过。

### 新增交付（Phase 2 开始：计划冻结 + 证据账本升级）

- 把“研究计划”从一张松散清单升级为可冻结、可审批、可校验的结构化对象：
  - 计划草案（ResearchPlanDraft）用于承载假设、成功阈值、baseline、数据集、评估指标、预算 envelope、停止规则。
  - 冻结计划（ResearchPlan）携带 `frozenAt/approvedBy/approvedAt`，为后续“不能见数据改故事”提供制度底座。
- 把“结论账本”从“只写一句话+一个指标”升级为 Claim-Evidence Ledger：
  - 结论（Claim）包含多个断言（Assertion），每个断言都必须绑定到证据（EvidenceBinding）。
  - 证据明确记录：runGroup、metric、values、seedCount、可选 CI/p-value、以及对比型断言的 baselineComparison。
  - 审计状态从 boolean 变为更贴近真实流程的 `draft/verified/disputed`，并要求 verified 断言必须带签名人与签名时间。
- Provenance 服务的账本汇总不再只会“数个数”：
  - 现在能输出断言级别的审计状态分布（verified/draft/disputed）。
  - 还能标出证据缺口（比如强断言缺少统计支撑、对比断言缺 baselineComparison 等），用于后续在编排层做硬门控。

### 本轮验证

- contracts 与 provenance 的定向单测保持在 60 秒内通过（使用 `perl -e 'alarm 60; ...'` 约束）。

### 新增交付（Spec Phase 1：文献模块完整跑通）

- 现在你可以把“找论文”从一句空话变成一条可执行流水线：
  - `openclaw research literature search`：从 Semantic Scholar / OpenAlex 搜索论文元数据，输出列表（可 JSON）。
  - `openclaw research literature ingest`：把搜索结果做去重、质量过滤，然后落盘到 `~/.deepscholar/projects/<projectId>/literature/papers/`。
- 现在你可以把 PDF 变成可追溯的结构化产物：
  - `openclaw research literature grobid`：把本地 PDF 送去 GROBID 解析，并把 TEI XML 保存到 `.../literature/parsed/`。
  - 这一步的意义是：后续做引用核对、章节证据卡片、表格/图表抽取时，不再靠“看 PDF 猜结构”。
- 现在你可以把“引用关系”落到知识图谱里：
  - 在 `services/paper-intel` 内实现了 GraphStore 接口，并提供 Neo4j 适配器。
  - `openclaw research literature graph-build` 可以把已落盘的论文写入 Neo4j（paper/authors/cites/authoredBy）。
- 现在你可以做第一版 Graph RAG 检索（局部 + 全局）：
  - 全局：对本地落盘论文做可解释的词法检索排序（标题权重大，摘要次之）。
  - 局部：对命中 paper 节点做邻域扩展（引用列表 + 作者），把“搜索命中”升级成“可继续追问的上下文包”。
  - `openclaw research literature query` 默认用 memory 图后端（本地快速），也可切到 `--graph-backend neo4j` 走真实图数据库。

### 本轮验证

- `services/paper-intel` 新增的 sources / ingest / grobid / graph / query 全部有单测覆盖，并保持 60 秒内通过。
- OpenClaw CLI 的 lazy subcommand 注册链路补了 research 的测试，确保 `openclaw research ...` 不会只停留在“命令存在但点不动”。

### 当前判断

- 项目最重要的第一步不是做功能堆砌，而是把控制面和科研重逻辑切开。
- 现在的骨架已经让后续开发可以按服务边界推进，而不是继续在大仓库里到处散点开工。
- 第二轮之后，项目已经不只是“搭好了空车间”，而是给几条最关键的制度上了锁：
  - 研究阶段不能乱跳
  - 大额/高风险资源会被门控拦下
  - 失败不再是一锅粥，而是开始分型
  - 论文结论有没有盖章，系统已经能数得出来

### 清理审计

- 已检查当前仓库是否存在可以立即删除的 repo 追踪冗余文件。
- 结论：本轮暂未发现“当前证据足以证明冗余且删除不会伤及控制面复用”的上游源码/文档。
- 当前只保留“保守清理”策略：先建立替代结构，再按功能替换结果做定点裁剪。

### 新增交付（Phase 2 完成：编排引擎 + 记忆系统 + 审批闭环）

- 现在“研究项目”不再只是一个聊天话题，而是一套会落盘、会留痕、能复盘的工程对象：
  - 项目元信息写入 `~/.deepscholar/projects/<projectId>/meta.json`
  - 每次关键动作都会追加一条不可变审计记录到 `audit_log.jsonl`
  - 每次关键动作都会落一个 checkpoint，为“中断可恢复”打底
- 现在“科研流程”不再靠大家凭感觉推进：
  - 12 步流程有明确的顺序与门控条件，想跳步会被当场拦下并给出原因
  - Turn-based bus 让决策按顺序排队处理，避免多人同时推动把状态撞碎
- 现在“预算审批”不再是口头承诺，而是能闭环的暂停开关：
  - 发起申请后项目会进入 paused，并记录 pending requestId
  - 人类批准后门控会盖章（budgetApproved=true），并在条件满足时推进到下一步
  - 人类拒绝后项目保持 paused，审计日志保留拒绝人/时间/理由
- 现在固定三大角色不再是“概念”，而是在编排层有清晰的身份牌子：
  - 主编、审计、财务三类常驻 Bot 的使命/边界写死在固定定义里
  - 同时支持注册“特战队 Bot 模板”，但仍受编排层步骤约束
- OpenClaw 控制面桥接完成（CLI 先跑通闭环）：
  - `openclaw research start/status/plan freeze/budget request/approve/reject/resume/abort`
  - 这让 Phase 2 能在不依赖 Telegram 的前提下先把制度骨架跑通

### 本轮验证

- Phase 2 定向测试在 60 秒内通过（包含 CLI 闭环测试）：
  - `perl -e 'alarm 60; exec @ARGV' pnpm exec vitest run services/orchestrator/src/*.test.ts packages/deepscholar-contracts/src/*.test.ts src/cli/research-orchestrator-cli.test.ts`

### 新增交付（Phase 2 加固补丁：写入一致性 + 证据留底 + 更严校验）

- 编排器的“保存动作”从“先写了就算”升级成“要么全写成，要么当场撤回”：
  - 当项目状态写入成功，但 checkpoint 或审计日志写入失败时，系统会把 `meta.json` 回滚到上一个稳定状态。
  - 这解决的是一种最危险的半吊子状态：界面/状态看似推进了，但证据账本缺页，后续会越跑越乱。
- 记忆压缩不再“只留摘要就把原话丢了”：
  - 压缩 Working 记忆时，会先把原始条目追加到 Archival 层，再写入一条压缩摘要。
  - 这样既能控住上下文长度，又不会让追责/复盘时“找不到原始材料”。
- 预算门控从“事后发现超支”变成“入口直接拦下”：
  - 当申请会导致超预算时，预算申请会被明确拒绝，并给出拒绝原因（例如超预算/超过 20% 阈值等）。
- 审批状态加了“防二次盖章”的保护：
  - 现在只有 `pending` 的申请才允许批准/拒绝，避免重复操作把审批链条弄脏。
- 契约校验更接近真实世界的“脏数据”场景：
  - `isIsoTimestamp` 增加格式前缀正则校验，避免 Date.parse 过度宽松。
  - 多个关键枚举字段加入运行时校验（例如记忆层级、审批状态、断言类型等），坏数据会被明确指出而不是悄悄混过去。
- CLI 输出行为与 OpenClaw 运行时规范对齐：
  - 研究相关 CLI 输出统一走 `runtime.log`，使其能被 OpenClaw 的日志捕获机制一致处理。
- 同步做了小范围架构整理：
  - 将编排器引擎文件按职责拆分为多个小模块，确保单文件规模与函数规模都保持可维护。

### 新增交付（Phase 3 开始：本地冒烟 Runner + Docker 沙箱闭环）

- 现在“实验”终于有了一个最小但完整的落地形态：一辆能开、能停、能回看的小车
  - 你可以发起一次冒烟实验，系统会生成一个 runId，并把所有产物按 runId 归档到 runs 目录。
  - run 不是一段文字描述，而是一份结构化记录（run.json），包含状态、时间戳、退出码、失败摘要等信息。
- 现在“跑起来”不再等于“在屏幕上打印一句 ok”
  - 每个 run 目录至少会有 stdout.log、stderr.log、metrics.json，让复盘时有原始材料可查。
- 现在 Runner 不再依赖“你机器上刚好装了什么”
  - Docker 执行被抽象成可注入的依赖：单测不需要真实 Docker，也能证明状态流转与落盘行为正确。
- OpenClaw CLI 已接入 Runner（Phase 3.1）
  - `openclaw research runner smoke/status/abort` 可用于本地冒烟闭环验证。
