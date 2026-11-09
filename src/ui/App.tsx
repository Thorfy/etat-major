import { useEffect, useState } from 'preact/hooks';
import type { GameClient } from '../game/GameClient.ts';
import type { SaveSlot } from '../game/saves.ts';
import type { LoadedWorld } from '../map/loadWorld.ts';
import { TERRAIN_NAMES } from '../map/terrain.ts';
import type { CellInfo, MapMode, MapView } from '../render/MapView.ts';
import type { SimEvent } from '../sim/protocol.ts';
import { FrontsPanel } from './FrontsPanel.tsx';
import { SetupPanel } from './SetupPanel.tsx';
import { formatDuration, formatShortDate } from '../game/time.ts';
import { formatGdp, formatPercent, integer } from './format.ts';

export interface UiState {
  hover: CellInfo;
  selected: CellInfo;
  debug: boolean;
  aiming: boolean;
  game: GameClient | null;
  startError: string | null;
  mapMode: MapMode;
}

interface AppProps {
  world: LoadedWorld;
  view: MapView;
  state: UiState;
  onStart(player: number): void;
  onResume(slot: SaveSlot): void;
  onMapMode(mode: MapMode): void;
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
          <time>{formatShortDate(event.tick)}</time>{' '}
          {event.type === 'war'
            ? `Guerre : ${nameOf(event.a)} et ${nameOf(event.b)}`
            : `${nameOf(event.loser)} capitule devant ${nameOf(event.winner)}`}
        </p>
      ))}
    </section>
  );
}

function MapModeSwitch({ mode, onMapMode }: { mode: MapMode; onMapMode(mode: MapMode): void }) {
  const modes: { id: MapMode; label: string }[] = [
    { id: 'political', label: 'Pays' },
    { id: 'economic', label: 'Économie' },
    { id: 'supply', label: 'Ravitaillement' },
  ];
  return (
    <div class="panel map-mode">
      <div class="speeds" role="group" aria-label="Carte affichée (touches E et R)">
        {modes.map(({ id, label }) => (
          <button key={id} class={mode === id ? 'on' : ''} aria-pressed={mode === id} onClick={() => onMapMode(id)}>
            {label}
          </button>
        ))}
      </div>
      {mode === 'economic' && (
        <div class="legend">
          <div class="ramp" role="img" aria-label="Du plus pauvre au plus riche" />
          <span>Rural</span>
          <span>Industriel</span>
          <small>PIB par km² · goutte : pétrole · carré : acier</small>
        </div>
      )}
      {mode === 'supply' && (
        <div class="legend">
          <div class="ramp supply" role="img" aria-label="Du territoire coupé au territoire bien ravitaillé" />
          <span>Coupé</span>
          <span>Ravitaillé</span>
          <small>Territoire conquis ; le sol national l'est toujours</small>
        </div>
      )}
    </div>
  );
}

