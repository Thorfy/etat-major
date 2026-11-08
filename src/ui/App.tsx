import { useEffect, useState } from 'preact/hooks';
import type { GameClient } from '../game/GameClient.ts';
import { areLandNeighbors } from '../map/adjacency.ts';
import type { LoadedWorld } from '../map/loadWorld.ts';
import type { MapView } from '../render/MapView.ts';
import { FrontsPanel } from './FrontsPanel.tsx';
import { SetupPanel } from './SetupPanel.tsx';
import { formatGdp, integer } from './format.ts';

export interface UiState {
  hover: number;
  hoverOwner: number;
  selected: number;
  selectedOwner: number;
  debug: boolean;
  game: GameClient | null;
}

interface AppProps {
  world: LoadedWorld;
  view: MapView;
  state: UiState;
  neighbors: Map<number, number[]>;
  onStart(player: number, enemy: number): void;
}

function DebugOverlay({ view, game }: { view: MapView; game: GameClient | null }) {
  const [text, setText] = useState('');
  useEffect(() => {
    const timer = setInterval(() => {
      const { frameMs, gpuMs, zoom } = view.stats;
      const gpu = gpuMs === null ? 'n.d.' : `${gpuMs.toFixed(1)} ms`;
      const lines = [`image ${frameMs.toFixed(1)} ms`, `GPU   ${gpu}`, `zoom  ${zoom.toFixed(2)} px/cellule`];
      if (game) {
        lines.push(
          `tick  ${game.tickMs.toFixed(1)} ms (max ${game.maxTickMs.toFixed(1)})`,
          `front ${game.snapshot?.frontierSize ?? 0} cellules`,
          `flux  ${Math.round(game.flipsPerSecond)} bascules/s`,
        );
      }
      setText(lines.join('\n'));
    }, 250);
    view.continuous = true;
    return () => {
      clearInterval(timer);
      view.continuous = false;
    };
  }, [view, game]);
  return <div class="panel debug">{text}</div>;
}

export function App({ world, view, state, neighbors, onStart }: AppProps) {
  const { nations, provinces, width, height } = world.data;
  const { game } = state;
  const nameOf = (owner: number) => nations[owner - 1].name;
  const hovered = state.hover ? provinces[state.hover - 1] : null;
  const selected = state.selected ? provinces[state.selected - 1] : null;
  const home = selected ? nations[selected.nation] : null;
  const homeId = selected ? selected.nation + 1 : 0;
  const owner = state.selectedOwner;

  const canOpenFront =
    game !== null && owner !== 0 && owner !== game.player && !game.isAtWarWith(owner) &&
    areLandNeighbors(world.ownerGrid, width, height, game.player, owner);

  return (
    <>
      <div class="panel title">
        <strong>Risk</strong> · titre provisoire
      </div>
      {state.debug && <DebugOverlay view={view} game={game} />}
      {game ? (
        <FrontsPanel game={game} nations={nations} />
      ) : (
        <SetupPanel nations={nations} neighbors={neighbors} onStart={onStart} />
      )}
      {hovered && (
        <div class="panel hover">
          {hovered.name} <span>· {nameOf(hovered.nation + 1)}</span>
          {state.hoverOwner !== 0 && state.hoverOwner !== hovered.nation + 1 && (
            <span class="occupied"> · tenue par {nameOf(state.hoverOwner)}</span>
          )}
        </div>
      )}
      <div class="panel hints">Glisser : déplacer · Molette : zoomer · Clic : sélectionner · F3 : mesures</div>
      {selected && home && (
        <aside class="panel info" aria-label="Province sélectionnée">
          <button class="close" aria-label="Fermer" onClick={() => view.select(0)}>
            ×
          </button>
          <h2>
            <span class="swatch" style={{ background: home.color }} />
            {home.name}
          </h2>
          <p class="province">{selected.name}</p>
          <dl>
            <dt>Population</dt>
            <dd>{integer.format(home.population)}</dd>
            <dt>PIB</dt>
            <dd>{formatGdp(home.gdpMusd)}</dd>
            <dt>Superficie</dt>
            <dd>{integer.format(home.areaKm2)} km²</dd>
          </dl>
          <h3>Province</h3>
          <dl>
            <dt>Superficie</dt>
            <dd>{integer.format(selected.areaKm2)} km²</dd>
            <dt>Cellules</dt>
            <dd>{integer.format(selected.cells)}</dd>
            {game && game.controllerOf(state.selected) !== homeId && (
              <>
                <dt>Contrôlée par</dt>
                <dd>{nameOf(game.controllerOf(state.selected))}</dd>
              </>
            )}
          </dl>
          {canOpenFront && (
            <button class="action" onClick={() => game.openFront(owner)}>
              Ouvrir un front contre {nameOf(owner)}
            </button>
          )}
        </aside>
      )}
    </>
  );
}
