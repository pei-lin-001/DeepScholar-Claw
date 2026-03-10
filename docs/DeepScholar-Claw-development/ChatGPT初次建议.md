下面这份文档，我按“可以直接立项、做架构评审、再往下拆研发任务”的标准来写。

## 先给判断

你的方向是对的，而且现在已经有足够多的外部参考，证明“文献调研→实验执行→写作→评审”的科研闭环可以被大模型显著自动化；但要把它做成**可持续运行、可控成本、可审计、可复现**的系统，不能把 OpenClaw 直接当成整套科研工厂本体，而应把它定位为**控制面与人机入口**。OpenClaw 官方已经具备本地化 Gateway、多智能体路由、按 agent 隔离的 workspace / state / session、技能、记忆检索、上下文压缩、heartbeat / cron，以及带审批点和恢复令牌的 Lobster 工作流，这些都很适合做“科研总控台”。但 OpenClaw 官方安全模型明确是“一个可信操作者的 personal assistant”，不是共享多租户边界；会话 ID 只是路由控制，不是用户级授权边界。因此，**长期工作流恢复、算力调度、证据账本、预算风控、实验执行隔离**必须作为 OpenClaw 之外的独立层来建设。([GitHub][1])

外部项目也给出了非常明确的信号：The AI Scientist v1 已经把“创意生成、文献检索、实验迭代、作图、写稿、自动评审”串成一条低成本闭环，公开材料给出的成本约为每篇 15 美元；AI Scientist v2 进一步做到了更泛化的端到端系统，并报告了首篇完全由 AI 写成且通过同行评审的 workshop 论文；Agent Laboratory 则强调人类在关键节点介入会显著改善质量；MLAgentBench 反过来提醒了现实约束——即便是很强的模型代理，在真实 ML 实验任务上的平均成功率也远没到“放任自流”的程度，长程规划与幻觉仍是核心难点。换句话说，**闭环可做，但必须把“止损、审计、复现、审批”做成一等公民**。([Sakana AI][2])

---

## 一、对你当前设想的判断：哪些是对的，哪些要升级

### 1）“固定常委 + 动态特工”是对的，但要加权限与寿命边界

你提的固定班底和动态小队非常合理。OpenClaw 的多 agent 机制天然支持每个 agent 拥有独立 workspace、agentDir、会话与认证配置，而且 per-agent sandbox / tool restriction 已经是官方支持能力，所以它很适合承载“常驻总控角色”和“按课题临时实例化的领域专家”。但动态 agent 不能只是逻辑概念，必须变成**有 TTL、预算上限、工具白名单、可销毁 workspace** 的真实运行单元。([OpenClaw][3])

### 2）“单线程黑板”思路对，但不能拿它当整个系统的总线

你的“thread=1，强制排队发言”思路对多智能体协作很重要，因为它能减少抢话和状态错乱；但如果把整个科研系统都建立在单线程对话黑板上，会很快遇到三个问题：吞吐低、状态不可恢复、并行实验难管理。更好的做法是：**决策层串行，执行层并行**。也就是让“主编 Bot / 审计 Bot / 财务 Bot”在一个受控的串行决策通道里说话，但实际的文献抓取、实验运行、日志分析、图表生成都走外部工作流引擎与任务队列。OpenClaw 的 heartbeat 更适合周期感知，cron 更适合精确调度；Lobster 更适合短小、确定性、带审批闸门的微工作流，而不是整个多天科研流程的唯一骨架。([OpenClaw][4])

### 3）“Embedding 记忆”方向对，但科研系统必须有结构化真相源

OpenClaw 已经有 QMD 记忆索引与自动 compaction，适合保留会话连续性与工作笔记；但科研闭环最怕“对话记忆替代事实存储”。真正的系统真相源必须是结构化对象：`Proposal`、`ResearchPlan`、`ExperimentSpec`、`Run`、`Claim`、`FigureSpec`、`Review`、`Approval`。会话摘要只能帮助 agent 回忆，**不能成为论文结论的证据来源**。([OpenClaw][5])

### 4）“Graph RAG 文献库”方向非常对，但要做成“图过滤 + 证据回取”，而不是只有图

你反对粗暴 chunking 是对的。微软 GraphRAG 的核心就是把语料构造成知识图谱，再配合 community summaries 在查询时增强提示，这与你的思路高度一致。我的建议不是只做“论文知识图谱”，而是做两层：上层是**文献关系图 / 方法图 / 数据集图 / 引文图**，下层是**可引用的 section-level 证据卡片**。图负责“找到该读哪几篇”，证据卡负责“精确引用哪一段”。这样才能同时兼顾启发式选题与论文写作时的严谨引用。([GitHub Microsoft][6])

