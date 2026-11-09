import { render } from 'preact';
import { GAME_SPEEDS, GameClient, type GameStart, mapHashOf } from './game/GameClient.ts';
import { SAVE_VERSION, decodeSave } from './game/saveFormat.ts';
import { type SaveSlot, readSave } from './game/saves.ts';
import { loadWorld } from './map/loadWorld.ts';
import { MapView } from './render/MapView.ts';
import { App, type UiState } from './ui/App.tsx';

const ui = document.getElementById('ui')!;
const message = (text: string) => render(<div class="fullscreen-message">{text}</div>, ui);

const MIN_FOCUS_SPAN = 160;

async function start(): Promise<void> {
  message('Chargement de la carte…');
  const world = await loadWorld();
  const noCell = { province: 0, owner: 0, terrain: 0 };
  const state: UiState = { hover: noCell, selected: noCell, debug: false, aiming: false, game: null, startError: null };

  let view: MapView | null = null;
  const refresh = () => {
    if (!view) return;
    render(<App world={world} view={view} state={{ ...state }} onStart={startGame} onResume={(slot) => void resume(slot)} />, ui);
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
      if (stored.meta.version !== SAVE_VERSION) throw new Error('elle vient d\'une autre version du jeu.');
      if (stored.meta.mapHash !== mapHashOf(world)) throw new Error('elle a été jouée sur une autre carte.');
      const saved = await decodeSave(stored.blob, world.data.width * world.data.height);
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
        refresh();
      },
      onToggleDebug() {
        state.debug = !state.debug;
        refresh();
      },
      onOffensive(fromX, fromY, toX, toY) {
        state.game?.launchOffensive(fromX, fromY, toX, toY);
      },
      onAimingChange(aiming) {
        state.aiming = aiming;
        refresh();
      },
    },
  );

  window.addEventListener('keydown', (event) => {
    const { target } = event;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return;
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
