import { spawn as Spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash as CreateHash } from 'node:crypto';
import { Pack } from './Pack';

export const Protocol = { Name: 'CarbonLuau.Tooling', Major: 1, Minor: 0 };
const MaxFrame = 8 * 1024 * 1024;
function ParseFrame(Text: string): unknown {
  const Stack: { Object: boolean; Keys: Set<string>; Key: boolean }[] = [];
  for (const Match of Text.matchAll(/"(?:\\.|[^"\\])*"|[{}[\],:]/g)) {
    const Token = Match[0], Current = Stack.at(-1);
    if (Token === '{' || Token === '[') {
      if (Stack.length >= 32) throw new Error('Tooling JSON exceeds its depth bound.');
      Stack.push({ Object: Token === '{', Keys: new Set(), Key: true });
    } else if (Token === '}' || Token === ']') Stack.pop();
    else if (Token === ',' && Current?.Object) Current.Key = true;
    else if (Token.startsWith('"') && Current?.Object && Current.Key) {
      const Name = JSON.parse(Token) as string;
      if (Current.Keys.has(Name)) throw new Error('Duplicate tooling JSON property.');
      Current.Keys.add(Name); Current.Key = false;
    }
  }
  return JSON.parse(Text);
}

export function Canonical(Value: unknown): unknown {
  if (Array.isArray(Value)) return Value.map(Canonical);
  if (Value !== null && typeof Value === 'object') return Object.fromEntries(Object.entries(Value).sort(([Left], [Right]) => Left < Right ? -1 : Left > Right ? 1 : 0).map(([Key, Item]) => [Key, Canonical(Item)]));
  return Value;
}
export function Revision(Params: unknown, Api: string, PackVersion: string): string {
  return 'sha256:' + CreateHash('sha256').update(JSON.stringify(Canonical(Params)) + '\n' + Api + '\n' + PackVersion).digest('hex');
}
export class FrameReader {
  private Buffer: Buffer = Buffer.alloc(0);
  Push(Chunk: Buffer): unknown[] {
    if (this.Buffer.length + Chunk.length > MaxFrame + 4096) throw new Error('Tooling output exceeds its bound.');
    this.Buffer = Buffer.concat([this.Buffer, Chunk]);
    const Results: unknown[] = [];
    while (this.Buffer.length > 0) {
      const End = this.Buffer.indexOf('\r\n\r\n');
      if (End < 0) { if (this.Buffer.length > 4096) throw new Error('Oversized tooling header.'); break; }
      if (End > 4092) throw new Error('Oversized tooling header.');
      if (this.Buffer.subarray(0, End).some(Byte => Byte > 127)) throw new Error('Non-ASCII tooling header.');
      const Match = /^Content-Length: ([0-9]+)$/.exec(this.Buffer.subarray(0, End).toString('ascii'));
      if (!Match) throw new Error('Invalid tooling header.');
      const Length = Number(Match[1]);
      if (!Number.isSafeInteger(Length) || Length < 1 || Length > MaxFrame) throw new Error('Invalid tooling content length.');
      if (this.Buffer.length < End + 4 + Length) break;
      Results.push(ParseFrame(new TextDecoder('utf-8', { fatal: true }).decode(this.Buffer.subarray(End + 4, End + 4 + Length))));
      this.Buffer = this.Buffer.subarray(End + 4 + Length);
    }
    return Results;
  }
}
export class ToolingClient {
  private readonly Process: ChildProcessWithoutNullStreams;
  private readonly Reader = new FrameReader();
  private NextId = 0;
  private Pending?: { Id: number; Revision?: string; Resolve: (Value: unknown) => void; Reject: (Error: Error) => void; Timer: NodeJS.Timeout };
  private Closed = false;
  private Stopping?: Promise<void>;
  constructor(Pack: Pack, private readonly Log: (Text: string) => void, private readonly Mode: 'static' | 'analysis' | 'preview' = 'static') {
    const Environment: NodeJS.ProcessEnv = {};
    for (const Name of ['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'LANG', 'LC_ALL']) if (process.env[Name]) Environment[Name] = process.env[Name];
    this.Process = Spawn(Pack.Host, [Mode === 'analysis' ? '--analysis-stdio' : '--stdio'], { cwd: Pack.Root, windowsHide: true, shell: false, stdio: 'pipe', env: Environment });
    this.Process.stdout.on('data', (Chunk: Buffer) => {
      try { for (const Value of this.Reader.Push(Chunk)) this.Receive(Value); }
      catch (Error) { this.Fail(Error instanceof globalThis.Error ? Error : new globalThis.Error('Invalid tooling output.')); }
    });
    let LogBytes = 0;
    this.Process.stderr.on('data', (Chunk: Buffer) => {
      LogBytes += Chunk.length;
      if (LogBytes > 65536) this.Fail(new Error('Tooling log exceeded its bound.'));
      else this.Log(Chunk.toString('utf8').slice(0, 2048));
    });
    this.Process.on('error', (Error) => this.Fail(Error));
    this.Process.on('exit', (Code) => this.Fail(new Error(`CarbonLuau tooling stopped (${Code ?? 'signal'}).`)));
    this.Process.stdin.on('error', (Error) => this.Fail(Error));
  }
  Request(Method: string, Params: unknown, ProjectRevision?: string): Promise<unknown> {
    if (this.Closed) return Promise.reject(new Error('CarbonLuau tooling is stopped. Use Restart Tooling.'));
    if (this.Pending) return Promise.reject(new Error('Only one tooling request may be outstanding.'));
    const Id = ++this.NextId;
    const Body = Buffer.from(JSON.stringify({ Protocol, Id, Method, Params, ...(ProjectRevision ? { ProjectRevision } : {}) }));
    if (Body.length > MaxFrame || Id > 2147483647) return Promise.reject(new Error('Tooling request exceeds its bound.'));
    return new Promise((Resolve, Reject) => {
      const Timer = setTimeout(() => this.Fail(new Error('Tooling request timed out.')), this.Mode === 'analysis' ? Method === 'snapshot' ? 35000 : 17000 : this.Mode === 'preview' ? 24000 : 15000);
      this.Pending = { Id, Revision: ProjectRevision, Resolve, Reject, Timer };
      this.Process.stdin.write(Buffer.concat([Buffer.from(`Content-Length: ${Body.length}\r\n\r\n`), Body]));
    });
  }
  private Receive(Value: unknown): void {
    const Response = Value as { Protocol: unknown; Id: number; ProjectRevision?: string; Result?: unknown; Error?: { Message: string; Details?: unknown } };
    const Pending = this.Pending;
    if (!Pending || Response.Id !== Pending.Id || JSON.stringify(Response.Protocol) !== JSON.stringify(Protocol) ||
        (Response.Error === undefined && Response.ProjectRevision !== Pending.Revision) ||
        (Object.hasOwn(Response, 'Result') === Object.hasOwn(Response, 'Error'))) throw new Error('Tooling response identity mismatch.');
    clearTimeout(Pending.Timer); this.Pending = undefined;
    if (Response.Error) Pending.Reject(Object.assign(new Error(String(Response.Error.Message).slice(0, 1024)), { Code: (Response.Error as { Code?: string }).Code, Details: Response.Error.Details }));
    else Pending.Resolve(Response.Result);
  }
  private Fail(Error: Error): void {
    if (this.Closed) return;
    this.Closed = true;
    if (this.Pending) { clearTimeout(this.Pending.Timer); this.Pending.Reject(Error); this.Pending = undefined; }
    this.Process.kill(); this.Log(Error.message);
  }
  async Stop(): Promise<void> {
    if (this.Mode === 'analysis' || this.Mode === 'preview') {
      this.Stopping ??= this.StopSupervisor();
      return this.Stopping;
    }
    try { if (!this.Closed && !this.Pending) await this.Request('shutdown', {}); }
    finally { this.Fail(new Error('Tooling stopped.')); }
  }
  private async StopSupervisor(): Promise<void> {
    this.Closed = true;
    if (this.Pending) { clearTimeout(this.Pending.Timer); this.Pending.Reject(new Error('Tooling supervisor stopped.')); this.Pending = undefined; }
    if (this.Process.exitCode !== null || this.Process.signalCode !== null) return;
    // EOF is handled on the supervisor's independent reader. It kills/reaps
    // its worker before removing analysis state, even with an outstanding request.
    await new Promise<void>((Resolve, Reject) => {
      const Exit = (): void => { clearTimeout(Force); clearTimeout(Deadline); Resolve(); };
      const Force = setTimeout(() => { this.Process.kill(); }, 5000);
      const Deadline = setTimeout(() => { this.Process.removeListener('exit', Exit); Reject(new Error('Tooling supervisor did not terminate.')); }, 7000);
      this.Process.once('exit', Exit);
      this.Process.stdin.end();
    });
  }
}
