// Fiche d'une de ses régions (région historique ou pays annexé) : son agitation, ses impôts et sa
// levée d'hommes, et l'indépendance qu'on peut lui rendre.
import { useState } from 'preact/hooks';
import type { GameClient } from '../game/GameClient.ts';
import {
  REGION_LEVY_STEP,
  REGION_LEVY_UNREST,
  REGION_POLICY_MAX,
  REGION_POLICY_STABILITY,
  REGION_TAX_STEP,
  REGION_TAX_UNREST,
} from '../sim/balance.ts';
import { formatPercent } from './format.ts';

const TAX_LABELS = ['très allégés', 'allégés', 'normaux', 'lourds', 'écrasants'];
const LEVY_LABELS = ['très faible', 'faible', 'normale', 'forte', 'totale'];

const signed = (value: number) => `${value >= 0 ? '+' : '−'}${formatPercent(Math.abs(value))}`;
const decimal = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}`;

function Stepper({ label, value, labels, onChange }: { label: string; value: number; labels: string[]; onChange(value: number): void }) {
  return (
    <div class="stepper">
      <span>{label}</span>
      <button class="action quiet" aria-label={`${label} : alléger`} disabled={value <= -REGION_POLICY_MAX} onClick={() => onChange(value - 1)}>
        −
      </button>
      <b>{labels[value + REGION_POLICY_MAX]}</b>
      <button class="action quiet" aria-label={`${label} : alourdir`} disabled={value >= REGION_POLICY_MAX} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

export function RegionCard({ game, origin, nameOf }: { game: GameClient; origin: number; nameOf(id: number): string }) {
  const [confirming, setConfirming] = useState(false);
  const movement = game.playerMovement(origin);
  if (!movement || !game.canCommand) return null;
  const historic = game.worldData.nations[origin - 1]?.parent !== undefined;
  const { tax, levy } = game.regionPolicyOf(origin);
  const effects: string[] = [];
  if (tax !== 0) effects.push(`PIB et capacité tirés d'ici ${signed(REGION_TAX_STEP * tax)}`);
  if (levy !== 0) effects.push(`hommes mobilisables ${signed(REGION_LEVY_STEP * levy)}`);
  const unrest = REGION_TAX_UNREST * tax + REGION_LEVY_UNREST * levy;
  if (unrest !== 0) effects.push(`plafond d'agitation ${decimal(unrest)}`);
  // Stabilité, par semaine de jeu : une minute de jeu en vaut une.
  const stability = -REGION_POLICY_STABILITY * movement.share * (tax + levy);
  if (stability !== 0) effects.push(`stabilité du pays ${decimal(stability * 100)} pt par semaine`);
  return (
    <section class="region-card">
      <h3>
        {historic ? 'Région' : 'Pays annexé'} : {nameOf(origin)}
      </h3>
      <dl>
        <dt>Agitation</dt>
        <dd class={movement.unrest >= 0.65 ? 'behind' : ''}>
          {formatPercent(movement.unrest)} <small>· plafond {formatPercent(movement.ceiling)}</small>
        </dd>
        <dt>Part du pays</dt>
        <dd>{formatPercent(movement.share)}</dd>
        <dt>Équipée</dt>
        <dd>{formatPercent(movement.care)}</dd>
      </dl>
      <Stepper label="Impôts" value={tax} labels={TAX_LABELS} onChange={(value) => game.setRegionPolicy(origin, value, levy)} />
      <Stepper label="Levée d'hommes" value={levy} labels={LEVY_LABELS} onChange={(value) => game.setRegionPolicy(origin, tax, value)} />
      <p class="note">{effects.length > 0 ? `${effects.join(' ; ')}.` : 'Impôts et levée normaux : ni gain ni coût.'}</p>
      <button
        class={`action ${confirming ? '' : 'quiet'}`}
        onClick={() => {
          if (!confirming) {
            setConfirming(true);
            return;
          }
          setConfirming(false);
          game.grantIndependence(origin);
        }}
        onBlur={() => setConfirming(false)}
      >
        {confirming ? `Confirmer : ${nameOf(origin)} devient indépendant` : "Proposer l'indépendance"}
      </button>
    </section>
  );
}
