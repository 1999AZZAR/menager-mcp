# Menager MCP Server


> **Part of the [HeLa MCP Ecosystem](https://github.com/1999AZZAR/hela-mcp-ecosystem)** — This server is **HeLa Ribosome (`hela-ribosome`)** — the *PTY Harness* component of the HeLa cellular architecture. See the [ecosystem docs](https://github.com/1999AZZAR/hela-mcp-ecosystem) for profiles, workflows, and multi-client setup.

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)

![Menager Terminal Orchestration](assets/menager-illustrations/01-terminal-orchestration.jpg)

`menager` is a TypeScript-based Model Context Protocol (MCP) server designed for inter-session terminal orchestration. It enables an AI agent session (or human operator) to act as a master control plane capable of spawning, monitoring, driving, and hooking into child terminal harnesses (CLI tools, secondary AI agents, interactive shells, or polyglot runtimes) via standard POSIX pseudo-terminals (`pty`).

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Starting the Server](#starting-the-server)
- [Available Tools](#available-tools)
  - [Generic PTY](#generic-pty)
  - [OpenCode Native Orchestration](#opencode-native-orchestration)
- [Configuring with AI Assistants](#configuring-with-ai-assistants)

## Features

- **Polyglot Harness Multiplexing:** Drive interactive processes written in any language via standard POSIX pseudo-terminals.
- **Simulated Human Typing:** Inject text, control sequences (`SIGINT`, EOF, Ctrl+C), and raw keystrokes seamlessly into child `stdin`.
- **Predictable Event Interception:** Provide non-blocking regex hooks with timeout guarantees and optional immediate auto-responses.
- **Memory-Bounded Observability:** Maintain dedicated circular buffers per session (default 5,000 lines) with real-time ANSI-stripping for token-efficient LLM context consumption.
- **Strict Asynchrony & Resource Discipline:** Event handling remains purely event-driven using Node.js event emitters and promises; buffer bounds are strictly enforced to prevent memory leaks.

## Installation

### Manual Installation
```bash
# Clone the repository
git clone <your-repo-url>
cd menager

# Install dependencies (requires build-essential/g++ for node-pty native bindings)
npm install

# Build the project
npm run build
```

## Usage

### Starting the Server

The server runs via Stdio transport, intended to be executed directly by MCP clients.

```bash
# Start the server (standard mode)
npm start

# Or run the built file directly
node build/index.js
```

## Available Tools

### Generic PTY

### `session_spawn`
Spawns a new child PTY session.
- **`command`** *(string)*: Target binary or executable (e.g., `bash`, `python3`). **Required.**
- **`args`** *(string[])*: Command line arguments.
- **`cwd`** *(string)*: Working directory path.
- **`env`** *(object)*: Additional environment variables.
- **`maxBufferLines`** *(number)*: Rolling line limit for memory buffers (default 5000).
- **`terminalType`** *(string)*: Terminal emulation type (`"dumb"` or `"xterm-256color"`, default `"xterm-256color"`).
- **`name`** *(string)*: Optional logical name/label for the session.
- **`cols`** *(number)*: Terminal columns (default 80).
- **`rows`** *(number)*: Terminal rows (default 24).

### `session_wait`
Blocks and waits for a session to exit gracefully, returning its final exit code.
- **`sessionId`** *(string)*: Target session ID. **Required.**
- **`timeoutMs`** *(number)*: Optional timeout in milliseconds.

### `session_write`
Injects keystrokes, commands, or escape sequences into the session's standard input.
- **`sessionId`** *(string)*: Target session ID. **Required.**
- **`payload`** *(string)*: String or control character sequence. **Required.**
- **`pressEnter`** *(boolean)*: Append `\n` to the payload (default **false** - *Breaking Change in v4*).
- **`pressKey`** *(string)*: Special key injection (`Ctrl+C`, `Ctrl+D`, `Enter`, `Tab`, `Escape`, `ArrowUp`, `ArrowDown`).

### `session_read`
Reads buffered output from the target session.
- **`sessionId`** *(string)*: Target session ID. **Required.**
- **`tailLines`** *(number)*: Number of trailing lines to retrieve (default 100).
- **`stripAnsi`** *(boolean)*: Return sanitized text without ANSI codes (default true).
- **`clearBuffer`** *(boolean)*: Flush internal buffers after read (default false).
- **`offsetLines`** *(number)*: Read lines starting from this absolute index offset (replaces tailLines).
- **`grepPattern`** *(string)*: Pre-filter buffer lines via Regex string matching.

### `session_hook`
Awaits a specific regex pattern on the session stream with optional automated reply.
- **`sessionId`** *(string)*: Target session ID. **Required.**
- **`pattern`** *(string)*: Regular expression string to observe. **Required.**
- **`timeoutMs`** *(number)*: Milliseconds before timing out (default 30000).
- **`autoResponse`** *(string)*: Optional string to immediately write on match.
- **`triggerPayload`** *(string)*: Write payload *after* hook registers (prevents concurrency deadlock).

### `session_resize`
Resizes the target PTY terminal dimensions.
- **`sessionId`** *(string)*: Target session ID. **Required.**
- **`cols`** *(number)*: Terminal columns. **Required.**
- **`rows`** *(number)*: Terminal rows. **Required.**

### `session_signal`
Sends a POSIX signal to the target session (with recursive process-tree termination).
- **`sessionId`** *(string)*: Target session ID. **Required.**
- **`signal`** *(string)*: Signal to deliver (`SIGINT`, `SIGTERM`, `SIGKILL`). **Required.**

### `session_close`
Force kills the session's process tree and deletes memory buffers immediately.
- **`sessionId`** *(string)*: Target session ID. **Required.**

### `session_prune`
Force deletes sessions to free memory.
- **`status`** *(string)*: Only delete sessions with this status (`"running"` or `"exited"`). Defaults to `"exited"`.

### `session_info`
Returns a single session's live metadata and metrics.
- **`sessionId`** *(string)*: Target session ID. **Required.**

### `session_list`
Lists all active and completed sessions managed by the server. No parameters required.

### OpenCode Native Orchestration

Native `opencode` CLI integration (see [CLI docs](https://opencode.ai/docs/cli/)) for agent routing and multi-session orchestration. Each spawned agent lives in its own PTY session with `meta.kind: "agent"` tracking (`agent`, `model`, `dir`, resolved opencode session id).

| Tool | Maps to | Purpose |
| :--- | :--- | :--- |
| `agent_spawn` | `opencode run "<prompt>" [--agent --model --title --share --attach]` | Spawn an agent run in a managed PTY; returns `sessionId` for routing. |
| `agent_send` | PTY write, or `opencode run --session <id> "<msg>"` (falls back to `--continue`) | Follow-up message to a live or exited agent. |
| `agent_fork` | `opencode run --session <id> --fork "<msg>"` | Branch a session into a new tracked session. |
| `agent_list` | menager tracking + `opencode session list --format json` | List routed agents merged with native sessions. |
| `agent_info` | session metadata + resolved opencode id + output preview | Inspect one agent. |
| `agent_close` | close PTY, optionally `opencode session delete <id>` | Teardown with `deleteOpencodeSession`. |
| `opencode_status` | `opencode --version` + `opencode agent list` | CLI health, defined agents, tracked counts. |
| `agent_create` | `opencode agent create --path --description --mode --permissions --model` | Define new agents for later `agent_spawn`. |
| `opencode_models` | `opencode models [provider] [--refresh] [--verbose]` | Model discovery for `agent_spawn --model`. |
| `opencode_stats` | `opencode stats [--days --tools --models --project]` | Usage/cost observability. |
| `opencode_export` / `opencode_import` | `opencode export [id]` / `import <file>` | Session portability. |
| `opencode_session_delete` | `opencode session delete <id>` | Standalone native delete. |
| `opencode_mcp_list` | `opencode mcp list` | MCP connection health. |
| `opencode_auth_list` | `opencode auth list` | Provider auth names (read-only, no secrets). |
| `opencode_db` | `opencode db [query] [--format]` | Direct db inspection. |
| `opencode_server_spawn` | `opencode serve\|web\|acp [--port --hostname]` in a managed PTY | Warm server for `agent_spawn --attach`. |

Deliberately excluded: `tui` (interactive), `auth login/logout` (interactive secrets), `upgrade`/`uninstall` (host-destructive), `github`/`plugin`/`pr` (repo admin — run directly).

Set a custom binary via `OPENCODE_BIN` env (default `opencode`). Prompts are capped at 8000 chars; `agent`/`model` values are strictly validated (`agent` alphanumerics, `model` as `provider/model`); all subprocesses spawn with `shell: false` (no shell injection).

## HeLa session quotas & run linkage (P0-B4, all opt-in overrides)

| Variable | Default | Meaning |
|----------|---------|---------|
| `HELA_RIBOSOME_MAX_SESSIONS` | `20` | Max live sessions; `spawn` throws `session quota exceeded` past it |
| `HELA_RIBOSOME_DEFAULT_TTL_MS` | `1800000` (30m) | Idle TTL for new sessions |
| `HELA_RIBOSOME_MAX_TTL_MS` | `14400000` (4h) | TTL is clamped to this ceiling |
| `HELA_RIBOSOME_MAX_BUFFER_LINES` | `5000` | Session output buffer cap |

`session_spawn`/`agent_spawn` accept optional `run_id`/`step_id` linking the session to a Mitosis RunStore run; the ids are also inherited from `HELA_RUN_ID`/`HELA_STEP_ID` env and propagated to child processes. `linkRun` attaches a run id to an existing session.

## Configuring with AI Assistants

### Configuring with Roo Code or Cline

1. Open the MCP settings file (usually `cline_mcp_settings.json` or `config.json`).
2. Add the following configuration for standard stdio mode:

```json
{
  "mcpServers": {
    "menager-mcp": {
      "command": "node",
      "args": ["/path/to/menager-mcp/build/index.js"],
      "env": {}
    }
  }
}
```

### Configuring with Claude Desktop

1. Open `claude_desktop_config.json`.
2. Add the following configuration:

```json
{
  "mcpServers": {
    "menager-mcp": {
      "command": "node",
      "args": ["/path/to/menager-mcp/build/index.js"],
      "env": {}
    }
  }
}
```
