# menager — idea

> **One agent to rule the terminals.**  
> A TypeScript MCP server that turns any CLI — Python, Node, bash, sub-agents — into a controllable, observable, hookable PTY harness.

---

## The problem

AI agents are great at writing code, bad at *driving* it. Every interesting workflow — `python -i`, `npm watch`, `gdb`, `claude-code`, an interactive installer asking `[y/N]` — lives behind a TTY. Plain `exec("bash -c ...")` can't hold a conversation: no persistent shell, no Ctrl+C, no waiting for `Ready`, no memory of what scrolled past.

`tmux` solves persistence for humans. Agents need the same, but programmable: spawn, type, read, wait for a regex, auto-reply, kill the tree, and do it for 10 harnesses in parallel without leaking memory.

**menager** is that control plane.

---

## The idea in one sentence

Give the master agent a `pty` switchboard: spawn any command in its own PTY, keep a bounded dual-stream buffer (raw ANSI + clean text), and let the agent `write` / `read` / `hook` / `wait` / `signal` / `prune` across all of them — all over MCP stdio.

If `spawn` is `fork`, `hook` is `expect`, and `read` is `tail`, menager is `systemd` for agent harnesses.

---

## How it works (30s architecture)

```
master agent ──MCP stdio (JSON-RPC)──> menager
                                    ├─ SessionManager (Map<id, Session>)
                                    │   ├─ Session ──node-pty──> /dev/pts/N ──> child (bash/python/sub-agent)
                                    │   ├─ rawLines[] / cleanLines[]  (FIFO, default 5000 lines)
                                    │   └─ hooks Set<RegExp> + waitPromises
                                    └─ HookEngine (existing-buffer check → future-data wait → autoResponse)
```

* **PTY, not pipe.** `node-pty` (`forkpty(3)`) allocates a real terminal (`TERM=xterm-256color` or `dumb`, configurable `cols`/`rows`). Interactive programs behave as if a human typed.
* **Two buffers, one truth.** Every `onData` chunk updates `rawLines` and `cleanLines = stripAnsi(rawLines[last])` re-stripped whole-line (fixes ANSI split across chunks). Both capped FIFO.
* **Hooks see past and future.** `hook(pattern)` first scans `cleanLines.join('\n')` (already buffered), then watches `latestCleanText`. Optional `triggerPayload` writes *after* registration to avoid deadlock, and `autoResponse` writes on match.

---

## Core primitives

1. **Session** — an isolated PTY with `id` (4-byte hex), optional `name`, `pid`, `command`+`args`, `cwd`/`env` merged per-session, `status` (`running`/`exited`) + `exitCode`, `createdAt`, optional `ttlMs` (auto-delete after exit).
2. **Buffer** — `getLines(tailLines, stripAnsi, offsetLines, grepPattern, clearBuffer)` — `tail` + `grep` + `slice` over the ring. `clearBuffer` flushes both streams.
3. **Hook** — `await hook(/Ready/, timeoutMs, autoResponse?, triggerPayload?)` — resolves with `matchedChunk`, rejects on `Hook timeout ...` or `Session exited`. `Invalid regex` is a typed `{"error":...}`.
4. **Lifecycle** — `signal(SIGINT|TERM|KILL)` via `tree-kill` (kills child tree, parent may survive `TERM` — useful), `close` (SIGKILL + delete), `prune(status=exited|running)` bulk GC, `wait(timeoutMs)` resolves with exit code, `resize(cols,rows)`.

No polling, no `sleep` loops — all async `Promise` + `onData`/`onExit`.

---

## Tool surface (10 tools, current as of v8)

| Tool | What it does | Notable params |
|------|--------------|----------------|
| `session_spawn` | `pty.spawn` new harness | `command, args[], cwd, env{}, maxBufferLines=5000, terminalType, name, cols=80, rows=24, ttlMs` |
| `session_write` | type into `stdin` | `payload, pressEnter=false (→\r), pressKey=Ctrl+C/D/Enter/Tab/Escape/ArrowUp/Down` — chunked `16k/5ms` async |
| `session_read` | ring buffer `tail` | `tailLines=100, stripAnsi=true, offsetLines, grepPattern, clearBuffer` |
| `session_hook` | `expect` a regex | `pattern, timeoutMs=30000, autoResponse, triggerPayload` |
| `session_wait` | block until `exited` | `timeoutMs?` → `exitCode` or `{"error":"Wait timeout..."}` |
| `session_signal` | `kill` | `SIGINT|TERM|KILL` via `tree-kill` |
| `session_resize` | `ioctl` | `cols, rows` |
| `session_info` | `stat` one | → `SessionInfo` |
| `session_list` | `ps` all | → `SessionInfo[]` |
| `session_close` / `session_prune` | GC | `close(id)`, `prune(status=exited)` → `prunedCount` |

