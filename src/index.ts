#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from "@modelcontextprotocol/sdk/types.js";
import { SessionManager } from "./SessionManager.js";

const sessionManager = new SessionManager();

const server = new Server(
  {
    name: "menager",
    version: "1.0.0",
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
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "session_spawn": {
        const { command, args: cmdArgs = [], cwd = process.cwd(), env = {}, maxBufferLines = 5000, terminalType = 'xterm-256color', name, cols, rows, ttlMs } = args as any;
        try {
          const info = sessionManager.spawn(command, cmdArgs, cwd, env, maxBufferLines, terminalType, name, cols, rows, ttlMs);
          return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
        } catch (e: any) {
          return { isError: true, content: [{ type: "text", text: e.message }] };
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
          return { isError: true, content: [{ type: "text", text: e.message }] };
        }
      }
      case "session_write": {
        const { sessionId, payload, pressEnter = false, pressKey } = args as any;
        const session = sessionManager.getSession(sessionId);
        const bytes = session.write(payload, pressEnter, pressKey);
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
          return { isError: true, content: [{ type: "text", text: `Invalid regex: ${e.message}` }] };
        }
        try {
          const matchedChunk = await session.hook(regex, timeoutMs, autoResponse, triggerPayload);
          return { content: [{ type: "text", text: JSON.stringify({ matched: true, matchedChunk, autoResponded: !!autoResponse }, null, 2) }] };
        } catch (e: any) {
          return { isError: true, content: [{ type: "text", text: e.message }] };
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
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: "text", text: error.message || String(error) }],
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
