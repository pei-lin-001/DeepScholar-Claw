import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPaperDraft } from "@deepscholar/contracts";
import { describe, expect, it } from "vitest";
import { compilePaperDraft } from "./latex-compile.ts";
import {
  createDockerLatexCompiler,
  createNodeCommandExecutor,
  type CommandExecutor,
  type LatexCompiler,
} from "./latex-compiler.ts";
import { writePaperBundle } from "./paper-bundle-fs.ts";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "deepscholar-writing-compile-"));
}

function fakeCompiler(mode: "success" | "failed"): LatexCompiler {
  return {
    compile: async (input) => {
      await fs.mkdir(input.draftDir, { recursive: true });
      await fs.writeFile(input.compileLogPath, `mode=${mode}\n`, "utf8");
      if (mode === "success") {
        await fs.writeFile(input.compiledPdfPath, "%PDF-1.4\n", "utf8");
      }
      return {
        status: mode,
        exitCode: mode === "success" ? 0 : 2,
        durationMs: 12,
        compiler: "unknown",
        outputPdfPath: input.compiledPdfPath,
        compileLogPath: input.compileLogPath,
      };
    },
  };
}

describe("latex compile pipeline", () => {
  it("updates draft status to compiled when compiler succeeds", async () => {
    const homeDir = await createTempDir();
    const draft = createPaperDraft({
      draftId: "d1",
      projectId: "p1",
      planId: "plan-1",
      title: "Compile Demo",
      venue: "arxiv",
      status: "draft",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:01.000Z",
    });
    await writePaperBundle({ homeDir, draft, bibYear: "2026" });

    const result = await compilePaperDraft({
      homeDir,
      projectId: "p1",
      draftId: "d1",
      timeoutMs: 1_000,
      compiler: fakeCompiler("success"),
    });
    expect(result.compile.status).toBe("success");
    expect(result.draft.status).toBe("compiled");
    const saved = JSON.parse(await fs.readFile(result.paths.draftJsonPath, "utf8")) as {
      status: string;
    };
    expect(saved.status).toBe("compiled");
  });

  it("updates draft status to compile_failed when compiler fails", async () => {
    const homeDir = await createTempDir();
    const draft = createPaperDraft({
      draftId: "d2",
      projectId: "p1",
      planId: "plan-1",
      title: "Compile Demo",
      venue: "arxiv",
      status: "draft",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:01.000Z",
    });
    await writePaperBundle({ homeDir, draft, bibYear: "2026" });

    const result = await compilePaperDraft({
      homeDir,
      projectId: "p1",
      draftId: "d2",
      timeoutMs: 1_000,
      compiler: fakeCompiler("failed"),
    });
    expect(result.compile.status).toBe("failed");
    expect(result.draft.status).toBe("compile_failed");
  });

  it("docker compiler returns explicit failure result and writes compile log", async () => {
    const tmp = await createTempDir();
    const draftDir = path.join(tmp, "draft");
    await fs.mkdir(draftDir, { recursive: true });
    await fs.writeFile(
      path.join(draftDir, "main.tex"),
      "\\documentclass{article}\\begin{document}x\\end{document}",
      "utf8",
    );

    let observed: readonly string[] | null = null;
    const exec: CommandExecutor = async (input) => {
      observed = input.command;
      return {
        exitCode: 127,
        stdout: "",
        stderr: "latexmk: not found",
        timedOut: false,
        durationMs: 5,
      };
    };
    const compiler = createDockerLatexCompiler({ exec, image: "texlive/texlive" });
    const result = await compiler.compile({
      draftDir,
      mainTexPath: path.join(draftDir, "main.tex"),
      compiledPdfPath: path.join(draftDir, "compiled.pdf"),
      compileLogPath: path.join(draftDir, "compile.log"),
      timeoutMs: 1_000,
    });
    expect(observed?.[0]).toBe("docker");
    expect(result.status).toBe("failed");
    const log = await fs.readFile(path.join(draftDir, "compile.log"), "utf8");
    expect(log).toContain("latexmk: not found");
  });

  it("docker compiler surfaces startup errors with a readable message", async () => {
    const tmp = await createTempDir();
    const draftDir = path.join(tmp, "draft");
    await fs.mkdir(draftDir, { recursive: true });

    const exec: CommandExecutor = async () => {
      throw new Error("docker: command not found");
    };
    const compiler = createDockerLatexCompiler({ exec, image: "texlive/texlive" });

    await expect(
      compiler.compile({
        draftDir,
        mainTexPath: path.join(draftDir, "main.tex"),
        compiledPdfPath: path.join(draftDir, "compiled.pdf"),
        compileLogPath: path.join(draftDir, "compile.log"),
        timeoutMs: 1_000,
      }),
    ).rejects.toThrow(/docker latex 编译无法启动/);
  });

  it("docker compiler mounts paperDir when draftDir is under paper/drafts", async () => {
    const tmp = await createTempDir();
    const paperDir = path.join(tmp, "paper");
    const draftDir = path.join(paperDir, "drafts", "d1");
    await fs.mkdir(draftDir, { recursive: true });
    await fs.writeFile(
      path.join(draftDir, "main.tex"),
      "\\documentclass{article}\\begin{document}x\\end{document}",
      "utf8",
    );

    // Note: TypeScript doesn't model closure assignments here; keep it non-null for stable typing.
    let observed: readonly string[] = [];
    const exec: CommandExecutor = async (input) => {
      observed = input.command;
      return { exitCode: 2, stdout: "", stderr: "failed", timedOut: false, durationMs: 1 };
    };
    const compiler = createDockerLatexCompiler({ exec, image: "texlive/texlive" });
    await compiler.compile({
      draftDir,
      mainTexPath: path.join(draftDir, "main.tex"),
      compiledPdfPath: path.join(draftDir, "compiled.pdf"),
      compileLogPath: path.join(draftDir, "compile.log"),
      timeoutMs: 1_000,
    });

    const observedText = observed.join(" ");
    expect(observedText).toContain(`${paperDir}:/paper`);
    expect(observedText).toContain("-w /paper/drafts/d1");
  });

  it("node executor keeps a readable error when stderr is empty", async () => {
    const exec = createNodeCommandExecutor();
    const result = await exec({ command: ["node", "-e", "process.exit(2)"], timeoutMs: 5_000 });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.trim().length).toBeGreaterThan(0);
  });

  it("node executor maxBuffer prevents large output from failing", async () => {
    const exec = createNodeCommandExecutor();
    const LARGE_OUTPUT_BYTES = 2 * 1024 * 1024;
    const script = `process.stdout.write('x'.repeat(${LARGE_OUTPUT_BYTES}))`;
    const result = await exec({ command: ["node", "-e", script], timeoutMs: 5_000 });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.length).toBeGreaterThanOrEqual(LARGE_OUTPUT_BYTES);
  });
});
