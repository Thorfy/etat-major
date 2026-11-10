// Panneau de gauche, en onglets : chaque onglet garde ses lignes à la même place, et défile seul.
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { type GameClient, LOW_SUPPLY } from '../game/GameClient.ts';
import { BUILD_EFFECTS, BUILD_NAMES } from '../game/buildings.ts';
import { effortEffect } from '../game/economy.ts';
import { formatShortDate } from '../game/time.ts';
import type { NationData } from '../map/types.ts';
import type { MapTool, MapView } from '../render/MapView.ts';
import {
  ALLIANCE_MAX_AGGRESSION,
  DEMAND_INDEPENDENCE_AT,
  DEMAND_INVESTMENT_AT,
  INVESTMENT_WEEKS,
  MAX_COUNTER_SHARE,
  MAX_PRIORITY_ZONES,
} from '../sim/balance.ts';
import type { FrontSnapshot, Stance } from '../sim/protocol.ts';
import { formatChange, formatGdp, formatPercent, formatRatio, integer } from './format.ts';

type Tab = 'fronts' | 'economy' | 'defense' | 'diplomacy';

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


/** Une note d'aide à hauteur réservée : qu'elle change ou se vide, rien ne bouge en dessous. */
function Note({ children, alert = false, lines = 2 }: { children?: ComponentChildren; alert?: boolean; lines?: number }) {
  return (
    <p class={`note ${alert ? 'alert' : ''}`} style={{ minHeight: `${lines * 1.4}em` }}>
      {children}
    </p>
  );
}

function Slider({ label, value, min, max, step, onChange }: { label: ComponentChildren; value: number; min: number; max: number; step: number; onChange(value: number): void }) {
  return (
    <label class="allocation">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onInput={(event) => onChange(Number(event.currentTarget.value))} />
    </label>
  );
}

// ——— Fronts ———

function FrontCard({ game, front, nations }: { game: GameClient; front: FrontSnapshot; nations: NationData[] }) {
  const mine = front.a === game.player ? 0 : 1;
  const enemyId = mine === 0 ? front.b : front.a;
  const enemy = nations[enemyId - 1];
  const own = front.sides[mine];
  const theirs = front.sides[1 - mine];
  const order = game.orderFor(enemyId);
  const ratio = Math.exp(mine === 0 ? front.logRatio : -front.logRatio);
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
        <span class={`ratio ${noContact ? '' : ratio >= 1 ? 'ahead' : 'behind'}`}>{noContact ? 'par la mer' : formatRatio(ratio)}</span>
      </header>
      <div class="balance" role="img" aria-label={`Rapport de force ${formatRatio(ratio)}`}>
        <div style={{ width: `${noContact ? 50 : (ratio / (1 + ratio)) * 100}%` }} />
      </div>
      <div class="stances" role="group" aria-label={`Posture contre ${enemy.name}`}>
        {STANCES.map(({ id, label }) => (
          <button
            key={id}
            class={order.stance === id ? 'on' : ''}
            aria-pressed={order.stance === id}
            disabled={noContact}
            onClick={() => game.setFront(enemyId, order.allocation, id)}
          >
            {label}
          </button>
        ))}
      </div>
      <Slider
        label={<>Forces engagées <b>{Math.round(order.allocation * 100)} %</b></>}
        value={Math.round(order.allocation * 100)}
        min={0}
        max={100}
        step={1}
        onChange={(value) => game.setFront(enemyId, value / 100, order.stance)}
      />
      <dl>
        <dt>Sur le front</dt>
        <dd>{noContact ? '—' : `${integer.format(own.force)} / ${integer.format(theirs.force)}`}</dd>
        <dt>Adversaire</dt>
        <dd>{noContact ? '—' : STANCE_STATUS[theirs.stance]}</dd>
        <dt>Ravitaillement</dt>
        <dd>
          {noContact ? (
            '—'
          ) : (
            <>
              <span class={own.supply < LOW_SUPPLY ? 'behind' : ''}>{formatPercent(own.supply)}</span> /{' '}
              <span class={theirs.supply < LOW_SUPPLY ? 'ahead' : ''}>{formatPercent(theirs.supply)}</span>
            </>
          )}
        </dd>
        <dt>Gains nets</dt>
        <dd class={net > 0 ? 'ahead' : net < 0 ? 'behind' : ''}>
          {net > 0 ? '+' : ''}
          {integer.format(net)}
        </dd>
        <dt>Ennemi encerclé</dt>
        <dd class={enemyPocket > 0 ? 'ahead' : ''}>{enemyPocket > 0 ? integer.format(enemyPocket) : '—'}</dd>
      </dl>
      <div class="front-actions">
        <button class="action quiet" disabled={noContact} onClick={() => game.fortifyFront(enemyId)}>
          Fortifier ce front
        </button>
        <button class="action quiet" onClick={() => game.proposePeace(enemyId)}>
          Proposer la paix
        </button>
      </div>
    </article>
  );
}

