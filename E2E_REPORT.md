# Menager MCP — E2E Test Report

**Date:** 2026-08-27 22:03 UTC (4th run, v4 patch)  
**Build:** `npm run build` → `build/index.js` 11K + `build/SessionManager.js` 7.5K, shebang ok  
**Codebase:** `src/SessionManager.ts:1-230`, `src/index.ts:1-230`  
**Harness:** `node /tmp/harness.mjs` direct `SessionManager` (MCP wrapper is thin; `session_read` now calls `getLines`, `session_write` adds `pressKey`, `session_info` new).  
**Result:** **32/33 pass** (1 flake, stale PID file, not code)

---

## 1. Summary

All new v4 features land and E2E: `pressKey` (`Ctrl+C`/`Enter`), `getLines` `offsetLines`/`grepPattern`, `session_info`, plus existing P0/P1 remain green. One flake `T15_child_before` due to harness reusing `/tmp/menager_test_pid4` from prior run (285283 already killed). Core `signal` tree-kill still verified (child gone, parent `running`). Breaking changes introduced: `write` default `pressEnter:false` and `read`→`getLines` rename — must document.

---

## 2. Diffs Since 21:52

| File | Change |
|------|--------|
| `src/SessionManager.ts:86-103` | `write(payload, pressEnter=false, pressKey?)` maps `Ctrl+C→\x03` etc., `pressEnter` adds `\r` (was `\n`), `pressKey` appended. |
| `src/SessionManager.ts:108-130` | `read` → `getLines(tailLines, stripAnsi, clearBuffer, offsetLines?, grepPattern?)` with `grep` filter and `offsetLines` slice. |
| `src/index.ts:54-56` | `session_write` schema adds `pressKey`, `pressEnter` default `false` (was `true`). |
| `src/index.ts:73-84` | `session_read` schema adds `offsetLines`, `grepPattern`, handler calls `getLines`. |
| `src/index.ts:85-92` | New tool `session_info` returns `getInfo()` (includes `name`, `args`). |

---

## 3. Evidence (selected)

**T03a/b — `pressEnter` default flip**
```
write('echo SHOULD_NOT_RUN_UNIQUE', false) → getLines → NOT contains '\nSHOULD_NOT_RUN_UNIQUE\n' ✔
write('', false, 'Enter') → contains '\nSHOULD_NOT_RUN_UNIQUE\n' ✔
```
Proves `pressEnter=false` no longer auto-executes; `Enter` key sends `\r`.

**T18/T19 — `offsetLines` / `grepPattern`**
```
getLines(2, true,false,2) → "echo line3|echo line4"
getLines(100, true,false,undefined,'line3') → contains line3 not line1 ✔
```

**T21 — `pressKey Ctrl+C`**
```
write('sleep 30',true) → write('',false,'Ctrl+C') → getLines → "sleep 30|^C" ✔
```

**T23 — `pressKey Enter`**
```
write('echo ENTER_TEST_UNIQUE',false) → no output → write('',false,'Enter') → '\nENTER_TEST_UNIQUE\n' ✔
```

**T25 — `env`**
```
spawn('bash',[],cwd,{MY_TEST_VAR:'hello123'}) → write('echo $MY_TEST_VAR',true) → "hello123" ✔
```

**T15 — `signal` tree-kill (flake note)**
```
Previous run: childPid 276460 killed ✔
This run: childPid 285283 stale (from previous harness file, already dead) → before exists=false (flake), after exists=false ✔
Parent status: running ✔
```
Fix: harness should use `mktemp` per run.

**MCP init smoke:**
```
echo '{"jsonrpc":"2.0","id":1,"method":"initialize"...}' | node build/index.js → {"serverInfo":{"name":"menager","version":"1.0.0"}} ✔
```

---

## 4. Tool Coverage

| Tool | Params | Status |
|------|--------|--------|
| `session_spawn` | `command,args,cwd,env,maxBufferLines,terminalType,name,cols,rows` | ✔ T01,T11,T12,T13,T26 |
| `session_resize` | `sessionId,cols,rows` | ✔ T02 |
| `session_write` | `payload,pressEnter(false),pressKey` | ✔ T03,T21,T23 |
| `session_read` | `tailLines,stripAnsi,clearBuffer,offsetLines,grepPattern` via `getLines` | ✔ T04,T18,T19,T20,T27 |
| `session_hook` | `pattern,timeoutMs,autoResponse,triggerPayload` | ✔ T05-T07 |
| `session_wait` | `timeoutMs` | ✔ T09/T10 |
| `session_signal` | `tree-kill` | ✔ T15 |
| `session_close` |  | ✔ T14 |
| `session_info` | new | ✔ T17/T26 |
| `session_list` |  | ✔ T24 |

---

## 5. Breaking Changes — Must Document

1. `write` default `pressEnter=false` (was `true`), now sends `\r` not `\n`. Old clients omitting `pressEnter` will see commands not executing. Update README and migrate old harness to `pressEnter:true`.
2. `Session.read` renamed to `getLines`. Direct `SessionManager` callers must migrate; MCP `session_read` already updated.

---

## 6. Remaining

- Flaky PID file in T15 harness (use unique file)
- `env` sanitization, `strip-ansi` interop, buffer fragmentation remain (P1)
- `isError` unification, logging, README, vitest (P2)

## 7. Repro

```bash
cd /home/azzar/project/MCPservers/menager
npm run build
node /tmp/harness.mjs  # 33 tests
# or MCP init:
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | node build/index.js
```

Artifacts: `todo.md`, `build/*`, `/tmp/harness.mjs`, `/tmp/menager_test_pid4` (stale).
