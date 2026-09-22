import { Renderer } from './Renderer';
import { IsViewport, ParseState, PreviewMessage } from '../extension/PreviewContract';

declare function acquireVsCodeApi(): { postMessage(Message: PreviewMessage): void };
const Api = acquireVsCodeApi();
const View = new Renderer(document);
const Status = document.getElementById('status')!;
const Width = document.getElementById('width') as HTMLInputElement, Height = document.getElementById('height') as HTMLInputElement;
const Screens = document.getElementById('screens') as HTMLSelectElement;
const Zoom = document.getElementById('zoom') as HTMLSelectElement;
function Send(Message: PreviewMessage): void { Api.postMessage(Message); }
document.getElementById('refresh')!.addEventListener('click', () => Send({ Version: 1, Type: 'Refresh' }));
document.getElementById('apply')!.addEventListener('click', () => {
  const Viewport = { Width: Number(Width.value), Height: Number(Height.value) };
  if (IsViewport(Viewport)) Send({ Version: 1, Type: 'Viewport', Viewport }); else Status.textContent = 'Viewport must use whole pixels from 1 to 8192.';
});
document.getElementById('presets')!.addEventListener('change', Event => {
  const [W, H] = (Event.target as HTMLSelectElement).value.split('x').map(Number);
  if (W && H) { Width.value = String(W); Height.value = String(H); Send({ Version: 1, Type: 'Viewport', Viewport: { Width: W, Height: H } }); }
});
Zoom.addEventListener('change', () => Send({ Version: 1, Type: 'Zoom', Zoom: Number(Zoom.value) }));
Screens.addEventListener('change', () => Send({ Version: 1, Type: 'Screen', Id: Screens.value }));
window.addEventListener('message', Event => {
  const M = ParseState(Event.data);
  if (!M) { View.Clear(); Status.textContent = 'Preview message rejected: incompatible or malformed input.'; return; }
  Status.textContent = M.Message; Width.value = String(M.Viewport.Width); Height.value = String(M.Viewport.Height);
  Zoom.value = String(M.Zoom); document.getElementById('surface')!.style.transform = 'scale(' + M.Zoom + ')';
  const Space = document.getElementById('canvas-space')!; Space.style.width = M.Viewport.Width * M.Zoom + 'px'; Space.style.height = M.Viewport.Height * M.Zoom + 'px';
  Screens.replaceChildren();
  for (const S of M.Screens) { const Option = document.createElement('option'); Option.value = S.Id; Option.textContent = S.Name + ' #' + S.Id; Option.selected = S.Id === M.Plan?.Screen?.Id; Screens.append(Option); }
  Screens.disabled = !M.Screens.length;
  try { if (M.Plan) { if (document.getElementById('surface')!.dataset.revision !== M.Plan.ProjectRevision) View.Render(M.Plan); } else View.Clear(); }
  catch { View.Clear(); Status.textContent = 'Preview plan rejected: incompatible or malformed renderer input.'; }
});
Send({ Version: 1, Type: 'Ready' });
