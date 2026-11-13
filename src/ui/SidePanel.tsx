// Panneau de gauche, en onglets : chaque onglet garde ses lignes à la même place, et défile seul.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { type GameClient, LOW_SUPPLY } from '../game/GameClient.ts';
import { BUILD_EFFECTS, BUILD_NAMES } from '../game/buildings.ts';
import { POLE_EFFECTS, axisEffects, poleName } from '../game/doctrines.ts';
import { effortEffect } from '../game/economy.ts';
import { formatShortDate } from '../game/time.ts';
import type { NationData } from '../map/types.ts';
import type { MapTool, MapView } from '../render/MapView.ts';
import {
  ALLIANCE_MAX_AGGRESSION,
  DEMAND_INDEPENDENCE_AT,
  DEMAND_INVESTMENT_AT,
  AXIS_BONUS,
  INVESTMENT_WEEKS,
  MAX_AXIS_TERMINALS,
  MAX_COUNTER_SHARE,
  MAX_TRADE_DEALS,
  TRADE_DEPENDENCE,
  MAX_PRIORITY_ZONES,
} from '../sim/balance.ts';
import {
  ARCHETYPES,
  BALANCED_ARCHETYPE,
  DOCTRINE_AXES,
  DOCTRINE_REACH,
  DOCTRINE_SPEED_PER_WEEK,
  MAX_RESEARCH_LEVEL,
  RESEARCH_COST,
  archetypeOf,
} from '../sim/doctrine.ts';
import type { AxisSnapshot, FrontSnapshot, Stance } from '../sim/protocol.ts';
import { Art, Blason } from './Art.tsx';
import { formatChange, formatGdp, formatPercent, formatRatio, integer } from './format.ts';

type Tab = 'fronts' | 'economy' | 'defense' | 'doctrine' | 'diplomacy';

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
          <Blason nation={enemy} />
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

/**
 * Commerce : accès aux partenaires, accords et embargos, et axes commerciaux tracés sur la carte.
 */
function TradeSection({ game, view, tool }: { game: GameClient; view: MapView; tool: MapTool | null }) {
  const stats = game.playerStats;
  if (!stats) return null;
  const names = (ids: number[]) => (ids.length > 0 ? ids.map((id) => game.nameOf(id)).join(', ') : 'aucun');
  const axes = game.playerAxes;
  const queued = stats.builds.filter((order) => order.kind === 'axis').length;
  return (
    <section>
      <h3>Commerce</h3>
      <dl>
        <dt>Accès au commerce</dt>
        <dd class={stats.trade < 0.8 ? 'behind' : ''}>{formatPercent(stats.trade)}</dd>
        <dt>Effet sur le PIB</dt>
        <dd class={stats.tradeFactor > 1.0005 ? 'ahead' : stats.tradeFactor < 0.9995 ? 'behind' : ''}>{formatChange(stats.tradeFactor - 1, 1)}</dd>
        <dt>Accords</dt>
        <dd>
          {stats.deals.length} / {MAX_TRADE_DEALS} · {names(stats.deals)}
        </dd>
        <dt>Tes embargos</dt>
        <dd>{names(stats.embargoes)}</dd>
        <dt>Embargos subis</dt>
        <dd class={stats.embargoedBy.length > 0 ? 'behind' : ''}>{names(stats.embargoedBy)}</dd>
      </dl>
      <Note lines={3}>
        {`Tu commerces avec tes voisins, et par la mer avec tout pays qui borde une même mer. Guerre, embargo et ` +
          `blocus coupent ces échanges : coupé de tous, tu perdrais ${formatPercent(TRADE_DEPENDENCE)} de ton PIB et tes ` +
          `importations. Un accord (fiche d'un pays) en rapporte un peu plus.`}
      </Note>
      <h3>Axes commerciaux</h3>
      <button class={`action ${tool === 'axis' ? 'armed' : ''}`} aria-pressed={tool === 'axis'} onClick={() => view.setTool(tool === 'axis' ? null : 'axis')}>
        {tool === 'axis' ? "Glisse d'une de tes provinces à une autre, ou chez un partenaire" : 'Tracer un axe commercial'}
      </button>
      <Note lines={2}>
        {`Chaque province traversée gagne ${formatPercent(AXIS_BONUS)} de PIB et de capacité, chez toi comme chez un ` +
          `partenaire commercial. L'ennemi qui en prend une province le coupe. Ton réseau a ${MAX_AXIS_TERMINALS} terminus ` +
          `au plus : prolonger une route ou relier deux de ses villes n'en ajoute pas, une branche en ajoute un.`}
      </Note>
      <AxisNetwork game={game} axes={axes} queued={queued} />
    </section>
  );
}