---

## 二、你当前想法里还没充分考虑到的关键问题

### 1）最大的缺口不是“智能程度”，而是**信任边界**

OpenClaw 官方明确写了：一个 Gateway 不是多租户、对抗式用户边界；认证后的 Gateway 调用者被视为可信操作者，会话标识不是授权边界，推荐是“一人一机/一 host/一 gateway”。这意味着你的系统如果将来允许多人共同驱动，或者把某些 agent 暴露给群聊、共享频道、公开 webhook，就不能靠 session 隔离来解决权限问题，必须按**OS 用户、主机、Gateway 实例**做硬隔离。([GitHub][7])

### 2）最大的工程风险不是“代码写不出来”，而是**长期流程断电后无法恢复**

科研任务天然跨小时、跨天、跨多轮修订。OpenClaw 本身有很强的 agent runtime，但对“一个项目跑了 36 小时、途中两次审批、一次 worker 崩溃、一次 GPU 被回收，然后还要从上次状态继续”的场景，仍需要专门的 durable execution 层。Temporal 的核心卖点就是工作流的状态和进度在失败后可恢复；Argo 则擅长 Kubernetes 上的大量并行容器作业。我的建议是：**科研总流程用 Temporal，实验批量 fan-out 用 K8s Job/Argo**。([Temporal 文档][8])

### 3）你现在的“纪委 Bot 对日志”还不够，要升级为**Claim-Evidence Ledger（结论-证据账本）**

只对日志，很容易漏掉三类造假或误导：
一是写作 Bot 可能没编数据，但会做**选择性汇报**；
二是可能把不公平 baseline 当成公平对比；
三是可能在 narrative 上夸大统计意义。

因此必须要求论文中的每一个数值结论、图表、甚至“优于”“显著提升”“更稳定”这类措辞，都绑定到结构化证据：`run_group_id`、`metric_name`、`seed_count`、`aggregation_rule`、`CI/std`、`figure_spec_id`。写作 agent 不能手输数字，只能从已验证的 metric registry 取数。

### 4）“失败即回炉”还不够，要把失败分型

建议把失败分成三类：

- **基础设施失败**：环境、下载、权限、OOM、超时、节点失联。
- **实现失败**：NaN、loss 不收敛、评测脚本错、标签泄漏、数据对齐错误。
- **科研失败**：代码无 bug、实验健康，但结果就是不提升。

前两类应该进入修复回路，第三类才进入“熔断换题”。不分型，系统就会把本该修 bug 的问题误判成科研死路，或者把已经无望的选题继续烧钱。

### 5）你现在的财务审批会太碎，建议改成**预算 envelope 模式**

如果每开一次机、每跑一次实验都问人类，会把系统拖成半自动。更好的模式是两级预算：

- 项目级 envelope：例如“这个课题最多花 300 美元，允许 2 张 A100，允许调用某两家模型 API”。
- 异常追加审批：只有超过 envelope、切换更贵硬件、或进入大规模 sweep 时再打断。

Lobster 正好适合做这种“有明确副作用、需要审批、可以恢复”的短工作流；更长的审批链则由 Temporal 的 human task 承接。([OpenClaw][9])

### 6）你还缺一个很重要的东西：**预注册式 Research Plan**

科研系统最容易“见数据改故事”。所以在正式实验前，必须先产出并冻结一个 `ResearchPlan`：

- 研究假设是什么；
- 成功条件是什么；
- 用哪些 baseline；
- 对哪些数据集和指标评估；
- 允许的 compute 预算是多少；
- 什么时候判定此方向失败。

这相当于把“移动球门”提前堵住。

### 7）你需要显式防范**benchmark contamination 与信息泄漏**

如果 agent 在实验中可以自由联网、看 leaderboard、看测试集说明、抓到别人近期公开答案，它可能无意中“作弊”。这在自动科研系统里不是边缘问题，而是中心问题。解决方式是：

- 评测阶段尽量离线；
- 测试集和 leaderboard access 受策略控制；
- 将“可联网文献调研 agent”和“执行评测 agent”分离；
- 对高价值 benchmark 使用隐藏测试封装。

### 8）你还没有把**论文版本、文献版本、数据集版本**问题说透

