# Menager MCP — Improvement / Fix / Refinement Log

> Generated: 2026-08-27  
> Tested via live harness: `spawn` / `list` / `write` / `read` / `hook` / `signal` / `wait`  
> Codebase: `src/index.ts`, `src/SessionManager.ts`

---

## 🔴 P0 — Fix (Breaking / Correctness)

- [x] **`hook` misses already-buffered data** — `Session.handleData()` only tests `hook.pattern.test(cleanData)` on *future* chunks (`SessionManager.ts:48`). If `write` then `hook`, pattern is already in `cleanLines` and will timeout (reproduced: `DONE_SIGNAL`, `HOOK_TRIGGERED`, `Enter name:` all timed out even though `read` proved data arrived). Fix: on `hook()` entry, first scan `cleanLines.join('\n')` against pattern and resolve immediately if found; otherwise register future hook.
- [x] **`hook` concurrency deadlock** — `hook` blocks MCP call for up to `timeoutMs` (30s default). Sequential client cannot `write` while `hook` is waiting, so `hook` + `autoResponse` for interactive prompts (`read -p "Enter name: "`) is untestable without parallel tool calls. Document required pattern: `hook` and `write` must be issued as **parallel tool calls** / via `chaining_workflow_orchestrator`. Or add `hook` variant that triggers a write after registration (e.g., `triggerPayload` param) to avoid needing concurrency.
- [ ] **`sleep` without args exits immediately** — `spawn(command="sleep", args=[])` always exits `1`. `SessionManager.spawn` supports `args`, and `src/index.ts:44` destructures `args`, but live `menager_session_spawn` wrapper wasn't forwarding `args` in tests. Verify MCP manifest forwards `args` and add integration test: `spawn("sleep", ["2"])` + `wait` => `exitCode 0` after ~2s, `spawn("bash", ["-c","sleep 1; echo HOOK_AFTER_SPAWN"])` for hook-without-concurrency test.
- [ ] **`signal` on shell doesn't kill children** — `ptyProcess.kill(signal)` sends to PTY only; `sleep 60 &` inside `bash` survives `SIGTERM` to parent (reproduced). For orchestration need `kill` to terminate process group or provide `signal` that kills children. Consider `ptyProcess.kill()` with process group or add `killTree` option / spawn with `detached` handling.
- [x] **`wait` timeout leak** — `wait()` filters `waitPromises` by `resolve` reference on timeout, but if session exits *after* timeout, promise already rejected yet `onExit` still resolves remaining promises. Ensure rejected promise is fully cleaned and `timeout` cleared on both paths. Add test: `wait(timeoutMs=500)` on `sleep 2` => rejects, then later `wait()` without timeout => still resolves correctly.
- [x] **RegExp unvalidated** — `new RegExp(pattern)` in `src/index.ts:84` throws on invalid regex (e.g., `pattern="[unclosed"`), crashes tool as unhandled. Wrap in try/catch and return `isError` with `Invalid regex` message.

---

## 🟠 P1 — Improve (Reliability / Resource)

- [x] **No session cleanup / `session_close` / `session_delete` tool** — `SessionManager.sessions` is a `Map` that grows forever (`list` showed 7+ sessions after 5 min). `exited` sessions never GC'd => memory leak (buffers `maxBufferLines=5000` per session). Add `session_close` (kill + delete) and `session_prune` (delete exited), plus `ttlMs` option on spawn with auto-cleanup.
- [ ] **No session naming / labeling** — IDs are `crypto.randomBytes(4).toString('hex')` (8 hex chars, collision possible under load, no uniqueness check). Add optional `name`/`label` on spawn, return it in `list`, allow `session_write/read` by name. Check collision loop on `id`.
- [ ] **Buffer `appendDataToLines` fragile** — splits on `\r\n` then `\n`, but PTY may send partial UTF-8 or ANSI sequences split across chunks. `cleanData = stripAnsi(data)` per chunk can leave broken escape codes. Consider buffering incomplete ANSI or using incremental strip.
- [ ] **Hardcoded PTY size** — `cols:80, rows:24` in `SessionManager.ts:34`. TUI apps (`vim`, `htop`, `lazygit`) break. Add `cols`/`rows` params to `spawn` and `session_resize` tool (`ptyProcess.resize(cols, rows)`).
- [ ] **No `cwd` validation** — `cwd = process.cwd()` default, but arbitrary path allowed. `pty.spawn` will throw `ENOENT` if missing; surface as `isError` with clear message, not crash.
- [ ] **No `env` merging sanitization** — `env: {...process.env, ...env}` blindly merges. Should filter or at least document that caller can override `PATH`/`NODE_ENV`. Consider allowlist or warning.
- [ ] **No backpressure / write overflow** — `write()` just does `ptyProcess.write(data)` synchronously, no check if PTY buffer full. Under rapid writes data may drop. Add queue or return `bytesBuffered` vs `bytesWritten`.
- [ ] **Missing `stripAnsi` import interop** — `strip-ansi@7` is ESM-only (`import stripAnsi from 'strip-ansi'`). Works with `"type":"module"` but breaks if consumed via CJS. Pin to `strip-ansi@6` or add interop helper. Verify `build` output.

