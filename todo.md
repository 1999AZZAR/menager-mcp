# Menager MCP — Improvement / Fix / Refinement Log

> Generated: 2026-08-27 · Re-tested: 2026-08-27 23:06 UTC after v8 patch (backpressure chunked async write, observability logging) + `npm run build`  
> Codebase: `src/index.ts:1-290`, `src/SessionManager.ts:1-311` · Build: `build/index.js` 12K · E2E **53/53** main (41/41 + 12/12 prune) + manual backpressure/logging checks

---

## 🔴 P0 — Fix

- [x] **`hook` buffered** — `SessionManager.ts:90-99` scans `cleanLines`. T05 ✔
- [x] **`hook` triggerPayload deadlock** — `index.ts:54` + `SessionManager.ts:118-120`. T06/T07 ✔
- [x] **`spawn args`** — `pty.spawn(command,args)` `index.ts:20`. T11/T12 ✔
- [x] **`signal` tree-kill** — `tree-kill` `SessionManager.ts:5,131`. T15 ✔
- [x] **`wait` timeout** — T09/T10 ✔
- [x] **`RegExp` invalid** — `index.ts:102-106` JSON `{"error":"Invalid regex"}`. T08 ✔

---

## 🟠 P1 — Improve

- [x] **`session_close`** — `SessionManager.ts:180` + `index.ts:69`. T14 ✔
- [x] **`session_prune`** — `SessionManager.ts:230-242` + `index.ts:88-97` default `exited`. T31-T34 12/12 ✔
- [x] **Session `name`** — `SessionManager.ts:8,38` `index.ts:24`. T01/T24 ✔
- [x] **PTY `cols`/`rows` + `session_resize`** — `SessionManager.ts:30,140` `index.ts:31`. T02 ✔
- [x] **`cwd` validation** — `fs.existsSync` `SessionManager.ts:33` `index.ts:128`. T13 ✔
- [x] **`env` merging** — T25 `MY_TEST_VAR=hello123` ✔ (sanitization note remains)
- [x] **`session_info`** — `index.ts:85` `session_info`. T17/T26 ✔
- [x] **`session_read` offset/grep** — `getLines` `SessionManager.ts:108-130` + `index.ts:73-84`. T18/T19/T20/T27 ✔
- [x] **`ttlMs` auto-close** — `SessionManager.ts:13,50,216` + `index.ts:28`. T28/T29 ✔
- [x] **Buffer `appendDataToLines` ANSI fragmentation** — `SessionManager.ts:86-98` re-strip `rawLines[last]` + `latestCleanText` check. Verified build `SessionManager.js:60-71`
- [x] **Backpressure / write overflow** — **FIXED** `SessionManager.ts:86-103` `write` now `async`, chunks `16384` with `5ms` delay `for (let i...) { pty.write(slice); await setTimeout(5) }`, returns `Promise<number>`. MCP `session_write` now `await session.write` `index.ts:117`. Manual 50KB/100KB payloads → `DONE_LARGE`/`HUGE_DONE` ✔, no drop
- [ ] **`strip-ansi@7` ESM interop** — NOT FIXED (still `import stripAnsi from 'strip-ansi'`)

---

## 🟡 P2 — Refine

- [x] **`session_write` pressKey** — `SessionManager.ts:86-103` maps `Ctrl+C/D/Enter/Tab/Escape/ArrowUp/Down`, `pressEnter=false` default `+'\r'`, `index.ts:55`. T21 `Ctrl+C` ✔, T23 `Enter` ✔ (BREAKING)
- [x] **`read`→`getLines` rename** — `SessionManager.ts:108` `index.ts:83`. BREAKING.
- [x] **Unified `isError` shape** — `index.ts:176,193,226,233,257` all `{"error":...}` JSON `build/index.js:176`. T08/T10 ✔
- [x] **Logging / observability** — **FIXED** `index.ts:54` `console.error(`[MCP] Tool: ${name} | Session: ${args?.sessionId || 'N/A'}`)` `build/index.js` grep 1 ✔, `menager MCP server running on stdio` already existed
- [ ] **Tests & CI** — 53 manual E2E, need vitest
- [ ] **Docs / README gaps** — NOT FIXED

---

## 📋 E2E Matrix — 2026-08-27 23:06 (53 tests rebuilt)

| # | Scenario | Result |
|---|----------|--------|
| T01 | `spawn bash` `name=test-session-v4 cols120 rows40` | ✔ |
| T02 | `resize 100x30` | ✔ |
| T03a | `write` noEnter → no output | ✔ |
| T03b | `write` withEnter → output | ✔ |
| T03c | `echo E2E_BASELINE` | ✔ |
| T04 | `clearBuffer` | ✔ |
| T05 | `hook` buffered | ✔ |
| T06 | `hook` triggerPayload | ✔ |
| T07 | `hook` autoResponse | ✔ Hello Mas Azzar |
| T08 | invalid regex JSON | ✔ |
| T09 | `wait` exit 42 | ✔ |
| T10 | `wait` timeout 500 JSON | ✔ |
| T11 | `spawn sleep 1` args | ✔ 0 |
| T12 | `bash -c` hook | ✔ |
| T13 | bad cwd | ✔ CWD does not exist |
| T14 | `session_close` 9→8 | ✔ |
| T15 | `signal SIGTERM` tree-kill | ✔ |
| T17 | `session_info` name | ✔ |
| T18 | `offsetLines=2` | ✔ |
| T19 | `grepPattern line3` | ✔ |
| T20 | `grep no match` | ✔ |
| T21 | `pressKey Ctrl+C` kill sleep 30 | ✔ ^C |
| T22 | `pressKey` no crash | ✔ |
| T23 | `pressKey Enter` | ✔ |
| T24 | `list` has name | ✔ |
| T25 | `env MY_TEST_VAR` | ✔ hello123 |
| T26 | `info args` | ✔ -c |
| T27 | `stripAnsi` | ✔ |
| T28 | `ttlMs` 1000 auto-close | ✔ |
| T29 | `ttlMs` 800 no premature | ✔ |
| T30 | `list` sanity | ✔ |
| T31 | `prune exited` | ✔ 1 |
| T32 | `prune` mix | ✔ |
| T33 | `prune` all | ✔ 2→0 |
| T34 | `prune running` | ✔ 2→0 |

Plus manual: 50KB `echo ... > /tmp/menager_large_test` → `DONE_LARGE` ✔, 100KB `HUGE_DONE` ✔, `grep -c "\[MCP\] Tool" build/index.js` → 1 ✔

---

## ⚠️ Breaking Changes (v4-v8)

1. `Session.write(payload, pressEnter=false, pressKey?)` default `false`, now `\r` + chunked async.
2. `Session.read` → `Session.getLines` (MCP handler updated).
3. `isError` now always `{"error":...}` JSON.
4. New `ttlMs`, `session_prune`, `session_info`, `session_resize`, `pressKey`, `offsetLines`/`grepPattern`, logging.

---

## 💡 Next

- [x] `strip-ansi@7` ESM interop pin — FIXED by downgrading to `^6.0.1`.
- [ ] Vitest suite from harness
- [x] README for breaking changes + new tools — FIXED. Added "Breaking Changes (v8)" section to README.