一篇论文可能有 arXiv 版、会议版、期刊版、勘误版；一个数据集可能有多个预处理版本；一段实验代码可能在你跑到一半时依赖升级。文献层至少需要融合 OpenAlex、Semantic Scholar、Crossref 这三类元数据：OpenAlex 提供开放的研究图谱与大规模实体关系，Semantic Scholar 提供论文/引文/推荐/SPECTER2 embedding，Crossref 提供 funding、license、post-publication updates、ORCID/ROR 等元数据。没有这个版本治理，后期可复现性会很差。([developers.openalex.org][10])

### 9）你需要把“自动评审”从角色扮演升级为**制度化 review protocol**

OpenReview 默认表单本来就有 rating 和 confidence；ARR 强调 reproducibility 和 ethics；NeurIPS 要求 review 必须有依据、要引用证据并使用 checklist；ICLR 则强调 discussion phase 中 reviewer 应根据回复更新判断。你的审稿 Bot 不该只是“扮演苛刻审稿人”，而应执行一个真正的协议。([OpenReview Documentation][11])

### 10）你还需要显式声明**非目标**

第一版不要碰：

- 物理实验、湿实验、医疗建议、临床或人类实验；
- 自动投会 / 自动投稿；
- 多人混用一个高权限 Gateway；
- 未授权的第三方技能自动安装。

The AI Scientist v1 公开说明的适用范围，本质上也是“能表达成代码的研究方向”；这恰好能帮你把第一版边界收得更稳。([GitHub][12])

---

## 三、同类/相关项目对你最有价值的借鉴

### 1）The AI Scientist v1：证明闭环能跑通

它已经把 idea generation、literature search、experiment planning、experiment iteration、figure generation、manuscript writing 和 reviewing 串起来了，且公开材料给出“约 15 美元一篇”的量级。你可以借鉴它的“从已有代码模板出发”策略。第一版别追求从零生万物，先从**强模板、强基线、强约束**做起。([Sakana AI][2])

### 2）The AI Scientist v2：证明更泛化的科研 agent 可以存在

它去掉了人工代码模板，加入 experiment manager agent 的 tree search，还把 VLM 引入图表内容与美观反馈，甚至报告了“向 ICLR workshop 提交的三篇全自动稿件中，有一篇超过平均人类录用阈值”。但它自己也提醒：v2 不一定比 v1 成功率更高，而且明确警告这类系统会执行 LLM 写出的代码，必须在受控沙箱里运行。这个教训非常关键：**泛化能力越强，越需要更硬的运行时约束。** ([arXiv][13])

### 3）Agent Laboratory：证明“人类关键介入”不是失败，而是提质

它把流程压成 literature review、experimentation、report writing 三阶段，并且论文与 README 都强调：人类反馈能提升质量，而且其成本相对更早期自动科研方法有显著下降。你的系统里“研究总监”和“财务总管”这两个角色应该保留，而且要制度化。([GitHub][14])

### 4）MLAgentBench：证明别把成功率想得太高

它是最该让架构师清醒的项目：真实 ML experimentation 任务上，强代理的平均成功率只有 37.5%，而且从老 benchmark 的 100% 到新 Kaggle 任务的 0% 波动非常大，论文明确点出了 long-term planning 和 hallucination 这两个核心难题。你的系统如果没有 stop-loss、RCA、人工闸门和 reproducibility gate，后面只会变成大额自动烧钱机。([arXiv][15])

### 5）OpenClaw 生态里已经有人在做“科研自动化”尝试

有社区插件 Scientify，已经把 literature survey、deep analysis、implementation plan、code implementation、automated review、full experiment 这 6 个阶段串起来；也有社区仓库直接把 OpenClaw 定位为 multi-agent scientific research platform。它们说明你这条路不是孤例，但也恰恰说明：**现在最缺的不是 demo，而是制度化的安全、审计、预算、证据链。** ([GitHub][16])

---

## 四、推荐的系统总架构

### 总原则

不是“让一群 Bot 自由聊天”，而是：

**串行决策 + 并行执行 + 结构化状态 + 证据优先**

### 四层架构

**第 1 层：OpenClaw 控制面**
负责：

- 人类入口（Telegram/Slack/Discord/Teams 等你实际启用的渠道）；
- 常驻 agent 运行时；
- skills / plugins；
- 轻量审批流；
- 状态播报、heartbeat、cron。
  OpenClaw 适合做这个层，因为它已经有本地 Gateway、agent 路由、typed tools、skills、sessions、memory、cron/heartbeat 和 Lobster。([GitHub][1])

