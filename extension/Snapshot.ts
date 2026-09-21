import * as Vscode from 'vscode';
import * as Fs from 'node:fs/promises';
import * as Path from 'node:path';

export interface SourceFile { Path: string; Text?: string; Archive?: string }
export interface FolderSnapshot { Id: string; Files: SourceFile[] }
export interface Snapshot { Params: { Folders: FolderSnapshot[] }; Uris: Map<string, Vscode.Uri>; Sources: Map<string, string> }
export const SourceKey = (Folder: string, Path: string): string => Folder + '\0' + Path;

export async function Capture(): Promise<Snapshot> {
  const Result: Snapshot = { Params: { Folders: [] }, Uris: new Map(), Sources: new Map() };
  const Roots = (Vscode.workspace.workspaceFolders ?? []).map(Folder => Folder.uri);
  // A loose document uses the same static path as a root workspace, without a new project file.
  for (const Document of Vscode.workspace.textDocuments) {
    if (!(Vscode.workspace.workspaceFolders?.length) && Document.languageId === 'luau' && Document.uri.scheme === 'file' && !Vscode.workspace.getWorkspaceFolder(Document.uri)) {
      const Parent = Vscode.Uri.file(Path.dirname(Document.uri.fsPath));
      if (!Roots.some(Root => Root.toString() === Parent.toString())) Roots.push(Parent);
    }
  }
  if (Roots.length > 32) throw new Error('CarbonLuau supports at most 32 workspace folders per snapshot.');
  let Total = 0, Candidates = 0, Nodes = 0;
  for (const [Index, Root] of Roots.entries()) {
    if (Root.scheme !== 'file') throw new Error('CarbonLuau requires a filesystem workspace.');
    for (let Current = Root.fsPath; ; Current = Path.dirname(Current)) {
      if ((await Fs.lstat(Current)).isSymbolicLink()) throw new Error('CarbonLuau source roots cannot contain symlinks or reparse points.');
      if (Current === Path.dirname(Current)) break;
    }
    const Folder: FolderSnapshot = { Id: String(Index), Files: [] };
    const Pending = [{ Uri: Root, Prefix: '', Depth: 0 }];
    while (Pending.length) {
      const Directory = Pending.pop()!;
      const Entries = await Vscode.workspace.fs.readDirectory(Directory.Uri);
      Entries.sort(([Left], [Right]) => Left.localeCompare(Right, 'en'));
      for (const [Name, Type] of Entries) {
        if (++Nodes > 20000) throw new Error('Workspace scan exceeded its bounded candidate search. Open a smaller CarbonLuau folder.');
        if (['.git', 'node_modules', '.vscode', 'bin', 'obj', 'build', 'dist', 'tooling'].includes(Name)) continue;
        if ((Type & Vscode.FileType.SymbolicLink) !== 0) throw new Error('CarbonLuau source snapshots reject symlinks and reparse points.');
        const Uri = Vscode.Uri.joinPath(Directory.Uri, Name);
        const Relative = Directory.Prefix + Name;
        if ((Type & Vscode.FileType.Directory) !== 0) {
          if (Directory.Depth >= 32) throw new Error('Workspace scan exceeded its directory depth bound.');
          Pending.push({ Uri, Prefix: Relative + '/', Depth: Directory.Depth + 1 });
          continue;
        }
        if (Name !== 'addon.json' && !Name.endsWith('.luau') && !Name.endsWith('.claddon')) continue;
        if (++Candidates > 2048) throw new Error('Workspace snapshot exceeds 2048 candidates across all folders.');
        const Info = await Vscode.workspace.fs.stat(Uri);
        if (Info.size > 6 * 1024 * 1024) throw new Error('Workspace candidate exceeds the tooling transport limit.');
        const Document = Vscode.workspace.textDocuments.find(Item => Item.uri.toString() === Uri.toString());
        const Bytes = Document && !Name.endsWith('.claddon') ? Buffer.from(Document.getText(), 'utf8') : Buffer.from(await Vscode.workspace.fs.readFile(Uri));
        Total += Bytes.length;
        if (Total > 6 * 1024 * 1024 || Folder.Files.length >= 2048) throw new Error('Workspace snapshot exceeds the tooling transport limit.');
        const Key = SourceKey(Folder.Id, Relative);
        Result.Uris.set(Key, Uri);
        if (Name.endsWith('.claddon')) Folder.Files.push({ Path: Relative, Archive: Bytes.toString('base64') });
        else {
          const Text = new TextDecoder('utf-8', { fatal: true }).decode(Bytes);
          Folder.Files.push({ Path: Relative, Text }); Result.Sources.set(Key, Text);
        }
      }
    }
    Folder.Files.sort((Left, Right) => Left.Path < Right.Path ? -1 : Left.Path > Right.Path ? 1 : 0);
    Result.Params.Folders.push(Folder);
  }
  return Result;
}