function FrontsTab({ game, nations, view, tool }: { game: GameClient; nations: NationData[]; view: MapView; tool: MapTool | null }) {
  const stats = game.playerStats;
  const aiming = tool === 'offensive';
  const offensives = game.playerOffensives();
  const reserve = stats?.reserve ?? 0;
  const committed = reserve * game.offensiveShare;
  const enemyOffensives = enemyOffensivesOf(game);
  const fronts = game.playerFronts();
  return (
    <>
      <section>
        <h3>Offensives</h3>
        <dl>
          <dt>Réserve</dt>
          <dd>{integer.format(reserve)}</dd>
          <dt>Marine</dt>
          <dd>{stats && stats.navy > 0 ? integer.format(stats.navy) : 'aucune'}</dd>
        </dl>
        <Slider
          label={<>Réserve engagée <b>{Math.round(game.offensiveShare * 100)} % · {integer.format(committed)}</b></>}
          value={Math.round(game.offensiveShare * 100)}
          min={10}
          max={100}
          step={5}
          onChange={(value) => game.setOffensiveShare(value / 100)}
        />
        <button class={`action ${aiming ? 'armed' : ''}`} aria-pressed={aiming} onClick={() => view.setAiming(!aiming)}>
          {aiming ? 'Glisse de ton territoire vers la cible' : 'Tracer une offensive'}
        </button>
        {offensives.map((offensive) => (
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
              <div style={{ width: `${Math.min(1, offensive.force / Math.max(1, offensive.startForce)) * 100}%` }} />
            </div>
          </div>
        ))}
        <Note alert={enemyOffensives.length > 0} lines={1}>
          {enemyOffensives.length === 0
            ? offensives.length === 0
              ? 'Aucune offensive en cours.'
              : ''
            : enemyOffensives.length === 1
              ? `Offensive de ${nations[enemyOffensives[0].nation - 1].name} en cours.`
              : `${enemyOffensives.length} offensives ennemies en cours.`}
        </Note>
      </section>
      <section>
        <h3>Fronts</h3>
        {fronts.length === 0 && <Note>Tu es en paix. Clique sur un pays pour voir ses alliances et lui déclarer la guerre.</Note>}
        {fronts.map((front) => (
          <FrontCard key={`${front.a}-${front.b}`} game={game} front={front} nations={nations} />
        ))}
      </section>
    </>
  );
}

// ——— Économie ———

