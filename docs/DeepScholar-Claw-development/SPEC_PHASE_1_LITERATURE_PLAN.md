# Spec Phase 1: 文献模块（完成记录）

> 对应规格文档：`DEEPSCHOLAR_DEVELOPMENT_SPEC.md` 中的 Phase 1 “文献模块 (单模块可用)”

## 这一阶段解决了什么问题

以前“文献模块”只是一张待办清单，系统并不会真的去抓论文、存论文、解析 PDF、建图谱、做检索。

现在 Phase 1 的成果是：你可以用 **DeepScholar-Claw 的 CLI** 直接驱动一条可执行链路，把“找论文”变成可重复、可审计的工程动作。

## 交付清单（按规格 Phase 1 对齐）

| 规格条目                             | 状态 | 落地位置/说明                                                                                     |
| ------------------------------------ | ---- | ------------------------------------------------------------------------------------------------- |
| Semantic Scholar / OpenAlex API 封装 | DONE | `services/paper-intel/src/sources/*`，支持限速、可测试解析                                        |
| GROBID 论文解析流水线                | DONE | `services/paper-intel/src/grobid/*` + TEI 落盘 `services/paper-intel/src/storage/tei-store-fs.ts` |
| Neo4j 知识图谱构建（实体/关系）      | DONE | `services/paper-intel/src/graph/*`，含 Neo4j 适配器与图谱构建函数                                 |
| Graph RAG 检索（局部+全局）          | DONE | `services/paper-intel/src/retrieval/*`（全局检索） + `graph.getNeighbors`（局部扩展）             |
| 文献质量过滤                         | DONE | `services/paper-intel/src/pipeline/quality-filter.ts`（可解释 drop reason）                       |
| 文献模块 CLI 命令                    | DONE | `src/cli/research-cli.ts`（`pnpm deepscholar -- research literature ...`）                        |
| 单元测试 + 集成测试                  | DONE | `services/paper-intel/src/*.test.ts`（当前 CLI 暂无独立 literature 测试文件）                     |

## 怎么用（最小闭环）

### 1) 搜索论文（不落盘）

```bash
pnpm deepscholar -- research literature search --source semantic-scholar --query "graph rag" --limit 5
pnpm deepscholar -- research literature search --source openalex --query "graph rag" --limit 5 --json
```

可选环境变量：

- `DEEPSCHOLAR_SEMANTIC_SCHOLAR_API_KEY`（可选）
- `DEEPSCHOLAR_OPENALEX_MAILTO`（可选，polite pool）

### 2) 搜索并落盘（会做去重 + 质量过滤）

```bash
pnpm deepscholar -- research literature ingest --project-id demo --source semantic-scholar --query "graph rag" --limit 20
```

落盘位置（默认）：

- `~/.deepscholar/projects/demo/literature/papers/`

### 3) 本地检索 + 图上扩展（Graph RAG v1）

```bash
pnpm deepscholar -- research literature query --project-id demo --query "graph" --limit 5
pnpm deepscholar -- research literature query --project-id demo --query "graph" --limit 5 --json
```

### 4) PDF -> TEI（GROBID）

```bash
pnpm deepscholar -- research literature grobid --project-id demo --paper-id P1 --pdf ./paper.pdf --grobid-url http://127.0.0.1:8070
```

落盘位置（默认）：

- `~/.deepscholar/projects/demo/literature/parsed/`

### 5) 写入 Neo4j 图谱

```bash
export DEEPSCHOLAR_NEO4J_URI="neo4j://127.0.0.1:7687"
export DEEPSCHOLAR_NEO4J_USERNAME="neo4j"
export DEEPSCHOLAR_NEO4J_PASSWORD="deepscholar"

pnpm deepscholar -- research literature graph-build --project-id demo
pnpm deepscholar -- research literature query --project-id demo --query "graph" --graph-backend neo4j
```
