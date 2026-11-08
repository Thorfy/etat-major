import type { GameClient } from '../game/GameClient.ts';
import type { NationData } from '../map/types.ts';
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
      </dl>
    </article>
  );
}

export function FrontsPanel({ game, nations }: { game: GameClient; nations: NationData[] }) {
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
        <span class="clock">{formatClock(game.elapsedSeconds)}</span>
      </header>
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
        </dl>
      )}
      {fronts.map((front) => (
        <FrontCard key={`${front.a}-${front.b}`} game={game} front={front} nations={nations} />
      ))}
    </section>
  );
}
