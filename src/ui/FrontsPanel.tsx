import { GAME_SPEEDS, type GameClient, SPEED_LABELS } from '../game/GameClient.ts';
import { formatDate } from '../game/time.ts';
import type { NationData } from '../map/types.ts';
import type { MapTool, MapView } from '../render/MapView.ts';
import type { BuildKind, FrontSnapshot, Stance } from '../sim/protocol.ts';
import { LOW_SUPPLY } from '../game/GameClient.ts';
import { MAX_COUNTER_SHARE, MAX_PRIORITY_ZONES } from '../sim/balance.ts';
import { effortEffect } from '../game/economy.ts';
import { formatChange, formatGdp, formatPercent, formatRatio, integer } from './format.ts';

const STANCES: { id: Stance; label: string }[] = [
  { id: 'attack', label: 'Attaquer' },
  { id: 'hold', label: 'Tenir' },
  { id: 'retreat', label: 'Replier' },
];

const STANCE_STATUS: Record<Stance, string> = {
  attack: 'attaque',
  hold: 'tient',
  retreat: 'se replie',
};

function SpeedControls({ game }: { game: GameClient }) {
  return (
    <div class="speeds" role="group" aria-label="Vitesse du jeu">
      <button class={game.speed === 0 ? 'on' : ''} aria-pressed={game.speed === 0} onClick={() => game.togglePause()}>
        Pause
      </button>
      {GAME_SPEEDS.map((speed, index) => (
        <button
          key={speed}
          class={game.speed === speed ? 'on' : ''}
          aria-pressed={game.speed === speed}
          aria-label={`Vitesse ${SPEED_LABELS[index]}`}
          onClick={() => game.setSpeed(speed)}
        >
          {SPEED_LABELS[index]}
        </button>
      ))}
    </div>
  );
}

function GameMenu({ game }: { game: GameClient }) {
  const backToMenu = async () => {
    // Quitter ne perd rien : la partie part d'abord en sauvegarde automatique.
    if (game.canCommand) await game.save('auto');
    window.location.reload();
  };
  return (
    <div class="game-menu">
      <button disabled={game.saving} onClick={() => void game.save('manual')}>
        {game.saving ? 'Sauvegarde…' : 'Sauvegarder'}
      </button>
      <button disabled={game.saving} onClick={() => void backToMenu()}>
        Quitter vers le menu
      </button>
    </div>
  );
}

function EconomySection({ game, nation }: { game: GameClient; nation: NationData }) {
  const stats = game.playerStats;
  if (!stats) return null;
  const target = game.effortTarget;
  const converting = Math.abs(stats.effort - target) > 0.005;
  const change = stats.output / Math.max(1, nation.gdpMusd) - 1;
  const atWar = game.playerFronts().length > 0;
  return (
    <section class="economy">
      <h3>Économie</h3>
      <dl>
        <dt>PIB</dt>
        <dd>
          {formatGdp(stats.output)}{' '}
          <small class={change > 0.005 ? 'ahead' : change < -0.005 ? 'behind' : ''}>({formatChange(change, 0)})</small>
        </dd>
        <dt>{stats.growth < 0 ? 'Usure' : 'Croissance'}</dt>
        <dd class={stats.growth > 0.0005 ? 'ahead' : stats.growth < -0.0005 ? 'behind' : ''}>{formatChange(stats.growth)} / sem.</dd>
      </dl>
      <label class="allocation">
        <span>
          Effort de guerre <b>{formatPercent(target)}{converting ? ` · atteint ${formatPercent(stats.effort)}` : ''}</b>
        </span>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={Math.round(target * 100)}
          aria-label="Effort de guerre"
          onInput={(event) => game.setEffort(Number(event.currentTarget.value) / 100)}
        />
      </label>
      <p class="front-note">
        {converting ? 'Reconversion de l\'économie en cours. ' : ''}
        {stats.effortCap < target - 0.005
          ? `Ton pays, las de la guerre, ne suit plus au-delà de ${formatPercent(stats.effortCap)}.`
          : effortEffect(target, atWar)}
      </p>
      <HomeFront game={game} />
    </section>
  );
}

const BUILD_NAMES: Record<BuildKind, string> = {
  factory: 'Usine',
  infrastructure: 'Infrastructure',
  depot: 'Dépôt',
  fort: 'Fortifications',
};

