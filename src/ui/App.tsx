import { useEffect, useState } from 'preact/hooks';
import type { LoadedWorld } from '../map/loadWorld.ts';
import type { MapView } from '../render/MapView.ts';

export interface UiState {
  hover: number;
  selected: number;
  debug: boolean;
}

const integer = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

function formatGdp(millions: number): string {
  if (millions <= 0) return 'n.c.';
  if (millions >= 1e6) return `${(millions / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Bn $`;
  if (millions >= 1e3) return `${integer.format(millions / 1e3)} Md $`;
  return `${integer.format(millions)} M $`;
}

function DebugOverlay({ view }: { view: MapView }) {
  const [text, setText] = useState('');
  useEffect(() => {
    const timer = setInterval(() => {
      const { frameMs, gpuMs, zoom } = view.stats;
      const gpu = gpuMs === null ? 'n.d.' : `${gpuMs.toFixed(1)} ms`;
      setText(`image ${frameMs.toFixed(1)} ms\nGPU   ${gpu}\nzoom  ${zoom.toFixed(2)} px/cellule`);
    }, 250);
    view.continuous = true;
    return () => {
      clearInterval(timer);
      view.continuous = false;
    };
  }, [view]);
  return <div class="panel debug">{text}</div>;
}

export function App({ world, view, state }: { world: LoadedWorld; view: MapView; state: UiState }) {
  const { nations, provinces } = world.data;
  const hovered = state.hover ? provinces[state.hover - 1] : null;
  const selected = state.selected ? provinces[state.selected - 1] : null;
  const nation = selected ? nations[selected.nation] : null;

  return (
    <>
      <div class="panel title">
        <strong>Risk</strong> · titre provisoire
      </div>
      {state.debug && <DebugOverlay view={view} />}
      {hovered && (
        <div class="panel hover">
          {hovered.name} <span>· {nations[hovered.nation].name}</span>
        </div>
      )}
      <div class="panel hints">Glisser : déplacer · Molette : zoomer · Clic : sélectionner · F3 : mesures</div>
      {selected && nation && (
        <aside class="panel info" aria-label="Province sélectionnée">
          <button class="close" aria-label="Fermer" onClick={() => view.select(0)}>
            ×
          </button>
          <h2>
            <span class="swatch" style={{ background: nation.color }} />
            {nation.name}
          </h2>
          <p class="province">{selected.name}</p>
          <dl>
            <dt>Population</dt>
            <dd>{integer.format(nation.population)}</dd>
            <dt>PIB</dt>
            <dd>{formatGdp(nation.gdpMusd)}</dd>
            <dt>Superficie</dt>
            <dd>{integer.format(nation.areaKm2)} km²</dd>
          </dl>
          <h3>Province</h3>
          <dl>
            <dt>Superficie</dt>
            <dd>{integer.format(selected.areaKm2)} km²</dd>
            <dt>Cellules</dt>
            <dd>{integer.format(selected.cells)}</dd>
          </dl>
        </aside>
      )}
    </>
  );
}