**第 2 层：科研工作流编排层**
建议单独建 `research-orchestrator` 服务，核心职责：

- 状态机推进；
- 任务分发；
- 审批暂停/恢复；
- 重试与补偿；
- 失败分类与 RCA；
- 项目级预算控制。
  这里首选 Temporal；如果实验 fan-out 很重，再加 Argo/K8s Job。([Temporal 文档][8])

**第 3 层：学术知识与证据层**
包含：

- 文献抓取与元数据融合；
- Paper Graph / Claim Graph；
- 检索与 novelty scoring；
- 引用与证据卡片；
- 结论-证据账本。
  OpenAlex、Semantic Scholar、Crossref 是最值得作为底层元数据源的组合。([developers.openalex.org][10])

**第 4 层：实验执行与产出层**
包含：

- 代码生成与 patch；
- 环境构建；
- 训练/评测作业；
- sweep/ablation；
- 图表生成；
- 写作与审稿。
  这里必须与 OpenClaw Gateway 宿主机分离，运行在沙箱 worker 或容器集群上。

---

## 五、OpenClaw 在这个项目里的正确定位

### 应该直接复用的部分

1. **多 agent 路由与隔离工作区**：适合固定常委与轻量动态 agent。([OpenClaw][3])
2. **skills**：适合为不同科研角色注入固定工作规范。([OpenClaw][17])
3. **typed tools**：优先用 OpenClaw 的 browser / cron / sessions / nodes / messaging 等 typed tools，不要把核心控制逻辑都做成 shell skill。([OpenClaw][18])
4. **memory + compaction**：用于会话连续性和工作笔记。([OpenClaw][5])
5. **heartbeat / cron**：heartbeat 做健康巡检与日报，cron 做精确时间触发。([OpenClaw][4])
6. **Lobster**：做审批、发布、通知等短流程，非常合适。([OpenClaw][9])

### 不应该让 OpenClaw 单独承担的部分

1. 长周期科研主状态机。
2. 大规模 GPU 作业调度。
3. 真正的多租户安全边界。
4. 证据账本与不可变 provenance 存储。
5. 精细的预算台账与 provider 计费对账。

### 最重要的工程策略：**插件优先，外部服务优先，少改 OpenClaw core**

OpenClaw 官方插件机制允许扩展工具、命令、Gateway RPC 和后台服务；但插件与 Gateway 运行在同一进程里，官方文档明确建议把插件视为受信任代码。换句话说，越重的业务逻辑越不应该直接塞进 OpenClaw 进程。建议做法是：

- 在 OpenClaw 里只放“薄插件”：调用外部服务的客户端工具；
- 复杂状态机、实验编排、图谱 ETL、预算系统都放独立服务；
- 只在确实需要 typed agent tool 时，再写 OpenClaw 插件桥接。([OpenClaw][19])

---

## 六、推荐的智能体组织架构

### 固定常委

**1. 主编 Bot（Chief Editor）**
唯一能推进项目阶段的人。负责立项、调度、调用审批、汇总状态，不直接写重实验代码。

**2. 纪委 Bot（Discipline / Provenance Officer）**
唯一有权签发“结果有效”的角色。负责 claim-evidence 审核、baseline 公平性、seed 数、图表可追溯性、论文中的数字校验。

**3. 文献情报 Bot（Literature Intelligence）**
负责领域扫描、候选论文图谱、空白点发现、引用核对。

**4. 实验经理 Bot（Experiment Manager）**
把 proposal 变成 `ResearchPlan` 与 `ExperimentSpec`，决定下一轮实验而不是亲自下场写每一行代码。

**5. 写作排版 Bot（Writer）**
只允许从经过验证的 claims / figures / citations 生成正文，不允许自由编数。

**6. 审稿委员会协调 Bot（Review Chair）**
组织盲审 reviewer agents、汇总分歧、触发 rebuttal / revision。

**7. 财务风控 Bot（Budget Officer）**
只负责预算 envelope、provider 选择、异常开销审批，不接触研究内容判断。

### 动态特工

按项目临时生成：

- 理论分析 Bot；
- 某子领域实现 Bot；
- 数据集适配 Bot；
- Debug Bot；
- Ablation 专家 Bot；
- Reproduction Auditor Bot；
- Rebuttal Bot。

动态 agent 统一要求：

- 有 TTL；
- 有单任务预算上限；
- 有只读 / 读写边界；
- 任务结束即销毁；
- 输出必须写回结构化产物，而不是只留在聊天记录里。

---

