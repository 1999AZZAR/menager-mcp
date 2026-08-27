# Product Requirements Document (PRD)

## Project: `menager`

A TypeScript-based Model Context Protocol (MCP) server for inter-session terminal orchestration, pseudo-terminal (PTY) lifecycle management, ring-buffered I/O multiplexing, and reactive event hooking across polyglot execution harnesses.

---

## 1. Overview & Objectives

`menager` enables an AI agent session (or human operator) to act as a master control plane capable of spawning, monitoring, driving, and hooking into child terminal harnesses (CLI tools, secondary AI agents, interactive shells, or language-specific runtimes such as Python, Node.js, and C binaries).

### Core Goals

* **Polyglot Harness Multiplexing:** Drive interactive processes written in any language via standard POSIX pseudo-terminals (`pty`).
* **Simulated Human Typing:** Inject text, control sequences (`SIGINT`, EOF, Ctrl+C), and raw keystrokes seamlessly into child `stdin`.
* **Predictable Event Interception:** Provide non-blocking regex hooks with timeout guarantees and optional immediate auto-responses.
* **Memory-Bounded Observability:** Maintain dedicated circular buffers per session with real-time ANSI-stripping for token-efficient LLM context consumption.

---

## 2. Technical Stack

* **Runtime:** Node.js (>= 20.x, ESM)
* **Language:** TypeScript 5.x
* **PTY Native Bindings:** `node-pty` (C++ POSIX `forkpty(3)` bindings)
* **Protocol:** `@modelcontextprotocol/sdk` (Stdio transport)
* **Validation:** `zod`
* **Output Sanitization:** `strip-ansi`

---

## 3. System Architecture

```
┌────────────────────────────────────────────────────────┐
│             Master Agent / Harness Session             │
└───────────────────────────┬────────────────────────────┘
                            │ MCP Protocol (stdio JSON-RPC)
┌───────────────────────────▼────────────────────────────┐
│                  menager MCP Server                    │
│                                                        │
│  ┌──────────────────────┐    ┌──────────────────────┐  │
│  │   Session Manager    │    │     Hook Engine      │  │
│  │  (node-pty spawn,    │    │ (Async RegExp Wait,  │  │
│  │   PID tracking)      │    │  Auto-Reply, Timeout)│  │
│  └──────────┬───────────┘    └──────────┬───────────┘  │
│             │                           │              │
│  ┌──────────▼───────────────────────────▼───────────┐  │
│  │      I/O Multiplexer & Circular Buffers          │  │
│  │  (Dual-stream: Raw ANSI & Clean Text, Splice FIFO)│  │
│  └──────────────────────┬───────────────────────────┘  │
└─────────────────────────┼──────────────────────────────┘
                          │ OS PTY (`/dev/pts/*`)
            ┌─────────────┴─────────────┐
            ▼                           ▼
┌───────────────────────┐   ┌───────────────────────┐
│ Child Session: `cli-1`│   │ Child Session: `sub-2`│
│ (Interactive Python)  │   │ (Sub-Agent Harness)   │
└───────────────────────┘   └───────────────────────┘

```

---

## 4. Functional Specifications

### 4.1 Session Lifecycle & Process Isolation

* Every session is spawned using `node-pty.spawn` with an isolated terminal allocation (`TERM=xterm-256color`, configurable columns/rows).
* Custom environment variables (`env`) and working directories (`cwd`) are merged on a per-session basis.
* Sessions automatically detect exit events, record exit codes, release internal hook listeners, and transition state to `exited`.

### 4.2 Stream Processing & Ring Buffering

* **Dual-Stream Buffers:** Every session stores two internal line buffers:
* `rawBuffer`: Unmodified ANSI output stream.
* `cleanBuffer`: Stripped, clean-text stream for token-efficient context delivery.


* **Strict FIFO Capacity:** Output is capped at a configurable line limit (default: 5,000 lines). Old lines are shifted out immediately to prevent unbounded memory growth.

### 4.3 Reactive Hook Subsystem

* Agents can register pattern listeners (`RegExp`) against incoming clean data chunks.
* When incoming output matches the target pattern:
* The waiter resolves immediately with the matching chunk.
* Optional `autoResponse` payload is dispatched directly to session `stdin`.


* If the pattern does not trigger within `timeoutMs`, the promise rejects cleanly without blocking other server operations.

---

## 5. MCP Tool Interfaces

### `session_spawn`

Spawns a new child PTY session.

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `command` | `string` | Yes | — | Target binary or executable (e.g., `bash`, `python3`). |
| `args` | `string[]` | No | `[]` | Command line arguments. |
| `cwd` | `string` | No | `process.cwd()` | Working directory path. |
| `env` | `Record<string, string>` | No | `{}` | Additional environment variables. |
| `maxBufferLines` | `number` | No | `5000` | Rolling line limit for memory buffers. |

**Returns:**

```json
{
  "sessionId": "a1b2c3d4",
  "pid": 48210,
  "command": "python3",
  "args": ["-i"],
  "status": "running",
  "exitCode": null,
  "createdAt": "2026-08-27T10:19:39.000Z"
}

```

---

### `session_write`

Injects keystrokes, commands, or escape sequences into the session's standard input.

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `sessionId` | `string` | Yes | — | Target session ID. |
| `payload` | `string` | Yes | — | String or control character sequence. |
| `pressEnter` | `boolean` | No | `true` | Append `\n` to the payload. |

**Returns:**

```json
{
  "sessionId": "a1b2c3d4",
  "bytesWritten": 14
}

```

---

### `session_read`

Reads buffered output from the target session.

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `sessionId` | `string` | Yes | — | Target session ID. |
| `tailLines` | `number` | No | `100` | Number of trailing lines to retrieve. |
| `stripAnsi` | `boolean` | No | `true` | Return sanitized text without ANSI codes. |
| `clearBuffer` | `boolean` | No | `false` | Flush internal buffers after read. |

**Returns:** Raw text lines joined by newlines.

---

### `session_hook`

Awaits a specific regex pattern on the session stream with optional automated reply.

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `sessionId` | `string` | Yes | — | Target session ID. |
| `pattern` | `string` | Yes | — | Regular expression to observe. |
| `timeoutMs` | `number` | No | `30000` | Milliseconds before timing out. |
| `autoResponse` | `string` | No | — | Optional string to immediately write on match. |

**Returns:**

```json
{
  "matched": true,
  "matchedChunk": "Confirm installation [y/N]:",
  "autoResponded": true
}

```

---

### `session_signal`

Sends a POSIX signal to the target session process.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `sessionId` | `string` | Yes | Target session ID. |
| `signal` | `"SIGINT" | "SIGTERM" | "SIGKILL"` | Yes | Signal to deliver. |

**Returns:**

```json
{
  "sessionId": "a1b2c3d4",
  "signaled": "SIGINT"
}

```

---

### `session_list`

Lists all active and completed sessions managed by the server.

**Parameters:** None.

**Returns:** Array of `SessionInfo` objects.

---

## 6. Non-Functional & Reliability Constraints

* **Strict Asynchrony:** Event handling must remain purely event-driven using Node.js event emitters and promises; no synchronous sleep or blocking loops.
* **Resource Discipline:** Buffer bounds must be enforced on every `onData` event. Exited sessions retain metadata and remaining buffers until explicitly evicted or restarted.
* **Graceful Shutdown:** On server `SIGINT` or `SIGTERM`, all active child PTY sessions must receive `SIGHUP`/`SIGTERM` to avoid leaving orphaned background processes.
