#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from "@modelcontextprotocol/sdk/types.js";
import { spawnSync } from "node:child_process";
import { SessionManager } from "./SessionManager.js";

const sessionManager = new SessionManager();

const OPENCODE_BIN = (() => {
  const raw = (process.env.OPENCODE_BIN || "opencode").trim();
  if (/^[a-zA-Z0-9._\/-]{1,256}$/.test(raw) && !raw.includes("..")) return raw;
  return "opencode";
})();

const AGENT_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const MODEL_RE = /^[^/\s]+\/[^/\s]{1,128}$/;
const MAX_PROMPT = 8000;

function assertPrompt(v: unknown): string {
  if (typeof v !== "string" || !v.trim()) throw new Error("prompt/message must be a non-empty string");
  if (v.length > MAX_PROMPT) throw new Error(`prompt exceeds ${MAX_PROMPT} chars`);
  return v;
}

function assertAgent(v: unknown): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== "string" || !AGENT_RE.test(v)) throw new Error("agent must match [a-zA-Z0-9_-]{1,64}");
  return v;
}

function assertModel(v: unknown): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== "string" || !MODEL_RE.test(v)) throw new Error("model must be provider/model");
  return v;
}

function buildRunArgs(o: { message: string; session?: string; fork?: boolean; share?: boolean; model?: string; agent?: string; format?: string; title?: string; attach?: string }): string[] {
  const a = ["run", o.message];
  if (o.session) { a.push("--session", o.session); }
  if (o.fork) {
    if (!o.session) throw new Error("fork requires session");
    a.push("--fork");
  }
  if (o.share) a.push("--share");
  if (o.model) a.push("--model", o.model);
  if (o.agent) a.push("--agent", o.agent);
  if (o.format === "json") a.push("--format", "json");
  if (o.title) a.push("--title", o.title.slice(0, 120));
  if (o.attach) a.push("--attach", o.attach);
  return a;
}

function runOpencodeSync(args: string[], cwd?: string, timeoutMs = 15000): { ok: boolean; stdout: string; stderr: string; error?: string } {
  try {
    const r = spawnSync(OPENCODE_BIN, args, { cwd: cwd || process.cwd(), timeout: timeoutMs, encoding: "utf-8", shell: false, maxBuffer: 2 * 1024 * 1024 });
    return { ok: r.status === 0, stdout: String(r.stdout || ""), stderr: String(r.stderr || ""), error: r.error ? String(r.error) : undefined };
  } catch (e: any) {
    return { ok: false, stdout: "", stderr: "", error: e?.message || String(e) };
  }
}