/** Hommes, stabilité, ressources et chantiers. */
function HomeFront({ game }: { game: GameClient }) {
  const stats = game.playerStats;
  if (!stats) return null;
  const { provinces } = game.worldData;
  const manpowerShare = stats.manpowerMax > 0 ? stats.manpower / stats.manpowerMax : 1;
  return (
    <>
      <dl>
        <dt>Main-d'œuvre</dt>
        <dd class={manpowerShare < 0.25 ? 'behind' : ''}>
          {integer.format(stats.manpower)} / {integer.format(stats.manpowerMax)}
        </dd>
        <dt>Stabilité</dt>
        <dd class={stats.stability < 0.5 ? 'behind' : ''}>{formatPercent(stats.stability)}</dd>
        <dt>Pétrole</dt>
        <dd class={stats.oil < 0.8 ? 'behind' : ''}>
          {formatPercent(stats.oil)}
          {stats.blockaded ? ' · blocus' : ''}
        </dd>
        <dt>Acier</dt>
        <dd class={stats.steel < 0.8 ? 'behind' : ''}>{formatPercent(stats.steel)}</dd>
        <dt>Chantiers</dt>
        <dd>+{integer.format(stats.construction)} pts / sem.</dd>
      </dl>
      {stats.builds.length === 0 ? (
        <p class="front-note">Aucun chantier. Clique sur une de tes provinces pour bâtir.</p>
      ) : (
        <ol class="builds">
          {stats.builds.map((order, index) => (
            <li key={`${order.province}-${order.kind}-${index}`}>
              <div class="offensive-row">
                <span>
                  {BUILD_NAMES[order.kind]}{' '}
                  <small>· {order.kind === 'fort' ? `${integer.format(order.cellCount)} cellules` : provinces[order.province - 1].name}</small>
                </span>
                <button class="close-inline" aria-label="Annuler ce chantier" onClick={() => game.cancelBuild(index)}>
                  ×
                </button>
              </div>
              <div class="gauge">
                <div style={{ width: `${Math.min(100, (order.progress / order.cost) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

/** Préparer la défense : lignes fortifiées, secteurs prioritaires, réserve de contre-attaque. */
function DefenseSection({ game, view, tool }: { game: GameClient; view: MapView; tool: MapTool | null }) {
  const stats = game.playerStats;
  if (!stats) return null;
  const zones = stats.priorityZones;
  const counter = game.counterShare;
  const counterForce = stats.army * counter;
  const toggle = (wanted: MapTool) => view.setTool(tool === wanted ? null : wanted);
  return (
    <section class="defense">
      <h3>Défense</h3>
      <button class={`action ${tool === 'fort' ? 'armed' : ''}`} aria-pressed={tool === 'fort'} onClick={() => toggle('fort')}>
        {tool === 'fort' ? 'Glisse le long de la ligne à fortifier' : 'Tracer une ligne fortifiée'}
      </button>
      <button
        class={`action ${tool === 'priority' ? 'armed' : ''}`}
        aria-pressed={tool === 'priority'}
        disabled={zones.length >= MAX_PRIORITY_ZONES && tool !== 'priority'}
        onClick={() => toggle('priority')}
      >
        {tool === 'priority' ? 'Clique le secteur à tenir en priorité' : `Secteur prioritaire (${zones.length}/${MAX_PRIORITY_ZONES})`}
      </button>
      {zones.map((zone, index) => (
        <div class="offensive-row" key={`${zone.x}-${zone.y}`}>
          <span>
            Secteur {index + 1} <small>· tes forces s'y concentrent</small>
          </span>
          <button class="close-inline" aria-label="Retirer ce secteur prioritaire" onClick={() => game.removePriority(index)}>
            ×
          </button>
        </div>
      ))}
      <label class="allocation">
        <span>
          Réserve de contre-attaque <b>{formatPercent(counter)} · {integer.format(counterForce)}</b>
        </span>
        <input
          type="range"
          min="0"
          max={Math.round(MAX_COUNTER_SHARE * 100)}
          step="5"
          value={Math.round(counter * 100)}
          aria-label="Réserve de contre-attaque"
          onInput={(event) => game.setCounterShare(Number(event.currentTarget.value) / 100)}
        />
      </label>
      <p class="front-note">
        {counter > 0
          ? stats.reserve < counterForce * 0.5
            ? 'Ta réserve est trop maigre : baisse les forces engagées sur les fronts.'
            : 'Une percée ennemie sur ton sol sera prise en tenaille à sa base.'
          : 'Garde une part de ton armée pour contrer d\'elle-même les percées ennemies.'}
      </p>
    </section>
  );
}

function OffensivesSection({ game, nations, view, tool }: { game: GameClient; nations: NationData[]; view: MapView; tool: MapTool | null }) {
  const aiming = tool === 'offensive';
  const offensives = game.playerOffensives();
  const committed = (game.playerStats?.reserve ?? 0) * game.offensiveShare;
  const enemyOffensives = (game.snapshot?.offensives ?? []).filter(
    (offensive) => offensive.nation !== game.player && game.isAtWarWith(offensive.nation),
  );

  return (
    <section class="offensives">
      <h3>Offensives</h3>
      <label class="allocation">
        <span>
          Réserve engagée <b>{Math.round(game.offensiveShare * 100)} % · {integer.format(committed)}</b>
        </span>
        <input
          type="range"
          min="10"
          max="100"
          step="5"
          value={Math.round(game.offensiveShare * 100)}
          onInput={(event) => game.setOffensiveShare(Number(event.currentTarget.value) / 100)}
        />
      </label>
      <button class={`action ${aiming ? 'armed' : ''}`} aria-pressed={aiming} onClick={() => view.setAiming(!aiming)}>
        {aiming ? 'Glisse de ton territoire vers la cible' : 'Tracer une offensive'}
      </button>
      {offensives.map((offensive) => {
        const strength = Math.min(1, offensive.force / Math.max(1, offensive.startForce));
        return (
          <div class="offensive" key={offensive.id}>
            <div class="offensive-row">
              <span>
                {integer.format(offensive.force)}{' '}
                <small>
                  · {offensive.inTransit ? 'en mer' : `${integer.format(offensive.captured)} cellules prises`}
                  {!offensive.inTransit && (
                    <span class={offensive.supply < LOW_SUPPLY ? 'behind' : ''}> · ravitaillée à {formatPercent(offensive.supply)}</span>
                  )}
                </small>
              </span>
              <button class="close-inline" aria-label="Arrêter l'offensive et rendre ses forces à la réserve" onClick={() => game.cancelOffensive(offensive.id)}>
                ×
              </button>
            </div>
            <div class="gauge">
              <div style={{ width: `${strength * 100}%` }} />
            </div>
          </div>
        );
      })}
      {enemyOffensives.length > 0 && (
        <p class="alert">
          {enemyOffensives.length === 1
            ? `Offensive de ${nations[enemyOffensives[0].nation - 1].name} en cours.`
            : `${enemyOffensives.length} offensives ennemies en cours.`}
        </p>
      )}
    </section>
  );
}

function FrontCard({ game, front, nations }: { game: GameClient; front: FrontSnapshot; nations: NationData[] }) {
  const mine = front.a === game.player ? 0 : 1;
  const enemyId = mine === 0 ? front.b : front.a;
  const enemy = nations[enemyId - 1];
  const own = front.sides[mine];
  const theirs = front.sides[1 - mine];
  const order = game.orderFor(enemyId);
  const ratio = Math.exp(mine === 0 ? front.logRatio : -front.logRatio);
  const balance = (ratio / (1 + ratio)) * 100;
  const net = own.captured - theirs.captured;
  const noContact = front.length === 0;
  const enemyPocket = game.snapshot?.nations.find((entry) => entry.id === enemyId)?.pocketCells ?? 0;

  return (
    <article class="front">
      <header>
        <h3>
          <span class="swatch" style={{ background: enemy.color }} />
          {enemy.name}
        </h3>
        {!noContact && <span class={`ratio ${ratio >= 1 ? 'ahead' : 'behind'}`}>{formatRatio(ratio)}</span>}
      </header>
      {noContact ? (
        <p class="front-note">Pas de frontière commune : trace une flèche au-dessus de la mer pour débarquer.</p>
      ) : (
        <>
          <div class="balance" role="img" aria-label={`Rapport de force ${formatRatio(ratio)}`}>
            <div style={{ width: `${balance}%` }} />
          </div>
          <div class="stances" role="group" aria-label={`Posture contre ${enemy.name}`}>
            {STANCES.map(({ id, label }) => (
              <button
                key={id}
                class={order.stance === id ? 'on' : ''}
                aria-pressed={order.stance === id}
                onClick={() => game.setFront(enemyId, order.allocation, id)}
              >
                {label}
              </button>
            ))}
          </div>
          <label class="allocation">
            <span>
              Forces engagées <b>{Math.round(order.allocation * 100)} %</b>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={Math.round(order.allocation * 100)}
              onInput={(event) => game.setFront(enemyId, Number(event.currentTarget.value) / 100, order.stance)}
            />
          </label>
          <dl>
            <dt>Sur le front</dt>
            <dd>{integer.format(own.force)} / {integer.format(theirs.force)}</dd>
            <dt>Adversaire</dt>
            <dd>{STANCE_STATUS[theirs.stance]}</dd>
            <dt>Ravitaillement</dt>
            <dd>
              <span class={own.supply < LOW_SUPPLY ? 'behind' : ''}>{formatPercent(own.supply)}</span> /{' '}
              <span class={theirs.supply < LOW_SUPPLY ? 'ahead' : ''}>{formatPercent(theirs.supply)}</span>
            </dd>
            <dt>Longueur</dt>
            <dd>{integer.format(front.length)}</dd>
          </dl>
        </>
      )}
      <dl>
        <dt>Gains nets</dt>
        <dd class={net > 0 ? 'ahead' : net < 0 ? 'behind' : ''}>
          {net > 0 ? '+' : ''}
          {integer.format(net)}
        </dd>
        {enemyPocket > 0 && (
          <>
            <dt>Ennemi encerclé</dt>
            <dd class="ahead">{integer.format(enemyPocket)}</dd>
          </>
        )}
      </dl>
      {!noContact && (
        <button class="action quiet fortify" onClick={() => game.fortifyFront(enemyId)}>
          Fortifier ce front
        </button>
      )}
    </article>
  );
}

interface FrontsPanelProps {
  game: GameClient;
  nations: NationData[];
  view: MapView;
  tool: MapTool | null;
}

export function FrontsPanel({ game, nations, view, tool }: FrontsPanelProps) {
  if (game.error) {
    return <div class="panel fronts"><p class="front-note">Simulation arrêtée : {game.error}</p></div>;
  }
  const nation = nations[game.player - 1];
  const stats = game.playerStats;
  const fronts = game.playerFronts();
  const delta = stats ? stats.cells - game.startCells : 0;

  return (
    <section class="panel fronts" aria-label="Fronts">
      <header class="nation">
        <h2>
          <span class="swatch" style={{ background: nation.color }} />
          {nation.name}
        </h2>
        <span class="clock">
          {formatDate(game.tick)}
          {game.speed === 0 ? ' · pause' : ''}
        </span>
      </header>
      <SpeedControls game={game} />
      <GameMenu game={game} />
      {!game.canCommand && <p class="alert">Ton pays a capitulé : tu observes le reste de la partie.</p>}
      {stats && game.canCommand && (
        <dl>
          <dt>Armée</dt>
          <dd>{integer.format(stats.army)} / {integer.format(stats.capacity)}</dd>
          <dt>Réserve</dt>
          <dd>{integer.format(stats.reserve)}</dd>
          <dt>Marine</dt>
          <dd>{stats.navy > 0 ? integer.format(stats.navy) : 'aucune'}</dd>
          <dt>Territoire</dt>
          <dd class={delta > 0 ? 'ahead' : delta < 0 ? 'behind' : ''}>
            {integer.format(stats.cells)} ({delta > 0 ? '+' : ''}{integer.format(delta)})
          </dd>
          {stats.pocketCells > 0 && (
            <>
              <dt>Encerclé</dt>
              <dd class="behind">{integer.format(stats.pocketCells)}</dd>
            </>
          )}
          <dt>Nations en vie</dt>
          <dd>{game.snapshot?.aliveNations ?? ''}</dd>
        </dl>
      )}
      {game.canCommand && <EconomySection game={game} nation={nation} />}
      {game.canCommand && fronts.length === 0 && (
        <p class="front-note peace">Tu es en paix. Clique sur un pays pour lui déclarer la guerre.</p>
      )}
      {game.canCommand && <DefenseSection game={game} view={view} tool={tool} />}
      {game.canCommand && <OffensivesSection game={game} nations={nations} view={view} tool={tool} />}
      {game.canCommand && fronts.map((front) => (
        <FrontCard key={`${front.a}-${front.b}`} game={game} front={front} nations={nations} />
      ))}
    </section>
  );
}