/**
 * Le réseau commercial en un coup d'œil : combien d'axes, de villes reliées, de tronçons coupés, et
 * les routes de ses accords ; la liste des axes, d'une ville à l'autre, se replie dès qu'elle
 * s'allonge, les axes coupés en tête.
 */
function AxisNetwork({ game, axes, queued }: { game: GameClient; axes: AxisSnapshot[]; queued: number }) {
  const [open, setOpen] = useState(false);
  const { provinces } = game.worldData;
  const routes = game.axes.filter((axis) => axis.partner !== 0 && (axis.nation === game.player || axis.partner === game.player));
  const cities = new Set([...axes, ...routes].flatMap((axis) => axis.path));
  const cut = axes.filter((axis) => !axis.active);
  const partners = routes.map((axis) => (axis.nation === game.player ? axis.partner : axis.nation));
  const sorted = [...cut, ...axes.filter((axis) => axis.active)];
  const folded = sorted.length > 4 && !open;
  const shown = folded ? sorted.slice(0, 3) : sorted;
  const city = (province: number) => provinces[province - 1]?.name ?? '?';
  const terminals = game.playerStats?.axisTerminals ?? 0;
  return (
    <>
      <dl>
        <dt>Terminus</dt>
        <dd class={terminals >= MAX_AXIS_TERMINALS ? 'behind' : ''}>
          {terminals} / {MAX_AXIS_TERMINALS}
        </dd>
        <dt>Axes</dt>
        <dd>
          {axes.length + queued}
          {queued > 0 ? ` · ${queued} en chantier` : ''}
        </dd>
        <dt>Villes reliées</dt>
        <dd>{integer.format(cities.size)}</dd>
        <dt>Coupés</dt>
        <dd class={cut.length > 0 ? 'behind' : ''}>{cut.length > 0 ? `${cut.length} sur ${axes.length}` : 'aucun'}</dd>
        <dt>Routes d'accords</dt>
        <dd>{partners.length > 0 ? partners.map((id) => game.nameOf(id)).join(', ') : 'aucune'}</dd>
      </dl>
      {shown.length > 0 && (
        <ol class="builds axis-list">
          {shown.map((axis) => {
            const bySea = axis.seaLinks.length > 0;
            return (
              <li key={axis.id}>
                <div class="offensive-row">
                  <span>
                    {city(axis.path[0])} → {city(axis.path[axis.path.length - 1])}{' '}
                    <small>
                      {bySea ? '· par la mer ' : ''}· {axis.provinces} villes
                      {!axis.active && (
                        <>
                          {' '}
                          · <b class="behind">coupé</b>
                        </>
                      )}
                    </small>
                  </span>
                  <button class="close-inline" aria-label="Supprimer cet axe" onClick={() => game.removeAxis(axis.id)}>
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {sorted.length > 4 && (
        <button class="link-button" onClick={() => setOpen(!open)}>
          {open ? 'Replier la liste' : `Voir les ${sorted.length} axes`}
        </button>
      )}
    </>
  );
}

/**
 * Les deux files de chantiers, civile et militaire, qui avancent en même temps. On glisse un
 * chantier pour le remonter ou le descendre dans sa file.
 */
function BuildQueues({ game, military: showMilitary }: { game: GameClient; military: boolean }) {
  const [dragged, setDragged] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const stats = game.playerStats;
  if (!stats) return null;
  const { provinces } = game.worldData;
  const entries = stats.builds.map((order, index) => ({ order, index }));
  const military = entries.filter(({ order }) => order.military);
  const civil = entries.filter(({ order }) => !order.military);
  const share = game.militaryShare;
  const both = military.length > 0 && civil.length > 0;
  const drop = (target: number) => {
    if (dragged !== null && dragged !== target && stats.builds[dragged]?.military === stats.builds[target]?.military) game.moveBuild(dragged, target);
    setDragged(null);
    setOver(null);
  };
  const list = (title: string, items: typeof entries, rate: number, empty: string) => (
    <>
      <h4 class="queue-title">
        {title} <small>· +{integer.format(rate)} pts / sem.</small>
      </h4>
      {items.length === 0 ? (
        <Note lines={1}>{empty}</Note>
      ) : (
        <ol class="builds">
          {items.map(({ order, index }) => (
            <li
              key={`${order.province}-${order.kind}-${order.axis}-${order.region}-${index}`}
              title={BUILD_EFFECTS[order.kind]}
              draggable={items.length > 1}
              class={`${dragged === index ? 'dragging' : ''} ${over === index && dragged !== index ? 'drop-target' : ''}`}
              onDragStart={(event) => {
                setDragged(index);
                event.dataTransfer?.setData('text/plain', String(index));
                if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(event) => {
                if (dragged === null || stats.builds[dragged]?.military !== order.military) return;
                event.preventDefault();
                setOver(index);
              }}
              onDragLeave={() => setOver((current) => (current === index ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                drop(index);
              }}
              onDragEnd={() => {
                setDragged(null);
                setOver(null);
              }}
            >
              <div class="offensive-row">
                <span>
                  {items.length > 1 && <span class="grip" aria-hidden="true">⠿</span>}
                  <Art id={`batiments/${order.kind}`} class="queue-art" />
                  {BUILD_NAMES[order.kind]}{' '}
                  <small>
                    ·{' '}
                    {order.kind === 'fort' || order.kind === 'axis'
                      ? `${integer.format(order.cellCount)} cellules`
                      : order.kind === 'research'
                        ? DOCTRINE_AXES[order.axis].name
                        : order.kind === 'investment'
                          ? game.nameOf(order.region)
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
    </>
  );
  const civilRate = stats.construction * (both ? 1 - share : civil.length > 0 ? 1 : 0);
  const militaryRate = stats.construction * (both ? share : military.length > 0 ? 1 : 0);
  return (
    <section>
      <h3>{showMilitary ? 'Chantiers militaires' : 'Chantiers'}</h3>
      <dl>
        <dt>Capacité</dt>
        <dd>+{integer.format(stats.construction)} pts / sem.</dd>
      </dl>
      <Slider
        label={
          <>
            Partage <b>civil {formatPercent(1 - share)} · militaire {formatPercent(share)}</b>
          </>
        }
        value={Math.round(share * 100)}
        min={0}
        max={100}
        step={10}
        onChange={(value) => game.setMilitaryShare(value / 100)}
      />
      <Note lines={2}>
        {showMilitary
          ? `La file militaire avance en même temps que la civile (onglet Économie, ${civil.length} en cours). Glisse un chantier pour changer son rang.`
          : `La file civile avance en même temps que la militaire (onglet Défense, ${military.length} en cours). Glisse un chantier pour changer son rang.`}
      </Note>
      {showMilitary
        ? list('Militaire', military, militaryRate, 'Fortifications, dépôts, routes du territoire conquis et recherche.')
        : list('Civil', civil, civilRate, 'Clique sur une de tes provinces pour bâtir.')}
    </section>
  );
}

function EconomyTab({ game, nation, view, tool }: { game: GameClient; nation: NationData; view: MapView; tool: MapTool | null }) {
  const stats = game.playerStats;
  if (!stats) return null;
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
      <TradeSection game={game} view={view} tool={tool} />
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
      <BuildQueues game={game} military={false} />
    </>
  );
}

// ——— Doctrine ———

const archetypeOfIndex = (index: number) => (index < 0 ? BALANCED_ARCHETYPE : ARCHETYPES[index]);
const unsignedPercent = (value: number) => `${Math.round(Math.abs(value) * 100)} %`;

function DoctrineAxis({ game, axis, current }: { game: GameClient; axis: number; current: number }) {
  const { name, plus, minus } = DOCTRINE_AXES[axis];
  const { level, queued } = game.researchOf(axis);
  const reach = DOCTRINE_REACH[level];
  const target = game.doctrineTarget(axis);
  const next = level + queued;
  const moving = Math.abs(target - current) > 0.005;
  const pole = poleName(axis, current);
  // Position sur la barre : −1 à gauche, +1 à droite.
  const at = (value: number) => `${(value + 1) * 50}%`;
  return (
    <section class="doctrine-axis">
      <h3>
        {name} <small>· recherche {level} / {MAX_RESEARCH_LEVEL}</small>
      </h3>
      <div class="poles">
        <span title={POLE_EFFECTS[axis][0]}>{minus}</span>
        <b>
          {pole === 'centre' ? 'centre' : `${pole} ${unsignedPercent(current)}`}
          {moving ? ` → ${poleName(axis, target) === 'centre' ? 'centre' : `${poleName(axis, target)} ${unsignedPercent(target)}`}` : ''}
        </b>
        <span title={POLE_EFFECTS[axis][1]}>{plus}</span>
      </div>
      <div class="reach-bar" aria-hidden="true">
        <div class="reach" style={{ left: at(-reach), width: `${reach * 100}%` }} />
        <div class="mid" />
        <div class="current" style={{ left: at(current) }} />
      </div>
      <input
        class="doctrine-range"
        type="range"
        min={-100}
        max={100}
        step={5}
        value={Math.round(target * 100)}
        aria-label={`${name} : de ${minus} à ${plus}`}
        onInput={(event) => {
          game.setDoctrine(axis, Number(event.currentTarget.value) / 100);
          // Hors des bornes, le curseur revient à la borne.
          event.currentTarget.value = String(Math.round(game.doctrineTarget(axis) * 100));
        }}
      />
      <Note lines={2}>{axisEffects(axis, current)}</Note>
      <button class="action quiet" disabled={next >= MAX_RESEARCH_LEVEL} onClick={() => game.research(axis)}>
        {next >= MAX_RESEARCH_LEVEL
          ? queued > 0
            ? 'Dernière recherche en file'
            : 'Recherche complète'
          : `Rechercher le niveau ${next + 1} (jusqu'à ${Math.round(DOCTRINE_REACH[next + 1] * 100)} %) · ${integer.format(RESEARCH_COST * (next + 1))} pts`}
      </button>
    </section>
  );
}

function DoctrineTab({ game }: { game: GameClient }) {
  const stats = game.playerStats;
  if (!stats) return null;
  const doctrine = game.doctrineOf(game.player);
  const current = archetypeOfIndex(archetypeOf(doctrine));
  const aimed = archetypeOfIndex(archetypeOf(DOCTRINE_AXES.map((_, axis) => game.doctrineTarget(axis))));
  const weeks = Math.round(1 / DOCTRINE_SPEED_PER_WEEK);
  return (
    <>
      <section>
        <div class="doctrine-head">
          <Art id={`doctrines/${current.id}`} class="doctrine-art" />
          <div>
            <h3>{current.name}</h3>
            <small>{aimed.id !== current.id ? `En route vers : ${aimed.name}` : 'Ta doctrine'}</small>
          </div>
        </div>
        <Note lines={4}>
          {`Chaque axe va d'un pôle à l'autre : chacun apporte un gain et coûte quelque chose, le centre ne fait rien. ` +
            `Ta doctrine glisse vers ta cible, du centre à un bout en ${weeks} semaines (deux fois plus en guerre). ` +
            `La recherche repousse les bornes de chaque axe ; elle prend sur tes chantiers.`}
        </Note>
      </section>
      {DOCTRINE_AXES.map((_, axis) => (
        <DoctrineAxis key={axis} game={game} axis={axis} current={doctrine[axis] ?? 0} />
      ))}
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
      <BuildQueues game={game} military={true} />
    </>
  );
}

// ——— Diplomatie ———

function DiplomacyTab({ game, nations }: { game: GameClient; nations: NationData[] }) {
  const stats = game.playerStats;
  if (!stats) return null;
  const name = (id: number) => game.nameOf(id);
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
 * Régions annexées et régions historiques du pays : une jauge chacune, des repères aux seuils des
 * demandes, et les demandes en attente avec leurs boutons. Les régions historiques calmes ne sont
 * que nommées.
 */
function RegionsSection({ game, nations }: { game: GameClient; nations: NationData[] }) {
  const stats = game.playerStats;
  if (!stats) return null;
  const historic = (origin: number) => nations[origin - 1].parent !== undefined;
  const quiet = (movement: (typeof stats.movements)[number]) =>
    historic(movement.origin) && movement.unrest < 0.01 && movement.demand === '' && !movement.investing;
  const movements = stats.movements.filter((movement) => !quiet(movement)).sort((a, b) => b.unrest - a.unrest || a.origin - b.origin);
  const calm = stats.movements.filter(quiet).sort((a, b) => b.share - a.share);
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
      <h3>Régions</h3>
      <Note lines={3}>
        {`Régions annexées et régions historiques de ton pays. Leur agitation tend vers un plafond (le trait blanc) : ` +
          `bas si tu les équipes, haut si ton pays est instable ou en guerre, et plus haut pour une identité forte. ` +
          `Elles demandent des investissements, puis l'indépendance ; à 100 %, elles se soulèvent.`}
      </Note>
      {movements.length === 0 && <Note lines={1}>Aucune région ne s'agite.</Note>}
      {movements.map((movement) => (
        <div class={`region ${movement.demand ? 'offer' : ''}`} key={movement.origin}>
          <div class="offensive-row">
            <span>
              <Blason nation={nations[movement.origin - 1]} />
              {game.nameOf(movement.origin)}{' '}
              <small>
                · {historic(movement.origin) ? `identité ${IDENTITY_NAMES[nations[movement.origin - 1].identity ?? 1]}` : 'annexée'} ·{' '}
                {formatPercent(movement.share)} du pays · équipée à {formatPercent(movement.care)}
              </small>
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
      {calm.length > 0 && (
        <p class="region-calm">
          Calmes : {calm.map((movement) => game.nameOf(movement.origin)).join(', ')}.
        </p>
      )}
    </section>
  );
}

const IDENTITY_NAMES = ['', 'faible', 'moyenne', 'forte', 'très forte'];

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
  // Le jeu peut demander un onglet (une guerre ouvre les fronts) ; le joueur reste libre d'en changer ensuite.
  const handled = useRef(game.tabRequest.seq);
  useEffect(() => {
    if (game.tabRequest.seq === handled.current) return;
    handled.current = game.tabRequest.seq;
    setTab(game.tabRequest.tab as Tab);
  }, [game.tabRequest.seq]);
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
    { id: 'economy', label: 'Économie', badge: stats?.builds.filter((order) => !order.military).length ? String(stats?.builds.filter((order) => !order.military).length) : '', alert: false },
    {
      id: 'defense',
      label: 'Défense',
      badge: stats?.pocketCells ? '!' : stats?.builds.some((order) => order.military) ? String(stats.builds.filter((order) => order.military).length) : '',
      alert: (stats?.pocketCells ?? 0) > 0,
    },
    { id: 'doctrine', label: 'Doctrine', badge: '', alert: false },
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
        {tab === 'economy' && <EconomyTab game={game} nation={nation} view={view} tool={tool} />}
        {tab === 'defense' && <DefenseTab game={game} view={view} tool={tool} />}
        {tab === 'doctrine' && <DoctrineTab game={game} />}
        {tab === 'diplomacy' && <DiplomacyTab game={game} nations={nations} />}
      </div>
    </section>
  );
}