---

## 🟡 P2 — Refine (DX / Features)

- [ ] **Add `session_read` streaming / offset** — Currently only `tailLines` from end. Add `offsetLines` / `sinceLine` / `grepPattern` to search buffer without pulling 5000 lines. Useful for big project logs.
- [ ] **Add `session_send` special keys** — `write` with `pressEnter:true` is limited. Add support for `Ctrl+C` (`\x03`), `Ctrl+D` (`\x04`), `ArrowUp`, `Tab` via `pressKey` enum. Currently must embed raw `\x03` in payload.
- [ ] **Add `session_status` / `session_info`** — `list` returns all; add single-session fetch by `sessionId` (already `getSession` exists internally but no tool).
- [ ] **Expose `isError` consistently** — `session_wait` and `session_hook` return `isError:true` on timeout, but `session_write/read` throw generic `catch` with `isError`. Unify error shape: `{error, code: "TIMEOUT"|"NOT_FOUND"|"INVALID_REGEX"}`.
- [ ] **Add logging / observability** — No logging of `spawn`/`signal`/`exit`. Add `console.error` structured logs (already does `menager MCP server running on stdio`) with `sessionId`, `pid`, `exitCode`, `durationMs` for debugging harness orchestration.
- [ ] **Add tests & CI** — Zero tests currently. Add `vitest` suite: `spawn`+`wait` exit codes, `write`+`read` roundtrip, `hook` buffered vs future, `signal` SIGKILL, `clearBuffer`, `maxBufferLines` eviction (shift loop), `concurrent` hook+write via parallel calls.
- [ ] **Docs / README gaps** — `README.md` (5.2k) doesn't document `hook` blocking behavior, `clearBuffer` destructiveness, `maxBufferLines` default 5000, `terminalType` `dumb` vs `xterm-256color`, or that `signal` to `bash` won't kill children. Add `Usage` examples for big-project harness: parallel spawns + `wait` orchestration.
- [x] **Build / DX** — `package.json` `bin` points to `build/index.js` but no shebang `#!/usr/bin/env node` in `src/index.ts` output. Add shebang or remove `bin`. Also `tsconfig.json` check: `esModuleInterop` needed for `node-pty`.

---

## 📋 Test Matrix (to automate)

- [ ] `spawn bash` -> `write "echo hi"` -> `read` contains `hi`
- [ ] `spawn bash` -> `read(tailLines=3, stripAnsi=true, clearBuffer=true)` -> second `read` empty
- [ ] `spawn bash` -> `write "sleep 1; exit 42"` -> `wait(timeout=5000)` => `42`
- [ ] `spawn("sleep", ["1"])` via args -> `wait` => `0` after ~1s (currently fails)
- [ ] `spawn bash` -> `hook("READY")` where `READY` already in buffer -> immediate resolve (currently timeout)
- [ ] `hook` + `autoResponse` concurrent: `hook("Enter name:")` || `write("read -p ...")` => `Hello Mas Azzar` (currently timeout)
- [ ] `spawn bash` -> `write "sleep 60 &"` -> `signal SIGTERM` -> children killed (currently survives)
- [ ] `list` pagination after 20 spawns -> no OOM, `prune` cleans exited

---

## 💡 Nice-to-have (Future)

- [ ] `session_attach` — re-attach to existing PTY via terminal UI
- [ ] `session_snapshot` — dump full buffer to file (`/tmp/menager-<id>.log`)
- [ ] `session_env` — update env of running session
- [ ] Metrics: `uptime`, `bytesIn`/`bytesOut`, `hookCount`