function EconomyTab({ game, nation }: { game: GameClient; nation: NationData }) {
  const stats = game.playerStats;
  if (!stats) return null;
  const { provinces } = game.worldData;
  const target = game.effortTarget;
  const converting = Math.abs(stats.effort - target) > 0.005;
  const change = stats.output / Math.max(1, nation.gdpMusd) - 1;
  const atWar = game.playerFronts().length > 0;
  const manpowerShare = stats.manpowerMax > 0 ? stats.manpower / stats.manpowerMax : 1;
  return (
    <>
      <section>
        <h3>Production</h3>
        <dl>
          <dt>PIB</dt>
          <dd>
            {formatGdp(stats.output)}{' '}
            <small class={change > 0.005 ? 'ahead' : change < -0.005 ? 'behind' : ''}>({formatChange(change, 0)})</small>
          </dd>
          <dt>{stats.growth < 0 ? 'Usure' : 'Croissance'}</dt>
          <dd class={stats.growth > 0.0005 ? 'ahead' : stats.growth < -0.0005 ? 'behind' : ''}>{formatChange(stats.growth)} / sem.</dd>
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
        </dl>
      </section>
      <section>
        <h3>Effort de guerre</h3>
        <Slider
          label={<>Visé <b>{formatPercent(target)}{converting ? ` · atteint ${formatPercent(stats.effort)}` : ''}</b></>}
          value={Math.round(target * 100)}
          min={0}
          max={100}
          step={5}
          onChange={(value) => game.setEffort(value / 100)}
        />
        <Note lines={3}>
          {converting ? "Reconversion de l'économie en cours. " : ''}
          {stats.effortCap < target - 0.005
            ? `Ton pays, las de la guerre, ne suit plus au-delà de ${formatPercent(stats.effortCap)}.`
            : effortEffect(target, atWar)}
        </Note>
      </section>
      <section>
        <h3>Chantiers</h3>
        <dl>
          <dt>Capacité</dt>
          <dd>+{integer.format(stats.construction)} pts / sem.</dd>
        </dl>
        {stats.builds.length === 0 ? (
          <Note>Aucun chantier. Clique sur une de tes provinces pour bâtir.</Note>
        ) : (
          <ol class="builds">
            {stats.builds.map((order, index) => (
              <li key={`${order.province}-${order.kind}-${index}`} title={BUILD_EFFECTS[order.kind]}>
                <div class="offensive-row">
                  <span>
                    {BUILD_NAMES[order.kind]}{' '}
                    <small>
                      ·{' '}
                      {order.kind === 'fort'
                        ? `${integer.format(order.cellCount)} cellules`
                        : order.kind === 'investment'
                          ? game.worldData.nations[order.region - 1].name
                          : provinces[order.province - 1].name}
                    </small>
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
      </section>
    </>
  );
}

// ——— Défense ———

function DefenseTab({ game, view, tool }: { game: GameClient; view: MapView; tool: MapTool | null }) {
  const stats = game.playerStats;
  if (!stats) return null;
  const zones = stats.priorityZones;
  const counter = game.counterShare;
  const counterForce = stats.army * counter;
  const toggle = (wanted: MapTool) => view.setTool(tool === wanted ? null : wanted);
  return (
    <>
      <section>
        <h3>Situation</h3>
        <dl>
          <dt>Encerclé</dt>
          <dd class={stats.pocketCells > 0 ? 'behind' : ''}>{stats.pocketCells > 0 ? `${integer.format(stats.pocketCells)} cellules` : '—'}</dd>
          <dt>Offensives ennemies</dt>
          <dd class={enemyOffensivesOf(game).length > 0 ? 'behind' : ''}>{enemyOffensivesOf(game).length || '—'}</dd>
        </dl>
      </section>
      <section>
        <h3>Lignes fortifiées</h3>
        <button class={`action ${tool === 'fort' ? 'armed' : ''}`} aria-pressed={tool === 'fort'} onClick={() => toggle('fort')}>
          {tool === 'fort' ? 'Glisse le long de la ligne à fortifier' : 'Tracer une ligne fortifiée'}
        </button>
        <Note lines={3}>{BUILD_EFFECTS.fort} Elles se bâtissent comme des chantiers, dans l'onglet Économie.</Note>
      </section>
      <section>
        <h3>Secteurs prioritaires</h3>
        <button
          class={`action ${tool === 'priority' ? 'armed' : ''}`}
          aria-pressed={tool === 'priority'}
          disabled={zones.length >= MAX_PRIORITY_ZONES && tool !== 'priority'}
          onClick={() => toggle('priority')}
        >
          {tool === 'priority' ? 'Clique le secteur à tenir en priorité' : `Ajouter un secteur (${zones.length}/${MAX_PRIORITY_ZONES})`}
        </button>
        {zones.length === 0 && <Note lines={1}>Aucun secteur : tes forces se répartissent le long des fronts.</Note>}
        {zones.map((zone, index) => (
          <div class="offensive-row zone" key={`${zone.x}-${zone.y}`}>
            <span>
              Secteur {index + 1} <small>· tes forces s'y concentrent</small>
            </span>
            <button class="close-inline" aria-label="Retirer ce secteur prioritaire" onClick={() => game.removePriority(index)}>
              ×
            </button>
          </div>
        ))}
      </section>
      <section>
        <h3>Contre-attaque</h3>
        <Slider
          label={<>Réserve gardée <b>{formatPercent(counter)} · {integer.format(counterForce)}</b></>}
          value={Math.round(counter * 100)}
          min={0}
          max={Math.round(MAX_COUNTER_SHARE * 100)}
          step={5}
          onChange={(value) => game.setCounterShare(value / 100)}
        />
        <Note alert={counter > 0 && stats.reserve < counterForce * 0.5}>
          {counter > 0
            ? stats.reserve < counterForce * 0.5
              ? 'Ta réserve est trop maigre : baisse les forces engagées sur les fronts.'
              : 'Une percée ennemie sur ton sol sera prise en tenaille à sa base.'
            : "Garde une part de ton armée pour contrer d'elle-même les percées ennemies."}
        </Note>
      </section>
    </>
  );
}

// ——— Diplomatie ———

function DiplomacyTab({ game, nations }: { game: GameClient; nations: NationData[] }) {
  const stats = game.playerStats;
  if (!stats) return null;
  const name = (id: number) => nations[id - 1].name;
  const list = (ids: number[], empty: string) => (ids.length > 0 ? ids.map(name).join(', ') : empty);
  return (
    <>
      <section>
        <h3>Relations</h3>
        <dl class="wide">
          <dt>Agressivité</dt>
          <dd class={stats.aggression >= ALLIANCE_MAX_AGGRESSION ? 'behind' : ''}>{formatPercent(stats.aggression)}</dd>
          <dt>Pactes</dt>
          <dd>{list(stats.allies, 'aucun')}</dd>
          <dt>Trêves</dt>
          <dd>{stats.truces.length > 0 ? stats.truces.map((truce) => `${name(truce.nation)} (${formatShortDate(truce.until)})`).join(', ') : 'aucune'}</dd>
          <dt>Rebelles coalisés</dt>
          <dd class={stats.coalition.length > 0 ? 'behind' : ''}>{list(stats.coalition, 'aucun')}</dd>
          <dt>Nations en vie</dt>
          <dd>{game.snapshot?.aliveNations ?? '—'}</dd>
        </dl>
        <Note alert={stats.coalition.length > 0}>
          {stats.coalition.length > 0
            ? 'Des régions de ton pays se sont soulevées ensemble : rends-leur la paix, ou reprends-les.'
            : 'Une agressivité élevée fait refuser tes pactes. Clique sur un pays pour lui proposer un pacte ou la paix.'}
        </Note>
      </section>
      <RegionsSection game={game} nations={nations} />
      <section>
        <h3>Offres de paix</h3>
        {stats.peaceOffers.length === 0 && <Note lines={1}>Aucune offre en attente.</Note>}
        {stats.peaceOffers.map((offer) => (
          <div class="offer" key={offer.nation}>
            <p>
              <b>{name(offer.nation)}</b> propose la paix : chaque province disputée reviendrait à qui la tient.
            </p>
            <div class="stances two">
              <button onClick={() => game.answerPeace(offer.nation, true)}>Accepter</button>
              <button onClick={() => game.answerPeace(offer.nation, false)}>Refuser</button>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

/**
 * Régions annexées qui s'agitent : une jauge chacune, des repères aux seuils des demandes, et les
 * demandes en attente avec leurs boutons.
 */
function RegionsSection({ game, nations }: { game: GameClient; nations: NationData[] }) {
  const stats = game.playerStats;
  if (!stats) return null;
  const movements = [...stats.movements].sort((a, b) => b.unrest - a.unrest || a.origin - b.origin);
  const cost = Math.max(50, Math.round(stats.construction * INVESTMENT_WEEKS));
  const status = (movement: (typeof movements)[number]) => {
    if (movement.demand === 'investment') return `demande des investissements, avant le ${formatShortDate(movement.until)}`;
    if (movement.demand === 'independence') return `demande l'indépendance, avant le ${formatShortDate(movement.until)}`;
    if (movement.investing) return 'investissements en chantier';
    if (movement.ceiling >= 1) return movement.unrest >= 0.85 ? 'au bord du soulèvement : équipe-la' : 'va vers le soulèvement : équipe-la';
    if (movement.ceiling > movement.unrest + 0.02) return `s'agite, jusqu'à ${formatPercent(movement.ceiling)}`;
    if (movement.ceiling < movement.unrest - 0.02) return `se calme, jusqu'à ${formatPercent(movement.ceiling)}`;
    return movement.unrest >= DEMAND_INVESTMENT_AT ? 'agitée' : movement.unrest > 0.05 ? 'tendue' : 'calme';
  };
  return (
    <section>
      <h3>Régions annexées</h3>
      <Note lines={3}>
        {`Leur agitation tend vers un plafond (le trait blanc) : bas si tu les équipes (usines, services publics, ` +
          `recrutement…), haut si elles sont négligées et ton pays instable ou en guerre. Elles demandent des ` +
          `investissements, puis l'indépendance ; à 100 %, elles se soulèvent.`}
      </Note>
      {movements.length === 0 && <Note lines={1}>Aucune région annexée.</Note>}
      {movements.map((movement) => (
        <div class={`region ${movement.demand ? 'offer' : ''}`} key={movement.origin}>
          <div class="offensive-row">
            <span>
              {nations[movement.origin - 1].name} <small>· {formatPercent(movement.share)} du pays · équipée à {formatPercent(movement.care)}</small>
            </span>
            <b class={movement.unrest >= DEMAND_INDEPENDENCE_AT ? 'behind' : ''}>{formatPercent(movement.unrest)}</b>
          </div>
          <div class="gauge unrest" role="img" aria-label={`Agitation ${formatPercent(movement.unrest)}`}>
            <div class={movement.unrest >= DEMAND_INDEPENDENCE_AT ? 'high' : ''} style={{ width: `${movement.unrest * 100}%` }} />
            <i style={{ left: `${DEMAND_INVESTMENT_AT * 100}%` }} />
            <i style={{ left: `${DEMAND_INDEPENDENCE_AT * 100}%` }} />
            <i class="ceiling" style={{ left: `${Math.min(99.5, movement.ceiling * 100)}%` }} title={`Plafond : ${formatPercent(movement.ceiling)}`} />
          </div>
          <p class="region-status">{status(movement)}</p>
          {movement.demand !== '' && (
            <>
              <p>
                {movement.demand === 'investment'
                  ? `Accepter met en tête de tes chantiers ${integer.format(cost)} pts d'investissements chez elle.`
                  : 'Accepter la laisse partir sans combat, avec une trêve d\'un an. Refuser la rapproche du soulèvement.'}
              </p>
              <div class="stances two">
                <button onClick={() => game.answerDemand(movement.origin, true)}>Accepter</button>
                <button onClick={() => game.answerDemand(movement.origin, false)}>Refuser</button>
              </div>
            </>
          )}
        </div>
      ))}
    </section>
  );
}

function enemyOffensivesOf(game: GameClient) {
  return (game.snapshot?.offensives ?? []).filter((offensive) => offensive.nation !== game.player && game.isAtWarWith(offensive.nation));
}

interface SidePanelProps {
  game: GameClient;
  nations: NationData[];
  view: MapView;
  tool: MapTool | null;
}

export function SidePanel({ game, nations, view, tool }: SidePanelProps) {
  const [tab, setTab] = useState<Tab>('fronts');
  if (game.error) {
    return (
      <section class="panel side">
        <div class="tab-body">
          <p class="note alert">Simulation arrêtée : {game.error}</p>
        </div>
      </section>
    );
  }
  if (!game.canCommand) return null;
  const stats = game.playerStats;
  const fronts = game.playerFronts().length;
  const enemyOffensives = enemyOffensivesOf(game).length;
  const offers = (stats?.peaceOffers.length ?? 0) + (stats?.movements.filter((movement) => movement.demand !== '').length ?? 0);
  const tabs: { id: Tab; label: string; badge: string; alert: boolean }[] = [
    { id: 'fronts', label: 'Fronts', badge: fronts ? String(fronts) : '', alert: enemyOffensives > 0 },
    { id: 'economy', label: 'Économie', badge: stats?.builds.length ? String(stats.builds.length) : '', alert: false },
    { id: 'defense', label: 'Défense', badge: stats?.pocketCells ? '!' : '', alert: (stats?.pocketCells ?? 0) > 0 },
    {
      id: 'diplomacy',
      label: 'Diplomatie',
      badge: offers ? String(offers) : stats?.coalition.length ? '!' : '',
      alert: offers > 0 || (stats?.coalition.length ?? 0) > 0,
    },
  ];
  const nation = nations[game.player - 1];
  return (
    <section class="panel side" aria-label="État-major">
      <div class="tabs" role="tablist">
        {tabs.map(({ id, label, badge, alert }) => (
          <button key={id} role="tab" aria-selected={tab === id} class={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
            <span class={`badge ${alert ? 'alert' : ''}`}>{badge}</span>
          </button>
        ))}
      </div>
      <div class="tab-body" role="tabpanel">
        {tab === 'fronts' && <FrontsTab game={game} nations={nations} view={view} tool={tool} />}
        {tab === 'economy' && <EconomyTab game={game} nation={nation} />}
        {tab === 'defense' && <DefenseTab game={game} view={view} tool={tool} />}
        {tab === 'diplomacy' && <DiplomacyTab game={game} nations={nations} />}
      </div>
    </section>
  );
}
