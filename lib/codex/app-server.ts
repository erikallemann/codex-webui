import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { resolveCodexBinary } from "./binary";

type RpcId = number | string;
type RpcMessage = Record<string, unknown> & { id?: RpcId; method?: string; params?: unknown };

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export class AppServerConnection {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<RpcId, PendingRequest>();
  private readonly messages: RpcMessage[] = [];
  private waiter: ((value: IteratorResult<RpcMessage>) => void) | null = null;
  private nextId = 1;
  private done = false;
  private stderrBuffer = "";

  constructor(cwd: string, signal: AbortSignal) {
    const bin = resolveCodexBinary();
    this.child = spawn(bin.command, [...bin.argvPrefix, "app-server"], {
      cwd,
      env: sanitizedEnv(),
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
    });

    const lines = createInterface({ input: this.child.stdout, crlfDelay: Infinity });
    lines.on("line", (line) => this.receive(line));
    this.child.stderr.on("data", (chunk: Buffer) => {
      this.stderrBuffer += chunk.toString("utf8");
    });
    this.child.on("error", (error) => this.finish(error));
    this.child.stdin.on("error", (error) => this.finish(error));
    this.child.on("close", () => this.finish());

    const abort = () => this.kill();
    signal.addEventListener("abort", abort, { once: true });
    this.child.once("close", () => signal.removeEventListener("abort", abort));
  }

  async initialize(): Promise<void> {
    await this.request("initialize", {
      clientInfo: { name: "codex-webui", title: "Codex Web UI", version: "0.1.1" },
      capabilities: { experimentalApi: true, requestAttestation: false },
    });
    this.notify("initialized");
  }

  request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    const result = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.write({ method, id, params });
    return result;
  }

  notify(method: string, params?: unknown): void {
    this.write(params === undefined ? { method } : { method, params });
  }

  respond(id: RpcId, result: unknown): void {
    this.write({ id, result });
  }

  async *events(): AsyncIterable<RpcMessage> {
    while (true) {
      if (this.messages.length > 0) {
        yield this.messages.shift()!;
        continue;
      }
      if (this.done) return;
      const next = await new Promise<IteratorResult<RpcMessage>>((resolve) => {
        this.waiter = resolve;
      });
      this.waiter = null;
      if (next.done) return;
      yield next.value;
    }
  }

  kill(): void {
    if (!this.child.killed) this.child.kill();
  }

  stderr(): string {
    return this.stderrBuffer;
  }

  private write(message: RpcMessage): void {
    if (this.done || !this.child.stdin.writable) {
      throw new Error("Codex app-server connection is closed");
    }
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private receive(line: string): void {
    let message: RpcMessage;
    try {
      message = JSON.parse(line) as RpcMessage;
    } catch {
      return;
    }

    if (message.id !== undefined && !message.method && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id)!;
      this.pending.delete(message.id);
      const error = message.error as { message?: string } | undefined;
      if (error) pending.reject(new Error(error.message ?? "app-server request failed"));
      else pending.resolve(message.result);
      return;
    }

    if (this.waiter) {
      const waiter = this.waiter;
      this.waiter = null;
      waiter({ value: message, done: false });
    } else {
      this.messages.push(message);
    }
  }

  private finish(processError?: Error): void {
    if (this.done) return;
    this.done = true;
    const error = processError ?? new Error(this.stderrBuffer.trim() || "Codex app-server exited");
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
    this.waiter?.({ value: undefined, done: true });
  }
}

function sanitizedEnv(): NodeJS.ProcessEnv {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined || key.toLowerCase() === "path") continue;
    env[key] = value;
  }
  env.PATH = process.env.PATH ?? process.env.Path ?? "";
  env.NO_COLOR = "1";
  env.CLICOLOR = "0";
  env.FORCE_COLOR = "0";
  return env as NodeJS.ProcessEnv;
}
