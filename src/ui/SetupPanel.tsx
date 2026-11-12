import { useEffect, useState } from 'preact/hooks';
import { type SaveSlot, type StoredSave, listSaves } from '../game/saves.ts';
import type { NationData } from '../map/types.ts';
import { formatDate } from '../game/time.ts';
import { Blason } from './Art.tsx';
import { formatGdp, integer } from './format.ts';

interface SetupProps {
  nations: NationData[];
  /** Pays cliqué sur la carte : il devient le pays choisi. */
  picked: number;
  onStart(player: number): void;
  onResume(slot: SaveSlot): void;
}

const SLOT_NAMES: Record<SaveSlot, string> = { auto: 'Sauvegarde automatique', manual: 'Ta sauvegarde' };

const savedDate = (time: number) =>
  new Date(time).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function SetupPanel({ nations, picked, onStart, onResume }: SetupProps) {
  const [player, setPlayer] = useState(nations.findIndex((nation) => nation.code === 'FRA') + 1);
  useEffect(() => {
    if (picked > 0) setPlayer(picked);
  }, [picked]);
  const chosen = nations[player - 1];
  const [saves, setSaves] = useState<StoredSave[]>([]);
  useEffect(() => {
    void listSaves().then(setSaves);
  }, []);

  // Les régions historiques, en sommeil, ne se jouent pas.
  const options = nations
    .map((nation, index) => ({ id: index + 1, name: nation.name, region: nation.parent !== undefined }))
    .filter((option) => !option.region)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  return (
    <section class="panel setup" aria-label="Nouvelle partie">
      {saves.length > 0 && (
        <div class="saves">
          <h2>Continuer</h2>
          {saves.map(({ slot, meta }) => (
            <button key={slot} class="save-entry" onClick={() => onResume(slot)}>
              <b>{meta.playerName}</b> · {formatDate(meta.tick)}
              <small>
                {SLOT_NAMES[slot]} · {savedDate(meta.savedAt)}
              </small>
            </button>
          ))}
        </div>
      )}
      <h2>Nouvelle partie</h2>
      <label>
        Ton pays
        <select value={player} onChange={(event) => setPlayer(Number(event.currentTarget.value))}>
          {options.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <p class="setup-note">Ou clique sur un pays de la carte.</p>
      <div class="setup-nation">
        <Blason nation={chosen} size="large" />
        <b>{chosen.name}</b>
      </div>
      <dl class="setup-facts">
        <dt>Population</dt>
        <dd>{integer.format(chosen.population)}</dd>
        <dt>PIB</dt>
        <dd>{formatGdp(chosen.gdpMusd)}</dd>
        <dt>Superficie</dt>
        <dd>{integer.format(chosen.areaKm2)} km²</dd>
      </dl>
      <p class="setup-note">Tu commences en paix. Le reste du monde, lui, n'attendra pas.</p>
      <button class="action" onClick={() => onStart(player)}>
        Commencer
      </button>
    </section>
  );
}
