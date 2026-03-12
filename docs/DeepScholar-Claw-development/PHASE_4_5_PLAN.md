# Phase 4.5 Plan（仓库精简：从 OpenClaw 大仓库收敛为 DeepScholar-Claw 最小工程）

## 为什么要做 Phase 4.5

在 Phase 4.5 启动时，仓库仍然继承了 OpenClaw 的“大而全”结构：多端 App、Web UI、各种消息通道、插件 SDK、扩展生态、海量脚本与测试。这些东西对 OpenClaw 来说是核心能力，但对 DeepScholar-Claw 当前阶段来说，会带来三个直接问题：

- **开发速度被拖慢**：改一个小逻辑也要跑一堆无关构建与测试，排障成本指数上升。
- **心智负担过高**：仓库里 80% 的文件不参与 DeepScholar 的科研闭环，后续协作会不断误触。
- **发布与定位混乱**：我们已经明确“基于 OpenClaw 但不属于 OpenClaw”，仓库需要更清晰的身份与边界。

Phase 4.5 的目标就是把这堆“没用但很重的行李”卸掉，只留下 DeepScholar 真正要跑的那辆车。

---

## 当前状态（截至 2026-03-12）

仓库已完成精简收敛，现在的形态是：

- 只保留 `src/`（CLI 控制面）、`services/`（科研重逻辑）、`packages/deepscholar-contracts/`（制度底座）
- OpenClaw 的 apps/ui/extensions/skills/plugin-sdk/多通道网关等大块内容已移除
- 根 `README.md` 已重写为 DeepScholar-Claw 的独立项目介绍

## 当前要保留的“DeepScholar 最小集合”

### 1) 共享契约层（必须保留）

- `packages/deepscholar-contracts/`
  - 研究项目/计划/预算/实验 run/论文草稿/评审/审计等结构化契约
  - 运行时校验（防脏数据、防崩溃）

### 2) 核心服务（必须保留）

- `services/orchestrator/`：12 步科研状态机 + 审批门控 + 审计/ checkpoint 落盘
- `services/runner/`：Docker 沙箱执行 + run 产物落盘 + 诊断/重试/熔断协作
- `services/writing/`：论文包落盘 + LaTeX 渲染/编译（含失败日志）
- `services/review/`：结构化打分表 + 聚合裁决（含混稿保护）
- `services/paper-intel/`：文献 ingest/图谱/检索（当前阶段保留，后续 Phase5/6 会继续用）
- `services/provenance/`：证据账本汇总（为“防造假审计”提供基础）

### 3) DeepScholar CLI（必须保留，但要收敛入口）

- 仅保留与 DeepScholar 闭环直接相关的 CLI 命令：
  - 项目启动/状态/冻结计划
  - 预算申请/批准/拒绝/恢复/终止
  - Runner smoke/status/abort/list/collect（如需要）
  - Phase4：validate/write/compile/review-decide

> 重要：Phase 4.5 会把 CLI 从 OpenClaw 的“多通道网关大命令面”收敛为 DeepScholar 的“科研闭环命令面”。
>  
> 当前仓库已经完成该收敛：CLI 命令面以 `deepscholar research ...` 为中心，不再包含多通道网关命令。

---

## 必须清除的内容（默认全部删除）

以下内容不参与 DeepScholar 当前闭环，且对后续维护有显著拖累，因此统一删除：

- `apps/`（iOS/Android/macOS app）
- `ui/`（OpenClaw Web UI）
- `extensions/`（OpenClaw 扩展生态）
- `skills/`（OpenClaw 技能库与插件化脚手架）
- `Swabble/`（与 OpenClaw app/生态相关）
- OpenClaw 网关与各通道实现的大块代码（`src/gateway/**`、`src/channels/**`、`src/telegram/**` 等）
- OpenClaw plugin-sdk（`src/plugin-sdk/**`）与相关 exports
- 与上述功能绑定的脚本、构建产物规则、CI 配置、测试配置

> 删除原则：**只要不是 DeepScholar 当前功能的依赖，就删。**  
> 验证原则：**删完必须能 build + test。**

---

## 执行策略（防止“删过头”）

我们按“最小可运行集合”倒推删除范围，而不是凭感觉删目录：

1. 先画出 DeepScholar 的依赖地图（入口文件、CLI 注册链路、服务依赖）
2. 再把 workspace/build/test 配置收敛到这张地图
3. 最后删除冗余目录与依赖，并用单测闸门回归

这样做的好处是：删错了会立刻在 build/test 里炸出来，不会留下“表面能跑但缺零件”的隐患。

---

## 本阶段验收（开发者侧）

### 1) 定向单测闸门（60 秒）

```bash
perl -e 'alarm 60; exec @ARGV' pnpm exec vitest run \
  services/orchestrator/src/*.test.ts \
  services/runner/src/*.test.ts \
  services/writing/src/*.test.ts \
  services/review/src/*.test.ts \
  services/paper-intel/src/*.test.ts \
  services/provenance/src/*.test.ts \
  packages/deepscholar-contracts/src/*.test.ts \
  src/cli/research-*.test.ts
```

### 2) Build + Test（Phase 4.5 结束后的新定义）

```bash
pnpm build && pnpm test
```

---

## 交付物清单

- 根 `README.md`：更新为 DeepScholar-Claw 的完整项目介绍
- `docs/DeepScholar-Claw-development/README.md`：索引新增 Phase 4.5 文档
- `docs/DeepScholar-Claw-development/DEEPSCHOLAR_DEVELOPMENT_SPEC.md`：阶段列表新增 Phase 4.5
- 代码精简：只保留 DeepScholar 最小集合
- 提交：完成一次可回溯的 git commit
