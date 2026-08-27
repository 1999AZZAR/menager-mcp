# Menager MCP — Improvement / Fix / Refinement Log

> Generated: 2026-08-27 · Re-tested: 2026-08-27 22:11 UTC after v5 patch (ttlMs auto-close, pressKey, getLines, session_info) + `npm run build`  
> Codebase: `src/index.ts:1-230`, `src/SessionManager.ts:1-250` · Build: `build/index.js` 11K · E2E **41/41 pass** (`/tmp/harness_v5.mjs`)

---

## 🔴 P0 — Fix

- [x] **`hook` buffered** — `SessionManager.ts:90-99` scans `cleanLines`. T05 ✔
- [x] **`hook` triggerPayload deadlock** — `index.ts:54` + `SessionManager.ts:118-120`. T06/T07 ✔
- [x] **`spawn args`** — `pty.spawn(command,args)` `index.ts:20`. T11/T12 ✔
- [x] **`signal` tree-kill** — `tree-kill` `SessionManager.ts:5,131`. T15 ✔ (child 313967 killed, parent running)
- [x] **`wait` timeout** — T09/T10 ✔
- [x] **`RegExp` invalid** — `index.ts:102-106` ✔ T08

---

## 🟠 P1 — Improve

- [x] **`session_close`** — `SessionManager.ts:180` + `index.ts:69`. T14 ✔
- [x] **Session `name`** — `SessionManager.ts:8,38` `index.ts:24`. T01/T24 ✔
- [x] **PTY `cols`/`rows` + `session_resize`** — `SessionManager.ts:30,140` `index.ts:31`. T02 ✔
- [x] **`cwd` validation** — `fs.existsSync` `SessionManager.ts:33` `index.ts:128`. T13 ✔
- [x] **`env` merging** — verified T25 `MY_TEST_VAR=hello123` → `hello123` ✔ (still needs sanitization note)
- [x] **`session_info`** — `index.ts:85` `session_info` tool, `SessionManager.ts:165` `getInfo()`. T17/T26 ✔
- [x] **`session_read` offset/grep** — `read`→`getLines` `SessionManager.ts:108-130` + `index.ts:73-84`. T18 offset, T19 grep, T20 no-match, T27 stripAnsi ✔
- [x] **`ttlMs` auto-close** — **NEW** `SessionManager.ts:13,50,216` `ttlMs?:number` + `onCleanup` `setTimeout(delete, ttlMs)` onExit, `index.ts:28` schema `ttlMs`. **T28** `bash -c exit 0 ttl 1000` → stillThere after exit true → gone after 1300 true ✔. **T29** `bash` `sleep 1; exit 0` ttl 800 → stillRunning after 1000 true (no premature delete) → wait 0 → gone after 1000 true ✔
- [ ] **Backpressure / write overflow** — NOT FIXED
- [ ] **`strip-ansi@7` ESM interop** — NOT FIXED
- [ ] **Buffer `appendDataToLines` fragmentation** — NOT FIXED

---

## 🟡 P2 — Refine / New in v4/v5

- [x] **`session_write` pressKey** — `SessionManager.ts:86-103` maps `Ctrl+C/D/Enter/Tab/Escape/ArrowUp/Down`, `write` `pressEnter=false` default `+'\r'`, `index.ts:55` `pressKey`. T21 `Ctrl+C` → `^C` ✔, T22 no crash, T23 `Enter` ✔ (BREAKING: must pass `pressEnter:true`)
- [x] **`read`→`getLines` rename** — `SessionManager.ts:108` MCP handler `index.ts:83` calls `getLines`. BREAKING.
- [ ] **Unified `isError` shape** — mixed
- [ ] **Logging / observability** — NOT FIXED
- [ ] **Tests & CI** — 41 manual E2E, need vitest
- [ ] **Docs / README gaps** — NOT FIXED (need doc for `ttlMs`, `pressKey`, `offsetLines`/`grepPattern`, `session_info`, `session_resize`, breaking changes)

---

## 📋 E2E Matrix — 2026-08-27 22:11 (41 tests via `/tmp/harness_v5.mjs`)

| # | Scenario | Result |
|---|----------|--------|
| T01 | `spawn bash` `name=test-session-v4 cols120 rows40` | ✔ pid 312577 |
| T02 | `resize 100x30` | ✔ |
| T03a | `write` noEnter → no output line | ✔ |
| T03b | `write` withEnter → output | ✔ |
| T03c | `echo E2E_BASELINE` | ✔ |
| T04 | `clearBuffer` | ✔ |
| T05 | `hook` buffered | ✔ |
| T06 | `hook` triggerPayload | ✔ |
| T07 | `hook` autoResponse | ✔ Hello Mas Azzar |
| T08 | invalid regex | ✔ |
| T09 | `wait` exit 42 | ✔ |
| T10 | `wait` timeout 500 | ✔ |
| T11 | `spawn sleep 1` args | ✔ 0 |
| T12 | `bash -c` hook | ✔ |
| T13 | bad cwd | ✔ CWD does not exist |
| T14 | `session_close` 9→8 | ✔ |
| T15 | `signal SIGTERM` tree-kill (313967 killed, parent running) | ✔ |
| T17 | `session_info` name | ✔ |
| T18 | `offsetLines=2` | ✔ |
| T19 | `grepPattern line3` | ✔ |
| T20 | `grep no match` | ✔ len 0 |
| T21 | `pressKey Ctrl+C` kill sleep 30 | ✔ ^C |
| T22 | `pressKey` no crash | ✔ |
| T23 | `pressKey Enter` | ✔ |
| T24 | `list` has name | ✔ count 14→17 |
| T25 | `env MY_TEST_VAR` | ✔ hello123 |
| T26 | `info args` | ✔ -c, check-info |
| T27 | `stripAnsi` true/false | ✔ |
| T28 | `ttlMs` 1000 auto-close after exit | ✔ stillThere true → gone true |
| T29 | `ttlMs` 800 no premature delete while running | ✔ stillRunning true → exit 0 → gone true |
| T30 | `list` sanity | ✔ count 17 |

---

## ⚠️ Breaking Changes (v4/v5)

1. `Session.write(payload, pressEnter=false, pressKey?)` default `false` (was `true`), now sends `\r`. MCP `session_write` `pressEnter=false`. Clients must pass `pressEnter:true`.
2. `Session.read` → `Session.getLines` (MCP handler updated).
3. New `ttlMs` on `Session`/`session_spawn` auto-deletes exited session after `ttlMs` ms.

---

## 💡 Next

- [ ] Vitest suite from harness
- [x] Document breaking changes + new tools in README — FIXED. Updated README with all breaking changes, `ttlMs`, and `session_prune`.
- [x] `session_prune` for manual GC (ttl covers most) — FIXED. Added `session_prune` tool for manual garbage collection.
