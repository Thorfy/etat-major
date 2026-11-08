import { useState } from 'preact/hooks';
import type { NationData } from '../map/types.ts';

interface SetupProps {
  nations: NationData[];
  neighbors: Map<number, number[]>;
  onStart(player: number, enemy: number): void;
}

export function SetupPanel({ nations, neighbors, onStart }: SetupProps) {
  const idOf = (code: string) => nations.findIndex((nation) => nation.code === code) + 1;
  const [player, setPlayer] = useState(idOf('FRA'));
  const [enemy, setEnemy] = useState(idOf('DEU'));

  const byName = (a: number, b: number) => nations[a - 1].name.localeCompare(nations[b - 1].name, 'fr');
  const playable = [...neighbors.keys()].sort(byName);
  const enemies = [...(neighbors.get(player) ?? [])].sort(byName);
  const options = (ids: number[]) =>
    ids.map((id) => (
      <option key={id} value={id}>
        {nations[id - 1].name}
      </option>
    ));

  return (
    <section class="panel setup" aria-label="Nouvelle partie">
      <h2>Nouvelle partie</h2>
      <label>
        Ton pays
        <select
          value={player}
          onChange={(event) => {
            const next = Number(event.currentTarget.value);
            setPlayer(next);
            const candidates = neighbors.get(next) ?? [];
            if (!candidates.includes(enemy)) setEnemy([...candidates].sort(byName)[0]);
          }}
        >
          {options(playable)}
        </select>
      </label>
      <label>
        Ton adversaire
        <select value={enemy} onChange={(event) => setEnemy(Number(event.currentTarget.value))}>
          {options(enemies)}
        </select>
      </label>
      <button class="action" onClick={() => onStart(player, enemy)}>
        Commencer la guerre
      </button>
    </section>
  );
}
