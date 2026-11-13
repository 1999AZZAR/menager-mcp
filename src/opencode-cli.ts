import os from "node:os";
import path from "node:path";

export interface StatsArgsInput {
  days?: unknown;
  topTools?: unknown;
  topModels?: unknown;
  project?: string;
}

function integerInRange(value: unknown, name: string, minimum: number, maximum: number): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be ${minimum}-${maximum}`);
  }
  return parsed;
}

/**
 * The OpenCode CLI exposes section toggles as booleans and uses --limit for
 * row counts. Passing `--tools 5` or `--models 3` makes the CLI print help
 * instead of statistics.
 */
export function buildStatsArgs(input: StatsArgsInput): string[] {
  const args = ["stats"];
  const days = integerInRange(input.days, "days", 0, 3650);
  if (days !== undefined) args.push("--days", String(days));

  let limit: number | undefined;
  const topTools = integerInRange(input.topTools, "topTools", 1, 100);
  if (topTools !== undefined) {
    args.push("--tools");
    limit = Math.max(limit ?? 0, topTools);
  }
  const topModels = integerInRange(input.topModels, "topModels", 1, 100);
  if (topModels !== undefined) {
    args.push("--models");
    limit = Math.max(limit ?? 0, topModels);
  }
  if (limit !== undefined) args.push("--limit", String(limit));
  if (input.project !== undefined) args.push("--project", input.project);
  return args;
}

function compactEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/**
 * The runtime gives each cell an isolated HOME/XDG tree. OpenCode's managed
 * service, however, binds one global port (49374), so a child CLI launched
 * with the cell HOME tries to start a second service and fails with
 * "Managed service port 49374 ... already in use".
 *
 * Point OpenCode commands at the real login home instead. The cell keeps its
 * isolated runtime data; only OpenCode subprocesses see the host config,
 * service password, sessions, and statistics.
 */
export function opencodeHostEnv(
  env: NodeJS.ProcessEnv = process.env,
  passwdHome: string = os.userInfo().homedir,
): Record<string, string> {
  const configuredHome = env.OPENCODE_HOST_HOME?.trim();
  const hostHome = configuredHome || passwdHome;
  const currentHome = env.HOME?.trim();
  const isolated = Boolean(currentHome && path.resolve(currentHome) !== path.resolve(hostHome));
  const merged: NodeJS.ProcessEnv = { ...env, HOME: hostHome };
  if (isolated) {
    merged.XDG_CONFIG_HOME = env.OPENCODE_HOST_CONFIG_HOME || path.join(hostHome, ".config");
    merged.XDG_DATA_HOME = env.OPENCODE_HOST_DATA_HOME || path.join(hostHome, ".local", "share");
    merged.XDG_CACHE_HOME = env.OPENCODE_HOST_CACHE_HOME || path.join(hostHome, ".cache");
    merged.XDG_STATE_HOME = env.OPENCODE_HOST_STATE_HOME || path.join(hostHome, ".local", "state");
  }
  return compactEnv(merged);
}
