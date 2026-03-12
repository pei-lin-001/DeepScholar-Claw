#!/usr/bin/env node

import process from "node:process";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { registerResearchCli } from "./cli/research-cli.js";

export function buildProgram(): Command {
  const program = new Command();
  program
    .name("deepscholar")
    .description("DeepScholar-Claw: 全自动深度学习科研闭环（文献 → 实验 → 论文 → 评审 → 审计）");

  registerResearchCli(program);
  return program;
}

function isMainModule(): boolean {
  const currentFile = fileURLToPath(import.meta.url);
  const argvFile = process.argv[1];
  if (!argvFile) {
    return false;
  }
  return currentFile === argvFile;
}

async function runCli(argv: string[]): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(argv, { from: "user" });
}

export function normalizeCliArgv(argv: readonly string[]): string[] {
  const args = argv.slice(2);
  return args[0] === "--" ? args.slice(1) : args;
}

if (isMainModule()) {
  runCli(normalizeCliArgv(process.argv)).catch((err) => {
    // Debug-first: print the actual error (with stack when available).
    const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
