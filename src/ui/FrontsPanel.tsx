import { GAME_SPEEDS, type GameClient } from '../game/GameClient.ts';
import type { NationData } from '../map/types.ts';
import type { MapView } from '../render/MapView.ts';
import type { FrontSnapshot, Stance } from '../sim/protocol.ts';
import { formatClock, formatRatio, integer } from './format.ts';

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
      {GAME_SPEEDS.map((speed) => (
        <button
          key={speed}
          class={game.speed === speed ? 'on' : ''}
          aria-pressed={game.speed === speed}
          aria-label={`Vitesse ${speed}`}
          onClick={() => game.setSpeed(speed)}
        >
          ×{speed}
        </button>
      ))}
    </div>
  );
}

function OffensivesSection({ game, nations, view, aiming }: { game: GameClient; nations: NationData[]; view: MapView; aiming: boolean }) {
  const offensives = game.playerOffensives();
  const reserve = game.snapshot?.nations.find((entry) => entry.id === game.player)?.reserve ?? 0;
  const committed = reserve * game.offensiveShare;
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
                {integer.format(offensive.force)} <small>· {integer.format(offensive.captured)} cellules prises</small>
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
  const closed = front.length === 0 && game.snapshot!.tick > 0;
  const enemyPocket = game.snapshot?.nations.find((entry) => entry.id === enemyId)?.pocketCells ?? 0;

  return (
    <article class="front">
      <header>
        <h3>
          <span class="swatch" style={{ background: enemy.color }} />
          {enemy.name}
        </h3>
        <span class={`ratio ${ratio >= 1 ? 'ahead' : 'behind'}`}>{formatRatio(ratio)}</span>
      </header>
      {closed ? (
        <p class="front-note">Plus de frontière terrestre commune.</p>
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
        </>
      )}
      <dl>
        <dt>Sur le front</dt>
        <dd>{integer.format(own.force)} / {integer.format(theirs.force)}</dd>
        <dt>Adversaire</dt>
        <dd>{STANCE_STATUS[theirs.stance]}</dd>
        <dt>Longueur</dt>
        <dd>{integer.format(front.length)}</dd>
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
    </article>
  );
}

interface FrontsPanelProps {
  game: GameClient;
  nations: NationData[];
  view: MapView;
  aiming: boolean;
}

export function FrontsPanel({ game, nations, view, aiming }: FrontsPanelProps) {
  if (game.error) {
    return <div class="panel fronts"><p class="front-note">Simulation arrêtée : {game.error}</p></div>;
  }
  const nation = nations[game.player - 1];
  const stats = game.snapshot?.nations.find((entry) => entry.id === game.player);
  const fronts = game.playerFronts();
  const delta = stats ? stats.cells - game.startCells : 0;

  return (
    <section class="panel fronts" aria-label="Fronts">
      <header class="nation">
        <h2>
          <span class="swatch" style={{ background: nation.color }} />
          {nation.name}
        </h2>
        <span class="clock">{game.speed === 0 ? 'en pause' : formatClock(game.elapsedSeconds)}</span>
      </header>
      <SpeedControls game={game} />
      {stats && (
        <dl>
          <dt>Armée</dt>
          <dd>{integer.format(stats.army)} / {integer.format(stats.capacity)}</dd>
          <dt>Réserve</dt>
          <dd>{integer.format(stats.reserve)}</dd>
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
        </dl>
      )}
      <OffensivesSection game={game} nations={nations} view={view} aiming={aiming} />
      {fronts.map((front) => (
        <FrontCard key={`${front.a}-${front.b}`} game={game} front={front} nations={nations} />
      ))}
    </section>
  );
}