## 七、完整研发流程（推荐 12 步）

### 0. 项目包络设定

人类输入：研究主题边界、允许数据源、目标 venue、预算上限、禁止事项。
输出：`Project Charter`。

### 1. 文献采集与去重

抓取 top venue + arXiv watchlist + code/repo signals，融合 OpenAlex / Semantic Scholar / Crossref 元数据，做 DOI / arXiv / title 级去重与版本归并。([developers.openalex.org][10])

### 2. 图谱建模与空白点发现

生成 Paper Graph、Method Graph、Dataset Graph、Claim Cards，跑 novelty / feasibility / cost 三维评分，形成 3–5 个 proposal。

### 3. 内部立项会

主编 Bot 汇总 proposal，纪委 Bot 从“是否可验证”角度打回不靠谱方案，财务 Bot 给出粗预算。
人类只在这里拍板方向。

### 4. 预注册研究计划

生成 `ResearchPlan`，冻结：

- 研究假设；
- 成功阈值；
- baseline；
- 数据集；
- 指标；
- 预算；
- 停止条件。
  没有这一步，不允许进入正式实验。

### 5. 环境合成与 smoke test

先做最小运行：

- 依赖能否装上；
- 数据能否读到；
- 2 epoch / 小样本能否跑通；
- 指标脚本能否产出。
  这一步专门过滤“不是科研失败，只是工程没跑起来”的情况。

### 6. 闭环实验迭代

循环：实现 → 运行 → 诊断 → 修复 / 调整 → 再运行。
这里允许动态 agent 出场，但所有外部执行都经 `ExperimentSpec` 走 runner，不允许 agent 直接在宿主机上“即兴开干”。

### 7. RCA 与熔断

若结果差：

- 先判 infra / implementation / scientific failure；
- 只有 scientific failure 才触发“课题熔断或 pivot”；
- 所有失败都写 `RCA Report`。

### 8. 结果稳定化

进入论文前必须补：

- 多 seed；
- ablation；
- 统计量；
- 复现实验；
- fairness 检查。
  这一层过不了，不能写“最终结果”。

### 9. 证据绑定

生成 `Claim Ledger`：

- 每个数字；
- 每张图；
- 每条对比结论；
- 每条引用。
  全部绑定到 runs / artifacts / citation snippets。

### 10. 论文与图表生成

Writer Bot 只能消费：

- verified claims；
- approved figures；
- approved citations。
  任何未绑定证据的内容都进不了正文。

### 11. 模拟同行评审

3 个独立 reviewer + 1 个 meta-reviewer + 1 个 ethics reviewer。
独立打分、汇总、作者回复、二轮审。评分机制后面详述。

### 12. 人类终审与发布包

提交给你的是一个完整包，而不是一篇 PDF：

- 稿件；
- 图表；
- 代码快照；
- artifact manifest；
- claim ledger；
- RCA；
- 预算报告；
- reproducibility report。

---

## 八、核心数据模型

建议以 Postgres 为主真相源，S3/MinIO 为产物存储，pgvector 为向量检索。图查询需求真的强到一定程度，再引 Neo4j；第一版不要一上来就把图数据库做成单点依赖。

最核心的对象是：

- `Project`：主题、边界、预算、目标 venue、状态。
- `Proposal`：新意、可行性、预估算力、相关论文、预期风险。
- `ResearchPlan`：预注册的假设、成功条件、baseline、metrics、stop rules。
- `ExperimentSpec`：代码基线、镜像、命令、资源申请、数据挂载、预算。
- `Run`：执行状态、日志、metrics、seed、artifact URI、成本。
- `RunGroup`：同一实验意图下的多 seed / 多 ablation 集合。
- `Claim`：正文中的一个结论单元。
- `FigureSpec`：图如何从哪些 run 生成。
- `CitationEvidence`：引用对应的具体 paper section/snippet。
- `Review`：审稿意见、评分、置信度、blocker。
- `Approval`：预算或发布审批记录。
- `Incident/RCA`：失败分类、根因、修复动作、是否熔断。

---

## 九、文献与知识层的具体设计

### 文献源

建议至少接三类：

- **OpenAlex**：开放研究图谱，覆盖 works / authors / institutions / topics / funders，适合作为全局骨架。([developers.openalex.org][10])
- **Semantic Scholar API**：适合论文、引文、推荐、SPECTER2 embeddings、数据集链接等。([Semantic Scholar][20])
- **Crossref**：适合 DOI、license、funding、post-publication updates、ORCID/ROR 等清洗。([www.crossref.org][21])

