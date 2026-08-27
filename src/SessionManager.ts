import * as pty from 'node-pty';
import stripAnsi from 'strip-ansi';
import crypto from 'crypto';

export interface SessionInfo {
  sessionId: string;
  pid: number;
  command: string;
  args: string[];
  status: 'running' | 'exited';
  exitCode: number | null;
  createdAt: string;
}

interface SessionHook {
  pattern: RegExp;
  resolve: (chunk: string) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
  autoResponse?: string;
}

export class Session {
  public id: string;
  public ptyProcess: pty.IPty;
  public maxBufferLines: number;
  public status: 'running' | 'exited' = 'running';
  public exitCode: number | null = null;
  public createdAt: string;

  private rawLines: string[] = [''];
  private cleanLines: string[] = [''];
  private hooks: Set<SessionHook> = new Set();
  private waitPromises: Array<{resolve: (code: number | null) => void, reject: (err: Error) => void, timeout?: NodeJS.Timeout}> = [];

  constructor(
    public command: string,
    public args: string[],
    cwd: string,
    env: Record<string, string>,
    maxBufferLines: number = 5000,
    terminalType: string = 'xterm-256color'
  ) {
    this.id = crypto.randomBytes(4).toString('hex');
    this.maxBufferLines = maxBufferLines;
    this.createdAt = new Date().toISOString();

    this.ptyProcess = pty.spawn(command, args, {
      name: terminalType,
      cols: 80,
      rows: 24,
      cwd: cwd,
      env: { ...process.env, ...env }
    });

    this.ptyProcess.onData((data) => this.handleData(data));
    this.ptyProcess.onExit((event) => {
      this.status = 'exited';
      this.exitCode = event.exitCode;
      this.cleanupHooks(new Error('Session exited'));
      this.waitPromises.forEach(p => {
        if (p.timeout) clearTimeout(p.timeout);
        p.resolve(event.exitCode);
      });
      this.waitPromises = [];
    });
  }

  private handleData(data: string) {
    const cleanData = stripAnsi(data);

    this.appendDataToLines(this.rawLines, data);
    this.appendDataToLines(this.cleanLines, cleanData);

    for (const hook of this.hooks) {
      if (hook.pattern.test(cleanData)) {
        clearTimeout(hook.timeout);
        this.hooks.delete(hook);
        if (hook.autoResponse) {
          this.write(hook.autoResponse, true);
        }
        hook.resolve(cleanData);
      }
    }
  }

  private appendDataToLines(lines: string[], data: string) {
    const chunks = data.split('\r\n').join('\n').split('\n');
    lines[lines.length - 1] += chunks[0];
    for (let i = 1; i < chunks.length; i++) {
      lines.push(chunks[i]);
    }
    while (lines.length > this.maxBufferLines) {
      lines.shift();
    }
  }

  private cleanupHooks(err: Error) {
    for (const hook of this.hooks) {
      clearTimeout(hook.timeout);
      hook.reject(err);
    }
    this.hooks.clear();
  }

  public write(payload: string, pressEnter: boolean = true) {
    const data = pressEnter ? payload + '\n' : payload;
    this.ptyProcess.write(data);
    return data.length;
  }

  public read(tailLines: number = 100, clean: boolean = true, clearBuffer: boolean = false): string {
    const targetBuffer = clean ? this.cleanLines : this.rawLines;
    const lines = targetBuffer.slice(-tailLines);
    
    if (clearBuffer) {
      this.rawLines = [''];
      this.cleanLines = [''];
    }

    return lines.join('\n');
  }

  public hook(pattern: RegExp, timeoutMs: number, autoResponse?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let hookObj: SessionHook | undefined;

      const timeout = setTimeout(() => {
        if (hookObj) {
          this.hooks.delete(hookObj);
        }
        reject(new Error(`Hook timeout after ${timeoutMs}ms for pattern: ${pattern}`));
      }, timeoutMs);

      hookObj = {
        pattern,
        resolve,
        reject,
        timeout,
        autoResponse
      };

      this.hooks.add(hookObj);
    });
  }

  public signal(signal: 'SIGINT' | 'SIGTERM' | 'SIGKILL') {
    this.ptyProcess.kill(signal);
  }

  public wait(timeoutMs?: number): Promise<number | null> {
    if (this.status === 'exited') {
      return Promise.resolve(this.exitCode);
    }
    return new Promise((resolve, reject) => {
      let timeout: NodeJS.Timeout | undefined;
      if (timeoutMs) {
        timeout = setTimeout(() => {
          this.waitPromises = this.waitPromises.filter(p => p.resolve !== resolve);
          reject(new Error(`Wait timeout after ${timeoutMs}ms for session ${this.id}`));
        }, timeoutMs);
      }
      this.waitPromises.push({ resolve, reject, timeout });
    });
  }

  public getInfo(): SessionInfo {
    return {
      sessionId: this.id,
      pid: this.ptyProcess.pid,
      command: this.command,
      args: this.args,
      status: this.status,
      exitCode: this.exitCode,
      createdAt: this.createdAt
    };
  }
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();

  public spawn(command: string, args: string[] = [], cwd: string = process.cwd(), env: Record<string, string> = {}, maxBufferLines: number = 5000, terminalType: string = 'xterm-256color'): SessionInfo {
    const session = new Session(command, args, cwd, env, maxBufferLines, terminalType);
    this.sessions.set(session.id, session);
    return session.getInfo();
  }

  public getSession(id: string): Session {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }
    return session;
  }

  public listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).map(s => s.getInfo());
  }

  public shutdown() {
    for (const session of this.sessions.values()) {
      if (session.status === 'running') {
        session.signal('SIGTERM');
      }
    }
  }
}
