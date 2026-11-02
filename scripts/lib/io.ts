import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function readJsonIfExists<T>(path: string, fallback: T): T {
  return existsSync(path) ? readJson<T>(path) : fallback;
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function listJsonIds(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => f.slice(0, -'.json'.length));
}

export function readJsonDir<T>(dir: string): T[] {
  return listJsonIds(dir).flatMap((name) => readJson<T[]>(join(dir, `${name}.json`)));
}