### 存储策略

不要“全文切块后直接扔向量库”就结束。建议存三种东西：

1. `PaperRecord`：元数据与版本信息；
2. `SectionRecord`：摘要、方法、实验、局限性等 section 边界；
3. `ClaimCard`：从论文中抽取出的“创新点 / 数据集 / 指标 / 局限性 / 可复现性风险”。

### 检索策略

两阶段：

- 第一阶段：图过滤，找到最相关的 5–20 篇；
- 第二阶段：section / snippet 级证据回取，供引用与对比。

这样既保留上下文完整性，也避免 agent 因为“整篇论文全塞进上下文”而成本爆炸。

---

## 十、实验执行层的具体设计

### 执行原则

**所有实验都经 Runner，不允许 agent 直接在 Gateway 主机上长期执行。**

### Runner 设计

`runner.submit(spec)` 接收 `ExperimentSpec`，产出 `run_id`。
`runner.status(run_id)` 返回状态、资源使用、日志片段、metrics 摘要。
`runner.abort(run_id)` 负责止损。
`runner.collect(run_id)` 汇总 artifacts。

### 最小必备记录

每个 run 至少记录：

- git commit hash / patch hash；
- 依赖锁文件；
- 容器镜像 digest；
- 数据集版本；
- 随机种子；
- 硬件类型；
- stdout / stderr；
- metrics；
- checkpoints；
- 成本。

### sweep 与搜索

内层参数搜索可以接 W&B Sweeps 或 ClearML：

- W&B Sweeps 适合快速做 Bayesian / grid / random 搜索和多机并行；([Weights & Biases 文档][22])
- ClearML 适合做实验跟踪、环境记录、stdout/stderr、resource monitoring、artifacts、dataset/version 与远程 agent 编排。([GitHub][23])

但要注意：这些工具只适合做**内层实验管理**，不要让它们替代你的科研主状态机。

---

## 十一、学术诚实与防造假：建议的“铁律”

### 铁律 1：数字只能来自 registry，不能来自自由文本

Writer Bot 禁止直接看日志拼数字，只能调用 `claim_get` / `metric_get`。

### 铁律 2：图只能由 FigureSpec 生成

图表必须是“声明式生成”，不允许手工截图或二次修图替换。

### 铁律 3：baseline 要有公平性声明

每个对比实验必须记录：

- 参数量是否同级；
- 训练预算是否同级；
- 数据预处理是否一致；
- 评测脚本是否统一。

### 铁律 4：负结果也要归档

不能只保留“好看”的 runs。
纪委 Bot 有权检查“是否存在被隐藏的失败 run group”。

### 铁律 5：论文里的强断言必须带统计支撑

“显著提升”“更稳定”“更高效”都要有对应统计量或成本量化依据。

---

## 十二、RCA 与止损机制

建议定义一套默认策略：

- **Infra failure**
  - 允许自动重试 1–2 次；
  - 超过上限转 Debug Bot；
  - 不计入课题科学失败次数。

- **Implementation failure**
  - 最多 3 轮修复；
  - 每轮必须附带 bug hypothesis；
  - 修复后先 smoke test 再全量跑。

- **Scientific failure**
  - 满足“代码健康 + 指标无明显提升 + 复现实验确认”才记为科学失败；
  - 连续 2–3 个健康 run group 都未达到预注册成功阈值，则触发 pivot / kill 评审。

- **Budget stop**
  - 消耗超过项目 envelope 的 40% 仍未获得一个可复现实验包时，强制中断并请求人类是否继续。

---

## 十三、模拟同行评审协议

建议不是“50 条散乱 checklist”，而是**12 个维度、每个维度若干硬指标**：

1. 问题重要性
2. 新意是否被文献证据支撑
3. 技术正确性
4. baseline 公平性
5. 实验设计完整性
6. ablation 完整性
7. 复现性
8. 图表与叙事一致性
9. 局限性披露
10. 伦理 / 安全
11. 写作清晰度
12. 成本-收益合理性

评分协议建议直接借鉴真实社区：

- 主评分 1–10，置信度 1–5，参考 OpenReview；([OpenReview Documentation][11])
- 复现性单独 1–5，伦理问题单独 flag，参考 ARR；([ACL Rolling Review][24])
- reviewer 必须给出有证据的意见，不能空泛，参考 NeurIPS reviewer guideline；([NeurIPS][25])
- 支持 rebuttal / discussion / 更新 recommendation，参考 ICLR discussion phase。([ICLR][26])

