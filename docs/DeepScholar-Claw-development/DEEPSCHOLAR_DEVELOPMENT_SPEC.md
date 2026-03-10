# DeepScholar-Claw: 基于大模型的全自动深度学习科研闭环系统

## 详细开发规格文档

> 版本: 1.1 | 日期: 2026-03-10
> 基座项目: OpenClaw (multi-channel AI gateway)
> v1.1 修订: 整合架构评审反馈——明确 OpenClaw 定位为控制面、引入 Claim-Evidence Ledger、
> 预注册研究计划、envelope 预算模式、串行决策+并行执行、制度化评审协议等

---

## 目录

1. [项目概述与定位](#1-项目概述与定位)
2. [同类项目分析与差异化](#2-同类项目分析与差异化)
3. [系统总体架构](#3-系统总体架构)
4. [基座能力复用：OpenClaw 提供了什么](#4-基座能力复用openclaw-提供了什么)
5. [核心模块详细设计](#5-核心模块详细设计)
   - 5.1 [文献采集与知识图谱模块 (Literature & Graph RAG)](#51-文献采集与知识图谱模块)
   - 5.2 [智能体编排引擎 (Agent Orchestration Engine)](#52-智能体编排引擎)
   - 5.3 [记忆与上下文管理系统 (Memory Engine)](#53-记忆与上下文管理系统)
   - 5.4 [实验执行引擎 (Experiment Execution Engine)](#54-实验执行引擎)
   - 5.5 [数据可视化与出图模块 (Visualization Module)](#55-数据可视化与出图模块)
   - 5.6 [论文撰写引擎 (Paper Writing Engine)](#56-论文撰写引擎)
   - 5.7 [模拟同行评审系统 (Simulated Peer Review)](#57-模拟同行评审系统)
   - 5.8 [财务审批与资源管理 (Budget & Resource Control)](#58-财务审批与资源管理)
   - 5.9 [人机交互界面 (Human-in-the-Loop Interface)](#59-人机交互界面)
6. [12 步科研流水线详细流程](#6-12-步科研流水线详细流程)
7. [数据模型与存储设计](#7-数据模型与存储设计)
8. [安全、容错与防造假机制](#8-安全容错与防造假机制)
9. [技术选型与依赖清单](#9-技术选型与依赖清单)
10. [分期开发计划](#10-分期开发计划)
11. [已识别风险与缓解策略](#11-已识别风险与缓解策略)
12. [明确的非目标 (v1)](#12-明确的非目标-v1)
13. [验收指标](#13-验收指标)
14. [参考资料与关键链接](#14-参考资料与关键链接)

---

## 1. 项目概述与定位

### 1.1 核心愿景

DeepScholar-Claw 是一个**纯计算型深度学习虚拟科研工厂**——不涉及物理实验，专注于"文献调研 → 创新点发现 → 实验设计与执行 → 数据出图 → 论文撰写 → 模拟同行评审"的完整闭环。

### 1.2 人类角色定义

| 角色       | 介入节点                   | 具体行为                                  |
| ---------- | -------------------------- | ----------------------------------------- |
| 科研总监   | 研究方向选择、最终论文定稿 | 从系统提案中选题；终审论文并决定是否投稿  |
| 财务大总管 | 算力/API 开销审批          | 审核《资源申请单》，决定是否批准 GPU 租用 |
| 方向纠偏者 | 熔断决策点                 | 当系统汇报"死胡同"时，决定换题还是调整    |

### 1.3 与通用 AI Agent 系统的区别

本系统**不是**通用的 multi-agent 框架。它是一个**垂直领域解决方案**，专门针对深度学习论文生产流程做了以下特化：

- 知识库仅索引顶会顶刊论文（CVPR, NeurIPS, ICML, ICLR, ACL, AAAI 等）
- 实验执行器针对 PyTorch/JAX 训练流程深度优化
- 出图引擎对标学术出版物标准（matplotlib/pgfplots 级别）
- 评审系统复刻真实顶会审稿流程（含量化打分表）

---

## 2. 同类项目分析与差异化

### 2.1 现有项目对比

| 项目                         | 覆盖范围       | 核心局限                                                                        | 我们的差异化                                                  |
| ---------------------------- | -------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **AI Scientist (Sakana AI)** | 端到端论文生成 | 42%实验失败率；文献检索浅薄（简单关键词匹配）；严重依赖人工模板；novelty 检测差 | Graph RAG 深度文献理解；Docker 沙箱化实验执行；熔断式错误恢复 |
| **Agent Laboratory (AMD)**   | 文献→实验→报告 | 仅 arXiv API 文献检索；无知识图谱；实验仅限 mle-bench 场景                      | 多数据源文献库 + 知识图谱；真实云端 GPU 训练；多轮严格评审    |
| **AgentRxiv**                | 协作式自主研究 | Agent Laboratory 的扩展，同样受限于有限的文献理解                               | 更完善的记忆系统和财务管控                                    |
| **MetaGPT**                  | 软件开发流程   | 面向软件工程，非科研场景                                                        | 复用其角色协作模式，但工具链完全面向科研                      |
| **GPT-Researcher / Storm**   | 文献调研+报告  | 仅覆盖调研阶段，无实验执行能力                                                  | 全流程覆盖，含实验执行和评审                                  |

### 2.2 AI Scientist 的关键教训（必须规避）

根据 [Beel et al. (2025) 的独立评估](https://arxiv.org/abs/2502.14297)：

1. **文献检索质量是基石**：AI Scientist 的简单关键词搜索导致多个"已有工作"被误判为"新颖"（如 micro-batching for SGD）。**我们的对策**：Graph RAG + 全文精读，而非片段检索。
2. **实验代码可靠性**：42% 的实验因代码 bug 失败。**我们的对策**：Docker 沙箱 + 预设模板 + 自动化测试 + 日志回溯修复。
3. **不能自己评审自己**：AI Scientist 的自我评审近乎自吹自擂。**我们的对策**：隔离的多评委独立背靠背评审 + 量化打分表。
4. **成本必须可控**：AI Scientist 声称 $15/篇，但失败重试使实际成本翻倍。**我们的对策**：人工审批制 + 预算上限 + 用量追踪。

---

## 3. 系统总体架构

### 3.1 核心设计原则

**串行决策 + 并行执行 + 结构化状态 + 证据优先**

不是"一群 Bot 自由聊天"，而是：

- 决策层串行：主编/审计/财务 Bot 在受控通道中依次决策
- 执行层并行：文献抓取、实验运行、图表生成并行处理
- 状态持久化：所有关键产物写回结构化存储，不依赖会话记忆
- 证据链优先：每个结论绑定到可验证的 run/artifacts/citations

### 3.2 四层架构模型

```
┌─────────────────────────────────────────────────────────────────┐
│                 Layer 1: OpenClaw 控制面 (Control Plane)          │
│  ─────────────────────────────────────────────────────────────  │
│  • 人类入口 (Telegram/Slack/Discord/Web)                       │
│  • 常驻 Agent 运行时 (主编/审计/财务 Bot)                        │
│  • Skills / Plugins 注入                                         │
│  • 轻量审批流 (Lobster)                                         │
│  • 状态播报、heartbeat、cron 调度                               │
│                                                                  │
│  OpenClaw 在此项目中的定位：**薄插件层 + 调度接口**，           │
│  不承载重业务逻辑                                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ 薄桥接工具调用 (tools)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               Layer 2: 科研工作流编排层 (Orchestration)          │
│  ─────────────────────────────────────────────────────────────  │
│  • 状态机推进与阶段门控                                         │
│  • 任务分发与调度                                               │
│  • 审批暂停/恢复                                                │
│  • 重试与补偿机制                                               │
│  • 失败分类与 RCA                                               │
│  • 项目级预算 envelope 控制                                      │
│                                                                  │
│  **推荐技术栈: Temporal** (长周期工作流持久化恢复)              │
│  实验批量 fan-out 可额外接入 K8s Job / Argo                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               Layer 3: 学术知识与证据层 (Knowledge & Evidence)  │
│  ─────────────────────────────────────────────────────────────  │
│  • 文献抓取与元数据融合 (OpenAlex + Semantic Scholar + Crossref) │
│  • Paper Graph / Method Graph / Claim Graph                    │
│  • 检索与 novelty scoring                                        │
│  • 引用与证据卡片                                               │
│  • Claim-Evidence Ledger (结论-证据账本)                       │
│                                                                  │
│  **推荐存储: Postgres + pgvector + S3/MinIO**                  │
│  Neo4j 作为可选查询加速层                                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               Layer 4: 实验执行与产出层 (Execution & Output)    │
│  ─────────────────────────────────────────────────────────────  │
│  • 代码生成与 patch                                             │
│  • 环境构建与镜像                                               │
│  • 训练/评测作业 (Docker 沙箱 + 云 GPU)                         │
│  • Sweep / Ablation 搜索                                         │
│  • 图表生成 (matplotlib / pgfplots)                             │
│  • 论文写作与排版                                               │
│                                                                  │
│  **与 OpenClaw Gateway 宿主机完全隔离**                        │
│  运行在独立的沙箱 worker 或容器集群上                            │
└─────────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────┐
│                    人类交互层 (Human Interface)                   │
│  Telegram Bot / Web Dashboard / CLI                              │
│  ── 研究提案选择 ── 经费审批 ── 论文终审 ── 方向纠偏 ──      │
└──────────────────────────┬──────────────────────────────────────┘
                           │ OpenClaw 消息通道
┌──────────────────────────▼──────────────────────────────────────┐
│                   编排控制层 (Orchestration Layer)                │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────┐   │
│  │ 主编 Bot  │  │流程调度器│  │ 熔断控制器 │  │ 财务审批网关  │   │
│  │(Editor)  │  │(Pipeline)│  │(CircuitBkr)│  │(BudgetGate)  │   │
│  └──────────┘  └──────────┘  └───────────┘  └──────────────┘   │
│                                                                  │
│  Turn-based Message Bus (单线程有序消息总线)                       │
└──────────────────────────┬──────────────────────────────────────┘

```

┌─────────────────────────────────────────────────────────────────┐
│ 人类交互层 (Human Interface) │
│ Telegram Bot / Web Dashboard / CLI │
│ ── 研究提案选择 ── 经费审批 ── 论文终审 ── 方向纠偏 ── │
└──────────────────────────┬──────────────────────────────────────┘
│ OpenClaw 消息通道
┌──────────────────────────▼──────────────────────────────────────┐
│ 编排控制层 (Orchestration Layer) │
│ │
│ ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────┐ │
│ │ 主编 Bot │ │流程调度器│ │ 熔断控制器 │ │ 财务审批网关 │ │
│ │(Editor) │ │(Pipeline)│ │(CircuitBkr)│ │(BudgetGate) │ │
│ └──────────┘ └──────────┘ └───────────┘ └──────────────┘ │
│ │
│ Turn-based Message Bus (单线程有序消息总线) │
└──────────────────────────┬──────────────────────────────────────┘
│
┌──────────────────────────▼──────────────────────────────────────┐
│ 执行工作层 (Worker Layer) │
│ │
│ ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌─────────┐ │
│ │文献 Bot │ │代码 Bot │ │纪律审查Bot│ │写作 Bot │ │评审 Bot │ │
│ │(Lit.) │ │(Coder) │ │(Auditor) │ │(Writer) │ │(Review) │ │
│ └────┬────┘ └────┬────┘ └────┬─────┘ └────┬────┘ └────┬────┘ │
│ │ │ │ │ │ │
│ 固定常驻 Bots ──────────────────── 动态特战队 Bots ────────── │
└──────┬───────────┬───────────┬──────────────┬───────────┬──────┘
│ │ │ │ │
┌──────▼───────────▼───────────▼──────────────▼───────────▼──────┐
│ 基础设施层 (Infrastructure) │
│ │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│ │ Graph RAG │ │ 记忆引擎 │ │ 云端实验执行器 │ │
│ │ 知识图谱 │ │ (Letta风格 │ │ (Docker Sandbox + │ │
│ │ + GROBID │ │ 分层压缩) │ │ AutoDL/RunPod API) │ │
│ │ + Neo4j │ │ + LanceDB │ │ + wandb 实验追踪 │ │
│ └──────────────┘ └──────────────┘ └──────────────────────────┘ │
│ │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│ │ Semantic │ │ LLM 路由器 │ │ 审计日志 │ │
│ │ Scholar API │ │ (模型分级 │ │ (全流程可追溯) │ │
│ │ + OpenAlex │ │ 调用管理) │ │ │ │
│ └──────────────┘ └──────────────┘ └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

````

---

## 4. 基座能力复用：OpenClaw 提供了什么

OpenClaw 是一个成熟的多通道 AI 网关系统（TypeScript/ESM, Node 22+）。以下是我们直接复用的核心能力：

### 4.1 OpenClaw 的正确定位：**控制面 + 人机入口**

> **核心原则：插件优先做薄桥接，重逻辑全部外置服务**
>
> OpenClaw 官方安全模型明确是"一人Gateway"的 personal assistant，不适合作为多租户科研工厂的本体。参考架构评审建议，OpenClaw 只负责：
> - 人类入口与消息路由
> - 常驻 Agent 运行时
> - Skills / Plugins 注入
> - 轻量审批流（Lobster）
> - 状态播报、heartbeat、cron
>
> **重业务逻辑（状态机、实验编排、图谱ETL、预算系统）全部放在独立服务中。**

### 4.2 直接复用的部分

| OpenClaw 能力 | 我们的用途 | 对应代码位置 |
|--------------|----------|-------------|
| **消息通道系统** (Telegram/Discord/Web) | 人类交互界面：经费审批、选题、终审 | `extensions/telegram/`, `extensions/discord/`, `src/web/` |
| **嵌入式 Agent Runner** | 所有 Bot 的运行时基础 | `src/agents/pi-embedded-runner/` |
| **Session 管理** | 每个研究项目 = 一个 session | `src/agents/pi-embedded-runner/session-*.ts` |
| **工具系统 (Tools)** | 扩展自定义科研工具 (文献检索、代码执行等) | `src/agents/pi-tools.ts`, `src/agents/tools/` |
| **Bash 执行沙箱** | 实验代码执行的底层能力 | `src/agents/bash-tools.ts`, `src/agents/sandbox/` |
| **插件/扩展系统** | 各模块作为独立 extension 开发 | `extensions/`, plugin-sdk |
| **ACP (Agent Communication Protocol)** | Agent 间通信与协调 | `src/acp/` |
| **Auth Profile / API Key 管理** | 多 LLM 提供商 key 轮转 | `src/agents/auth-profiles.ts` |
| **上下文压缩 (Compaction)** | 长对话上下文管理的基础 | `src/agents/pi-extensions/compaction-safeguard.ts` |
| **Memory 扩展** | 向量化长期记忆 | `extensions/memory-core/`, `extensions/memory-lancedb/` |
| **Skills 系统** | 可复用的能力模块 | `src/agents/skills/` |
| **CLI 框架** | 项目管理命令行工具 | `src/cli/program/` |
| **配置系统** | 类型化配置管理 | `src/config/types.ts` (36个类型模块) |
| **LLM 模型路由** | 多模型分级调用 | `src/agents/model-selection.ts`, `src/agents/model-catalog.ts` |

### 4.2 需要新建的模块

| 新模块 | 实现为 | 说明 |
|-------|-------|------|
| `extensions/deepscholar-literature/` | OpenClaw Extension | 文献采集、GROBID 解析、Graph RAG 构建 |
| `extensions/deepscholar-experiment/` | OpenClaw Extension | 云 GPU 编排、Docker 沙箱、实验追踪 |
| `extensions/deepscholar-writing/` | OpenClaw Extension | LaTeX 论文生成、图表排版 |
| `extensions/deepscholar-review/` | OpenClaw Extension | 模拟同行评审系统 |
| `extensions/deepscholar-budget/` | OpenClaw Extension | 财务审批、资源管理 |
| `extensions/deepscholar-orchestrator/` | OpenClaw Extension | 12 步流水线编排、熔断控制 |
| `skills/research-pipeline/` | OpenClaw Skill | 科研流水线的可复用 skill 定义 |

#### OpenClaw 薄桥接工具 (thin bridge tools)

以下工具作为 OpenClaw 插件暴露给 Agents，调用外部服务：

```typescript
const BRIDGE_TOOLS = [
  "paper_graph.search",        // 搜索论文知识图谱
  "citation_evidence.get",    // 获取引用证据卡片
  "proposal.submit",           // 提交研究提案
  "budget.request",           // 申请资源预算
  "budget.envelope.get",      // 获取项目预算 envelope
  "runner.submit",            // 提交实验到 runner 服务
  "runner.status",            // 查询实验状态
  "runner.abort",             // 中止实验
  "claim.get",               // 获取已验证的结论
  "claim.register",          // 注册新结论到账本
  "review.start",            // 启动模拟评审
  "review.status",            // 查询评审状态
  "research_plan.freeze",    // 冻结预注册研究计划
  "provenance.verify",       // 验证证据链
];
````

#### 不应该让 OpenClaw 单独承担的部分

| 能力                        | 原因                      | 推荐方案                 |
| --------------------------- | ------------------------- | ------------------------ |
| 长周期科研主状态机          | 跨小时/天运行，失败需恢复 | Temporal 工作流          |
| 大规模 GPU 作业调度         | 需要容器编排、队列管理    | K8s Job / Argo Workflows |
| 多租户安全边界              | OpenClaw 非对抗式安全模型 | 按 Gateway 实例隔离      |
| 证据账本与不可变 provenance | 需要事务性写入            | Postgres + 审计表        |
| 精细预算台账与计费对账      | 需要 provider API 集成    | 独立预算服务             |

---

## 5. 核心模块详细设计

### 5.1 文献采集与知识图谱模块

#### 5.1.1 文献数据源

```typescript
// extensions/deepscholar-literature/src/sources.ts

interface PaperSource {
  name: string;
  fetchPapers(query: SourceQuery): AsyncGenerator<RawPaper>;
  rateLimit: { requests: number; windowMs: number };
}

// 数据源优先级与特点
const SOURCES = {
  semanticScholar: {
    // 200M+ 论文, 免费, 无需 API key
    // 速率限制: 100 请求/5分钟 (无认证), 更高需申请
    // 优势: AI 驱动的相关性排序, TL;DR 摘要
    endpoint: "https://api.semanticscholar.org/graph/v1",
    fields: [
      "title",
      "abstract",
      "authors",
      "year",
      "venue",
      "citationCount",
      "references",
      "tldr",
      "openAccessPdf",
    ],
  },
  openAlex: {
    // 250M+ 作品, 免费, 无需 API key
    // 速率限制: ~100K/天 (polite pool 需提供 email)
    // 优势: 高吞吐量批量检索, 概念标签, 机构信息
    endpoint: "https://api.openalex.org",
    fields: [
      "id",
      "title",
      "abstract_inverted_index",
      "authorships",
      "concepts",
      "cited_by_count",
      "primary_location",
    ],
  },
  arxiv: {
    // 预印本, 免费, OAI-PMH 协议
    // 优势: 最新论文的第一手来源
    endpoint: "http://export.arxiv.org/api/query",
  },
  dblp: {
    // 计算机科学文献索引
    endpoint: "https://dblp.org/search/publ/api",
  },
};
```

#### 5.1.2 论文解析流水线 (GROBID)

[GROBID](https://github.com/kermitt2/grobid) 是经过 Semantic Scholar、ResearchGate 等生产验证的论文解析引擎。

```typescript
// extensions/deepscholar-literature/src/parser.ts

interface ParsedPaper {
  id: string; // 内部唯一ID
  doi?: string;
  arxivId?: string;
  title: string;
  abstract: string;
  authors: Author[];
  venue: string; // e.g., "NeurIPS 2025"
  year: number;
  sections: Section[]; // 完整章节结构
  references: Reference[]; // 结构化引用列表
  figures: Figure[]; // 图表描述
  tables: Table[]; // 表格数据
  equations: Equation[]; // 公式
  fullText: string; // 纯文本全文
  metadata: {
    tier: "top-conf" | "top-journal" | "workshop" | "preprint";
    citationCount: number;
    influentialCitationCount: number;
  };
}

// GROBID 服务部署为 Docker 容器
// 性能: 单台 16核机器可达 ~10.6 PDF/秒 (~915,000 PDF/天)
// 准确率: 参考文献解析 F1 ~0.87-0.90
const GROBID_CONFIG = {
  dockerImage: "lfoppiano/grobid:0.8.1",
  port: 8070,
  // GROBID 输出 TEI XML, 包含 68 个细粒度标签
  // 涵盖: 标题、摘要、作者、章节、段落、引用标记、图注等
  consolidation: 2, // 最高级别文献合并
  includeRawAffiliations: true,
};
```

#### 5.1.3 知识图谱构建 (Graph RAG)

不使用传统文本切片 RAG（会破坏论文逻辑连贯性）。采用 [Microsoft GraphRAG](https://github.com/microsoft/graphrag) 的核心思路，但针对学术文献做了领域适配。

```typescript
// extensions/deepscholar-literature/src/graph-rag.ts

// 学术知识图谱的节点类型
type GraphNodeType =
  | "Paper" // 论文节点
  | "Author" // 作者节点
  | "Innovation" // 创新点 (从论文中提取)
  | "Method" // 方法/模型架构
  | "Dataset" // 数据集
  | "Metric" // 评价指标
  | "Result" // 实验结果
  | "Limitation" // 局限性
  | "Venue" // 发表场所
  | "Concept"; // 研究概念/领域

// 关系类型
type GraphEdgeType =
  | "CITES" // 引用关系
  | "PROPOSES" // 论文 -> 创新点
  | "USES_METHOD" // 论文 -> 方法
  | "EVALUATED_ON" // 论文 -> 数据集
  | "ACHIEVES" // 方法 -> 结果
  | "IMPROVES_UPON" // 创新点 -> 已有方法
  | "HAS_LIMITATION" // 方法 -> 局限性
  | "AUTHORED_BY" // 论文 -> 作者
  | "RELATED_TO"; // 概念间关联

// 图谱构建流水线
interface GraphBuildPipeline {
  // 1. 实体与关系提取 (LLM-powered)
  //    使用 GPT-4o-mini (低成本) 提取结构化信息
  //    Prompt 模板定义提取规则
  extractEntitiesAndRelations(paper: ParsedPaper): Promise<ExtractionResult>;

  // 2. 社区检测 (Leiden 算法)
  //    对相关论文进行层次化聚类
  //    每个社区 = 一个研究子方向
  detectCommunities(): Promise<Community[]>;

  // 3. 社区摘要生成
  //    LLM 为每个社区生成简洁摘要
  //    用于全局性问题的回答
  generateCommunitySummaries(): Promise<CommunitySummary[]>;

  // 4. 向量化索引
  //    节点属性 + 社区摘要的 Embedding
  //    用于语义检索
  buildVectorIndex(): Promise<void>;
}

// 检索策略: 双模式
interface RetrievalStrategy {
  // 局部搜索: 精确匹配 2-3 篇最相关论文, 然后调取全文
  localSearch(query: string): Promise<{
    papers: ParsedPaper[]; // 全文
    subgraph: GraphSubset; // 相关子图
  }>;

  // 全局搜索: 基于社区摘要回答宏观问题
  //   如 "多模态大模型微调的主要挑战有哪些?"
  globalSearch(query: string): Promise<{
    answer: string;
    communities: CommunitySummary[];
    supportingPapers: PaperReference[];
  }>;
}
```

**存储选型**:

| 组件       | 技术选型                         | 理由                                                                |
| ---------- | -------------------------------- | ------------------------------------------------------------------- |
| 图数据库   | **Neo4j Community** (Docker)     | 成熟的图查询语言 Cypher；社区版免费；丰富的可视化工具               |
| 向量数据库 | **LanceDB** (复用 OpenClaw 已有) | 已有 `extensions/memory-lancedb/`；嵌入式无需独立服务；支持增量更新 |
| 全文存储   | **SQLite + FTS5**                | 全文检索；轻量级；支持原始 PDF 二进制存储                           |

#### 5.1.4 文献质量过滤

```typescript
// 只索引高质量文献
const VENUE_TIER_MAP = {
  "top-conf": [
    // CV: CVPR, ICCV, ECCV
    // NLP: ACL, EMNLP, NAACL
    // ML: NeurIPS, ICML, ICLR
    // AI: AAAI, IJCAI
    // 更多按需添加
  ],
  "top-journal": [
    "Nature",
    "Science",
    "Nature Machine Intelligence",
    "JMLR",
    "TPAMI",
    "IJCV",
    // ...
  ],
  workshop: [], // 默认不索引, 除非用户指定
  preprint: [], // arXiv 预印本, 按引用量过滤
};

// 预印本过滤策略
const PREPRINT_FILTER = {
  minCitations: 5, // 至少 5 次引用
  maxAgeDays: 180, // 6 个月内
  requireOpenAccess: true, // 必须可获取全文
};
```

#### 5.1.5 论文全文获取流水线 (Full-Text Acquisition)

全文是 Graph RAG 深度理解的基础——仅靠摘要无法提取方法细节、实验设置和局限性。
系统按优先级瀑布式尝试获取 PDF 全文，从完全合法的渠道开始逐级降级。

```typescript
// extensions/deepscholar-literature/src/fulltext-acquisition.ts

// ═══ 全文获取优先级链 ═══
// 每一层失败后自动降级到下一层，全部失败则退化为"仅摘要"模式

interface FullTextProvider {
  name: string;
  priority: number; // 1=最高优先级
  legal: "fully" | "gray"; // 合法性标注
  rateLimit: RateLimit;
  fetchPdf(paper: PaperIdentifier): Promise<PdfResult | null>;
}

const FULLTEXT_PROVIDERS: FullTextProvider[] = [
  // ── 优先级 1: arXiv 直链 ──────────────────────────────────
  // ML/AI/CV/NLP 领域 80%+ 的顶会论文有 arXiv 版本
  // 完全免费、完全合法、高度稳定
  {
    name: "arxiv",
    priority: 1,
    legal: "fully",
    rateLimit: { requests: 4, windowMs: 1000, burstSleep: 1000 },
    // 通过 Semantic Scholar 返回的 arxivId 直接构造下载链接
    // URL 模式: https://arxiv.org/pdf/{arxivId}.pdf
    // 批量场景: Amazon S3 Requester Pays bucket (s3://arxiv/pdf/)
    //   全库 ~9.2TB, 每月增长 ~100GB
    //   适合一次性构建大型知识库
    // API 端点: export.arxiv.org (专门为程序访问设置)
    // OAI-PMH: 批量元数据收割, 每日更新
  },

  // ── 优先级 2: Unpaywall API ───────────────────────────────
  // 扫描 50,000+ 出版商和机构仓库, 寻找合法 OA 版本
  // 覆盖 ~50% 论文的某种 Open Access 版本
  // 完全免费、完全合法
  {
    name: "unpaywall",
    priority: 2,
    legal: "fully",
    rateLimit: { requests: 100000, windowMs: 86400000 }, // 100K/天
    // API: GET https://api.unpaywall.org/v2/{doi}?email=xxx
    // 返回字段: best_oa_location.url_for_pdf → 直接 PDF 链接
    // Python 库: unpywall (pip install unpywall)
    //   Unpywall.download_pdf_handle(doi) → PDF 文件句柄
    //   Unpywall.get_pdf_link(doi) → OA PDF 链接
    // 数据快照: 整库可下载 (16GB 压缩, 100M+ 记录)
    //   适合离线预处理 DOI→PDF_URL 映射
  },

  // ── 优先级 3: CORE API ────────────────────────────────────
  // 全球最大的 OA 聚合器: 431M 元数据, 323M 全文链接, 46M 直接托管
  // 覆盖大量 Unpaywall 未收录的机构仓库论文
  {
    name: "core",
    priority: 3,
    legal: "fully",
    rateLimit: { requests: 5, windowMs: 10000 }, // 5次/10秒(免费层)
    // API v3: https://api.core.ac.uk/v3/
    // 返回: 元数据 + 全文(部分直接托管)
    // 批量数据集: 可下载完整语料进行本地处理
    // Rust 客户端库: core_api_client (高性能批量访问)
  },

  // ── 优先级 4: 出版商 OA 直接下载 ─────────────────────────
  // 部分顶会直接提供 OA PDF
  {
    name: "publisher_oa",
    priority: 4,
    legal: "fully",
    rateLimit: { requests: 1, windowMs: 2000 },
    // 已知的免费源:
    //   PMLR (proceedings.mlr.press) → ICML, AISTATS 等
    //   OpenReview (openreview.net) → ICLR, NeurIPS
    //   ACL Anthology (aclanthology.org) → ACL, EMNLP, NAACL
    //   AAAI (ojs.aaai.org) → AAAI
    //   JMLR (jmlr.org) → JMLR
    // 这些 venue 的论文全部 OA, 可直接抓取 PDF
  },

  // ── 优先级 5: Semantic Scholar / OpenAlex OA 字段 ─────────
  // 元数据 API 附带的 OA PDF 链接 (数据来源与 Unpaywall 部分重叠)
  {
    name: "metadata_oa",
    priority: 5,
    legal: "fully",
    rateLimit: { requests: 100, windowMs: 300000 },
    // Semantic Scholar: paper.openAccessPdf.url
    // OpenAlex: work.open_access.oa_url
  },

  // ── 优先级 6: Sci-Hub (可选, 默认关闭) ────────────────────
  // 最后手段: 覆盖几乎所有已发表论文 (80M+)
  // ⚠️ 灰色地带: 部分国家/地区使用涉及版权问题
  // ⚠️ 必须由用户在配置中显式启用, 系统默认不开启
  {
    name: "scihub",
    priority: 6,
    legal: "gray",
    rateLimit: { requests: 1, windowMs: 5000 }, // 保守限速
    // Python 库选型:
    //   scidownl (PyPI, pip install scidownl)
    //     ✓ 支持 DOI/PMID/标题下载
    //     ✓ 自动更新域名 (SQLite 本地存储可用域名)
    //     ✓ 支持代理
    //     ✓ 支持指定 Sci-Hub URL (-u 参数)
    //     用法: scidownl download --doi "10.1038/xxx" --out ./papers/
    //
    //   zaytoun/scihub.py (GitHub)
    //     ✓ 支持 Google Scholar 搜索 + 下载
    //     ✗ 验证码会间歇性阻断批量下载
    //
    //   Sci-Hub MCP Server (jackkuo666/sci-hub-mcp-server)
    //     ✓ 2025 年新项目, MCP 协议, 可直接接入 AI Agent
    //     ✓ 支持 DOI/标题/关键词
    //     依赖: Python 3.10+, FastMCP
    //
    // 域名不稳定性:
    //   2026年1月 sci-hub.se 被 DNS 封锁
    //   备用: .onion Tor 地址, Telegram Bot (@scaborot)
    //   scidownl 自动域名发现可部分缓解
    enabled: false, // 默认关闭, 需用户在 config.yaml 显式开启
  },
];

// ═══ 获取结果与降级逻辑 ═══

interface PdfResult {
  source: string; // 来源 provider 名称
  pdfBuffer: Buffer; // PDF 二进制内容
  pdfUrl?: string; // 原始下载 URL (用于审计)
  legal: "fully" | "gray"; // 合法性标注 (用于论文引用声明)
}

interface AcquisitionResult {
  paperId: string;
  doi?: string;
  arxivId?: string;
  fullTextAcquired: boolean;
  source?: string; // 最终获取来源
  fallbackUsed: boolean; // 是否使用了降级方案
  // 全部失败时退化为仅摘要模式
  abstractOnly: boolean;
  abstractSource: "semantic_scholar_tldr" | "raw_abstract";
}

// ═══ 覆盖率预估 (ML/AI/CV/NLP 领域) ═══
//
// 优先级 1 (arXiv):         ~80%  ML/AI 顶会论文有 arXiv 版本
// 优先级 2 (Unpaywall):     ~10%  额外覆盖 (制度库存档版本)
// 优先级 3 (CORE):          ~3%   额外覆盖 (机构仓库)
// 优先级 4 (出版商 OA):     ~5%   额外覆盖 (PMLR, OpenReview 等)
// 优先级 5 (元数据 OA):     ~1%   与上述重叠, 少量增量
// ─────────────────────────────────
// 合法渠道合计:              ~95%+ (ML/AI 领域)
//
// 优先级 6 (Sci-Hub, 可选):  剩余 ~5% (主要是老论文或非 OA 期刊)
//
// 对于医学/化学/社科等传统出版商垄断领域:
//   合法渠道覆盖率下降到 ~40-60%
//   Sci-Hub 在这些领域有不可替代的价值
//   但本系统聚焦 ML/AI, 合法渠道已高度充足
```

**关键设计决策：为什么 arXiv 直链是第一优先级？**

在 ML/AI/CV/NLP 领域，绝大多数顶会论文的作者会在投稿同期或之前将预印本上传至 arXiv。Semantic Scholar 的元数据直接包含 `arxivId` 字段，我们只需简单拼接 `https://arxiv.org/pdf/{arxivId}.pdf` 即可获得全文。这条路径：

- 零额外 API 调用（arxivId 在元数据检索时已获取）
- 完全合法（arXiv 是作者自愿上传的预印本仓库）
- 高度稳定（arXiv 运营 30+ 年，由 Cornell University 维护）
- 版本可控（可指定 v1/v2 等特定版本）

**Sci-Hub 的定位与风险隔离：**

Sci-Hub 被设计为完全可选的最后手段。配置层面通过 `config.yaml` 的 `literature.scihub.enabled: false` 默认关闭。即使开启，系统也会在审计日志中标记 Sci-Hub 来源的论文，并在生成的参考文献中避免直接链接到 Sci-Hub URL（改为链接到出版商原始 DOI 页面）。

---

### 5.2 智能体编排引擎

#### 5.2.1 双层智能体架构

```typescript
// extensions/deepscholar-orchestrator/src/agents.ts

// === 固定常驻 Bot (系统骨架, 开发时深度调试) ===

interface CoreBot {
  id: string;
  role: string;
  systemPrompt: string;
  model: ModelTier;
  alwaysActive: true;
}

const CORE_BOTS: CoreBot[] = [
  {
    id: "editor-chief",
    role: "主编 Bot",
    // 职责: 全流程控制; 任务分派; 阶段门控; 向人类汇报
    // 不直接执行任何科研工作, 只做调度
    model: "high", // Claude/GPT-4o 级别
    alwaysActive: true,
    systemPrompt: `你是 DeepScholar 系统的主编, 负责...`,
  },
  {
    id: "auditor",
    role: "纪律审查 Bot",
    // 职责: 数据核对; 防造假; 日志审计; 一致性检查
    // 独立于其他所有 Bot, 直接读取原始数据
    model: "high",
    alwaysActive: true,
    systemPrompt: `你是一个铁面无私的学术诚信审查员...`,
  },
  {
    id: "budget-controller",
    role: "财务管控 Bot",
    // 职责: 资源预估; 审批单生成; 用量追踪; 超支预警
    model: "low", // 简单逻辑, 无需强模型
    alwaysActive: true,
    systemPrompt: `你负责管理所有计算资源开销...`,
  },
];

// === 动态特战队 Bot (按需实例化, 任务完成即销毁) ===

interface DynamicBotTemplate {
  templateId: string;
  role: string;
  spawnCondition: string; // 在什么阶段被创建
  destroyCondition: string; // 在什么条件下被销毁
  model: ModelTier;
  tools: string[]; // 可用工具列表
}

const DYNAMIC_BOT_TEMPLATES: DynamicBotTemplate[] = [
  {
    templateId: "literature-researcher",
    role: "文献调研 Bot",
    spawnCondition: "PHASE_LITERATURE_REVIEW",
    destroyCondition: "PHASE_LITERATURE_COMPLETE",
    model: "medium", // GPT-4o-mini / Claude Haiku 级别
    tools: [
      "semantic_scholar_search",
      "openalex_search",
      "arxiv_search",
      "graph_rag_query",
      "paper_full_text_read",
    ],
  },
  {
    templateId: "innovation-analyst",
    role: "创新点分析 Bot",
    spawnCondition: "PHASE_IDEA_GENERATION",
    destroyCondition: "PHASE_IDEA_APPROVED",
    model: "high",
    tools: ["graph_rag_query", "paper_full_text_read", "novelty_check", "feasibility_estimate"],
  },
  {
    templateId: "ml-coder",
    role: "ML 代码 Bot",
    spawnCondition: "PHASE_EXPERIMENT_DESIGN",
    destroyCondition: "PHASE_EXPERIMENT_COMPLETE",
    model: "high",
    tools: [
      "code_write",
      "code_execute_sandbox",
      "gpu_instance_manage",
      "wandb_log_read",
      "debug_log_analyze",
    ],
  },
  {
    templateId: "data-visualizer",
    role: "数据可视化 Bot",
    spawnCondition: "PHASE_RESULTS_ANALYSIS",
    destroyCondition: "PHASE_FIGURES_APPROVED",
    model: "medium",
    tools: ["code_write", "code_execute_sandbox", "matplotlib_render", "latex_table_generate"],
  },
  {
    templateId: "paper-writer",
    role: "论文撰写 Bot",
    spawnCondition: "PHASE_PAPER_WRITING",
    destroyCondition: "PHASE_PAPER_FINALIZED",
    model: "high",
    tools: [
      "latex_write",
      "bibtex_manage",
      "graph_rag_query",
      "paper_full_text_read",
      "figure_reference",
    ],
  },
  {
    templateId: "peer-reviewer",
    role: "评审 Bot",
    spawnCondition: "PHASE_PEER_REVIEW",
    destroyCondition: "PHASE_REVIEW_COMPLETE",
    model: "high",
    tools: ["paper_read", "scoring_rubric", "review_template"],
    // 注意: 每次评审实例化 3 个互相隔离的 reviewer
  },
];
```

#### 5.2.2 Turn-based Message Bus

```typescript
// extensions/deepscholar-orchestrator/src/message-bus.ts

// 核心原则: 单线程有序, 禁止并发发言
// 复用 OpenClaw 的 ACP (Agent Communication Protocol)

interface MessageBus {
  // 消息队列, FIFO
  queue: BusMessage[];

  // 当前持有发言权的 Bot
  currentSpeaker: string | null;

  // 发言请求 -> 排队
  requestTurn(botId: string, priority: TurnPriority): Promise<void>;

  // 获得发言权后, 发送消息
  speak(botId: string, message: BotMessage): Promise<void>;

  // 交还发言权
  releaseTurn(botId: string): void;

  // 广播 (仅主编 Bot 可用)
  broadcast(message: SystemMessage): void;
}

type TurnPriority = "critical" | "normal" | "low";
// critical: 熔断信号、人类消息 -> 立即中断当前发言
// normal: 正常工作汇报
// low: 进度更新

interface BotMessage {
  from: string; // Bot ID
  to: string | "all"; // 目标 Bot 或广播
  type: MessageType;
  payload: unknown;
  timestamp: number;
  // 追踪链: 每条消息携带完整的因果链
  causationId: string; // 触发此消息的上游消息 ID
  correlationId: string; // 同一任务流的关联 ID
}

type MessageType =
  | "task_assignment" // 主编 -> Bot: 分配任务
  | "task_result" // Bot -> 主编: 任务结果
  | "clarification_needed" // Bot -> 主编: 需要澄清
  | "data_handoff" // Bot -> Bot: 数据传递 (通过主编中转)
  | "status_update" // Bot -> Bus: 进度更新
  | "error_report" // Bot -> 主编: 错误报告
  | "human_approval_req" // 主编 -> 人类: 需要审批
  | "human_approval_resp" // 人类 -> 主编: 审批结果
  | "circuit_break" // 审查Bot/主编: 熔断信号
  | "phase_transition"; // 主编: 阶段切换
```

#### 5.2.3 流程状态机

```typescript
// extensions/deepscholar-orchestrator/src/state-machine.ts

enum ResearchPhase {
  IDLE = "idle",
  LITERATURE_CRAWL = "literature_crawl", // Step 1
  LITERATURE_ANALYSIS = "literature_analysis", // Step 2
  IDEA_GENERATION = "idea_generation", // Step 3
  IDEA_DISCUSSION = "idea_discussion", // Step 4
  HUMAN_TOPIC_APPROVAL = "human_topic_approval", // Step 5
  EXPERIMENT_DESIGN = "experiment_design", // Step 6
  RESOURCE_APPROVAL = "resource_approval", // Step 7
  EXPERIMENT_EXECUTION = "experiment_execution", // Step 8
  RESULTS_VALIDATION = "results_validation", // Step 9
  PAPER_WRITING = "paper_writing", // Step 10
  PEER_REVIEW = "peer_review", // Step 11
  HUMAN_FINAL_REVIEW = "human_final_review", // Step 12
  COMPLETED = "completed",
  FAILED_CIRCUIT_BREAK = "failed_circuit_break",
}

// 状态转换规则 (有向图)
const TRANSITIONS: Record<ResearchPhase, TransitionRule[]> = {
  [ResearchPhase.LITERATURE_CRAWL]: [
    { to: ResearchPhase.LITERATURE_ANALYSIS, condition: "crawl_complete" },
  ],
  // ... 每个阶段的合法转换
  [ResearchPhase.EXPERIMENT_EXECUTION]: [
    { to: ResearchPhase.RESULTS_VALIDATION, condition: "experiment_success" },
    { to: ResearchPhase.EXPERIMENT_DESIGN, condition: "code_bug_fixable" },
    { to: ResearchPhase.FAILED_CIRCUIT_BREAK, condition: "approach_unviable" },
  ],
  [ResearchPhase.RESULTS_VALIDATION]: [
    { to: ResearchPhase.PAPER_WRITING, condition: "results_validated" },
    { to: ResearchPhase.EXPERIMENT_EXECUTION, condition: "need_more_experiments" },
    { to: ResearchPhase.FAILED_CIRCUIT_BREAK, condition: "results_unfixable" },
  ],
  [ResearchPhase.PEER_REVIEW]: [
    { to: ResearchPhase.HUMAN_FINAL_REVIEW, condition: "review_passed" },
    { to: ResearchPhase.PAPER_WRITING, condition: "major_revision" },
    { to: ResearchPhase.EXPERIMENT_EXECUTION, condition: "need_additional_experiments" },
  ],
  // 熔断 -> 可回退到选题阶段
  [ResearchPhase.FAILED_CIRCUIT_BREAK]: [
    { to: ResearchPhase.IDEA_GENERATION, condition: "human_approved_retry" },
    { to: ResearchPhase.COMPLETED, condition: "human_abort" },
  ],
};
```

---

### 5.3 记忆与上下文管理系统

#### 5.3.1 分层记忆架构 (Letta/MemGPT 风格)

参考 [MemGPT](https://research.memgpt.ai/) 的虚拟上下文管理思路，实现三层记忆：

```typescript
// extensions/deepscholar-orchestrator/src/memory.ts

// 层级 1: 工作记忆 (In-Context Memory)
// = LLM 上下文窗口中的内容, 类似"RAM"
interface WorkingMemory {
  // 当前任务的关键上下文
  currentPhase: ResearchPhase;
  currentTask: TaskDescription;
  recentMessages: BotMessage[]; // 最近 N 条消息

  // 研究项目的核心摘要 (始终保持在上下文中)
  projectBrief: {
    researchTopic: string;
    approvedIdea: string;
    keyHypothesis: string;
    currentProgress: string;
  };

  // 上下文窗口使用量监控
  tokenUsage: {
    current: number;
    limit: number; // 模型上下文窗口大小
    threshold: number; // 触发压缩的阈值 (通常 75%)
  };
}

// 层级 2: 短期记忆 (Recall Memory)
// = 完整对话历史, 可被检索, 类似"SSD缓存"
// 复用 OpenClaw session (.jsonl 文件)
interface RecallMemory {
  // 全部对话记录, 按时间排序
  conversationLog: SessionMessage[];

  // 按阶段分段索引
  phaseSegments: Map<
    ResearchPhase,
    {
      startIndex: number;
      endIndex: number;
      summary: string; // LLM 生成的阶段摘要
    }
  >;

  // 检索: 关键词 + 语义
  search(query: string, topK: number): Promise<SessionMessage[]>;
}

// 层级 3: 长期记忆 (Archival Memory)
// = 结构化知识库, 向量化存储, 类似"硬盘"
// 复用 OpenClaw 的 memory-lancedb extension
interface ArchivalMemory {
  // 关键实验数据 (结构化)
  experimentResults: ExperimentResult[];

  // 论文大纲与草稿版本
  paperDrafts: PaperDraft[];

  // 关键决策记录
  decisions: DecisionRecord[];

  // 知识图谱引用
  graphReferences: GraphReference[];

  // 向量化检索
  semanticSearch(query: string, topK: number): Promise<ArchivalEntry[]>;

  // 写入 (Bot 自主管理)
  store(entry: ArchivalEntry, tags: string[]): Promise<void>;
}
```

#### 5.3.2 上下文压缩策略

```typescript
// extensions/deepscholar-orchestrator/src/compaction.ts

// 当上下文使用量超过阈值时自动触发
// 复用 OpenClaw 的 compaction-safeguard extension 并扩展

interface CompactionStrategy {
  // 1. 阶段性摘要
  //    完成一个阶段后, 将该阶段的详细对话压缩为结构化摘要
  //    摘要存入 Recall Memory, 原始对话标记为"已归档"
  summarizePhase(phase: ResearchPhase): Promise<PhaseSummary>;

  // 2. 渐进式压缩
  //    当 working memory 逼近 threshold:
  //    - 保留: 当前任务上下文 + 项目摘要 + 最近 5 条消息
  //    - 压缩: 历史消息 -> 带关键词标签的摘要
  //    - 丢弃: 纯状态更新、重复信息
  progressiveCompact(): Promise<void>;

  // 3. 关键信息标记
  //    Bot 可以主动标记某条消息为"关键", 压缩时永不丢弃
  markCritical(messageId: string): void;

  // 4. 检查点机制
  //    每次阶段切换时保存完整快照
  //    用于故障恢复
  saveCheckpoint(phase: ResearchPhase): Promise<CheckpointId>;
  restoreCheckpoint(id: CheckpointId): Promise<void>;
}
```

---

### 5.4 实验执行引擎

#### 5.4.1 代码生成与沙箱执行

```typescript
// extensions/deepscholar-experiment/src/sandbox.ts

// 所有 LLM 生成的代码在 Docker 沙箱中执行
// 参考: gVisor 增强隔离 + 事务性快照回滚

interface ExperimentSandbox {
  // 基础镜像: 预装 PyTorch, JAX, 常用库
  baseImage: string;
  // e.g., "deepscholar/experiment-base:pytorch2.5-cuda12.4"

  // 资源限制
  limits: {
    cpuCores: number;
    memoryGB: number;
    diskGB: number;
    networkAccess: "none" | "limited" | "full";
    // limited: 仅允许访问 pip, wandb, 数据集下载URL
    maxRunTimeMinutes: number; // 强制超时
  };

  // 安全策略 (参考 Fault-Tolerant Sandboxing, arXiv:2512.12806)
  security: {
    // 命令拦截层: 禁止危险操作
    blockedCommands: string[]; // rm -rf /, curl malicious, etc.
    // 文件系统快照: 事务性回滚
    enableSnapshot: boolean;
    // 网络出站白名单
    networkWhitelist: string[];
  };
}

// 实验执行流程
interface ExperimentRunner {
  // 1. 代码生成 (ML Coder Bot)
  generateCode(spec: ExperimentSpec): Promise<{
    trainScript: string; // train.py
    modelDef: string; // model.py
    dataLoader: string; // data.py
    configYaml: string; // config.yaml
    requirements: string; // requirements.txt
    testScript: string; // test_smoke.py (冒烟测试)
  }>;

  // 2. 本地预检 (低成本验证)
  //    在本地 Docker 中用小数据集运行冒烟测试
  //    确保代码能跑通再申请 GPU
  preflightCheck(code: GeneratedCode): Promise<{
    passed: boolean;
    errors: string[];
    estimatedGpuHours: number;
    estimatedCost: CostEstimate;
  }>;

  // 3. 云端执行 (需经财务审批)
  executeOnCloud(
    code: GeneratedCode,
    resources: ApprovedResources,
  ): Promise<{
    status: "success" | "failed" | "timeout";
    logs: string;
    metrics: ExperimentMetrics; // loss, accuracy, etc.
    artifacts: string[]; // 模型权重、日志文件路径
    actualCost: number;
  }>;

  // 4. 失败恢复
  diagnoseFailure(logs: string): Promise<{
    rootCause: "code_bug" | "oom" | "data_issue" | "approach_unviable" | "infra_error";
    suggestedFix?: string;
    shouldRetry: boolean;
  }>;
}
```

#### 5.4.2 云 GPU 编排

```typescript
// extensions/deepscholar-experiment/src/cloud-gpu.ts

// 支持多云平台, 优先使用成本最低的
interface CloudGPUProvider {
  name: string;
  createInstance(spec: GPUSpec): Promise<InstanceHandle>;
  uploadCode(handle: InstanceHandle, code: GeneratedCode): Promise<void>;
  startTraining(handle: InstanceHandle): Promise<JobHandle>;
  monitorJob(job: JobHandle): AsyncGenerator<JobStatus>;
  downloadArtifacts(job: JobHandle): Promise<Artifact[]>;
  destroyInstance(handle: InstanceHandle): Promise<void>;
  estimateCost(spec: GPUSpec, durationHours: number): CostEstimate;
}

// AutoDL (中国区优先, 性价比高)
const autodlProvider: CloudGPUProvider = {
  name: "AutoDL",
  // API: https://api.autodl.com
  // Token: 控制台 -> 设置 -> 开发者Token
  // 支持: RTX 4090, A100, H100 等
  // 特点: 预装 PyTorch 镜像, 快速启动
  // ...
};

// RunPod (海外备选, 编排能力强)
const runpodProvider: CloudGPUProvider = {
  name: "RunPod",
  // API: https://api.runpod.io
  // 特点: Instant Clusters, 按秒计费
  // Serverless GPU 支持
  // ...
};

// vast.ai (最低价, 适合非紧急实验)
const vastaiProvider: CloudGPUProvider = {
  name: "vast.ai",
  // API: https://cloud.vast.ai/api/v0
  // 特点: GPU 市场价, 可能比其他低 50-70%
  // 缺点: 需自行编排, 无内置集群管理
  // ...
};

// 智能选择策略
function selectProvider(requirements: {
  gpuType: string;
  region: "cn" | "global";
  urgency: "high" | "normal" | "low";
  budget: number;
}): CloudGPUProvider {
  // 中国区优先 AutoDL (网络延迟低, 无GFW问题)
  // 海外任务用 RunPod (编排好) 或 vast.ai (便宜)
  // 紧急任务: RunPod (按需启动快)
  // 非紧急任务: vast.ai (竞价实例)
}
```

#### 5.4.3 实验追踪 (Weights & Biases 集成)

```typescript
// extensions/deepscholar-experiment/src/tracking.ts

interface ExperimentTracker {
  // 在生成的训练代码中自动注入 wandb 追踪
  injectTracking(trainScript: string): string;

  // 实时监控训练进度
  monitorRun(wandbRunId: string): AsyncGenerator<{
    step: number;
    metrics: Record<string, number>; // loss, accuracy, lr, etc.
    systemMetrics: {
      gpuUtil: number;
      gpuMemory: number;
      epochProgress: number;
    };
  }>;

  // 异常检测 (训练过程中)
  detectAnomalies(metrics: MetricsStream): {
    lossExplosion: boolean; // loss 突然暴涨
    trainingStalled: boolean; // loss 长期不下降
    overfitting: boolean; // train/val 差距过大
    recommendation: "continue" | "early_stop" | "adjust_lr" | "abort";
  };
}
```

---

### 5.5 数据可视化与出图模块

```typescript
// extensions/deepscholar-writing/src/visualization.ts

// 学术论文级别的图表生成
interface AcademicVisualization {
  // 支持的图表类型
  chartTypes: [
    "line_plot", // 训练曲线 (loss/accuracy vs epoch)
    "bar_chart", // 方法对比
    "confusion_matrix", // 分类结果
    "attention_heatmap", // 注意力可视化
    "tsne_scatter", // 特征分布
    "ablation_table", // 消融实验表格 (LaTeX)
    "architecture_diagram", // 模型架构图 (tikz/pgfplots)
    "comparison_table", // 基准对比表格 (LaTeX)
  ];

  // 风格标准
  style: {
    // 严格遵循学术出版物标准
    fontFamily: "serif"; // Times New Roman 或 Computer Modern
    fontSize: { title: 12; axis: 10; legend: 9 };
    figureWidth: "3.5in" | "7in"; // 单栏/双栏
    dpi: 300;
    colorScheme: "colorblind_safe"; // 色盲友好配色
    format: "pdf" | "pgf"; // 矢量格式
  };

  // 生成流程
  generateFigure(
    spec: FigureSpec,
    data: ExperimentData,
  ): Promise<{
    code: string; // matplotlib/pgfplots 代码
    rendered: Buffer; // 渲染后的 PDF/PNG
    caption: string; // LLM 生成的图注
    latexRef: string; // \label{fig:xxx}
  }>;
}
```

---

### 5.6 论文撰写引擎

```typescript
// extensions/deepscholar-writing/src/paper-engine.ts

interface PaperWritingEngine {
  // 1. 大纲生成
  generateOutline(inputs: {
    approvedIdea: IdeaProposal;
    experimentResults: ExperimentResult[];
    relatedWork: GraphRAGResult;
    targetVenue: string; // e.g., "NeurIPS 2026"
  }): Promise<PaperOutline>;

  // 2. 分章节撰写
  //    每个章节由 Paper Writer Bot 撰写, 主编 Bot 审阅整体连贯性
  writeSections(outline: PaperOutline): Promise<{
    abstract: string;
    introduction: string;
    relatedWork: string; // 基于 Graph RAG 精准引用
    methodology: string;
    experiments: string; // 含自动嵌入的图表引用
    results: string;
    discussion: string;
    conclusion: string;
    bibtex: string; // 所有引用的 BibTeX
  }>;

  // 3. LaTeX 编译
  compileLaTeX(
    paper: PaperContent,
    template: VenueTemplate,
  ): Promise<{
    pdf: Buffer;
    compileLog: string;
    pageCount: number;
    wordCount: number;
  }>;

  // 4. 引用一致性检查 (由 Auditor Bot 执行)
  verifyCitations(
    paper: PaperContent,
    graphRAG: GraphRAGStore,
  ): Promise<{
    allCitationsValid: boolean;
    hallucinated: string[]; // 不存在的引用
    misattributed: string[]; // 张冠李戴的引用
    missing: string[]; // 应该引用但没引用的
  }>;
}

// LaTeX 模板管理 (主流会议/期刊)
const VENUE_TEMPLATES = {
  neurips: "neurips_2026.sty",
  icml: "icml2026.sty",
  iclr: "iclr2026_conference.sty",
  cvpr: "cvpr.sty",
  acl: "acl2026.sty",
  // 通用
  arxiv: "article.cls",
};
```

---

### 5.7 模拟同行评审系统

参考 [Stanford Agentic Reviewer](https://paperreview.ai/tech-overview) 的维度评分方法和 ReviewerToo 的多角色评审模式。

```typescript
// extensions/deepscholar-review/src/review-system.ts

// 核心原则: 多评委独立背靠背 + 量化打分表
// 禁止简单的角色扮演 prompt, 使用结构化评审框架

interface ReviewSystem {
  // 1. 实例化 3 个隔离的评审 Bot
  //    每个 Bot 使用不同的 LLM session (无共享上下文)
  //    每个 Bot 有不同的"学术偏好" (理论型/实验型/应用型)
  createReviewPanel(): Promise<ReviewPanel>;

  // 2. 独立评审
  conductReview(reviewer: ReviewerBot, paper: PaperContent): Promise<Review>;

  // 3. 汇总与裁决
  aggregateReviews(reviews: Review[]): Promise<ReviewDecision>;

  // 4. 修改后复审 (如果需要)
  reReview(
    reviewer: ReviewerBot,
    revisedPaper: PaperContent,
    previousReview: Review,
  ): Promise<Review>;
}

// 量化打分表 (7 个维度, 参考 Stanford Agentic Reviewer)
interface ScoringRubric {
  // 每个维度 1-10 分
  dimensions: {
    originality: {
      score: number;
      evidence: string; // 必须引用具体段落
      subChecks: [
        "novelty_vs_existing_work", // 与已有工作的差异
        "contribution_significance", // 贡献的重要性
        "creative_approach", // 方法的创造性
      ];
    };
    soundness: {
      score: number;
      evidence: string;
      subChecks: [
        "mathematical_correctness", // 数学推导正确性
        "assumption_validity", // 假设的合理性
        "proof_completeness", // 证明的完整性
      ];
    };
    experimentalRigor: {
      score: number;
      evidence: string;
      subChecks: [
        "baseline_completeness", // 基准对比是否充分
        "ablation_study", // 消融实验是否完整
        "statistical_significance", // 统计显著性检验
        "reproducibility", // 可复现性 (代码/超参)
        "dataset_diversity", // 数据集多样性
        "hyperparameter_sensitivity", // 超参敏感性分析
      ];
    };
    clarity: {
      score: number;
      evidence: string;
      subChecks: [
        "writing_quality", // 写作质量
        "figure_quality", // 图表质量
        "notation_consistency", // 符号一致性
        "structure_logic", // 结构逻辑性
      ];
    };
    relatedWorkCompleteness: {
      score: number;
      evidence: string;
      subChecks: [
        "coverage_of_field", // 领域覆盖度
        "fair_comparison", // 公平对比
        "proper_citation", // 引用准确性
      ];
    };
    practicalImpact: {
      score: number;
      evidence: string;
      subChecks: [
        "real_world_applicability", // 实际应用价值
        "scalability", // 可扩展性
        "efficiency", // 计算效率
      ];
    };
    ethicsAndReproducibility: {
      score: number;
      evidence: string;
      subChecks: [
        "ethical_considerations", // 伦理考量
        "data_availability", // 数据可获取性
        "code_release_plan", // 代码开源计划
      ];
    };
  };

  // 总分计算 (加权平均, 权重可按目标会议调整)
  totalScore: number; // 1-10

  // 裁决阈值
  thresholds: {
    accept: 7.0; // >= 7 直接通过
    minorRevision: 5.5; // 5.5-6.9 小修
    majorRevision: 4.0; // 4.0-5.4 大修
    reject: 0; // < 4.0 打回重做
  };
}

// 评委分歧处理
interface DisputeResolution {
  // 如果最高分和最低分差距 > 3 分
  // 触发"公开辩论"模式:
  //   - 各评审 Bot 阅读其他人的评审意见
  //   - 进行一轮书面辩论
  //   - 更新自己的分数 (必须给出理由)
  //   - 取最终平均分
  conductDebate(reviews: Review[]): Promise<Review[]>;
}
```

---

### 5.8 财务审批与资源管理

> **架构评审重要更新：Envelope 预算模式**
>
> 如果每开一次机、每跑一次实验都问人类，会把系统拖成半自动。改为两级预算：
>
> - **项目级 envelope**：例如"这个课题最多花 300 美元，允许 2 张 A100"
> - **异常追加审批**：只有超过 envelope、切换更贵硬件、或进入大规模 sweep 时再打断

```typescript
// extensions/deepscholar-budget/src/budget-manager.ts

// ═══ 两级预算模型 ═══

interface BudgetEnvelope {
  projectId: string;
  // 人类设定的预算上限
  totalBudgetUSD: number;
  gpuBudgetUSD: number;
  llmApiBudgetUSD: number;

  // 资源限制
  constraints: {
    maxGpuInstances: number;        // e.g., 2
    maxGpuHoursPerRun: number;    // e.g., 24
    allowedGpuTypes: string[];     // e.g., ["A100", "RTX_4090"]
    allowedProviders: string[];     // e.g., ["AutoDL", "RunPod"]
  };

  // 警告阈值
  alertThresholds: {
    warningAtPercent: number;      // e.g., 0.6 (60%)
    criticalAtPercent: number;     // e.g., 0.8 (80%)
  };
}

interface BudgetManager {
  // 获取项目预算 envelope
  getEnvelope(projectId: string): Promise<BudgetEnvelope>;

  // 检查是否可以执行 (不触发审批)
  canExecute(costEstimate: number): Promise<{
    allowed: boolean;
    reason?: string;
    requiresApproval: boolean;
  }>;

  // 触发审批的场景
  // 1. 单次调用预估超过 envelope 的 20%
  // 2. 切换到更贵的 GPU 类型
  // 3. 进入大规模 sweep (>10 并行实验)
  // 4. 预算消耗 > 40% 仍无可复现实验包时

  createResourceRequest(request: {
  projectBudget: {
    totalUSD: number;
    gpuBudgetUSD: number;
    llmApiBudgetUSD: number;
    alertThreshold: number;  // 消耗比例阈值, 如 0.8
  };

  // 已消耗统计
  consumed: {
    gpuCost: number;
    llmApiCost: number;
    otherCost: number;
  };

  // 资源申请单 (发送给人类审批)
  createResourceRequest(request: {
    requestor: string;       // Bot ID
    purpose: string;         // "训练 ViT-Large on ImageNet-1K"
    resourceType: "gpu" | "llm_api";
    estimatedCost: number;
    estimatedDuration: string;
    justification: string;   // 为什么需要这些资源
    alternatives: string[];  // 更便宜的替代方案
  }): Promise<ResourceRequestId>;

  // 通过消息通道发送审批单
  // 复用 OpenClaw 的 Telegram/Discord 通道
  sendApprovalRequest(requestId: ResourceRequestId): Promise<void>;

  // 等待人类审批
  waitForApproval(requestId: ResourceRequestId): Promise<{
    approved: boolean;
    modifiedBudget?: number;  // 人类可能调整预算
    comments?: string;
  }>;
}

// LLM API 成本管理
interface LLMCostManager {
  // 模型分级策略 (用便宜模型做简单任务)
  modelTiers: {
    high: {
      // Claude Opus / GPT-4o: 用于创新点分析、论文撰写、代码生成
      models: ["claude-opus-4", "gpt-4o"];
      costPer1kTokens: { input: 0.015, output: 0.075 };
    };
    medium: {
      // Claude Sonnet / GPT-4o-mini: 用于文献检索、数据提取
      models: ["claude-sonnet-4", "gpt-4o-mini"];
      costPer1kTokens: { input: 0.003, output: 0.015 };
    };
    low: {
      // Claude Haiku / GPT-4o-mini: 用于格式化、简单分类
      models: ["claude-haiku-4", "gpt-4o-mini"];
      costPer1kTokens: { input: 0.0008, output: 0.004 };
    };
  };

  // 缓存策略
  cache: {
    // 相同 prompt 的结果缓存 (精确匹配)
    exactMatchTTL: "24h";
    // 语义相似 prompt 的结果复用
    semanticCacheSimilarity: 0.95;
  };

  // Token 预算追踪
  trackUsage(model: string, inputTokens: number, outputTokens: number): void;
  getUsageReport(): UsageReport;
}
```

---

### 5.9 人机交互界面

```typescript
// 复用 OpenClaw 的多通道能力

// 1. Telegram Bot (主要交互方式, 适合移动端)
//    用途: 接收审批请求, 选题投票, 进度推送
//    格式: 结构化消息 + 行内按钮

// 2. Web Dashboard (详细信息查看)
//    复用 OpenClaw 的 ui/ 目录扩展
//    用途: 知识图谱可视化, 实验仪表盘, 论文预览

// 3. CLI (开发者/高级用户)
//    复用 OpenClaw 的 CLI 框架 (Commander)
//    openclaw research start --topic "multimodal LLM fine-tuning"
//    openclaw research status
//    openclaw research approve --request-id xxx
//    openclaw research abort

// Telegram 消息模板示例
const APPROVAL_MESSAGE_TEMPLATE = `
📋 *资源申请单 #{{requestId}}*

*申请者:* {{requestor}}
*用途:* {{purpose}}
*资源类型:* {{resourceType}}
*预估费用:* ${{ estimatedCost }}
*预估时长:* {{estimatedDuration}}
*已消耗预算:* ${{ consumedBudget }} / ${{ totalBudget }} ({{percentage}}%)

*理由:*
{{justification}}

*更便宜的替代方案:*
{{alternatives}}

请选择:
`;
// [✅ 批准] [❌ 拒绝] [✏️ 调整预算]
```

---

## 6. 12 步科研流水线详细流程

```
Step  0: 预注册研究计划 ──── 生成并冻结 ResearchPlan
         │                    防止"见数据改故事"
         │                    包含:
         │                    - 研究假设
         │                    - 成功条件 (成功阈值)
         │                    - 对比 baseline
         │                    - 数据集 + 指标
         │                    - 预算上限
         │                    - 停止条件 (何时判定失败)
         │                    [人类介入点 0]
         ▼
Step  1: 文献爬取 ─────────── 文献Bot定期从顶会顶刊抓取最新论文
         │                    数据源: Semantic Scholar + OpenAlex + arXiv
         │                    触发: 定时任务(每日) 或 人类指定领域
         ▼
Step  2: 文献入库与图谱构建 ── GROBID解析 → 知识图谱节点/边 → Neo4j
         │                    社区检测 → 社区摘要 → LanceDB向量化
         ▼
Step  3: 创新点发现 ────────── 文献Bot + 创新分析Bot
         │                    Graph RAG 全局搜索: "当前领域有哪些未解决的问题?"
         │                    生成 3-5 个候选研究提案
         ▼
Step  4: 内部研讨 ──────────── 多Bot讨论(Turn-based)
         │                    可行性评估: 数据集可用性、计算资源需求、创新程度
         │                    每个提案打分排序
         ▼
Step  5: 人类选题 ──────────── 提案推送给人类(Telegram/Web)
         │                    人类选择或修改方向
         │                    [人类介入点 1]
         ▼
Step  6: 实验设计 ──────────── ML Coder Bot 生成实验代码
         │                    包含: 模型定义、数据加载、训练脚本、评估脚本
         │                    本地 Docker 冒烟测试 (小数据集)
         ▼
Step  7: 资源审批 ──────────── Budget Bot 生成《资源申请单》
         │                    发送给人类审批
         │                    [人类介入点 2: 经费审批]
         ▼
Step  8: 云端实验 ──────────── 创建 GPU 实例 → 上传代码 → 开始训练
         │                    wandb 实时追踪 → 异常检测
         │                    训练完成 → 下载 artifacts → 销毁实例
         │
         ├── 代码Bug ────────→ ML Coder Bot 根据日志修Bug → 回到 Step 8
         ├── 方法不可行 ─────→ 熔断 → 通知人类 → 回到 Step 3 或终止
         ▼
Step  9: 结果验证 ──────────── Auditor Bot 核对
         │                    原始训练日志 vs 代码Bot报告的数据
         │                    逐行比对, 防止数据造假/幻觉
         │
         ├── 数据不一致 ────→ 标记问题 → 要求代码Bot解释 → 修正
         ├── 结果优秀 ──────→ 进入写作阶段
         ├── 结果一般 ──────→ 讨论: 补充实验 or 调整方法 → 回到 Step 6/8
         ▼
Step 10: 论文撰写 ──────────── Paper Writer Bot
         │                    大纲 → 分章节撰写 → LaTeX编译
         │                    图表: Data Viz Bot 根据真实数据生成
         │                    引用: 从知识图谱精准拉取, Auditor检查
         ▼
Step 11: 模拟同行评审 ────────  3个独立 Reviewer Bot
         │                    50项量化打分表 → 独立打分 → 汇总
         │                    如有大分歧 → 公开辩论 → 最终裁决
         │
         ├── Accept (≥7.0) ─→ 进入终审
         ├── Minor Rev ─────→ 小修后直接进终审
         ├── Major Rev ─────→ 大修 → 回到 Step 10 (甚至 Step 8)
         ├── Reject (<4.0) ─→ 熔断讨论: 换题 or 大改
         ▼
Step 12: 人类终审 ──────────── 论文PDF + 实验报告 + 审稿意见
                               推送给人类
                               [人类介入点 3: 最终定稿]
                               人类决定: 投稿 / 修改 / 存档
```

---

## 7. 数据模型与存储设计

### 7.1 目录结构

```
~/.deepscholar/
├── config.yaml                    # 全局配置
├── projects/                      # 研究项目
│   └── {project-id}/
│       ├── meta.json              # 项目元数据 (主题、创建时间、状态)
│       ├── sessions/              # Bot 对话记录 (OpenClaw session 格式)
│       │   └── {session-id}.jsonl
│       ├── checkpoints/           # 阶段快照
│       │   └── {phase}_{timestamp}.json
│       ├── literature/            # 文献库
│       │   ├── papers/            # 原始 PDF
│       │   ├── parsed/            # GROBID 解析结果 (TEI XML)
│       │   └── graph.db           # Neo4j 数据 (或导出)
│       ├── experiments/           # 实验
│       │   └── {exp-id}/
│       │       ├── code/          # 生成的代码
│       │       ├── logs/          # 训练日志 (原始)
│       │       ├── artifacts/     # 模型权重、指标
│       │       └── wandb/         # wandb 本地缓存
│       ├── paper/                 # 论文
│       │   ├── drafts/            # 各版本草稿
│       │   ├── figures/           # 图表
│       │   ├── main.tex           # 主 LaTeX 文件
│       │   ├── refs.bib           # 参考文献
│       │   └── compiled.pdf       # 编译输出
│       ├── reviews/               # 评审记录
│       │   └── round_{n}/
│       │       ├── reviewer_{1..3}.json
│       │       └── meta_review.json
│       ├── budget/                # 财务记录
│       │   ├── requests/          # 审批单
│       │   └── usage.json         # 用量统计
│       └── audit_log.jsonl        # 全流程审计日志
├── knowledge_base/                # 跨项目共享的知识图谱
│   ├── neo4j/                     # Neo4j 数据目录
│   ├── lancedb/                   # 向量数据库
│   └── papers.sqlite              # 论文全文索引
└── credentials/                   # API 密钥 (复用 OpenClaw)
```

### 7.2 核心数据类型

```typescript
// 研究项目
interface ResearchProject {
  id: string;
  title: string;
  topic: string;
  createdAt: Date;
  status: ResearchPhase;
  budget: BudgetAllocation;
  ideaProposals: IdeaProposal[];
  approvedIdea?: IdeaProposal;
  experiments: Experiment[];
  paperDrafts: PaperDraft[];
  reviewRounds: ReviewRound[];
  auditLog: AuditEntry[];
}

// 研究提案
interface IdeaProposal {
  id: string;
  title: string;
  motivation: string; // 为什么做这个
  approach: string; // 怎么做
  expectedContribution: string; // 预期贡献
  feasibilityScore: number; // Bot 评估的可行性 1-10
  noveltyScore: number; // Bot 评估的新颖性 1-10
  estimatedResources: ResourceEstimate;
  supportingPapers: string[]; // 知识图谱中的论文引用
  risks: string[]; // 风险点
}

// 预注册研究计划 (Step 0 产出)
interface ResearchPlan {
  id: string;
  projectId: string;
  frozenAt: Date; // 冻结时间，不可更改

  // 核心内容
  hypothesis: string; // 研究假设
  successCriteria: {
    primaryMetric: string; // e.g., "accuracy", "BLEU"
    targetValue: number; // e.g., 0.85
    improvementOverBaseline: number; // e.g., 0.05 (5% 提升)
  };

  // 对比基线
  baselines: {
    name: string; // e.g., "ViT-B/16"
    source: "official" | "reproduced" | "第三方";
    metricValues: Record<string, number>;
  }[];

  // 数据集与指标
  datasets: {
    name: string;
    version: string;
    split: "train" | "test" | "val";
  }[];
  evaluationMetrics: string[];

  // 预算约束
  budgetEnvelope: {
    maxGpuHours: number;
    maxCostUSD: number;
    maxExperiments: number;
  };

  // 停止规则
  stopRules: {
    maxFailedAttempts: number; // 连续失败多少次后停止
    budgetDepletionPercent: number; // 预算消耗多少百分比后停止
    timeLimitHours: number; // 时间上限
  };

  // 审计
  approvedBy: string; // 人类审批者
  approvedAt: Date;
}

// 实验
interface Experiment {
  id: string;
  designSpec: ExperimentSpec;
  code: GeneratedCode;
  preflightResult: PreflightResult;
  cloudExecution?: {
    provider: string;
    instanceId: string;
    startTime: Date;
    endTime?: Date;
    cost: number;
    status: "running" | "completed" | "failed";
  };
  results?: ExperimentResult;
  auditStatus: "pending" | "verified" | "flagged";
}
```

---

## 8. 安全、容错与防造假机制

### 8.1 防造假 (Anti-Fabrication)

```
问题: LLM 倾向于"编造"看起来合理但不真实的数据

对策:
┌───────────────────────────────────────────────────┐
│              数据溯源链 (Data Provenance)           │
│                                                   │
│  实验数据 ←── 原始 wandb 日志 ←── GPU 实例日志     │
│      │                                            │
│      ▼                                            │
│  Auditor Bot 读取原始日志 (不经过任何中间Bot)       │
│      │                                            │
│      ▼                                            │
│  逐行比对: 论文中的数字 vs 原始日志中的数字        │
│      │                                            │
│  不一致 → 标记 + 要求解释 + 拒绝进入下一阶段       │
│  一致   → 通过, 附加验证签名                       │
└───────────────────────────────────────────────────┘

关键规则:
1. Auditor Bot 永远直接读取原始 artifact, 不接受其他 Bot 的转述
2. 论文中的每个数字都必须能追溯到具体的日志行号
3. 图表代码必须直接读取原始数据文件, 不允许硬编码数据点
4. 引用验证: 论文中每个 \cite{} 都必须在知识图谱中存在
```

### 8.2 熔断机制 (Circuit Breaker)

```typescript
// extensions/deepscholar-orchestrator/src/circuit-breaker.ts

interface CircuitBreaker {
  // 触发条件
  triggers: {
    // 实验连续失败 3 次 (同一 approach)
    consecutiveExperimentFailures: 3;

    // 单个实验耗时超过预算的 200%
    costOverrun: 2.0;

    // 评审分数持续低于 reject 阈值, 2 轮大修后仍无改善
    persistentReviewFailure: 2;

    // 人类超过 72 小时未响应审批
    humanResponseTimeout: "72h";
  };

  // 熔断动作
  onCircuitBreak(trigger: string): Promise<void>;
  // 1. 立即暂停所有正在执行的任务
  // 2. 保存当前状态快照
  // 3. Root Cause Analysis:
  //    - 如果是代码bug → 尝试修复 (最多 2 次)
  //    - 如果是方法本身不work → 标记为"方法不可行"
  //    - 如果是资源不足 → 重新申请
  // 4. 生成《熔断报告》发送给人类
  // 5. 等待人类决策: 换题 / 调整方法 / 增加预算 / 终止
}
```

#### 8.1.1 Claim-Evidence Ledger (结论-证据账本)

仅做日志比对不够，必须升级为结构化证据账本：

```typescript
// 每一个论文中的结论都必须绑定到可验证证据

interface Claim {
  id: string; // 唯一标识
  paperSection: string; // 论文中的位置 (e.g., "3.2", "Table 2")
  content: string; // 结论原文 (e.g., "Our method outperforms baseline by 5.3%")
  strength: "strong" | "moderate" | "weak";
  assertions: Assertion[];
}

interface Assertion {
  id: string;
  type: "numerical" | "comparative" | "qualitative";
  // 数值型: "准确率提升 5.3%"
  // 对比型: "优于 XXX 方法"
  // 定性型: "更稳定"

  // 证据绑定
  evidence: {
    runGroupId: string; // 关联的实验组
    metricName: string; // e.g., "accuracy", "f1"
    values: number[]; // 原始数值
    aggregation: "mean" | "median" | "best";
    std?: number; // 标准差
    ci95?: [number, number]; // 95% 置信区间
    seedCount: number; // 实验种子数
    baselineComparison: {
      baselineRunGroupId: string;
      delta: number; // 差值
      pValue?: number; // 统计显著性
    };
  };

  // 绑定到具体图表
  figureSpecId?: string;

  // 审计状态
  auditStatus: "draft" | "verified" | "disputed";
  verifiedBy: string; // Auditor Bot 签名
  verifiedAt: Date;
}
```

**关键铁律：**

1. **数字只能来自 registry** — Writer Bot 禁止直接看日志拼数字，只能调用 `claim.get()`
2. **图表必须声明式生成** — 不允许手工截图或二次修图
3. **强断言必须带统计支撑** — "显著提升""更稳定"都要有 p-value 或 CI
4. **负结果也要归档** — 不能只保留"好看"的 runs

### 8.2 失败分类 (Failure Classification)

不分类型的熔断会导致两类错误：本该修 bug 的判成科研死路，或本该止损的继续烧钱。

```typescript
type FailureType =
  | "infrastructure" // 基础设施失败
  | "implementation" // 实现失败
  | "scientific"; // 科研失败

interface FailureAnalysis {
  type: FailureType;
  // 基础设施失败: 环境、下载、权限、OOM、超时、节点失联
  // 实现失败: NaN、loss 不收敛、评测脚本错、标签泄漏、数据对齐错误
  // 科研失败: 代码无 bug、实验健康，但结果就是不提升

  evidence: {
    logs: string[];
    metrics: ExperimentMetrics;
    diagnostics: string[];
  };

  recommendedAction: "retry" | "debug_fix" | "abandon_direction" | "require_human";
  retryCount?: number;
}

const FAILURE_POLICIES = {
  infrastructure: {
    maxRetries: 2,
    actionAfterMax: "debug",
    countTowardScientificFailure: false,
  },
  implementation: {
    maxRetries: 3,
    actionAfterMax: "abandon_direction",
    requireDebugHypothesis: true, // 每轮修复必须附带 bug 假设
    countTowardScientificFailure: false,
  },
  scientific: {
    // 必须同时满足: 代码健康 + 指标无提升 + 复现实验确认
    // 才记为科学失败
    requiresReproductionConfirmation: true,
    consecutiveHealthyRunsThreshold: 2,
    triggersPivotOrKill: true,
  },
};
```

### 8.3 全流程审计日志

```typescript
// 每个操作都记录到不可变的审计日志
interface AuditEntry {
  timestamp: Date;
  actor: string; // Bot ID 或 "human"
  action: string; // "generate_code", "run_experiment", "write_section"
  phase: ResearchPhase;
  details: {
    input: string; // 输入摘要
    output: string; // 输出摘要
    modelUsed: string; // 使用的 LLM 模型
    tokenCount: number; // Token 消耗
    cost: number; // 费用
    duration: number; // 耗时(秒)
  };
  // 用于事后追溯和争议解决
}
```

---

## 9. 技术选型与依赖清单

### 9.1 运行时环境

| 组件   | 选型             | 版本 | 理由              |
| ------ | ---------------- | ---- | ----------------- |
| 运行时 | Node.js + Bun    | 22+  | OpenClaw 基座要求 |
| 语言   | TypeScript (ESM) | 5.x  | OpenClaw 基座要求 |
| 包管理 | pnpm             | 9+   | OpenClaw 基座要求 |

### 9.2 核心依赖

| 功能             | 库/服务                      | 说明                                            |
| ---------------- | ---------------------------- | ----------------------------------------------- |
| 主状态机与工作流 | **Temporal** (推荐)          | 长周期科研流程的持久化恢复；失败后从检查点继续  |
| 工作流编排备选   | Argo Workflows / K8s Job     | 实验批量 fan-out 场景                           |
| 关系数据库       | PostgreSQL + pgvector        | 核心对象存储：Project/Proposal/Run/Claim 等     |
| 对象存储         | S3 / MinIO                   | 实验 artifacts、模型权重、PDF 等                |
| 图数据库         | Neo4j Community (可选)       | 知识图谱查询加速，第一版可用 pggraph 边表替代   |
| 向量数据库       | LanceDB                      | 已有 extension, 向量化记忆                      |
| 论文解析         | GROBID (Docker)              | PDF → 结构化 TEI XML                            |
| 文献检索         | Semantic Scholar API         | 免费, 200M+ 论文                                |
| 文献检索 (备)    | OpenAlex API                 | 免费, 250M+ 论文, 高吞吐                        |
| 元数据融合       | Crossref API                 | DOI、license、funding、post-publication updates |
| 实验追踪         | Weights & Biases (wandb)     | 训练指标实时追踪；Sweep 支持超参搜索            |
| 实验追踪 (备)    | ClearML                      | 实验跟踪、环境记录、artifacts 管理              |
| LaTeX 编译       | TeX Live (Docker)            | 论文编译                                        |
| 代码沙箱         | Docker + gVisor              | LLM 生成代码的安全执行                          |
| 云 GPU (中国)    | AutoDL API                   | 性价比高, RTX 4090 / A100                       |
| 云 GPU (海外)    | RunPod API                   | 编排好, 按秒计费                                |
| 云 GPU (低价)    | vast.ai API                  | GPU 市场价, 便宜 50-70%                         |
| LLM 提供商       | Claude / GPT / DeepSeek      | OpenClaw 的模型路由能力                         |
| 消息通道         | Telegram (主) / Discord (备) | OpenClaw 已有 extension                         |

### 9.3 Docker 镜像

```yaml
# docker-compose.deepscholar.yml

services:
  neo4j:
    image: neo4j:5-community
    ports: ["7474:7474", "7687:7687"]
    volumes: ["./knowledge_base/neo4j:/data"]
    environment:
      NEO4J_AUTH: neo4j/deepscholar

  grobid:
    image: lfoppiano/grobid:0.8.1
    ports: ["8070:8070"]
    # 性能: 单实例 ~10 PDF/秒

  latex:
    image: texlive/texlive:latest
    volumes: ["./projects:/projects"]

  sandbox:
    image: deepscholar/experiment-base:latest
    # 预装: Python 3.11, PyTorch 2.5, JAX, numpy, scipy, wandb
    runtime: runsc # gVisor 隔离
    security_opt: ["no-new-privileges:true"]
    read_only: true
    tmpfs: ["/tmp:size=10G"]
```

---

## 10. 分期开发计划

### Phase 0: 基础设施搭建

- [ ] Fork/配置 OpenClaw 开发环境
- [ ] Docker Compose 配置 (Neo4j + GROBID + LaTeX)
- [ ] 创建 6 个 extension 骨架项目
- [ ] 配置开发用 LLM API keys
- [ ] 验证 OpenClaw Telegram 通道可用

### Phase 1: 文献模块 (单模块可用)

- [ ] Semantic Scholar / OpenAlex API 封装
- [ ] GROBID 论文解析流水线
- [ ] Neo4j 知识图谱构建 (实体/关系提取)
- [ ] Graph RAG 检索 (局部+全局)
- [ ] 文献质量过滤
- [ ] 文献模块的 CLI 命令 (`openclaw research literature ...`)
- [ ] 单元测试 + 集成测试

### Phase 2: 编排引擎 + 记忆系统

- [ ] Turn-based Message Bus 实现
- [ ] 状态机 (12 步流程)
- [ ] 固定 Bot 定义 (主编、审计、财务)
- [ ] 动态 Bot 模板注册
- [ ] 分层记忆系统 (Working/Recall/Archival)
- [ ] 上下文压缩策略
- [ ] 检查点保存/恢复
- [ ] 财务审批流 (Telegram 交互)

### Phase 3: 实验执行引擎

- [ ] Docker 沙箱 + gVisor 配置
- [ ] 代码生成模板 (PyTorch 训练脚本)
- [ ] 本地冒烟测试 runner
- [ ] AutoDL API 集成
- [ ] RunPod API 集成
- [ ] wandb 追踪集成
- [ ] 失败诊断与自动修复
- [ ] 熔断机制

### Phase 4: 论文生成 + 评审

- [ ] LaTeX 模板管理
- [ ] 学术可视化引擎
- [ ] 分章节论文撰写流程
- [ ] 引用一致性检查
- [ ] LaTeX 编译流水线
- [ ] 评审系统 (3 评委 + 打分表)
- [ ] 评委分歧辩论机制
- [ ] 大修/小修循环

### Phase 5: 端到端集成测试

- [ ] 全流程 E2E 测试 (用简单任务, 如 "MNIST 上的新 augmentation 策略")
- [ ] 人类交互流程测试 (Telegram 审批)
- [ ] 成本控制测试
- [ ] 熔断恢复测试
- [ ] 防造假审计测试

### Phase 6: 优化与扩展

- [ ] Web Dashboard (知识图谱可视化, 实验仪表盘)
- [ ] 多项目并行支持
- [ ] 自定义评审维度配置
- [ ] 更多云 GPU 平台接入
- [ ] 性能优化 (Graph RAG 索引速度, LLM 缓存)

---

## 11. 已识别风险与缓解策略

### 11.1 技术风险

| 风险                                   | 严重性 | 概率 | 缓解策略                                                    |
| -------------------------------------- | ------ | ---- | ----------------------------------------------------------- |
| LLM 生成的训练代码频繁失败             | 高     | 高   | 预置经过验证的代码模板库；冒烟测试前置；最多重试 3 次后熔断 |
| Graph RAG 构建成本过高 (大量 LLM 调用) | 中     | 中   | 使用 GPT-4o-mini 做实体提取；增量构建而非全量重建；结果缓存 |
| 上下文窗口不够用                       | 中     | 高   | Letta 风格的分层记忆 + 激进压缩；阶段性摘要；关键信息标记   |
| 多 Bot 协调出现死锁/混乱               | 中     | 中   | 严格的 Turn-based Bus；主编 Bot 兜底超时机制；状态机约束    |
| Docker 沙箱安全逃逸                    | 高     | 低   | gVisor 增强隔离；网络白名单；只读文件系统；资源限制         |
| 论文引用幻觉 (引用不存在的论文)        | 高     | 中   | Auditor Bot 逐条验证；所有引用必须在知识图谱中存在          |

### 11.2 运营风险

| 风险                   | 严重性 | 缓解策略                                       |
| ---------------------- | ------ | ---------------------------------------------- |
| 云 GPU 成本失控        | 高     | 人类审批制；硬性预算上限；实时用量追踪         |
| LLM API 费用超预期     | 中     | 模型分级调用；aggressive caching；token budget |
| 人类审批成为瓶颈       | 中     | 超时自动暂停 (非自动批准)；汇总型审批减少频率  |
| 生成论文的学术伦理问题 | 高     | 明确声明 AI 辅助；不自动投稿；人类终审把关     |

### 11.3 目前方案中需要进一步思考的问题

1. **知识图谱的增量更新策略**：当新论文入库时，如何高效更新已有的社区结构和摘要，而不是全量重建？建议采用增量 Leiden 算法 + 影响范围估算，仅重新生成受影响社区的摘要。

2. **多项目间的知识复用**：如果同时运行多个研究项目，知识图谱应该是共享的还是独立的？建议采用"共享底层图谱 + 项目级视图"的设计，底层论文节点共享，项目特定的标注和权重独立。

3. **实验代码模板的维护**：LLM 生成的训练代码质量高度依赖于模板。需要建立一个经过人工验证的"黄金模板库"，覆盖常见的训练范式（分类、检测、分割、生成、微调等）。

4. **评审系统的偏差校准**：LLM 评审器已知偏向于评估技术正确性，而忽略新颖性评估。需要在 prompt engineering 中特别加强 novelty 维度的评估权重，并可能引入基于知识图谱的自动 novelty 检测。

5. **长时间运行的可靠性**：一个完整的科研流程可能持续数天到数周。需要可靠的检查点/恢复机制，以及对 LLM API 服务中断的容错处理。

6. **数据集的自动获取**：实验需要数据集，但许多学术数据集需要注册/申请。需要建立数据集可用性的预检查，以及常用公开数据集的自动下载能力。

7. **Baseline 复现问题**：论文需要与 baseline 做对比。如何确保 baseline 的实现是正确的？建议优先使用官方开源实现，次选知名第三方实现，最后才是自己复现。

8. **并发实验的资源调度**：如果一个课题需要多组实验（消融实验、超参搜索），如何高效调度？建议实现一个简单的任务队列，支持优先级和依赖关系。

---

## 12. 明确的非目标 (v1)

基于架构评审反馈，以下场景**不是**本系统第一版的目标：

| 类别             | 非目标场景                                  | 理由                                                  |
| ---------------- | ------------------------------------------- | ----------------------------------------------------- |
| **实验类型**     | 物理实验、湿实验、医疗建议、临床或人类实验  | 超出纯计算范畴，涉及安全和伦理                        |
| **投稿自动化**   | 自动向会议/期刊投稿                         | 人类必须终审把关；自动投稿涉及出版伦理                |
| **多租户**       | 多人共享高权限 Gateway                      | OpenClaw 安全模型为"一人一 Gateway"；多租户需严格隔离 |
| **动态技能安装** | Agent 自主从公共 Registry 安装第三方 Skills | 第三方 Skills 视为不可信代码；生产环境需白名单        |
| **通用领域**     | 任意 ML 子领域的泛化闭环                    | 第一版聚焦 code-expressible + 公开 benchmark + 窄领域 |
| **公网暴露**     | Gateway 暴露到公网                          | OpenClaw 安全基线为 loopback + token auth             |

### 边界约束

- 仅支持**纯计算型深度学习研究**（模型训练/评测/改进）
- 仅支持**公开数据集**（禁止爬取私有数据）
- 仅支持**可复现实验**（必须记录环境/依赖/种子）
- 仅支持**单项目顺序执行**（暂不支持多项目并行排队）

---

## 13. 验收指标

在系统上线前，应满足以下硬指标：

### 功能指标

| 指标               | 目标值                | 说明                              |
| ------------------ | --------------------- | --------------------------------- |
| 单项目全流程可跑通 | 立项 → 实验包无人值守 | 中间仅人类审批节点需介入          |
| 健康 run 率        | > 70%                 | 排除 infra failure 后的成功率     |
| Claim 审计误差率   | 0%                    | 论文中数字 claim 必须 100% 可追溯 |
| 复现实验通过率     | > 90%                 | 在容忍区间内复现已验证结果        |
| Review 区分度      | 能区分好坏稿          | Reviewer 不应一律给中分           |

### 工程指标

| 指标                | 目标值   | 说明                           |
| ------------------- | -------- | ------------------------------ |
| 预算超支可追溯率    | 100%     | 所有超支事件必须有审计记录     |
| 失败项目 RCA 覆盖率 | 100%     | 每个失败项目必须有根因报告     |
| 人类修改量递减      | 持续下降 | 随着系统成熟，人类介入量应减少 |
| 资源审批合规率      | 100%     | 无审批不触发高成本资源租用     |

### 安全指标

| 指标                    | 目标值 | 说明                               |
| ----------------------- | ------ | ---------------------------------- |
| 未审批高成本触发次数    | 0      | 财务 Bot 必须拦截无审批的 GPU 租用 |
| 实验 agent 敏感凭据接触 | 0      | 训练 agent 不得接触宿主机凭据      |
| Gateway 公网暴露        | 0      | 必须仅 loopback 绑定               |

---

## 14. 参考资料与关键链接

### 同类系统

- [AI Scientist (Sakana AI)](https://sakana.ai/ai-scientist/) - 端到端研究自动化
- [AI Scientist v2 论文](https://pub.sakana.ai/ai-scientist-v2/paper/paper.pdf) - Workshop 级别论文生成
- [AI Scientist 独立评估](https://arxiv.org/abs/2502.14297) - 42% 实验失败率等关键发现
- [Agent Laboratory](https://agentlaboratory.github.io/) - LLM 驱动的全周期研究框架
- [AgentRxiv](https://agentrxiv.github.io/) - 协作式自主研究

### Multi-Agent 框架

- [AutoGen (Microsoft)](https://microsoft.github.io/autogen/) - 对话驱动的多 agent 框架
- [CrewAI](https://www.crewai.com/) - 角色化 agent 团队
- [MetaGPT](https://github.com/geekan/MetaGPT) - 模拟软件公司的 multi-agent
- [LangGraph](https://github.com/langchain-ai/langgraph) - 状态图 agent 编排

### 知识图谱与 RAG

- [Microsoft GraphRAG](https://github.com/microsoft/graphrag) - 图增强 RAG
- [GraphRAG 论文](https://arxiv.org/abs/2404.16130) - "From Local to Global"
- [Awesome-GraphRAG](https://github.com/DEEP-PolyU/Awesome-GraphRAG) - 资源汇总

### 论文解析

- [GROBID](https://github.com/kermitt2/grobid) - 学术论文 PDF 解析
- [Semantic Scholar API](https://www.semanticscholar.org/product/api) - 200M+ 论文检索
- [OpenAlex API](https://docs.openalex.org/) - 250M+ 开放学术数据

### 记忆系统

- [MemGPT (Letta)](https://research.memgpt.ai/) - 虚拟上下文管理
- [Letta 文档](https://docs.letta.com/) - agent 记忆框架

### 评审系统

- [Stanford Agentic Reviewer](https://paperreview.ai/tech-overview) - AI 评审，与人类评审相关度 0.42
- [ICLR 2025 LLM 评审 RCT](https://www.nature.com/articles/s42256-026-01188-x) - 大规模随机对照研究

### 代码沙箱

- [LLM Sandbox](https://github.com/vndee/llm-sandbox) - 轻量级 LLM 代码沙箱
- [Fault-Tolerant Sandboxing](https://arxiv.org/abs/2512.12806) - 事务性沙箱

### 云 GPU

- [AutoDL API 文档](https://www.autodl.com/docs/esd_api_doc/) - 中国区 GPU 云
- [RunPod](https://www.runpod.io/) - 海外 GPU 云
- [vast.ai](https://vast.ai/) - GPU 市场

### 基座项目

- [OpenClaw](https://github.com/openclaw/openclaw) - 多通道 AI 网关
