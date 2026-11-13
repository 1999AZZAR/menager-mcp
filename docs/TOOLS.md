# HeLa Ribosome: canonical tools

Server version **3.0.0**. Generated from the ecosystem schema catalog; regenerate with `npm run docs:generate -- --servers` in the ecosystem checkout.

Only names advertised by `tools/list` are listed here. Older aliases in migration examples are not additional tools. Runtime namespace prefixes are optional and do not change these server-local names.

## `agent_close`

Close a tracked agent session, optionally also deleting the opencode session.

## `agent_create`

Create a new opencode agent file (opencode agent create --path --description --mode --permissions --model). Non-interactive when all of path/description/mode/permissions are given.

## `agent_fork`

Fork an agent session (opencode run --session <id> --fork) into a new tracked branch session.

## `agent_info`

Inspect an agent session: metadata, resolved opencode session id, and output preview.

## `agent_list`

List menager agent sessions, optionally merged with live opencode session list.

## `agent_send`

Send a follow-up message to an agent session. Writes into the running PTY, or resumes via opencode run --session when the PTY already exited.

## `agent_spawn`

Spawn an opencode agent run (opencode run) inside a managed PTY. Native multi-agent orchestration: each agent gets its own sessionId for routing follow-ups via agent_send/agent_fork.

## `opencode_auth_list`

List authenticated providers (opencode auth list). Read-only; names only, no secrets.

## `opencode_db`

Restricted to OpenCode session database inspection; use hela-genome execute_sql/query_data for the HeLa memory graph. Query the opencode database (opencode db [query]). Read with no query prints the db path context.

## `opencode_export`

Export opencode session data as JSON (opencode export [sessionID]).

## `opencode_import`

Import opencode session data from a JSON file (opencode import <file>).

## `opencode_mcp_list`

List configured MCP servers and connection status (opencode mcp list). OpenCode subprocesses use the login home rather than the cell's isolated HOME, so they connect to the existing managed service instead of trying to bind its port again.

## `opencode_models`

List available models (opencode models [provider] [--refresh] [--verbose]).

## `opencode_server_spawn`

Spawn a long-running opencode server (serve|web|acp) in a managed PTY so agent_spawn --attach has a warm target and avoids MCP cold boot.

## `opencode_session_delete`

Delete an opencode session (opencode session delete <sessionID>). Standalone; agent_close also offers this.

## `opencode_stats`

Token usage and cost statistics (opencode stats). `topTools` and `topModels` enable the corresponding sections; their values become a single `--limit` row count. `days=0` means today.

## `opencode_status`

Check opencode CLI availability, version, defined agents, and tracked session counts.

## `session_close`

Kills and removes an interactive PTY session managed by this server, freeing its memory.

## `session_hook`

Awaits a specific regex pattern on the session stream with optional automated reply.

## `session_info`

Returns metadata and status for a specific session.

## `session_list`

Lists all active and completed interactive PTY sessions managed by this server.

## `session_prune`

Force deletes sessions (default: only 'exited' sessions).

## `session_read`

Reads buffered output from the target session.

## `session_resize`

Resizes the PTY terminal dimensions.

## `session_signal`

Sends a POSIX signal to the target session process.

## `session_spawn`

Spawns a new child PTY session.

## `session_wait`

Blocks and waits for a session to exit, returning its exit code.

## `session_write`

Injects keystrokes, commands, or escape sequences into the session's standard input.
