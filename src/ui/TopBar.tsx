// Barre du haut : le pays, le temps, les indicateurs clés, les cartes et le menu, toujours au même endroit.
import { useLayoutEffect, useRef } from 'preact/hooks';
import { GAME_SPEEDS, type GameClient, SPEED_LABELS } from '../game/GameClient.ts';
import { formatDate } from '../game/time.ts';
import type { NationData } from '../map/types.ts';
import type { MapMode } from '../render/MapView.ts';
import { Blason } from './Art.tsx';
import { compact, formatChange, formatGdp, formatPercent, integer } from './format.ts';

/** Les petites armées en entier, les grandes en abrégé : la largeur reste contenue. */
const troops = (value: number) => (value < 1e5 ? integer.format(value) : compact.format(value));

export const MAP_MODES: { id: MapMode; label: string }[] = [
  { id: 'political', label: 'Pays' },
  { id: 'economic', label: 'Économie' },
  { id: 'supply', label: 'Ravitaillement' },
];

/** Un indicateur : un libellé court au-dessus d'une valeur, d'une largeur fixe. */
function Indicator({ label, value, tone = '', title }: { label: string; value: string; tone?: string; title?: string }) {
  return (
    <div class="indicator" title={title}>
      <span>{label}</span>
      <b class={tone}>{value}</b>
    </div>
  );
}

function Indicators({ game, nation }: { game: GameClient; nation: NationData }) {
  const stats = game.playerStats;
  if (!game.canCommand) return <p class="alert">Ton pays a capitulé : tu observes le reste de la partie.</p>;
  if (!stats) return null;
  const manpower = stats.manpowerMax > 0 ? stats.manpower / stats.manpowerMax : 1;
  const change = stats.output / Math.max(1, nation.gdpMusd) - 1;
  const territory = stats.cells - game.startCells;
  return (
    <>
      <Indicator
        label="Armée"
        value={`${troops(stats.army)} / ${troops(stats.capacity)}`}
        title={`Armée : ${integer.format(stats.army)} sur une capacité de ${integer.format(stats.capacity)}`}
      />
      <Indicator
        label="Main-d'œuvre"
        value={formatPercent(manpower)}
        tone={manpower < 0.25 ? 'behind' : ''}
        title={`${integer.format(stats.manpower)} hommes mobilisables sur ${integer.format(stats.manpowerMax)}`}
      />
      <Indicator label="Stabilité" value={formatPercent(stats.stability)} tone={stats.stability < 0.5 ? 'behind' : ''} />
      <Indicator
        label="PIB"
        value={formatGdp(stats.output)}
        tone={change > 0.005 ? 'ahead' : change < -0.005 ? 'behind' : ''}
        title={`${formatChange(change, 0)} depuis le début de la partie`}
      />
      <Indicator
        label={stats.blockaded ? 'Pétrole · blocus' : 'Pétrole'}
        value={formatPercent(stats.oil)}
        tone={stats.oil < 0.8 || stats.blockaded ? 'behind' : ''}
        title="Part des besoins en pétrole couverte"
      />
      <Indicator label="Acier" value={formatPercent(stats.steel)} tone={stats.steel < 0.8 ? 'behind' : ''} title="Part des besoins en acier couverte" />
      <Indicator
        label="Commerce"
        value={formatPercent(stats.trade)}
        tone={stats.trade < 0.8 ? 'behind' : stats.tradeFactor > 1.0005 ? 'ahead' : ''}
        title="Part de tes partenaires commerciaux possibles avec qui tu commerces encore"
      />
      <Indicator
        label="Territoire"
        value={`${territory > 0 ? '+' : ''}${integer.format(territory)}`}
        tone={territory > 0 ? 'ahead' : territory < 0 ? 'behind' : ''}
        title={`${integer.format(stats.cells)} cellules, contre ${integer.format(game.startCells)} au départ`}
      />
    </>
  );
}

interface TopBarProps {
  game: GameClient;
  nation: NationData;
  mapMode: MapMode;
  onMapMode(mode: MapMode): void;
}

export function TopBar({ game, nation, mapMode, onMapMode }: TopBarProps) {
  const bar = useRef<HTMLElement>(null);
  // Les panneaux se placent sous la barre : sa hauteur ne change qu'avec la taille de la fenêtre.
  useLayoutEffect(() => {
    const element = bar.current;
    if (!element) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty('--bar', `${element.offsetHeight}px`));
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--bar');
    };
  }, []);
  const backToMenu = async () => {
    // Quitter ne perd rien : la partie part d'abord en sauvegarde automatique.
    if (game.canCommand) await game.save('auto');
    window.location.reload();
  };
  return (
    <header class="panel topbar" ref={bar}>
      <div class="topbar-group identity">
        <h2 title={nation.name}>
          <Blason nation={nation} />
          {nation.name}
        </h2>
        <time class="clock">{formatDate(game.tick)}</time>
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
      </div>
      <div class="topbar-group indicators">
        <Indicators game={game} nation={nation} />
      </div>
      <div class="topbar-group actions">
        <div class="speeds map-modes" role="group" aria-label="Carte affichée (touches E et R)">
          {MAP_MODES.map(({ id, label }) => (
            <button key={id} class={mapMode === id ? 'on' : ''} aria-pressed={mapMode === id} onClick={() => onMapMode(id)}>
              {label}
            </button>
          ))}
        </div>
        <div class="game-menu">
          <button disabled={game.saving} onClick={() => void game.save('manual')}>
            Sauvegarder
          </button>
          <button disabled={game.saving} onClick={() => void backToMenu()}>
            Menu
          </button>
        </div>
      </div>
    </header>
  );
}
