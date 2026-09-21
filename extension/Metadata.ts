import * as Vscode from 'vscode';

interface ApiMember { Name: string; OwnerId: string; Summary: string; ValueType?: string; Signatures?: { Parameters: { Name: string; Type: string }[]; Returns: string[] }[] }
export function RegisterMetadata(Value: unknown): Vscode.Disposable {
  const Catalog = (Value as { Catalog: { Members: ApiMember[] } }).Catalog;
  if (!Array.isArray(Catalog.Members) || Catalog.Members.length > 8192) throw new Error('Invalid canonical API metadata.');
  const Members = new Map<string, ApiMember[]>();
  for (const Member of Catalog.Members) {
    if (typeof Member.Name !== 'string' || typeof Member.OwnerId !== 'string' || typeof Member.Summary !== 'string') throw new Error('Invalid API member.');
    const Group = Members.get(Member.Name) ?? []; Group.push(Member); Members.set(Member.Name, Group);
  }
  return Vscode.languages.registerHoverProvider({ language: 'luau', scheme: 'file' }, {
    provideHover: (Document, Position) => {
      const Range = Document.getWordRangeAtPosition(Position, /[A-Za-z_][A-Za-z0-9_]*/);
      if (!Range) return undefined;
      const Matches = Members.get(Document.getText(Range));
      if (!Matches) return undefined;
      const Markdown = new Vscode.MarkdownString();
      Markdown.appendText('Canonical CarbonLuau API reference (not inferred expression types)\n\n');
      for (const Member of Matches.slice(0, 16)) {
        const Signatures = Member.Signatures?.slice(0, 16).map(Signature => '(' + Signature.Parameters.map(Parameter => `${Parameter.Name}: ${Parameter.Type}`).join(', ') + ') -> (' + Signature.Returns.join(', ') + ')').join('\n') ?? Member.ValueType ?? '';
        Markdown.appendText(`${Member.OwnerId}.${Member.Name} ${Signatures}\n${Member.Summary}\n\n`);
      }
      return new Vscode.Hover(Markdown, Range);
    }
  });
}
