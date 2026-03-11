import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { type PaperCompileResult } from "@deepscholar/contracts";

function errorText(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  try {
    const json = JSON.stringify(err);
    return typeof json === "string" && json.length > 0 ? json : "unknown error";
  } catch {
    return "unknown error";
  }
}

export type CommandResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly durationMs: number;
};

export type CommandExecutor = (input: {
  readonly command: readonly string[];
  readonly cwd?: string;
  readonly timeoutMs: number;
}) => Promise<CommandResult>;

export function createNodeCommandExecutor(): CommandExecutor {
  return async (input) => {
    const start = Date.now();
    const [file, ...args] = input.command;
    if (!file) {
      throw new Error("command 不能为空");
    }

    return await new Promise<CommandResult>((resolve, reject) => {
      execFile(
        file,
        args,
        { cwd: input.cwd, timeout: input.timeoutMs, encoding: "utf8" },
        (err, stdout, stderr) => {
          const durationMs = Date.now() - start;
          if (!err) {
            resolve({
              exitCode: 0,
              stdout: stdout ?? "",
              stderr: stderr ?? "",
              timedOut: false,
              durationMs,
            });
            return;
          }
          const timedOut =
            typeof err === "object" && err !== null && "killed" in err && Boolean(err.killed);
          const exitCode =
            typeof err === "object" && err !== null && "code" in err && typeof err.code === "number"
              ? err.code
              : 1;
          resolve({
            exitCode,
            stdout: stdout ?? "",
            stderr: stderr ?? errorText(err),
            timedOut,
            durationMs,
          });
        },
      ).on("error", reject);
    });
  };
}

export type LatexCompileInput = {
  readonly draftDir: string;
  readonly mainTexPath: string;
  readonly compiledPdfPath: string;
  readonly compileLogPath: string;
  readonly timeoutMs: number;
};

export type LatexCompiler = {
  compile(input: LatexCompileInput): Promise<PaperCompileResult>;
};

export type DockerLatexCompilerOptions = {
  readonly exec: CommandExecutor;
  readonly image: string;
};

function compileLogText(result: CommandResult): string {
  const header = [
    `exitCode: ${result.exitCode}`,
    `timedOut: ${result.timedOut}`,
    `durationMs: ${result.durationMs}`,
    "",
  ].join("\n");
  return header + result.stdout + (result.stderr ? "\n" + result.stderr : "") + "\n";
}

async function persistCompileLog(logPath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.writeFile(logPath, content, "utf8");
}

export function createDockerLatexCompiler(options: DockerLatexCompilerOptions): LatexCompiler {
  const image = options.image;
  if (!image.trim()) {
    throw new Error("docker latex compiler image 不能为空");
  }

  async function compile(input: LatexCompileInput): Promise<PaperCompileResult> {
    const jobName = path.basename(input.compiledPdfPath, ".pdf");
    const mainFileName = path.basename(input.mainTexPath);
    const dockerCommand = [
      "docker",
      "run",
      "--rm",
      "-v",
      `${input.draftDir}:/work`,
      "-w",
      "/work",
      image,
      "latexmk",
      "-pdf",
      "-interaction=nonstopmode",
      "-halt-on-error",
      `-jobname=${jobName}`,
      mainFileName,
    ] as const;

    let result: CommandResult;
    try {
      result = await options.exec({ command: dockerCommand, timeoutMs: input.timeoutMs });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await persistCompileLog(input.compileLogPath, `docker 执行失败: ${message}\n`);
      throw new Error(`docker latex 编译无法启动: ${message}`, { cause: err });
    }

    await persistCompileLog(input.compileLogPath, compileLogText(result));
    const status: PaperCompileResult["status"] = result.timedOut
      ? "timeout"
      : result.exitCode === 0
        ? "success"
        : "failed";
    return {
      status,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      compiler: "docker",
      outputPdfPath: input.compiledPdfPath,
      compileLogPath: input.compileLogPath,
    };
  }

  return { compile };
}
