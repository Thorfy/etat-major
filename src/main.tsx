import { render } from 'preact';
import { GAME_SPEEDS, GameClient, type GameStart, mapHashOf } from './game/GameClient.ts';
import { SAVE_VERSION, decodeSave } from './game/saveFormat.ts';
import { type SaveSlot, readSave } from './game/saves.ts';
import { loadWorld } from './map/loadWorld.ts';
import { provinceWealth } from './game/economy.ts';
import { type MapMode, MapView } from './render/MapView.ts';
import { App, type UiState } from './ui/App.tsx';

const ui = document.getElementById('ui')!;
const message = (text: string) => render(<div class="fullscreen-message">{text}</div>, ui);

const MIN_FOCUS_SPAN = 160;

async function start(): Promise<void> {
  message('Chargement de la carte…');
  const world = await loadWorld();
  const noCell = { province: 0, owner: 0, terrain: 0, supply: 1 };
  const state: UiState = {
    hover: noCell,
    selected: noCell,
    debug: false,
    tool: null,
    game: null,
    startError: null,
    mapMode: 'political',
  };

  let view: MapView | null = null;
  const refresh = () => {
    if (!view) return;
    render(
      <App
        world={world}
        view={view}
        state={{ ...state }}
        onStart={startGame}
        onResume={(slot) => void resume(slot)}
        onMapMode={setMapMode}
      />,
      ui,
    );
  };

  const setMapMode = (mode: MapMode) => {
    state.mapMode = mode;
    view?.setMapMode(mode);
    refresh();
  };

  const launch = (settings: GameStart) => {
    const label = world.data.nations[settings.player - 1].label;
    view!.focus(label.x, label.y, Math.max(label.r * 8, MIN_FOCUS_SPAN));
    const game = new GameClient(world, view!, settings, refresh);
    state.game = game;
    state.startError = null;
    view!.setPlayer(settings.player, (nation) => game.isAtWarWith(nation));
    if (!game.canCommand) view!.setCommandEnabled(false);
    refresh();
  };

  const startGame = (player: number) => launch({ player, seed: Date.now() >>> 0 });

  const resume = async (slot: SaveSlot) => {
    try {
      const stored = await readSave(slot);
      if (!stored) throw new Error('sauvegarde introuvable.');
      if (stored.meta.version > SAVE_VERSION) throw new Error('elle vient d\'une version plus récente du jeu.');
      if (stored.meta.mapHash !== mapHashOf(world)) throw new Error('elle a été jouée sur une autre carte.');
      // Une sauvegarde d'une version précédente est mise à jour au chargement.
      const saved = await decodeSave(stored.blob, world.data.width * world.data.height, stored.meta.version);
      launch({ player: stored.meta.player, seed: 1, saved });
    } catch (error) {
      state.startError = `Reprise impossible : ${error instanceof Error ? error.message : String(error)}`;
      refresh();
    }
  };

  view = new MapView(
    document.getElementById('map') as HTMLCanvasElement,
    document.getElementById('labels') as HTMLCanvasElement,
    world,
    {
      onHover(cell) {
        state.hover = cell;
        refresh();
      },
      onSelect(cell) {
        state.selected = cell;
        state.game?.highlightAlliesOf(cell.owner);
        refresh();
      },
      onToggleDebug() {
        state.debug = !state.debug;
        refresh();
      },
      onOffensive(fromX, fromY, toX, toY) {
        state.game?.launchOffensive(fromX, fromY, toX, toY);
      },
      onFort(fromX, fromY, toX, toY) {
        state.game?.fortifyLine(fromX, fromY, toX, toY);
      },
      onPriority(x, y) {
        state.game?.addPriority(x, y);
      },
      onToolChange(tool) {
        state.tool = tool;
        refresh();
      },
    },
  );

  // Avant la partie, la carte économique montre la richesse de départ.
  const gdp = [0, ...world.data.provinces.map((province) => province.gdpMusd)];
  view.setEconomy(provinceWealth(world.data.provinces.map((province) => province.areaKm2), gdp));
  view.setResourceMarkers(
    world.data.provinces
      .filter((province) => province.oil > 0 || province.steel > 0)
      .map(({ x, y, oil, steel }) => ({ x, y, oil, steel })),
  );

  window.addEventListener('keydown', (event) => {
    const { target } = event;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return;
    const key = event.key.toLowerCase();
    if ((key === 'e' || key === 'r') && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const mode = key === 'e' ? 'economic' : 'supply';
      setMapMode(state.mapMode === mode ? 'political' : mode);
      return;
    }
    const game = state.game;
    if (!game) return;
    // Sur un bouton, Espace reste réservé au bouton.
    if (event.code === 'Space' && !(target instanceof HTMLButtonElement)) {
      event.preventDefault();
      game.togglePause();
    } else if (event.key >= '1' && event.key <= '3') {
      game.setSpeed(GAME_SPEEDS[Number(event.key) - 1]);
    }
  });

  render(null, ui);
  refresh();
  if (import.meta.env.DEV) Object.assign(window, { __game: { view, world, state } });
}

start().catch((error: unknown) => {
  console.error(error);
  message(`Impossible de démarrer : ${error instanceof Error ? error.message : String(error)}`);
});
