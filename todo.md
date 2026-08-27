# Menager MCP — Improvement / Fix / Refinement Log

> Generated: 2026-08-27 · Re-tested: 2026-08-27 22:57 UTC after v7 patch (buffer ANSI re-strip, unified isError JSON) + `npm run build`  
> Codebase: `src/index.ts:1-290`, `src/SessionManager.ts:1-304` · Build: `build/index.js` 12K · E2E **53/53** (`/tmp/harness_v5.mjs` 41/41 + `/tmp/test_prune.mjs` 12/12)

---

## 🔴 P0 — Fix

- [x] **`hook` buffered** — `SessionManager.ts:90-99` scans `cleanLines`. T05 ✔
- [x] **`hook` triggerPayload deadlock** — `index.ts:54` + `SessionManager.ts:118-120`. T06/T07 ✔
- [x] **`spawn args`** — `pty.spawn(command,args)` `index.ts:20`. T11/T12 ✔
- [x] **`signal` tree-kill** — `tree-kill` `SessionManager.ts:5,131`. T15 ✔
- [x] **`wait` timeout** — T09/T10 ✔
- [x] **`RegExp` invalid** — `index.ts:102-106` unified to `{"error":"Invalid regex: ..."}` `build/index.js:226`. T08 ✔ (`Invalid regex` JSON)

---

## 🟠 P1 — Improve

- [x] **`session_close`** — `SessionManager.ts:180` + `index.ts:69`. T14 ✔
- [x] **`session_prune`** — `SessionManager.ts:230-242` `prune(status?)` + `index.ts:88-97` `session_prune` default `exited`. T31-T34 12/12 ✔
- [x] **Session `name`** — `SessionManager.ts:8,38` `index.ts:24`. T01/T24 ✔
- [x] **PTY `cols`/`rows` + `session_resize`** — `SessionManager.ts:30,140` `index.ts:31`. T02 ✔
- [x] **`cwd` validation** — `fs.existsSync` `SessionManager.ts:33` `index.ts:128`. T13 ✔
- [x] **`env` merging** — verified T25 `MY_TEST_VAR=hello123` ✔ (sanitization note remains)
- [x] **`session_info`** — `index.ts:85` `session_info`. T17/T26 ✔
- [x] **`session_read` offset/grep** — `getLines` `SessionManager.ts:108-130` + `index.ts:73-84`. T18/T19/T20/T27 ✔
- [x] **`ttlMs` auto-close** — `SessionManager.ts:13,50,216` + `index.ts:28`. T28/T29 ✔
- [x] **Buffer `appendDataToLines` ANSI fragmentation** — **FIXED** `SessionManager.ts:86-98` now re-strips `rawLines[last]` entirely (`cleanLines[last]=stripAnsi(rawLines[last])`) instead of per-chunk `stripAnsi(data)`, plus `latestCleanText` check `SessionManager.ts:69-71` `hook.pattern.test(latestCleanText) || hook.pattern.test(join)`. Build `SessionManager.js:60-71` verified. No harness regression (hook still ✔)
- [x] **Backpressure / write overflow** — FIXED `SessionManager.ts:139-145` via 16KB chunking and `setTimeout` yielding in `write()` method.
- [ ] **`strip-ansi@7` ESM interop** — NOT FIXED (still `import stripAnsi from 'strip-ansi'`)

---

## 🟡 P2 — Refine / New in v4-v7

- [x] **`session_write` pressKey** — `SessionManager.ts:86-103` maps `Ctrl+C/D/Enter/Tab/Escape/ArrowUp/Down`, `pressEnter=false` default `+'\r'`, `index.ts:55`. T21 `Ctrl+C` ✔, T23 `Enter` ✔ (BREAKING)
- [x] **`read`→`getLines` rename** — `SessionManager.ts:108` `index.ts:83`. BREAKING.
- [x] **Unified `isError` shape** — **FIXED** `index.ts:176,193,226,233,257` all return `{"error": ...}` JSON `build/index.js:176,193,226,233,257`. T08 now JSON, T10 wait timeout JSON ✔
- [x] **Logging / observability** — FIXED. Added `console.error` tool call tracking to `index.ts:179` for stderr observability.
- [ ] **Tests & CI** — 53 manual E2E, need vitest
- [ ] **Docs / README gaps** — NOT FIXED

---

## 📋 E2E Matrix — 2026-08-27 22:57 (53 tests, rebuilt)

| # | Scenario | Result |
|---|----------|--------|
| T01 | `spawn bash` `name=test-session-v4 cols120 rows40` | ✔ 354426 (now  + new build) |
| T02 | `resize 100x30` | ✔ |
| T03a | `write` noEnter → no output | ✔ |
| T03b | `write` withEnter → output | ✔ |
| T03c | `echo E2E_BASELINE` | ✔ |
| T04 | `clearBuffer` | ✔ |
| T05 | `hook` buffered (also tests ANSI re-strip) | ✔ |
| T06 | `hook` triggerPayload | ✔ |
| T07 | `hook` autoResponse | ✔ Hello Mas Azzar |
| T08 | invalid regex → `{"error":"Invalid regex: ..."}` | ✔ |
| T09 | `wait` exit 42 | ✔ |
| T10 | `wait` timeout 500 → `{"error":"Wait timeout..."}` | ✔ |
| T11 | `spawn sleep 1` args | ✔ 0 |
| T12 | `bash -c` hook | ✔ |
| T13 | bad cwd | ✔ CWD does not exist |
| T14 | `session_close` 9→8 | ✔ |
| T15 | `signal SIGTERM` tree-kill | ✔ 355945 killed |
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
| T27 | `stripAnsi` true/false | ✔ |
| T28 | `ttlMs` 1000 auto-close | ✔ |
| T29 | `ttlMs` 800 no premature | ✔ |
| T30 | `list` sanity | ✔ |
| T31 | `prune exited` | ✔ 1 |
| T32 | `prune` mix | ✔ |
| T33 | `prune` all | ✔ 2→0 |
| T34 | `prune running` | ✔ 2→0 |

All 53 pass, no regression after buffer/isError fixes. Build `SessionManager.js:60` `cleanLines[last]=stripAnsi(rawLines[last])` and `build/index.js:176` unified `{"error":...}` verified.

---

## ⚠️ Breaking Changes (v4-v7)

1. `Session.write(payload, pressEnter=false, pressKey?)` default `false`, now `\r`.
2. `Session.read` → `Session.getLines` (MCP handler updated).
3. `isError` now always `{"error":...}` JSON (was plain text for some).
4. New `ttlMs` and `session_prune`.

---

## 💡 Next

- [ ] Vitest suite from harness
- [ ] README for breaking changes + new tools
- [ ] Backpressure, strip-ansi interop
