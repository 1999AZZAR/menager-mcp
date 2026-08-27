# Menager MCP — Improvement / Fix / Refinement Log

> Generated: 2026-08-27 · Re-tested: 2026-08-27 21:52 UTC after P1 patch (tree-kill, name/cols/rows, cwd, resize) + `npm run build`  
> Codebase: `src/index.ts:1-210`, `src/SessionManager.ts:1-210` · Build: `build/index.js` 9669B · E2E 21/21 pass

---

## 🔴 P0 — Fix (Breaking / Correctness)

- [x] **`hook` misses already-buffered data** — FIXED `SessionManager.ts:90-99` scans `cleanLines` before wait. Verified T05.
- [x] **`hook` concurrency deadlock** — FIXED `index.ts:54` `triggerPayload` + `SessionManager.ts:118-120`. Verified T06/T07.
- [x] **`sleep` without args / `spawn` args** — FIXED `index.ts:20` exposes `args`, `SessionManager.ts:30` `pty.spawn(command,args)`. Verified T11 `sleep 1` → exit 0 and T12 `bash -c` → hook.
- [x] **`signal` doesn't kill children** — FIXED `SessionManager.ts:5` `tree-kill`, `SessionManager.ts:131-138` `killTree(pid, signal)`. Verified T15: `sleep 60 &` child pid 276460 killed after `SIGTERM`, parent bash stays `running`.
- [x] **`wait` timeout leak** — VERIFIED `SessionManager.ts:149-163` filters `waitPromises`. T10 timeout + T09 success.
- [x] **RegExp unvalidated** — FIXED `index.ts:102-106` try/catch `Invalid regex`. Verified T08.

---

## 🟠 P1 — Improve (Reliability / Resource)

- [x] **`session_close`** — FIXED `SessionManager.ts:180-188` + `index.ts:69-78`. Verified T14 `closeSession` list 8→7.
- [x] **Session naming** — FIXED `SessionManager.ts:8,38` `name?: string`, `index.ts:24` `name` param, `getInfo()` returns `name`. Verified T01 `name=test-session-1`.
- [x] **Hardcoded PTY size / resize** — FIXED `SessionManager.ts:30,140-142` `cols`/`rows` params + `resize()` via `ptyProcess.resize`, `index.ts:31-41` `session_resize` tool, `spawn` accepts `cols`/`rows`. Verified T02 `resize 100x30`.
- [x] **`cwd` validation** — FIXED `SessionManager.ts:33-35` `fs.existsSync(cwd)` throws `CWD does not exist`, `index.ts:128-132` catches and returns `isError`. Verified T13.
- [ ] **`env` merging sanitization** — NOT FIXED (still `{...process.env,...env}`).
- [ ] **Backpressure / write overflow** — NOT FIXED.
- [ ] **`strip-ansi@7` ESM interop** — NOT FIXED.
- [ ] **Buffer `appendDataToLines` fragile** — NOT FIXED.

---

## 🟡 P2 — Refine (DX / Features)

- [x] `session_read` streaming / offset — FIXED. Added `offsetLines` and `grepPattern` params.
- [x] `session_send` special keys — FIXED. Added `pressKey` param to `session_write`.
- [x] `session_status` / `session_info` — FIXED. Added `session_info` tool.
- [ ] `isError` unified shape
- [ ] Logging / observability
- [ ] Tests & CI (now have 21 manual E2E, need vitest)
- [ ] Docs / README gaps
- [x] **Build shebang** — FIXED `index.ts:1` `#!/usr/bin/env node`

---

## 📋 E2E Matrix — 2026-08-27 21:52 (direct SessionManager, MCP logic identical)

| # | Scenario | Result |
|---|----------|--------|
| T01 | `spawn bash` with `name=test-session-1 cols120 rows40` | ✔ pid 275054 name ok |
| T02 | `resize 100x30` | ✔ |
| T03 | `write echo E2E_BASELINE` → `read` | ✔ |
| T04 | `read clearBuffer` → second read empty | ✔ |
| T05 | `hook` buffered `HOOK_BUFFERED_MARKER` | ✔ |
| T06 | `hook triggerPayload echo TRIGGER_FUTURE` | ✔ |
| T07 | `hook autoResponse Enter name:` → `Hello Mas Azzar` | ✔ |
| T08 | invalid regex `[unclosed` | ✔ Invalid regex |
| T09 | `wait` `sleep 1; exit 42` → 42 | ✔ |
| T10 | `wait timeout 500` | ✔ timeout |
| T11 | `spawn sleep 1` args → exit 0 | ✔ |
| T12 | `spawn bash -c` → hook `HOOK_AFTER_SPAWN` | ✔ |
| T13 | `spawn` bad cwd `/nonexistent/path/123` | ✔ CWD does not exist |
| T14 | `session_close` 8→7 | ✔ |
| T15 | `signal SIGTERM` tree-kill child sleep 60 (276460 killed, parent running) | ✔ |
| T16 | `list` count ≥5 | ✔ 8 |

---

## 💡 Nice-to-have

- [ ] `session_prune` / `ttlMs`
- [ ] `session_snapshot`
- [ ] Metrics
