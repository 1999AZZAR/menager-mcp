# Menager MCP — E2E Test Report

**Date:** 2026-08-27 22:11 UTC (5th run, v5 patch)  
**Build:** `npm run build` → `build/index.js` 11K + `build/SessionManager.js` 7.7K, shebang ok  
**Codebase:** `src/SessionManager.ts:1-250` (ttlMs, pressKey, getLines), `src/index.ts:1-230` (ttlMs, session_info, session_resize, pressKey, offset/grep)  
**Harness:** `node /tmp/harness_v5.mjs` direct `SessionManager` (MCP wrapper is thin; `session_spetest` `write` default `false`, `read`→`getLines`, `ttlMs`).  
**Result:** **41/41 pass** (previous 32/33, now + ttlMs, unique PID file fixes flake)

---

## 1. Summary

All v4 + new v5 `ttlMs` auto-close verified. Previous flake `T15_child_before` fixed via unique PID file (`/tmp/menager_test_pid_${Date.now()}`) → child 313967 correctly detected before/after `SIGTERM`. New `ttlMs` prevents memory leak for exited sessions: T28 immediate exit + 1000 ms TTL → stillThere true → gone true; T29 long-running + 800 ms TTL → no premature delete while running, then gone after exit+TTL.

---

## 2. Diffs Since 22:03

| File | Change |
|------|--------|
| `src/SessionManager.ts:13` | `SessionInfo.ttlMs?: number` |
| `src/SessionManager.ts:50,216` | `constructor(..., ttlMs?, onCleanup?)` stores, `onExit` → `if(ttlMs && onCleanup) setTimeout(onCleanup, ttlMs)` |
| `src/SessionManager.ts:226` | `spawn(..., ttlMs?)` passes `() => sessions.delete(id)` as cleanup |
| `src/index.ts:28` | `session_spawn` schema adds `ttlMs` |
| `src/index.ts:129` | `spawn` destructures `ttlMs` and forwards |

Already in v4 (still verified): `pressKey`, `getLines` offset/grep, `session_info`, `session_resize`, `tree-kill`, `cwd` validation, `name`.

---

## 3. Evidence (new + critical)

**T28 — ttlMs auto-close (immediate exit)**
```
spawn('bash',['-c','echo TTL_TEST; exit 0'], ttlMs=1000, name='ttl-test') → sid 6dd9f37e
wait → exit 0 ✔
list immediately after exit → stillThere true ✔
sleep 1300 → list gone true ✔
```
Logic `SessionManager.ts:54-56` schedules delete only after exit.

**T29 — ttlMs no premature delete**
```
spawn('bash', ttlMs=800, 'ttl-long') → write('sleep 1; exit 0', true)
sleep 1000 (ttl 800 passed but process still running until 1.3s) → stillRunning true ✔
wait → exit 0 ✔
sleep 1000 → gone true ✔
```
Proves ttl timer only starts onExit, not on spawn.

**T15 — signal tree-kill (fixed harness)**
```
write('sleep 60 & echo $! > /tmp/menager_test_pid_${Date.now()}; echo STARTED', true)
childPid 313967 exists true → signal SIGTERM → exists false ✔, parent running ✔
```

**T03a/b — pressEnter default false**
```
write('echo SHOULD_NOT_RUN_UNIQUE', false) → NOT contains '\nSHOULD_NOT_RUN_UNIQUE\n' ✔
write('', false, 'Enter') → contains ✔
```

**MCP smoke**
```
echo '{"jsonrpc":"2.0","id":1,"method":"initialize"...}' | node build/index.js → {"serverInfo":{"name":"menager"}} ✔
```

Full 41/41 log in `/tmp/harness_v5.mjs` output (see terminal).

---

## 4. Tool Coverage

| Tool | Params | Status |
|------|--------|--------|
| `session_spawn` | `command,args,cwd,env,maxBufferLines,terminalType,name,cols,rows,ttlMs` | ✔ T01,T11,T12,T13,T26,T28,T29 |
| `session_resize` | `cols,rows` | ✔ T02 |
| `session_write` | `payload,pressEnter(false),pressKey` | ✔ T03,T21,T23 |
| `session_read` | `tailLines,stripAnsi,clearBuffer,offsetLines,grepPattern` via `getLines` | ✔ T04,T18,T19,T20,T27 |
| `session_hook` | `pattern,timeoutMs,autoResponse,triggerPayload` | ✔ T05-T07 |
| `session_wait` | `timeoutMs` | ✔ T09/T10 |
| `session_signal` | `tree-kill` | ✔ T15 |
| `session_close` |  | ✔ T14 |
| `session_info` | `name,args` | ✔ T17/T26 |
| `session_list` |  | ✔ T24/T30 |
| `ttlMs` auto-close | onExit setTimeout | ✔ T28/T29 |

---

## 5. Breaking Changes

1. `write` default `pressEnter=false` sends `\r` (was `true`/`\n`). Must pass `pressEnter:true`.
2. `read` → `getLines` (MCP handler updated).
3. New `ttlMs` (opt-in, no break).

---

## 6. Remaining

- `env` sanitization, `strip-ansi` interop, buffer fragmentation remain (P1)
- Unified `isError`, logging, README, vitest (P2) — harness ready to convert

## 7. Repro

```bash
cd /home/azzar/project/MCPservers/menager
npm run build
node /tmp/harness_v5.mjs  # 41 tests
```

Artifacts: `todo.md`, `build/*`, `/tmp/harness_v5.mjs`, `/tmp/menager_test_pid_*`.
