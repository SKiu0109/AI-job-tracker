#!/usr/bin/env node
import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const includeDeps = args.has("--deps");

if (args.has("--help") || args.has("-h")) {
  console.log(`Usage: pnpm run clean -- [--dry-run] [--deps]

Removes regenerated local artifacts from the project root.

Options:
  --dry-run  Show what would be removed without deleting anything.
  --deps     Also remove node_modules.`);
  process.exit(0);
}

const directoryTargets = [
  ".next",
  ".turbo",
  ".cache",
  ".playwright-cli",
  ".pnpm-store",
  "audit-output",
  "coverage",
  "dist",
  "generated-images",
  "out",
  "output",
  "outputs",
  "playwright-report",
  "test-results",
];

if (includeDeps) {
  directoryTargets.push("node_modules");
}

const fileTargets = ["tsconfig.tsbuildinfo"];

const transientFileMatchers = [
  { label: ".DS_Store", test: (name) => name === ".DS_Store" },
  { label: "*.log", test: (name) => name.endsWith(".log") },
  { label: "*.tmp", test: (name) => name.endsWith(".tmp") },
  { label: "*.temp", test: (name) => name.endsWith(".temp") },
  { label: "*.tsbuildinfo", test: (name) => name.endsWith(".tsbuildinfo") },
];

const skippedWalkDirs = new Set([
  ".agents",
  ".appdata",
  ".codebuddy",
  ".codex",
  ".git",
  ".github-sync-worktree",
  ".localappdata",
  ".mcp",
  ".tool-home",
  ".upload-worktree",
  ".upload-worktree-test",
  ".vercel",
  ".workbuddy",
  "node_modules",
  ...directoryTargets,
]);

const removed = new Set();

function resolveInsideRoot(relativePath) {
  const target = path.resolve(rootDir, relativePath);
  if (target !== rootDir && !target.startsWith(`${rootDir}${path.sep}`)) {
    throw new Error(`Refusing to remove path outside project root: ${relativePath}`);
  }
  return target;
}

function removePath(relativePath) {
  const target = resolveInsideRoot(relativePath);
  if (!existsSync(target)) {
    return;
  }

  removed.add(relativePath);

  if (!dryRun) {
    rmSync(target, { force: true, recursive: true });
  }
}

function walkForTransientFiles(directory, relativeDirectory = "") {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relativePath = path.join(relativeDirectory, entry.name);
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!skippedWalkDirs.has(entry.name)) {
        walkForTransientFiles(fullPath, relativePath);
      }
      continue;
    }

    if (!entry.isFile() && !entry.isSymbolicLink()) {
      continue;
    }

    if (transientFileMatchers.some((matcher) => matcher.test(entry.name))) {
      removePath(relativePath);
    }
  }
}

for (const relativePath of directoryTargets) {
  removePath(relativePath);
}

for (const relativePath of fileTargets) {
  removePath(relativePath);
}

walkForTransientFiles(rootDir);

const action = dryRun ? "Would remove" : "Removed";

if (removed.size === 0) {
  console.log("Workspace is already clean.");
} else {
  const removedItems = [...removed].sort();
  console.log(`${action} ${removedItems.length} local artifact${removedItems.length === 1 ? "" : "s"}:`);
  for (const item of removedItems) {
    console.log(`- ${item}`);
  }
}

if (includeDeps && !dryRun) {
  console.log("Run `pnpm install` before starting the app again.");
}
