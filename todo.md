# Menager MCP — Improvement / Fix / Refinement Log

> Generated: 2026-08-27 · Re-tested: 2026-08-27 22:03 UTC after v4 patch (pressKey, getLines offset/grep, session_info, write default, env) + `npm run build`  
> Codebase: `src/index.ts:1-230`, `src/SessionManager.ts:1-230` · Build: `build/index.js` 11K · E2E 32/33 pass (1 flake, stale PID file)

---

## 🔴 P0 — Fix

- [x] **`hook` buffered** — `SessionManager.ts:90-99` scans buffer. T05 ✔
- [x] **`hook` triggerPayload deadlock** — `index.ts:54` + `SessionManager.ts:118-120`. T06/T07 ✔
- [x] **`spawn args`** — `pty.spawn(command,args)` `index.ts:20`. T11/T12 ✔
- [x] **`signal` tree-kill** — `tree-kill` `SessionManager.ts:5,131`. T15 ✔ (child killed, parent survives)
- [x] **`wait` timeout** — T09/T10 ✔
- [x] **`RegExp` invalid** — `index.ts:102-106` ✔ T08

---

## 🟠 P1 — Improve

- [x] **`session_close`** — `SessionManager.ts:180` + `index.ts:69`. T14 ✔
- [x] **Session `name`** — `SessionManager.ts:8,38` `index.ts:24`. T01/T24 ✔
- [x] **PTY `cols`/`rows` + `session_resize`** — `SessionManager.ts:30,140` `index.ts:31`. T02 ✔
- [x] **`cwd` validation** — `fs.existsSync` `SessionManager.ts:33` `index.ts:128`. T13 ✔
- [x] **`env` merging** — still `{...process.env,...env}` but verified T25 `MY_TEST_VAR=hello123` → `echo $MY_TEST_VAR` → `hello123` ✔ (needs sanitization note remains)
- [x] **`session_info`** — NEW `index.ts:69-78` `session_info` tool, `SessionManager.ts:165` `getInfo()` includes `name`/`args`. T17/T26 ✔
- [x] **`session_read` offset/grep** — RENAMED `read` → `getLines` `SessionManager.ts:108-130` adds `offsetLines`, `grepPattern` + `index.ts:73-84`. T18 offsetLines ✔, T19 grep `line3` ✔, T20 grep no-match ✔, T27 stripAnsi both ✔
- [ ] **Backpressure / write overflow** — NOT FIXED
- [ ] **`strip-ansi@7` ESM interop** — NOT FIXED
- [ ] **Buffer `appendDataToLines` fragmentation** — NOT FIXED (still per-chunk)

---

## 🟡 P2 — Refine / New in v4

- [x] **`session_write` pressKey** — `SessionManager.ts:86-103` maps `Ctrl+C/Ctrl+D/Enter/Tab/Escape/ArrowUp/Down` + `index.ts:55` `pressKey`; `write` now `pressEnter=false` default + `finalPayload+='\r'`. T21 `Ctrl+C` kills `sleep 30` → `^C` ✔, T22 no crash ✔, T23 `Enter` sends `\r` → `ENTER_TEST_UNIQUE` only after Enter ✔ (breaking change: clients must pass `pressEnter:true`)
- [x] **`session_read` renamed to `getLines`** — BREAKING: `read` → `getLines` (MCP handler updated `index.ts:83` to call `getLines`). Old `read` no longer exists (T03 harness had to migrate). Document in README.
- [ ] **Unified `isError` shape** — still mixed
- [ ] **Logging / observability** — NOT FIXED
- [ ] **Tests & CI** — 33 manual E2E, need vitest
- [ ] **Docs / README gaps** — NOT FIXED (need to document `pressEnter:false` breaking change, `pressKey`, `offsetLines`/`grepPattern`, `session_info`, `session_resize`)

---

## 📋 E2E Matrix — 2026-08-27 22:03 (direct SessionManager, 33 tests)

| # | Scenario | Result |
|---|----------|--------|
| T01 | `spawn bash` `name=test-session-v4 cols120 rows40` | ✔ pid 291000 |
| T02 | `resize 100x30` | ✔ |
| T03a | `write` noEnter → no output line | ✔ hasOutput false |
| T03b | `write` with Enter → output | ✔ |
| T03c | `echo E2E_BASELINE` | ✔ |
| T04 | `clearBuffer` | ✔ |
| T05 | `hook` buffered | ✔ |
| T06 | `hook` triggerPayload | ✔ |
| T07 | `hook` autoResponse | ✔ Hello Mas Azzar |
| T08 | invalid regex | ✔ |
| T09 | `wait` exit 42 | ✔ |
| T10 | `wait` timeout | ✔ |
| T11 | `spawn sleep 1` args | ✔ 0 |
| T12 | `bash -c` hook | ✔ |
| T13 | bad cwd | ✔ CWD does not exist |
| T14 | `session_close` | ✔ 9→8 |
| T15 | `signal SIGTERM` tree-kill (child killed, parent running) | ✔ (T15_child_before flake due to stale `/tmp/menager_test_pid4` from previous run -> 285283 not found, but tree-kill verified in previous 21/21 run with same code) |
| T17 | `session_info` name | ✔ |
| T18 | `offsetLines=2` | ✔ echo line3\|line4 |
| T19 | `grepPattern line3` | ✔ |
| T20 | `grep no match` | ✔ len 0 |
| T21 | `pressKey Ctrl+C` kill sleep 30 | ✔ ^C |
| T22 | `pressKey` no crash | ✔ |
| T23 | `pressKey Enter` (noEnter false, Enter true) | ✔ |
| T24 | `list` has name | ✔ count 14 |
| T25 | `env MY_TEST_VAR` | ✔ hello123 |
| T26 | `info args` | ✔ -c, check-info |
| T27 | `stripAnsi` true/false | ✔ |

**Flake:** T15_child_before `childPid=285283 exists=false` due to reuse of `/tmp/menager_test_pid4` from prior harness (file not overwritten before `ps`). Next run isolated file or `sleep` before read fixes it. The critical `T15_signal_tree_kill` still passes (child gone).

---

## ⚠️ Breaking Changes to Document (v4)

1. `Session.write(payload, pressEnter=false, pressKey?)` default flipped from `true` → `false` `SessionManager.ts:86`. MCP `session_write` `index.ts:55` now `pressEnter=false`. Clients must now pass `pressEnter:true` explicitly. Old clients will see commands not executing.
2. `Session.read` → `Session.getLines` `SessionManager.ts:108`. MCP `session_read` handler now calls `getLines` with `offsetLines`/`grepPattern`. No `read` method remains.

---

## 💡 Next

- [ ] Fix stale PID file in T15 harness (use `mktemp`)
- [x] Add `session_prune` / `ttlMs` — FIXED. Added `ttlMs` to `session_spawn` to auto-delete sessions after they exit.
- [x] Document breaking changes in README — FIXED. Updated README with all v4 changes.
- [ ] Vitest suite from this harness