const server = new Server(
  {
    name: "menager-mcp",
    version: "1.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const TOOLS: Tool[] = [
  {
    name: "session_spawn",
    description: "Spawns a new child PTY session.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string" },
        args: { type: "array", items: { type: "string" } },
        cwd: { type: "string" },
        env: { type: "object", additionalProperties: { type: "string" } },
        maxBufferLines: { type: "number" },
        terminalType: { type: "string", description: "Set to 'dumb' to avoid TUI/cursor artifacts, or 'xterm-256color' for standard colors." },
        name: { type: "string", description: "Optional logical name for this session" },
        cols: { type: "number", description: "Terminal columns (default 80)" },
        rows: { type: "number", description: "Terminal rows (default 24)" },
        ttlMs: { type: "number", description: "Optional Time-To-Live in milliseconds. Auto-closes session after it exits." }
      },
      required: ["command"]
    }
  },
  {
    name: "session_resize",
    description: "Resizes the PTY terminal dimensions.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        cols: { type: "number" },
        rows: { type: "number" }
      },
      required: ["sessionId", "cols", "rows"]
    }
  },
  {
    name: "session_wait",
    description: "Blocks and waits for a session to exit, returning its exit code.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        timeoutMs: { type: "number", description: "Optional timeout in milliseconds" }
      },
      required: ["sessionId"]
    }
  },
  {
    name: "session_write",
    description: "Injects keystrokes, commands, or escape sequences into the session's standard input.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        payload: { type: "string" },
        pressEnter: { type: "boolean" },
        pressKey: { type: "string", description: "Optional special key (Ctrl+C, Ctrl+D, Enter, Tab, Escape, ArrowUp, ArrowDown)" }
      },
      required: ["sessionId", "payload"]
    }
  },
  {
    name: "session_read",
    description: "Reads buffered output from the target session.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        tailLines: { type: "number" },
        stripAnsi: { type: "boolean" },
        clearBuffer: { type: "boolean" },
        offsetLines: { type: "number", description: "Read lines starting from this index" },
        grepPattern: { type: "string", description: "Filter read lines by regex pattern" }
      },
      required: ["sessionId"]
    }
  },
  {
    name: "session_hook",
    description: "Awaits a specific regex pattern on the session stream with optional automated reply.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        pattern: { type: "string" },
        timeoutMs: { type: "number" },
        autoResponse: { type: "string" },
        triggerPayload: { type: "string", description: "Optional payload to write AFTER registering the hook to avoid concurrency deadlocks" }
      },
      required: ["sessionId", "pattern"]
    }
  },
  {
    name: "session_close",
    description: "Kills and removes a session, freeing its memory.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" }
      },
      required: ["sessionId"]
    }
  },
  {
    name: "session_signal",
    description: "Sends a POSIX signal to the target session process.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        signal: { type: "string", enum: ["SIGINT", "SIGTERM", "SIGKILL"] }
      },
      required: ["sessionId", "signal"]
    }
  },
  {
    name: "session_info",
    description: "Returns metadata and status for a specific session.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" }
      },
      required: ["sessionId"]
    }
  },
  {
    name: "session_prune",
    description: "Force deletes sessions (default: only 'exited' sessions).",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["running", "exited"] }
      }
    }
  },
  {
    name: "session_list",
    description: "Lists all active and completed sessions managed by the server.",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "agent_spawn",
    description: "Spawn an opencode agent run (opencode run) inside a managed PTY. Native multi-agent orchestration: each agent gets its own sessionId for routing follow-ups via agent_send/agent_fork.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Initial prompt for the agent (max 8000 chars)" },
        agent: { type: "string", description: "opencode agent name (e.g. build, plan)" },
        model: { type: "string", description: "provider/model (e.g. opencode/muse-spark-1.3-free)" },
        cwd: { type: "string", description: "Working directory for the agent run" },
        title: { type: "string", description: "Session title" },
        format: { type: "string", enum: ["default", "json"], description: "opencode output format" },
        share: { type: "boolean", description: "Share the opencode session" },
        attach: { type: "string", description: "Attach to a running opencode server URL" },
        name: { type: "string", description: "Logical name for routing" },
        cols: { type: "number" },
        rows: { type: "number" }
      },
      required: ["prompt"]
    }
  },
  {
    name: "agent_send",
    description: "Send a follow-up message to an agent session. Writes into the running PTY, or resumes via opencode run --session when the PTY already exited.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        message: { type: "string" }
      },
      required: ["sessionId", "message"]
    }
  },
  {
    name: "agent_fork",
    description: "Fork an agent session (opencode run --session <id> --fork) into a new tracked branch session.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        message: { type: "string" },
        name: { type: "string" }
      },
      required: ["sessionId", "message"]
    }
  },
  {
    name: "agent_list",
    description: "List menager agent sessions, optionally merged with live opencode session list.",
    inputSchema: {
      type: "object",
      properties: {
        includeOpencode: { type: "boolean", description: "Merge opencode session list (default true)" },
        maxCount: { type: "number", description: "Max opencode sessions to fetch (default 20, max 50)" }
      },
      required: []
    }
  },
  {
    name: "agent_info",
    description: "Inspect an agent session: metadata, resolved opencode session id, and output preview.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        tailLines: { type: "number", description: "Preview lines (default 20, max 100)" }
      },
      required: ["sessionId"]
    }
  },
  {
    name: "agent_close",
    description: "Close a tracked agent session, optionally also deleting the opencode session.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        deleteOpencodeSession: { type: "boolean", description: "Also run opencode session delete" }
      },
      required: ["sessionId"]
    }
  },
  {
    name: "opencode_status",
    description: "Check opencode CLI availability, version, defined agents, and tracked session counts.",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  console.error(`[MCP] Tool: ${name} | Session: ${args?.sessionId || 'N/A'}`);

  try {
    switch (name) {
      case "session_spawn": {
        const { command, args: cmdArgs = [], cwd = process.cwd(), env = {}, maxBufferLines = 5000, terminalType = 'xterm-256color', name, cols, rows, ttlMs } = args as any;
        try {
          const info = sessionManager.spawn(command, cmdArgs, cwd, env, maxBufferLines, terminalType, name, cols, rows, ttlMs);
          return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
        } catch (e: any) {
          return { isError: true, content: [{ type: "text", text: JSON.stringify({ error: e.message || String(e) }) }] };
        }
      }
      case "session_resize": {
        const { sessionId, cols, rows } = args as any;
        const session = sessionManager.getSession(sessionId);
        session.resize(cols, rows);
        return { content: [{ type: "text", text: JSON.stringify({ sessionId, cols, rows }, null, 2) }] };
      }
      case "session_wait": {
        const { sessionId, timeoutMs } = args as any;
        const session = sessionManager.getSession(sessionId);
        try {
          const exitCode = await session.wait(timeoutMs);
          return { content: [{ type: "text", text: JSON.stringify({ sessionId, exitCode }, null, 2) }] };
        } catch (e: any) {
          return { isError: true, content: [{ type: "text", text: JSON.stringify({ error: e.message || String(e) }) }] };
        }
      }
      case "session_write": {
        const { sessionId, payload, pressEnter = false, pressKey } = args as any;
        const session = sessionManager.getSession(sessionId);
        const bytes = await session.write(payload, pressEnter, pressKey);
        return { content: [{ type: "text", text: JSON.stringify({ sessionId, bytesWritten: bytes }, null, 2) }] };
      }
      case "session_read": {
        const { sessionId, tailLines = 100, stripAnsi = true, clearBuffer = false, offsetLines, grepPattern } = args as any;
        const session = sessionManager.getSession(sessionId);
        const data = session.getLines(tailLines, stripAnsi, clearBuffer, offsetLines, grepPattern);
        return { content: [{ type: "text", text: data }] };
      }
      case "session_info": {
        const { sessionId } = args as any;
        const session = sessionManager.getSession(sessionId);
        return { content: [{ type: "text", text: JSON.stringify(session.getInfo(), null, 2) }] };
      }
      case "session_prune": {
        const { status = "exited" } = args as any;
        const count = sessionManager.prune(status);
        return { content: [{ type: "text", text: JSON.stringify({ prunedCount: count }, null, 2) }] };
      }
      case "session_hook": {
        const { sessionId, pattern, timeoutMs = 30000, autoResponse, triggerPayload } = args as any;
        const session = sessionManager.getSession(sessionId);
        let regex: RegExp;
        try {
          regex = new RegExp(pattern);
        } catch (e: any) {
          return { isError: true, content: [{ type: "text", text: JSON.stringify({ error: `Invalid regex: ${e.message}` }) }] };
        }
        try {
          const matchedChunk = await session.hook(regex, timeoutMs, autoResponse, triggerPayload);
          return { content: [{ type: "text", text: JSON.stringify({ matched: true, matchedChunk, autoResponded: !!autoResponse }, null, 2) }] };
        } catch (e: any) {
          return { isError: true, content: [{ type: "text", text: JSON.stringify({ error: e.message || String(e) }) }] };
        }
      }
      case "session_close": {
        const { sessionId } = args as any;
        sessionManager.closeSession(sessionId);
        return { content: [{ type: "text", text: JSON.stringify({ sessionId, closed: true }, null, 2) }] };
      }
      case "session_signal": {
        const { sessionId, signal } = args as any;
        const session = sessionManager.getSession(sessionId);
        session.signal(signal);
        return { content: [{ type: "text", text: JSON.stringify({ sessionId, signaled: signal }, null, 2) }] };
      }
      case "session_list": {
        const list = sessionManager.listSessions();
        return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] };
      }
      case "agent_spawn": {
        const { prompt: rawPrompt, agent: rawAgent, model: rawModel, cwd = process.cwd(), title, format, share, attach, name, cols, rows } = args as any;
        const prompt = assertPrompt(rawPrompt);
        const agent = assertAgent(rawAgent);
        const model = assertModel(rawModel);
        const fmt = format === "json" ? "json" : undefined;
        const runArgs = buildRunArgs({ message: prompt, model, agent, format: fmt, title: typeof title === "string" ? title : undefined, share: share === true, attach: typeof attach === "string" ? attach : undefined });
        const info = sessionManager.spawn(OPENCODE_BIN, runArgs, cwd, {}, 5000, "xterm-256color", name, cols, rows, undefined, {
          kind: "agent", agent, model, dir: cwd,
          title: typeof title === "string" ? title.slice(0, 120) : undefined,
          promptPreview: prompt.slice(0, 200)
        });
        return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
      }
      case "agent_send": {
        const { sessionId, message: rawMessage } = args as any;
        const message = assertPrompt(rawMessage);
        const session = sessionManager.getSession(sessionId);
        if (session.status === "running") {
          const bytes = await session.write(message, true);
          return { content: [{ type: "text", text: JSON.stringify({ sessionId, delivered: true, via: "pty-write", bytesWritten: bytes }, null, 2) }] };
        }
        const opencodeId = session.meta.opencodeSessionId || session.resolveOpencodeSessionId();
        const runArgs = buildRunArgs({ message, session: opencodeId || undefined, model: session.meta.model, agent: session.meta.agent, format: undefined });
        if (!opencodeId) runArgs.splice(1, 0, "--continue");
        const info = sessionManager.spawn(OPENCODE_BIN, runArgs, session.meta.dir || process.cwd(), {}, 5000, "xterm-256color", session.name, undefined, undefined, undefined, {
          kind: "agent", agent: session.meta.agent, model: session.meta.model, dir: session.meta.dir,
          promptPreview: message.slice(0, 200), parentSessionId: sessionId, opencodeSessionId: opencodeId
        });
        return { content: [{ type: "text", text: JSON.stringify({ resumed: true, via: opencodeId ? "opencode-session" : "opencode-continue", previousSessionId: sessionId, next: info }, null, 2) }] };
      }
      case "agent_fork": {
        const { sessionId, message: rawMessage, name } = args as any;
        const message = assertPrompt(rawMessage);
        const session = sessionManager.getSession(sessionId);
        const opencodeId = session.meta.opencodeSessionId || session.resolveOpencodeSessionId();
        if (!opencodeId) throw new Error("cannot fork: no opencode session id resolved yet (agent may still be starting; use agent_info to check, then retry)");
        const runArgs = buildRunArgs({ message, session: opencodeId, fork: true, model: session.meta.model, agent: session.meta.agent });
        const info = sessionManager.spawn(OPENCODE_BIN, runArgs, session.meta.dir || process.cwd(), {}, 5000, "xterm-256color", typeof name === "string" ? name : undefined, undefined, undefined, undefined, {
          kind: "agent", agent: session.meta.agent, model: session.meta.model, dir: session.meta.dir,
          promptPreview: message.slice(0, 200), parentSessionId: sessionId, opencodeSessionId: opencodeId
        });
        return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
      }
      case "agent_list": {
        const { includeOpencode = true, maxCount = 20 } = args as any;
        const tracked = sessionManager.listSessions().filter((s: any) => s.meta?.kind === "agent");
        if (!includeOpencode) return { content: [{ type: "text", text: JSON.stringify({ tracked }, null, 2) }] };
        const n = Math.min(Math.max(Number(maxCount) || 20, 1), 50);
        const r = runOpencodeSync(["session", "list", "--format", "json", "-n", String(n)]);
        if (!r.ok) return { content: [{ type: "text", text: JSON.stringify({ tracked, opencodeListWarning: (r.stderr || r.error || "session list failed").slice(0, 300) }, null, 2) }] };
        let sessions: unknown = [];
        try { sessions = JSON.parse(r.stdout || "[]"); } catch { sessions = []; }
        return { content: [{ type: "text", text: JSON.stringify({ tracked, opencode: sessions }, null, 2) }] };
      }
      case "agent_info": {
        const { sessionId, tailLines = 20 } = args as any;
        const session = sessionManager.getSession(sessionId);
        const n = Math.min(Math.max(Number(tailLines) || 20, 1), 100);
        const resolved = session.meta.opencodeSessionId || session.resolveOpencodeSessionId();
        if (resolved && !session.meta.opencodeSessionId) sessionManager.setMeta(sessionId, { opencodeSessionId: resolved });
        return { content: [{ type: "text", text: JSON.stringify({ ...session.getInfo(), resolvedOpencodeSessionId: resolved, preview: session.getLines(n, true) }, null, 2) }] };
      }
      case "agent_close": {
        const { sessionId, deleteOpencodeSession = false } = args as any;
        let session: any = null;
        try { session = sessionManager.getSession(sessionId); } catch { session = null; }
        const opencodeId = session?.meta?.opencodeSessionId || session?.resolveOpencodeSessionId?.() || null;
        sessionManager.closeSession(sessionId);
        if (deleteOpencodeSession && opencodeId) {
          const r = runOpencodeSync(["session", "delete", opencodeId]);
          return { content: [{ type: "text", text: JSON.stringify({ sessionId, closed: true, opencodeDeleted: r.ok, opencodeSessionId: opencodeId }, null, 2) }] };
        }
        return { content: [{ type: "text", text: JSON.stringify({ sessionId, closed: true, opencodeSessionId: opencodeId }, null, 2) }] };
      }
      case "opencode_status": {
        const ver = runOpencodeSync(["--version"], undefined, 10000);
        const agents = runOpencodeSync(["agent", "list"], undefined, 10000);
        const tracked = sessionManager.listSessions();
        const agentSessions = tracked.filter((s: any) => s.meta?.kind === "agent");
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              bin: OPENCODE_BIN,
              available: ver.ok,
              version: (ver.stdout || ver.stderr || "").trim().slice(0, 100),
              agentsOutput: (agents.stdout || agents.stderr || "").slice(0, 2000),
              trackedSessions: tracked.length,
              trackedAgents: agentSessions.length,
              runningAgents: agentSessions.filter((s: any) => s.status === "running").length
            }, null, 2)
          }]
        };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: "text", text: JSON.stringify({ error: error.message || String(error) }) }],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("menager MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

process.on("SIGINT", () => {
  sessionManager.shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  sessionManager.shutdown();
  process.exit(0);
});
