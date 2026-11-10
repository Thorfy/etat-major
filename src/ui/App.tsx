import { useEffect, useState } from 'preact/hooks';
import type { BuildOption, GameClient } from '../game/GameClient.ts';
import { BUILD_EFFECTS, BUILD_NAMES } from '../game/buildings.ts';
import type { SaveSlot } from '../game/saves.ts';
import type { LoadedWorld } from '../map/loadWorld.ts';
import { TERRAIN_NAMES } from '../map/terrain.ts';
import type { CellInfo, MapMode, MapTool, MapView } from '../render/MapView.ts';
import type { BuildKind, SimEvent } from '../sim/protocol.ts';
import { SidePanel } from './SidePanel.tsx';
import { MAP_MODES, TopBar } from './TopBar.tsx';
import { SetupPanel } from './SetupPanel.tsx';
import { describeEvent, eventKey, eventNations } from '../game/events.ts';
import { formatDuration, formatShortDate } from '../game/time.ts';
import { ALLIANCE_MAX_AGGRESSION } from '../sim/balance.ts';
import { formatGdp, formatPercent, integer } from './format.ts';

export interface UiState {
  hover: CellInfo;
  selected: CellInfo;
  debug: boolean;
  tool: MapTool | null;
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

/** Les derniers événements du monde, sur une hauteur fixe. */
function Journal({ game, nameOf }: { game: GameClient; nameOf(id: number): string }) {
  const lines = game.journal.slice(-JOURNAL_LINES).reverse();
  const involvesPlayer = (event: SimEvent) => eventNations(event).includes(game.player);
  return (
    <section class="panel journal" aria-label="Événements du monde">
      {lines.length === 0 && <p>Le monde est calme.</p>}
      {lines.map((event) => (
        <p key={eventKey(event)} class={involvesPlayer(event) ? 'mine' : ''}>
          <time>{formatShortDate(event.tick)}</time> {describeEvent(event, nameOf)}
        </p>
      ))}
    </section>
  );
}

const RELATIONS = { war: 'en guerre', ally: 'pacte de non-agression', truce: 'trêve', peace: 'en paix' } as const;

/**
 * Diplomatie avec le pays sélectionné : toujours les mêmes lignes, et deux boutons à la même place
 * (paix, pacte ou rupture ; déclaration de guerre). Personne ne vient en aide à qui est attaqué.
 */
function NationDiplomacy({ game, nation, nameOf }: { game: GameClient; nation: number; nameOf(id: number): string }) {
  if (nation === game.player || !game.canCommand) return null;
  const relation = game.relationOf(nation);
  const economy = game.economy;
  const aggression = economy ? economy.aggression[nation] : 0;
  const coalition = economy ? economy.coalitionAgainst[nation] : 0;
  const alliances = game.alliancesOf(nation);
  const mine = game.nationEconomy(game.player).capacity;
  const theirs = game.nationEconomy(nation).capacity;
  const canWar = game.canDeclareWar(nation);
  return (
    <>
      <h3>Diplomatie</h3>
      <dl>
        <dt>Avec toi</dt>
        <dd class={relation === 'war' ? 'behind' : relation === 'ally' ? 'ahead' : ''}>
          {RELATIONS[relation]}
          {relation === 'truce' ? ` jusqu'au ${formatShortDate(game.truceUntil(nation))}` : ''}
        </dd>
        <dt>Rapport de force</dt>
        <dd class={mine >= theirs ? 'ahead' : 'behind'}>
          {integer.format(mine)} contre {integer.format(theirs)}
        </dd>
        <dt>Agressivité</dt>
        <dd class={aggression >= ALLIANCE_MAX_AGGRESSION ? 'behind' : ''}>{formatPercent(aggression)}</dd>
        <dt>Pactes</dt>
        <dd>{alliances.treaty.length > 0 ? alliances.treaty.map(nameOf).join(', ') : 'aucun'}</dd>
        <dt>Soulèvement</dt>
        <dd>
          {coalition > 0
            ? `contre ${nameOf(coalition)}${alliances.coalition.length > 0 ? `, avec ${alliances.coalition.map(nameOf).join(', ')}` : ''}`
            : '—'}
        </dd>
      </dl>
      <div class="card-actions">
        {relation === 'war' && (
          <button class="action quiet" onClick={() => game.proposePeace(nation)}>
            Proposer la paix
          </button>
        )}
        {relation === 'peace' && (
          <button class="action quiet" onClick={() => game.proposeAlliance(nation)}>
            Proposer un pacte
          </button>
        )}
        {relation === 'ally' && (
          <button class="action quiet" onClick={() => game.breakAlliance(nation)}>
            Rompre le pacte
          </button>
        )}
        {relation === 'truce' && (
          <button class="action quiet" disabled>
            Trêve en cours
          </button>
        )}
        <button
          class="action danger"
          disabled={!canWar}
          title={!canWar && relation === 'peace' ? 'Ni frontière commune, ni marine pour débarquer.' : undefined}
          onClick={() => game.declareWar(nation)}
        >
          {relation === 'war' ? 'En guerre' : 'Déclarer la guerre'}
        </button>
      </div>
    </>
  );
}

/**
 * Chantiers possibles dans une de ses provinces. Au survol (ou au clavier), la note réservée sous
 * les boutons dit ce que fait le bâtiment, et pourquoi il est impossible s'il l'est.
 */
function BuildOptions({ game, province, options }: { game: GameClient; province: number; options: BuildOption[] }) {
  const [hovered, setHovered] = useState<BuildKind | null>(null);
  const shown = options.find((option) => option.kind === hovered);
  return (
    <div class="build-options" onMouseLeave={() => setHovered(null)}>
      <h3>Bâtir ici</h3>
      {options.length === 0 && <p class="note">Province pas encore tenue : rien à bâtir pour l'instant.</p>}
      {options.map((option) => (
        <div
          key={option.kind}
          class="build-option"
          onMouseEnter={() => setHovered(option.kind)}
          onFocusCapture={() => setHovered(option.kind)}
        >
          <button
            class="action quiet"
            disabled={option.reason !== ''}
            aria-describedby="build-effect"
            onClick={() => game.build(province, option.kind)}
          >
            {option.label} · {integer.format(option.cost)} pts
          </button>
        </div>
      ))}
      {options.length > 0 && (
        <p class="note build-effect" id="build-effect">
          {shown ? (
            <>
              <b>{BUILD_NAMES[shown.kind]} :</b> {BUILD_EFFECTS[shown.kind]}
              {shown.reason && <span class="behind"> {shown.reason}</span>}
            </>
          ) : (
            'Survole un chantier pour voir ce qu\'il apporte. Les chantiers s\'enchaînent dans l\'ordre de la file, sans limite.'
          )}
        </p>
      )}
    </div>
  );
}

/** Légende de la carte affichée. */
function MapLegend({ mode }: { mode: MapMode }) {
  if (mode === 'economic') {
    return (
      <div class="legend">
        <div class="ramp" role="img" aria-label="Du plus pauvre au plus riche" />
        <span>Rural</span>
        <span>Industriel</span>
        <small>PIB par km² · goutte : pétrole · carré : acier</small>
      </div>
    );
  }
  if (mode === 'supply') {
    return (
      <div class="legend">
        <div class="ramp supply" role="img" aria-label="Du territoire coupé au territoire bien ravitaillé" />
        <span>Coupé</span>
        <span>Ravitaillé</span>
        <small>Territoire conquis ; le sol national l'est toujours</small>
      </div>
    );
  }
  return null;
}

/** Choix de la carte avant la partie ; en partie, il passe dans la barre du haut. */
function MapModeSwitch({ mode, onMapMode }: { mode: MapMode; onMapMode(mode: MapMode): void }) {
  return (
    <div class="panel map-mode">
      <div class="speeds" role="group" aria-label="Carte affichée (touches E et R)">
        {MAP_MODES.map(({ id, label }) => (
          <button key={id} class={mode === id ? 'on' : ''} aria-pressed={mode === id} onClick={() => onMapMode(id)}>
            {label}
          </button>
        ))}
      </div>
      <MapLegend mode={mode} />
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
  const buildOptions = game ? game.buildOptions(provinceId) : [];
  // Une région annexée qui s'agite dans le pays qui la tient.
  const unrest = game && owner && origin !== owner ? game.unrestOf(owner, origin) : -1;

  return (
    <>
      {game ? (
        <>
          <TopBar game={game} nation={nations[game.player - 1]} mapMode={state.mapMode} onMapMode={onMapMode} />
          {state.mapMode !== 'political' && (
            <div class="panel map-legend">
              <MapLegend mode={state.mapMode} />
            </div>
          )}
          <SidePanel game={game} nations={nations} view={view} tool={state.tool} />
        </>
      ) : (
        <>
          <div class="panel title">
            <strong>État-major</strong> · grande stratégie
          </div>
          <MapModeSwitch mode={state.mapMode} onMapMode={onMapMode} />
          <SetupPanel nations={nations} picked={state.selected.owner} onStart={onStart} onResume={onResume} />
        </>
      )}
      {state.debug && <DebugOverlay view={view} game={game} />}
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
          ? 'Clic droit + glisser : offensive · Espace : pause · 1, 2, 3 : vitesse · E, R : cartes'
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
            <dt>PIB</dt>
            <dd>{economy ? formatGdp(game.nationEconomy(owner).output) : formatGdp(holder.gdpMusd)}</dd>
            <dt>Capacité militaire</dt>
            <dd>{economy ? integer.format(game.nationEconomy(owner).capacity) : '—'}</dd>
            <dt>Effort de guerre</dt>
            <dd>{economy ? formatPercent(game.nationEconomy(owner).effort) : '—'}</dd>
            <dt>Stabilité</dt>
            <dd class={economy && economy.stability[owner] < 0.5 ? 'behind' : ''}>{economy ? formatPercent(economy.stability[owner]) : '—'}</dd>
            <dt>Superficie de départ</dt>
            <dd>{integer.format(holder.areaKm2)} km²</dd>
          </dl>
          <NationDiplomacy game={game} nation={owner} nameOf={nameOf} />
          {owner === game.player && game.canCommand && (
            <BuildOptions key={provinceId} game={game} province={provinceId} options={buildOptions} />
          )}
          <h3>Province</h3>
          <dl>
            <dt>Population</dt>
            <dd>{integer.format(selected.population)}</dd>
            <dt>PIB</dt>
            <dd>{formatGdp(provinceGdp)}</dd>
            <dt>Développement</dt>
            <dd class={development > 1.005 ? 'ahead' : development < 0.995 ? 'behind' : ''}>{economy ? formatPercent(development) : '—'}</dd>
            <dt>Superficie</dt>
            <dd>{integer.format(selected.areaKm2)} km²</dd>
            <dt>Ravitaillement ici</dt>
            <dd class={state.selected.supply < 0.4 ? 'behind' : ''}>{formatPercent(state.selected.supply)}</dd>
            <dt>Pays d'origine</dt>
            <dd>{nameOf(origin)}</dd>
            <dt>Agitation</dt>
            <dd class={unrest >= 0.65 ? 'behind' : ''}>{unrest >= 0 ? formatPercent(unrest) : '—'}</dd>
            <dt>Consolidation</dt>
            <dd>
              {!economy || owner === origin
                ? '—'
                : game.controllerOf(provinceId) === origin
                  ? 'pas encore tenue'
                  : formatPercent(economy.consolidation[provinceId])}
            </dd>
            <dt>Gisements</dt>
            <dd>
              {[selected.oil > 0 ? `pétrole ${selected.oil}` : '', selected.steel > 0 ? `acier ${selected.steel}` : '']
                .filter(Boolean)
                .join(' · ') || '—'}
            </dd>
            <dt>Bâtiments</dt>
            <dd>
              {(economy
                ? [
                    economy.factories[provinceId] ? `usines ${economy.factories[provinceId]}` : '',
                    economy.infrastructure[provinceId] ? `infra. ${economy.infrastructure[provinceId]}` : '',
                    economy.depots[provinceId] ? 'dépôt' : '',
                    ...(Object.keys(economy.buildings) as (keyof typeof economy.buildings)[]).map((kind) =>
                      economy.buildings[kind][provinceId] ? `${BUILD_NAMES[kind].toLowerCase()} ${economy.buildings[kind][provinceId]}` : '',
                    ),
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : '') || '—'}
            </dd>
            <dt>Terrain ici</dt>
            <dd>{TERRAIN_NAMES[state.selected.terrain]}</dd>
          </dl>
        </aside>
      )}
      {state.startError && <div class="panel toast" role="alert">{state.startError}</div>}
      {game && game.defeatedBy !== 0 && !game.defeatSeen && <DefeatDialog game={game} nameOf={nameOf} />}
    </>
  );
}
