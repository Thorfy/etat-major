import { useEffect, useState } from 'preact/hooks';
import type { GameClient } from '../game/GameClient.ts';
import type { SaveSlot } from '../game/saves.ts';
import type { LoadedWorld } from '../map/loadWorld.ts';
import { TERRAIN_NAMES } from '../map/terrain.ts';
import type { CellInfo, MapView } from '../render/MapView.ts';
import type { SimEvent } from '../sim/protocol.ts';
import { FrontsPanel } from './FrontsPanel.tsx';
import { SetupPanel } from './SetupPanel.tsx';
import { formatClock, formatGdp, integer } from './format.ts';

export interface UiState {
  hover: CellInfo;
  selected: CellInfo;
  debug: boolean;
  aiming: boolean;
  game: GameClient | null;
  startError: string | null;
}

interface AppProps {
  world: LoadedWorld;
  view: MapView;
  state: UiState;
  onStart(player: number): void;
  onResume(slot: SaveSlot): void;
}

const JOURNAL_LINES = 5;

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

function Journal({ game, nameOf }: { game: GameClient; nameOf(id: number): string }) {
  const lines = game.journal.slice(-JOURNAL_LINES).reverse();
  if (lines.length === 0) return null;
  const involvesPlayer = (event: SimEvent) =>
    event.type === 'war'
      ? event.a === game.player || event.b === game.player
      : event.loser === game.player || event.winner === game.player;
  return (
    <section class="panel journal" aria-label="Événements du monde">
      {lines.map((event) => (
        <p key={`${event.type}-${event.tick}-${event.type === 'war' ? event.a * 1000 + event.b : event.loser}`} class={involvesPlayer(event) ? 'mine' : ''}>
          <time>{formatClock(event.tick / 10)}</time>{' '}
          {event.type === 'war'
            ? `Guerre : ${nameOf(event.a)} et ${nameOf(event.b)}`
            : `${nameOf(event.loser)} capitule devant ${nameOf(event.winner)}`}
        </p>
      ))}
    </section>
  );
}

function DefeatDialog({ game, nameOf }: { game: GameClient; nameOf(id: number): string }) {
  return (
    <div class="dialog-backdrop">
      <section class="panel dialog" role="alertdialog" aria-labelledby="defeat-title">
        <h2 id="defeat-title">{nameOf(game.player)} a capitulé</h2>
        <p>
          {nameOf(game.defeatedBy)} annexe tout ce qu'il te restait, après {formatClock(game.elapsedSeconds)} de guerre.
        </p>
        <button class="action" onClick={() => window.location.reload()}>
          Retour au menu
        </button>
        <button class="action quiet" onClick={() => game.acknowledgeDefeat()}>
          Regarder la suite du monde
        </button>
      </section>
    </div>
  );
}

export function App({ world, view, state, onStart, onResume }: AppProps) {
  const { nations, provinces } = world.data;
  const { game } = state;
  const nameOf = (owner: number) => nations[owner - 1].name;
  const hovered = state.hover.province ? provinces[state.hover.province - 1] : null;
  const selected = state.selected.province ? provinces[state.selected.province - 1] : null;
  const owner = state.selected.owner;
  const holder = owner ? nations[owner - 1] : null;
  const origin = selected ? selected.nation + 1 : 0;

  return (
    <>
      <div class="panel title">
        <strong>Risk</strong> · titre provisoire
      </div>
      {state.debug && <DebugOverlay view={view} game={game} />}
      {game ? (
        <FrontsPanel game={game} nations={nations} view={view} aiming={state.aiming} />
      ) : (
        <SetupPanel nations={nations} onStart={onStart} onResume={onResume} />
      )}
      {hovered && (
        <div class="panel hover">
          {hovered.name} <span>· {nameOf(hovered.nation + 1)} · {TERRAIN_NAMES[state.hover.terrain]}</span>
          {state.hover.owner !== 0 && state.hover.owner !== hovered.nation + 1 && (
            <span class="occupied"> · tenue par {nameOf(state.hover.owner)}</span>
          )}
        </div>
      )}
      {game?.message && <div class="panel toast" role="status">{game.message}</div>}
      {game && <Journal game={game} nameOf={nameOf} />}
      <div class="panel hints">
        {game
          ? 'Clic droit + glisser : offensive · Espace : pause · 1, 2, 3 : vitesse · Molette : zoomer · F3 : mesures'
          : 'Glisser : déplacer · Molette : zoomer · Clic : sélectionner · F3 : mesures'}
      </div>
      {selected && holder && (
        <aside class="panel info" aria-label="Province sélectionnée">
          <button class="close" aria-label="Fermer" onClick={() => view.select()}>
            ×
          </button>
          <h2>
            <span class="swatch" style={{ background: holder.color }} />
            {holder.name}
          </h2>
          <p class="province">{selected.name}</p>
          <dl>
            <dt>Population de départ</dt>
            <dd>{integer.format(holder.population)}</dd>
            <dt>PIB de départ</dt>
            <dd>{formatGdp(holder.gdpMusd)}</dd>
            <dt>Superficie de départ</dt>
            <dd>{integer.format(holder.areaKm2)} km²</dd>
          </dl>
          <h3>Province</h3>
          <dl>
            <dt>Superficie</dt>
            <dd>{integer.format(selected.areaKm2)} km²</dd>
            <dt>Terrain ici</dt>
            <dd>{TERRAIN_NAMES[state.selected.terrain]}</dd>
            {origin !== owner && (
              <>
                <dt>Pays d'origine</dt>
                <dd>{nameOf(origin)}</dd>
              </>
            )}
          </dl>
          {game?.canDeclareWar(owner) && (
            <button class="action" onClick={() => game.declareWar(owner)}>
              Déclarer la guerre : {holder.name}
            </button>
          )}
          {game?.isAtWarWith(owner) && <p class="alert">Tu es en guerre contre ce pays.</p>}
        </aside>
      )}
      {state.startError && <div class="panel toast" role="alert">{state.startError}</div>}
      {game && game.defeatedBy !== 0 && !game.defeatSeen && <DefeatDialog game={game} nameOf={nameOf} />}
    </>
  );
}