流程上建议：

- 三个 reviewer 彼此隔离；
- 一个 meta-reviewer 汇总争议；
- 一个 ethics reviewer 专门看风险；
- 只在分歧大的条目上进入公开辩论，不做无边界群聊。

---

## 十四、安全与部署红线

这是整份文档里最不能妥协的部分。

### 1）Gateway 不要暴露到公网

OpenClaw 官方安全文档推荐 loopback + token auth 的 safe baseline，Gateway auth 默认也是 fail-closed。([OpenClaw][27])

### 2）一个 trust boundary 一个 Gateway

官方明确说了：一个 Gateway 不是多租户对抗边界；如果有 mixed-trust 用户，要按 OS user / host / gateway 隔离。([GitHub][7])

### 3）科研 code agent 必须强制沙箱

官方安全页明确写了：默认 `agents.defaults.sandbox.mode` 是 off，exec 在无沙箱时会落到 Gateway 主机；而 `tools.elevated` 是全局逃逸口。你的系统里，除极少数 infra-admin agent 外，应彻底禁用 elevated，并要求 code / experiment agents 只在 sandbox worker 上运行。([GitHub][7])

### 4）大多数 agent 禁止 `sessions_spawn`

官方文档直接建议：除非真的需要，否则 deny `sessions_spawn`；若必须用 delegated child，也要限制 `allowAgents`，并在需要时指定 `sandbox: "require"`。([OpenClaw][27])

### 5）第三方 skills 与 plugins 一律视为高风险

官方 skills 文档已经写得很清楚：第三方 skill 要视为不可信代码；而 skill 的 `env` / `apiKey` 会注入 host process，不是注入 sandbox。插件则与 Gateway 同进程运行，属于受信任代码。结论很简单：**生产系统不要允许 agent 自己从公共 registry 随机装 skill。** 建内部白名单仓库。([OpenClaw][17])

### 6）浏览器与联网能力严格分层

官方安全页提醒，browser control 等于让 agent 操作真实浏览器配置，而且私网访问默认是允许的，除非你显式关掉相关策略。科研系统里，文献抓取 agent 可以联网，但执行评测 agent 应尽量离线；绝不能让训练 agent 继承人类的日常浏览器 profile。([OpenClaw][27])

### 7）保持快速升级

我不建议深度 fork OpenClaw core，还有一个现实原因：OpenClaw 在 2026 年 3 月上旬官方安全页还在持续列出新的 GHSA，NVD 也收录了影响 2026.1.29 之前版本的 CVE-2026-25253。这说明它功能很强，但安全面也在快速演进。你越深 fork，越难吃上游补丁。([GitHub][7])

---

## 十五、推荐的代码与服务边界

建议仓库形态如下：

```text
research-factory/
  openclaw/
    openclaw.json
    agents/
    skills/
    plugins/
  services/
    orchestrator/
    paper-intel/
    runner/
    provenance/
    reviewer/
    notifier/
  schemas/
  workflows/
  infra/
  docs/
```

建议新增的 OpenClaw 薄工具只有这些类型：

- `paper_graph.search`
- `citation_evidence.get`
- `proposal.submit`
- `budget.request`
- `runner.submit`
- `runner.status`
- `claim.get`
- `review.start`
- `review.status`

这样 OpenClaw 负责“调度与决策接口”，外部服务负责“重逻辑与重状态”。

---

## 十六、第一版最小可行范围（MVP）

我建议你第一版只做**一个窄领域**，例如：

- 小规模视觉分类；
- 小模型 NLP 微调；
- 特定公开 benchmark 上的训练策略改进。

MVP 只要求打通 6 件事：

1. 文献图谱与 proposal 生成
2. 人类立项
3. 预注册 ResearchPlan
4. 自动实现 + 自动跑实验
5. 纪委 Bot 生成 Claim Ledger
6. 自动初稿 + 自动审稿

先不要做：

- 泛化到任意 ML 子领域；
- 大规模多项目排队；
- 完整 auto-submit；
- 跨多人协作的共享高权限 Gateway。

---

## 十七、验收指标

上线前我建议至少满足这些硬指标：

- 单项目从立项到首个可复现实验包，全流程无人值守可跑通；
- 健康 run 率持续高于“随机试错”基线；
- 论文中的数字性 claim 审计误差率为 0；
- 复现实验在容忍区间内通过；
- 预算超支事件必须全量可追溯；
- 失败项目必须都有 RCA；
- reviewer 平均分能区分“好稿/坏稿”而不是一律给中分；
- 人类最终修改量持续下降；
- 没有任何 agent 在未审批情况下触发高成本资源租用；
- 没有任何实验 agent 接触到宿主机敏感凭据。