All errors unified: `isError: true, content: [{text: JSON.stringify({error: ...})}]`. Each `CallToolRequest` logs `[MCP] Tool: name | Session: id` to `stderr`.

---

## What makes it different

* **vs `bash` tool:** persistent, not one-shot. Memory-bounded, greppable history.
* **vs `tmux`:** API-first, not keystrokes. Regex hooks + auto-reply, `wait` with timeout, `ttlMs` auto-GC, JSON errors for LLMs.
* **vs `expect`:** polyglot and concurrent — 10 hooks in parallel, each PTY dual-buffered for token-efficient `stripAnsi` reads.

---

## Use cases that actually need this

1. **Sub-agent farm.** Master spawns `sub-agent --task "refactor auth"` in 3 PTYs, hooks `TASK_DONE`, collects `read(grep:"RESULT")`, `prune` when done.
2. **Interactive CLIs.** Drive `python -i`, `gh pr create --fill`, `terraform apply` (hook `Apply complete? [y/N]` → `autoResponse: "y"`), `gdb` (send `Ctrl+C`).
3. **Long watches.** `npm run dev` + `hook(/Compiled/)` → read `tailLines=20`, no log flood (5000-line cap).
4. **Polyglot CI.** Spawn `bash`, `node`, `python3`, `cargo run` side-by-side, `wait` each, `signal` tree-kill on timeout.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js ≥ 20.x, ESM |
| Language | TypeScript 5.x |
| PTY | `node-pty` (C++ `forkpty(3)` bindings) |
| Protocol | `@modelcontextprotocol/sdk` (Stdio, JSON-RPC) |
| Sanitization | `strip-ansi` |
| Validation | `zod` (declared in `package.json`) |

---

## Design principles

* **Async only** — events + promises, never blocking `sleep`.
* **Bounded** — FIFO shift on every `onData`; `prune`/`ttlMs` prevent Map leak.
* **Faithful TTY** — real PTY, not pipe; ANSI preserved raw but clean for LLM.
* **Observable** — `stderr` logging, dual buffers, `list`/`info`.

---

## Reliability & resource discipline

* **Strict asynchrony** — purely event-driven (`onData`/`onExit` + promises); no synchronous sleep or blocking loops.
* **Buffer bounds enforced on every `onData`** — `maxBufferLines` FIFO shift keeps memory flat regardless of output volume.
* **Exited sessions retain metadata + remaining buffers** until explicitly `close`d/`prune`d or auto-reaped by `ttlMs` — nothing is lost mid-flight, nothing leaks forever.
* **Graceful shutdown** — on server `SIGINT`/`SIGTERM`, all active child PTYs receive `SIGTERM` (`tree-kill`), so no orphaned background processes survive the parent.
* **Signal discipline** — `tree-kill` on `signal()`/`close()`/`prune()` so a killed shell doesn't leave `sleep 60 &` grandkids running.

---

## Current state & next ideas

**Shipped (v8):** PTY lifecycle, dual buffers with ANSI re-strip, chunked async `write`, `hook` past+future, `tree-kill` signals, `name`/`cols`/`rows`/`ttlMs`, `prune`/`close`/`resize`/`info`, unified JSON errors, `grep`/`offset` reads, `pressKey` map.

**Next:**
* `session_attach` — re-attach UI, `session_snapshot` → `/tmp/menager-<id>.log`
* Backpressure feedback (`bytesBuffered` vs `bytesWritten` already implicit via chunking)
* `strip-ansi` ESM pin, `env` allowlist, per-session metrics (`uptime`, `hookCount`)
* Vitest suite from the 53 E2E (41 main + 12 prune) + README for breaking changes (`write` now `pressEnter:false` → `\r`, `read` → `getLines`).

---

## Non-goals

Not a terminal emulator UI, not a process supervisor for production, not a replacement for `systemd`/`docker`. It is a *harness switchboard* for the 10-60s lifetime of an agent turn.

---

*Source: `src/SessionManager.ts` (Session + SessionManager), `src/index.ts` (MCP server, 11 tools inc. prune/info/resize). Build `npm run build` → `build/index.js` (12K).*
