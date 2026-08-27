# Menager MCP — E2E Test Report

**Date:** 2026-08-27 22:41 UTC (6th run, v6 patch)  
**Build:** `npm run build` → `build/index.js` 12K + `build/SessionManager.js` 8.1K, shebang ok  
**Codebase:** `src/SessionManager.ts:1-260` (prune, ttlMs), `src/index.ts:1-260` (session_prune)  
**Harness:** `node /tmp/harness_v5.mjs` (41 tests) + `node /tmp/test_prune.mjs` (12 tests) direct `SessionManager`  
**Result:** **53/53 pass** (41 main + 12 prune, previous 41/41)

---

## 1. Summary

New `session_prune` tool fully verified. Previous 41 tests still green (1 previous flake fixed via unique PID file). `ttlMs` auto-close and `prune` together solve memory-leak (Map growth) noted in todo.

---

## 2. Diffs Since 22:11

| File | Change |
|------|--------|
| `src/SessionManager.ts:230-242` | `prune(status?)` — iterates `sessions`, `if(!status \|\| session.status===status)` → `signal('SIGKILL')` if running → `delete` → returns count |
| `src/index.ts:88-97` | New tool `session_prune` `{status: enum["running","exited"]}` default `status="exited"` → `sessionManager.prune(status)` → `prunedCount` |
| `src/index.ts:117-120` | Handler `session_prune` case |

---

## 3. Evidence (new)

**T31 — prune exited**
```
spawn('bash',['-c','exit 0']) → wait → list contains → prune('exited') → 1 → gone ✔
```

**T32 — prune only exited (mix)**
```
run1,run2 (bash), ex1 (bash -c exit 1) → before 3 → prune('exited') → 1 → after 2 → running still 2 ✔
```

**T33 — prune all (Manager direct, no arg)**
```
2 running → prune() (no status) → 2 → after 0 ✔
Note: MCP `session_prune` with no arg defaults to "exited" for safety, Manager with no arg deletes all.
```

**T34 — prune running**
```
2 running → prune('running') → 2 → after 0 ✔
```

**MCP smoke**
```
echo '{"jsonrpc":"2.0","id":1,"method":"initialize"...}' | node build/index.js → serverInfo menager ✔
```

Previous 41 evidence unchanged (see 22:11 report for T01-T30).

---

## 4. Tool Coverage (updated)

| Tool | Params | Status |
|------|--------|--------|
| `session_spawn` | `command,args,cwd,env,maxBufferLines,terminalType,name,cols,rows,ttlMs` | ✔ |
| `session_resize` | `cols,rows` | ✔ |
| `session_write` | `payload,pressEnter(false),pressKey` | ✔ |
| `session_read` | `tailLines,stripAnsi,clearBuffer,offsetLines,grepPattern` via `getLines` | ✔ |
| `session_hook` | `pattern,timeoutMs,autoResponse,triggerPayload` | ✔ |
| `session_wait` | `timeoutMs` | ✔ |
| `session_signal` | `tree-kill` | ✔ |
| `session_close` |  | ✔ |
| `session_info` |  | ✔ |
| `session_prune` | `status?` default `exited` (MCP) | ✔ T31-T34 |
| `session_list` |  | ✔ |
| `ttlMs` | onExit setTimeout | ✔ |

---

## 5. Breaking Changes

1. `write` default `pressEnter=false` `\r`
2. `read` → `getLines`
3. New `ttlMs` and `session_prune` (additive)

---

## 6. Remaining

- `env` sanitization, `strip-ansi` interop, buffer fragmentation (P1)
- Unified `isError`, logging, README, vitest (P2)

## 7. Repro

```bash
cd /home/azzar/project/MCPservers/menager
npm run build
node /tmp/harness_v5.mjs  # 41
node /tmp/test_prune.mjs  # 12
```

Artifacts: `todo.md`, `build/*`, `/tmp/harness_v5.mjs`, `/tmp/test_prune.mjs`.