---

## 十八、我给你的最终拍板建议

如果你现在就要开始做，我建议按下面这组决策执行：

1. **OpenClaw 只做控制面，不做执行面。**
2. **插件优先做薄桥接，重逻辑全部外置服务。**
3. **主流程用 Temporal，实验 fan-out 用容器任务系统。**
4. **状态真相源用 Postgres + S3/MinIO；图谱先用边表 + pgvector，别一开始就重 Neo4j。**
5. **必须引入 Claim-Evidence Ledger，别只做日志比对。**
6. **预算改成 envelope 模式，不要每个小动作都人工审批。**
7. **把“单线程黑板”改成“串行决策 + 并行执行”。**
8. **禁止生产环境动态安装第三方 skills。**
9. **严格单人单 Gateway，所有 code agent 强制沙箱。**
10. **第一版只做 code-expressible、公开 benchmark、窄领域闭环。**

如果你愿意，我下一步可以直接在这份文档基础上继续往下落两层：一层是**模块级 PRD + 服务接口定义**，另一层是**OpenClaw 配置草案 + agent/tool 权限矩阵**。

[1]: https://github.com/openclaw/openclaw "https://github.com/openclaw/openclaw"
[2]: https://sakana.ai/ai-scientist/ "https://sakana.ai/ai-scientist/"
[3]: https://docs.openclaw.ai/concepts/multi-agent "https://docs.openclaw.ai/concepts/multi-agent"
[4]: https://docs.openclaw.ai/automation/cron-vs-heartbeat "https://docs.openclaw.ai/automation/cron-vs-heartbeat"
[5]: https://docs.openclaw.ai/concepts/memory "https://docs.openclaw.ai/concepts/memory"
[6]: https://microsoft.github.io/graphrag/ "https://microsoft.github.io/graphrag/"
[7]: https://github.com/openclaw/openclaw/security "https://github.com/openclaw/openclaw/security"
[8]: https://docs.temporal.io/temporal "https://docs.temporal.io/temporal"
[9]: https://docs.openclaw.ai/tools/lobster "https://docs.openclaw.ai/tools/lobster"
[10]: https://developers.openalex.org/ "https://developers.openalex.org/"
[11]: https://docs.openreview.net/reference/default-forms/default-review-form "https://docs.openreview.net/reference/default-forms/default-review-form"
[12]: https://github.com/SakanaAI/AI-Scientist "https://github.com/SakanaAI/AI-Scientist"
[13]: https://arxiv.org/abs/2504.08066 "https://arxiv.org/abs/2504.08066"
[14]: https://github.com/SamuelSchmidgall/AgentLaboratory/blob/main/README.md "https://github.com/SamuelSchmidgall/AgentLaboratory/blob/main/README.md"
[15]: https://arxiv.org/abs/2310.03302 "https://arxiv.org/abs/2310.03302"
[16]: https://github.com/tsingyuai/scientify "https://github.com/tsingyuai/scientify"
[17]: https://docs.openclaw.ai/tools/skills "https://docs.openclaw.ai/tools/skills"
[18]: https://docs.openclaw.ai/zh-CN/tools "https://docs.openclaw.ai/zh-CN/tools"
[19]: https://docs.openclaw.ai/zh-CN/tools/plugin "https://docs.openclaw.ai/zh-CN/tools/plugin"
[20]: https://www.semanticscholar.org/product/api "https://www.semanticscholar.org/product/api"
[21]: https://www.crossref.org/documentation/retrieve-metadata/rest-api/ "https://www.crossref.org/documentation/retrieve-metadata/rest-api/"
[22]: https://docs.wandb.ai/models/sweeps "https://docs.wandb.ai/models/sweeps"
[23]: https://github.com/clearml/clearml "https://github.com/clearml/clearml"
[24]: https://aclrollingreview.org/reviewform "https://aclrollingreview.org/reviewform"
[25]: https://neurips.cc/Conferences/2025/ReviewerGuidelines "https://neurips.cc/Conferences/2025/ReviewerGuidelines"
[26]: https://iclr.cc/Conferences/2025/ReviewerGuide "https://iclr.cc/Conferences/2025/ReviewerGuide"
[27]: https://docs.openclaw.ai/gateway/security "https://docs.openclaw.ai/gateway/security"
