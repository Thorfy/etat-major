import { render } from 'preact';
import { GameClient } from './game/GameClient.ts';
import { findLandNeighbors } from './map/adjacency.ts';
import type { LoadedWorld } from './map/loadWorld.ts';
import { loadWorld } from './map/loadWorld.ts';
import { wrapDeltaX } from './map/projection.ts';
import { MapView } from './render/MapView.ts';
import { App, type UiState } from './ui/App.tsx';

const ui = document.getElementById('ui')!;
const message = (text: string) => render(<div class="fullscreen-message">{text}</div>, ui);

function neighborsOf(world: LoadedWorld): Map<number, number[]> {
  const neighbors = new Map<number, number[]>();
  const add = (from: number, to: number) => {
    const list = neighbors.get(from);
    if (list) list.push(to);
    else neighbors.set(from, [to]);
  };
  for (const [a, b] of findLandNeighbors(world.ownerGrid, world.data.width, world.data.height)) {
    add(a, b);
    add(b, a);
  }
  return neighbors;
}

async function start(): Promise<void> {
  message('Chargement de la carte…');
  const world = await loadWorld();
  const neighbors = neighborsOf(world);
  const state: UiState = { hover: 0, hoverOwner: 0, selected: 0, selectedOwner: 0, debug: false, game: null };

  let view: MapView | null = null;
  const refresh = () => {
    if (!view) return;
    render(<App world={world} view={view} state={{ ...state }} neighbors={neighbors} onStart={startGame} />, ui);
  };

  const startGame = (player: number, enemy: number) => {
    const a = world.data.nations[player - 1].label;
    const b = world.data.nations[enemy - 1].label;
    const dx = wrapDeltaX(a.x, b.x);
    const span = Math.max(Math.hypot(dx, b.y - a.y) * 2.2, 160);
    view!.focus(a.x + dx / 2, (a.y + b.y) / 2, span);
    state.game = new GameClient(world, view!, player, enemy, Date.now() >>> 0, refresh);
    refresh();
  };

  view = new MapView(
    document.getElementById('map') as HTMLCanvasElement,
    document.getElementById('labels') as HTMLCanvasElement,
    world,
    {
      onHover(province, owner) {
        state.hover = province;
        state.hoverOwner = owner;
        refresh();
      },
      onSelect(province, owner) {
        state.selected = province;
        state.selectedOwner = owner;
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
  if (import.meta.env.DEV) Object.assign(window, { __game: { view, world, state } });
}

start().catch((error: unknown) => {
  console.error(error);
  message(`Impossible de démarrer : ${error instanceof Error ? error.message : String(error)}`);
});
