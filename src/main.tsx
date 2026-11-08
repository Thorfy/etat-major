import { render } from 'preact';
import { loadWorld } from './map/loadWorld.ts';
import { MapView } from './render/MapView.ts';
import { App, type UiState } from './ui/App.tsx';

const ui = document.getElementById('ui')!;
const message = (text: string) => render(<div class="fullscreen-message">{text}</div>, ui);

async function start(): Promise<void> {
  message('Chargement de la carte…');
  const world = await loadWorld();
  const state: UiState = { hover: 0, selected: 0, debug: false };

  let view: MapView | null = null;
  const refresh = () => {
    if (view) render(<App world={world} view={view} state={{ ...state }} />, ui);
  };
  view = new MapView(
    document.getElementById('map') as HTMLCanvasElement,
    document.getElementById('labels') as HTMLCanvasElement,
    world,
    {
      onHover(province) {
        state.hover = province;
        refresh();
      },
      onSelect(province) {
        state.selected = province;
        refresh();
      },
      onToggleDebug() {
        state.debug = !state.debug;
        refresh();
      },
    },
  );
  render(null, ui);
  refresh();
  if (import.meta.env.DEV) Object.assign(window, { __game: { view, world } });
}

start().catch((error: unknown) => {
  console.error(error);
  message(`Impossible de démarrer : ${error instanceof Error ? error.message : String(error)}`);
});