function DefeatDialog({ game, nameOf }: { game: GameClient; nameOf(id: number): string }) {
  return (
    <div class="dialog-backdrop">
      <section class="panel dialog" role="alertdialog" aria-labelledby="defeat-title">
        <h2 id="defeat-title">{nameOf(game.player)} a capitulé</h2>
        <p>
          {nameOf(game.defeatedBy)} annexe tout ce qu'il te restait, après {formatDuration(game.tick)} de partie.
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

export function App({ world, view, state, onStart, onResume, onMapMode }: AppProps) {
  const { nations, provinces } = world.data;
  const { game } = state;
  const nameOf = (owner: number) => nations[owner - 1].name;
  const hovered = state.hover.province ? provinces[state.hover.province - 1] : null;
  const selected = state.selected.province ? provinces[state.selected.province - 1] : null;
  const owner = state.selected.owner;
  const holder = owner ? nations[owner - 1] : null;
  const origin = selected ? selected.nation + 1 : 0;
  const economy = game?.economy ?? null;
  const provinceId = state.selected.province;
  const development = economy ? economy.development[provinceId] : 1;
  const provinceGdp = economy ? economy.provinceGdp[provinceId] * development : selected?.gdpMusd ?? 0;

  return (
    <>
      <div class="panel title">
        <strong>État-major</strong> · grande stratégie
      </div>
      <MapModeSwitch mode={state.mapMode} onMapMode={onMapMode} />
      {state.debug && <DebugOverlay view={view} game={game} />}
      {game ? (
        <FrontsPanel game={game} nations={nations} view={view} aiming={state.aiming} />
      ) : (
        <SetupPanel nations={nations} picked={state.selected.owner} onStart={onStart} onResume={onResume} />
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
          ? 'Clic droit + glisser : offensive · Espace : pause · 1, 2, 3 : vitesse · E, R : cartes · F3 : mesures'
          : 'Glisser : déplacer · Molette : zoomer · Clic : sélectionner · E, R : cartes · F3 : mesures'}
      </div>
      {game && selected && holder && (
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
            {economy ? (
              <>
                <dt>PIB</dt>
                <dd>{formatGdp(game!.nationEconomy(owner).output)}</dd>
                <dt>Capacité militaire</dt>
                <dd>{integer.format(game!.nationEconomy(owner).capacity)}</dd>
                <dt>Effort de guerre</dt>
                <dd>{formatPercent(game!.nationEconomy(owner).effort)}</dd>
                <dt>Stabilité</dt>
                <dd>{formatPercent(economy.stability[owner])}</dd>
              </>
            ) : (
              <>
                <dt>Population</dt>
                <dd>{integer.format(holder.population)}</dd>
                <dt>PIB</dt>
                <dd>{formatGdp(holder.gdpMusd)}</dd>
              </>
            )}
            <dt>Superficie de départ</dt>
            <dd>{integer.format(holder.areaKm2)} km²</dd>
          </dl>
          <h3>Province</h3>
          <dl>
            <dt>Population</dt>
            <dd>{integer.format(selected.population)}</dd>
            <dt>PIB</dt>
            <dd>{formatGdp(provinceGdp)}</dd>
            {economy && (
              <>
                <dt>Développement</dt>
                <dd class={development > 1.005 ? 'ahead' : development < 0.995 ? 'behind' : ''}>{formatPercent(development)}</dd>
              </>
            )}
            <dt>Superficie</dt>
            <dd>{integer.format(selected.areaKm2)} km²</dd>
            {game && state.selected.supply < 1 && (
              <>
                <dt>Ravitaillement ici</dt>
                <dd class={state.selected.supply < 0.4 ? 'behind' : ''}>{formatPercent(state.selected.supply)}</dd>
              </>
            )}
            {economy && owner !== origin && (
              <>
                <dt>Consolidation</dt>
                <dd>
                  {game!.controllerOf(provinceId) === origin
                    ? 'province pas encore tenue'
                    : formatPercent(economy.consolidation[provinceId])}
                </dd>
              </>
            )}
            {(selected.oil > 0 || selected.steel > 0) && (
              <>
                <dt>Gisements</dt>
                <dd>
                  {[selected.oil > 0 ? `pétrole ${selected.oil}` : '', selected.steel > 0 ? `acier ${selected.steel}` : '']
                    .filter(Boolean)
                    .join(' · ')}
                </dd>
              </>
            )}
            {economy && (economy.factories[provinceId] > 0 || economy.infrastructure[provinceId] > 0 || economy.depots[provinceId] > 0) && (
              <>
                <dt>Bâtiments</dt>
                <dd>
                  {[
                    economy.factories[provinceId] ? `usines ${economy.factories[provinceId]}` : '',
                    economy.infrastructure[provinceId] ? `infrastructure ${economy.infrastructure[provinceId]}` : '',
                    economy.depots[provinceId] ? 'dépôt' : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </dd>
              </>
            )}
            <dt>Terrain ici</dt>
            <dd>{TERRAIN_NAMES[state.selected.terrain]}</dd>
            {origin !== owner && (
              <>
                <dt>Pays d'origine</dt>
                <dd>{nameOf(origin)}</dd>
              </>
            )}
          </dl>
          {game && game.buildOptions(provinceId).length > 0 && (
            <div class="build-options">
              <h3>Bâtir ici</h3>
              {game.buildOptions(provinceId).map((option) => (
                <button
                  key={option.kind}
                  class="action quiet"
                  disabled={option.reason !== ''}
                  title={option.reason || undefined}
                  onClick={() => game.build(provinceId, option.kind)}
                >
                  {option.label} · {integer.format(option.cost)} pts
                </button>
              ))}
              {game.buildOptions(provinceId).some((option) => option.reason) && (
                <p class="front-note">{game.buildOptions(provinceId).find((option) => option.reason)!.reason}</p>
              )}
            </div>
          )}
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
