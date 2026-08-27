# Menager MCP — Improvement / Fix / Refinement Log

> Generated: 2026-08-27 · Re-tested: 2026-08-27 22:41 UTC after v6 patch (session_prune, ttlMs) + `npm run build`  
> Codebase: `src/index.ts:1-260`, `src/SessionManager.ts:1-260` · Build: `build/index.js` 12K · E2E **41/41** main + **12/12** prune (`/tmp/harness_v5.mjs` + `/tmp/test_prune.mjs`)

---

## 🔴 P0 — Fix

- [x] **`hook` buffered** — `SessionManager.ts:90-99` scans `cleanLines`. T05 ✔
- [x] **`hook` triggerPayload deadlock** — `index.ts:54` + `SessionManager.ts:118-120`. T06/T07 ✔
- [x] **`spawn args`** — `pty.spawn(command,args)` `index.ts:20`. T11/T12 ✔
- [x] **`signal` tree-kill** — `tree-kill` `SessionManager.ts:5,131`. T15 ✔ (313967 killed)
- [x] **`wait` timeout** — T09/T10 ✔
- [x] **`RegExp` invalid** — `index.ts:102-106` ✔ T08

---

## 🟠 P1 — Improve

- [x] **`session_close`** — `SessionManager.ts:180` + `index.ts:69`. T14 ✔
- [x] **`session_prune`** — **NEW** `SessionManager.ts:230-242` `prune(status?)` tree-kill running + delete, `index.ts:89-97` `session_prune` tool (default `status="exited"`). **T31** `bash -c exit 0` → prune `exited` count 1 → gone ✔, **T32** mix 2 running +1 exited → prune `exited` only 1 → running 2 remain ✔, **T33** prune all (no arg via Manager) 2→0 ✔, **T34** prune `running` 2→0 ✔ (12/12)
- [x] **Session `name`** — `SessionManager.ts:8,38` `index.ts:24`. T01/T24 ✔
- [x] **PTY `cols`/`rows` + `session_resize`** — `SessionManager.ts:30,140` `index.ts:31`. T02 ✔
- [x] **`cwd` validation** — `fs.existsSync` `SessionManager.ts:33` `index.ts:128`. T13 ✔
- [x] **`env` merging** — verified T25 `MY_TEST_VAR=hello123` ✔ (sanitization note remains)
- [x] **`session_info`** — `index.ts:85` `session_info` tool. T17/T26 ✔
- [x] **`session_read` offset/grep** — `getLines` `SessionManager.ts:108-130` + `index.ts:73-84`. T18/T19/T20/T27 ✔
- [x] **`ttlMs` auto-close** — `SessionManager.ts:13,50,216` + `index.ts:28`. T28 ttl 1000 → stillThere → gone ✔, T29 ttl 800 no premature ✔
- [ ] **Backpressure / write overflow** — NOT FIXED
- [ ] **`strip-ansi@7` ESM interop** — NOT FIXED
- [x] **Buffer `appendDataToLines` fragmentation** — FIXED `SessionManager.ts:86-98` by completely re-stripping the last buffered line on new chunks instead of appending broken strips.

---

## 🟡 P2 — Refine / New in v4-v6

- [x] **`session_write` pressKey** — `SessionManager.ts:86-103` maps `Ctrl+C/D/Enter/Tab/Escape/ArrowUp/Down`, `pressEnter=false` default `+'\r'`, `index.ts:55`. T21 `Ctrl+C` ✔, T22 no crash, T23 `Enter` ✔ (BREAKING)
- [x] **`read`→`getLines` rename** — `SessionManager.ts:108` MCP handler `index.ts:83` calls `getLines`. BREAKING.
- [x] **Unified `isError` shape** — FIXED `index.ts:188,204,236,242,266`. All errors return `content: [{ type: "text", text: JSON.stringify({ error: ... }) }]`.
- [ ] **Logging / observability** — NOT FIXED
- [ ] **Tests & CI** — 53 manual E2E (41+12), need vitest
- [ ] **Docs / README gaps** — NOT FIXED (need doc for `ttlMs`, `session_prune`, `pressKey`, `offsetLines`/`grepPattern`, `session_info`, `session_resize`, breaking changes)

---

## 📋 E2E Matrix — 2026-08-27 22:41 (53 tests)

| # | Scenario | Result |
|---|----------|--------|
| T01 | `spawn bash` `name=test-session-v4 cols120 rows40` | ✔ 354426 |
| T02 | `resize 100x30` | ✔ |
| T03a | `write` noEnter → no output | ✔ |
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
| T27 | `stripAnsi` | ✔ |
| T28 | `ttlMs` 1000 auto-close | ✔ |
| T29 | `ttlMs` 800 no premature | ✔ |
| T30 | `list` sanity | ✔ count 17 |
| T31 | `prune exited` (1 exited → 0) | ✔ count 1 |
| T32 | `prune` mix 2 running+1 exited → only exited pruned | ✔ |
| T33 | `prune` all (no arg) 2→0 | ✔ |
| T34 | `prune running` 2→0 | ✔ |

---

## ⚠️ Breaking Changes (v4-v6)

1. `Session.write(payload, pressEnter=false, pressKey?)` default `false` (was `true`), now `\r`. Must pass `pressEnter:true`.
2. `Session.read` → `Session.getLines` (MCP handler updated).
3. New `ttlMs` (opt-in) and `session_prune` (default `exited` in MCP, `prune()` without arg deletes all in Manager).

---

## 💡 Next

- [ ] Vitest suite from harness
- [ ] README for breaking changes + new tools
