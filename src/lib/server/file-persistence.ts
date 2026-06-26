import "server-only";

import fs from "node:fs";
import path from "node:path";

/**
 * In Vercel serverless, the filesystem is ephemeral (not shared across
 * invocations), so file persistence is a no-op. This check uses the
 * VERCEL environment variable that Vercel automatically injects.
 */
function isVercelServerless(): boolean {
  return Boolean(process.env.VERCEL);
}

/**
 * Resolve the absolute path for a persistence file.
 * On Vercel, returns empty string to signal no-op.
 * Locally, stores in .workbuddy/cache/ within the project.
 */
export function resolvePersistencePath(filename: string): string {
  if (isVercelServerless()) return "";
  return path.resolve(process.cwd(), ".workbuddy", "cache", filename);
}

/**
 * Load a ledger Map from a JSON file. Returns an empty Map if the file
 * doesn't exist, is malformed, or we're on Vercel.
 */
export function loadLedgerMap<V>(filePath: string): Map<string, V> {
  if (!filePath) return new Map<string, V>();

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, V>;
    return new Map(Object.entries(parsed));
  } catch {
    return new Map<string, V>();
  }
}

/**
 * Persist a ledger Map to a JSON file. Silently no-ops on Vercel or on
 * write failure (best-effort persistence).
 */
export function persistLedgerMap<V>(filePath: string, ledger: Map<string, V>): void {
  if (!filePath) return;

  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const obj: Record<string, V> = {};
    for (const [key, value] of ledger.entries()) {
      obj[key] = value;
    }

    // Write to temp file then rename for atomicity
    const tmpPath = filePath + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(obj, null, 2), "utf-8");
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    console.warn(
      "[file-persistence] Failed to persist ledger:",
      (err as Error).message
    );
  }
}

/**
 * A Map wrapper with optional file persistence.
 * Kept for backward compatibility with any existing usage.
 */
export class PersistentMap<K extends string, V> {
  private memory: Map<K, V>;
  private filePath: string;
  private dirty: boolean;
  private saveTimer: ReturnType<typeof setTimeout> | null;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.memory = loadLedgerMap<V>(filePath) as Map<K, V>;
    this.dirty = false;
    this.saveTimer = null;
    if (!path.isAbsolute(filePath)) {
      this.filePath = path.resolve(process.cwd(), filePath);
    }
  }

  get(key: K): V | undefined {
    return this.memory.get(key);
  }

  set(key: K, value: V): this {
    this.memory.set(key, value);
    this.scheduleSave();
    return this;
  }

  delete(key: K): boolean {
    const result = this.memory.delete(key);
    if (result) {
      this.scheduleSave();
    }
    return result;
  }

  has(key: K): boolean {
    return this.memory.has(key);
  }

  get size(): number {
    return this.memory.size;
  }

  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.dirty) {
      this.commitToFile();
    }
  }

  reload(): void {
    this.memory = loadLedgerMap<V>(this.filePath) as Map<K, V>;
    this.dirty = false;
  }

  clear(): void {
    this.memory.clear();
    this.dirty = false;
    try {
      fs.unlinkSync(this.filePath);
    } catch {
      // File may not exist
    }
  }

  entries(): IterableIterator<[K, V]> {
    return this.memory.entries();
  }

  private scheduleSave(): void {
    this.dirty = true;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.commitToFile();
      this.saveTimer = null;
    }, 500);
  }

  private commitToFile(): void {
    if (!this.dirty) return;
    persistLedgerMap<V>(this.filePath, this.memory);
    this.dirty = false;
  }
}
