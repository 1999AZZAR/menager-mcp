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
        terminalType: { type: "string", description: "Set to 'dumb' to avoid TUI/cursor artifacts, or 'xterm-256color' for standard colors." }
      },
      required: ["command"]
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
        pressEnter: { type: "boolean" }
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
        clearBuffer: { type: "boolean" }
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
        autoResponse: { type: "string" }
      },
      required: ["sessionId", "pattern"]
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
        const { command, args: cmdArgs = [], cwd = process.cwd(), env = {}, maxBufferLines = 5000, terminalType = 'xterm-256color' } = args as any;
        const info = sessionManager.spawn(command, cmdArgs, cwd, env, maxBufferLines, terminalType);
        return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
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
        const { sessionId, payload, pressEnter = true } = args as any;
        const session = sessionManager.getSession(sessionId);
        const bytesWritten = session.write(payload, pressEnter);
        return { content: [{ type: "text", text: JSON.stringify({ sessionId, bytesWritten }, null, 2) }] };
      }
      case "session_read": {
        const { sessionId, tailLines = 100, stripAnsi = true, clearBuffer = false } = args as any;
        const session = sessionManager.getSession(sessionId);
        const data = session.read(tailLines, stripAnsi, clearBuffer);
        return { content: [{ type: "text", text: data }] };
      }
      case "session_hook": {
        const { sessionId, pattern, timeoutMs = 30000, autoResponse } = args as any;
        const session = sessionManager.getSession(sessionId);
        try {
          const matchedChunk = await session.hook(new RegExp(pattern), timeoutMs, autoResponse);
          return { content: [{ type: "text", text: JSON.stringify({ matched: true, matchedChunk, autoResponded: !!autoResponse }, null, 2) }] };
        } catch (e: any) {
          return { isError: true, content: [{ type: "text", text: e.message }] };
        }
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
