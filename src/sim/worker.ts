// Fait tourner la simulation hors du fil principal, à cadence fixe.
import { Simulation } from './Simulation.ts';
import { ADJACENCY_INTERVAL_TICKS, TICKS_PER_SECOND } from './balance.ts';
import type { FromWorker, ToWorker, WorkerUpdate } from './protocol.ts';

const scope = self as unknown as {
  postMessage(message: FromWorker, transfer: Transferable[]): void;
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
};

const BASE_TICK_MS = 1000 / TICKS_PER_SECOND;
const MAX_CATCH_UP_TICKS = 3;
const SNAPSHOT_EVERY = 2;

let sim: Simulation | null = null;
let speed = 1;
let last = 0;
let accumulated = 0;
let updates = 0;
let lastLabelTick = 0;

function send(tickMs: number, withSnapshot: boolean): void {
  const changes = sim!.drainChanges();
  // Noms de pays : régulièrement, et tout de suite après une capitulation.
  const capitulation = changes.events.some((event) => event.type === 'capitulation');
  let labels: WorkerUpdate['labels'] = [];
  if (capitulation || sim!.tick - lastLabelTick >= ADJACENCY_INTERVAL_TICKS) {
    labels = sim!.updateLabels();
    lastLabelTick = sim!.tick;
  }
  const update: WorkerUpdate = {
    type: 'update',
    ...changes,
    labels,
    snapshot: withSnapshot || capitulation ? sim!.snapshot() : null,
    tickMs,
  };
  scope.postMessage(update, [changes.cells.buffer, changes.owners.buffer, changes.provinces.buffer, changes.homes.buffer]);
}

function loop(): void {
  const now = performance.now();
  if (speed === 0) {
    last = now;
    return;
  }
  const tickMs = BASE_TICK_MS / speed;
  accumulated += now - last;
  last = now;
  let steps = 0;
  const begin = performance.now();
  while (accumulated >= tickMs && steps < MAX_CATCH_UP_TICKS) {
    sim!.step();
    accumulated -= tickMs;
    steps++;
  }
  // Trop de retard (onglet ralenti) : on abandonne le temps perdu plutôt que de courir après.
  if (accumulated > tickMs * MAX_CATCH_UP_TICKS) accumulated = 0;
  if (steps > 0) {
    updates++;
    send((performance.now() - begin) / steps, updates % SNAPSHOT_EVERY === 0);
  }
}

scope.onmessage = (event) => {
  const message = event.data;
  if (message.type === 'init') {
    sim = new Simulation(message);
    lastLabelTick = sim.tick;
    last = performance.now();
    setInterval(loop, BASE_TICK_MS / 8);
    send(0, true);
  } else if (message.type === 'speed') {
    speed = message.speed;
    accumulated = 0;
  } else if (message.type === 'save') {
    if (!sim) return;
    const save = sim.save();
    scope.postMessage({ type: 'saved', requestId: message.requestId, save }, [save.owners.buffer]);
  } else if (sim) {
    sim.apply(message.command);
    // En pause, le joueur doit voir tout de suite l'effet de ses ordres.
    send(0, true);
  }
};
