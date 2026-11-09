// Fait tourner la simulation hors du fil principal, à cadence fixe.
import { Simulation } from './Simulation.ts';
import { ADJACENCY_INTERVAL_TICKS, GAME_SPEEDS, TICKS_PER_SECOND } from './balance.ts';
import type { FromWorker, ToWorker, WorkerUpdate } from './protocol.ts';

const scope = self as unknown as {
  postMessage(message: FromWorker, transfer: Transferable[]): void;
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
};

const BASE_TICK_MS = 1000 / TICKS_PER_SECOND;
const MAX_CATCH_UP_TICKS = 4;
/** L'interface n'a pas besoin de plus de 10 états complets par seconde, quelle que soit la vitesse. */
const SNAPSHOT_MS = 100;
/** L'économie du monde change lentement : toutes les 5 s de jeu. */
const ECONOMY_EVERY_TICKS = 50;

let sim: Simulation | null = null;
let speed: number = GAME_SPEEDS[0];
let lastSnapshot = 0;
let last = 0;
let accumulated = 0;
let lastLabelTick = 0;
let lastEconomyTick = -Infinity;

function send(tickMs: number, withSnapshot: boolean, withEconomy = false): void {
  const changes = sim!.drainChanges();
  // Noms de pays : régulièrement, et tout de suite après une capitulation.
  const capitulation = changes.events.some((event) => event.type === 'capitulation');
  let labels: WorkerUpdate['labels'] = [];
  if (capitulation || sim!.tick - lastLabelTick >= ADJACENCY_INTERVAL_TICKS) {
    labels = sim!.updateLabels();
    lastLabelTick = sim!.tick;
  }
  let economy: WorkerUpdate['economy'] = null;
  if (withEconomy || capitulation || sim!.tick - lastEconomyTick >= ECONOMY_EVERY_TICKS) {
    economy = sim!.economySnapshot();
    lastEconomyTick = sim!.tick;
  }
  const update: WorkerUpdate = {
    type: 'update',
    ...changes,
    labels,
    snapshot: withSnapshot || capitulation ? sim!.snapshot() : null,
    economy,
    tickMs,
  };
  const transfer: Transferable[] = [
    changes.cells.buffer,
    changes.owners.buffer,
    changes.provinces.buffer,
    changes.homes.buffer,
    changes.supplyCells.buffer,
    changes.supplyValues.buffer,
  ];
  if (economy) transfer.push(...Object.values(economy).map((array: Float32Array) => array.buffer));
  scope.postMessage(update, transfer);
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
    const snapshot = now - lastSnapshot >= SNAPSHOT_MS;
    if (snapshot) lastSnapshot = now;
    send((performance.now() - begin) / steps, snapshot);
  }
}

scope.onmessage = (event) => {
  const message = event.data;
  if (message.type === 'init') {
    sim = new Simulation(message);
    lastLabelTick = sim.tick;
    last = performance.now();
    setInterval(loop, BASE_TICK_MS / 8);
    send(0, true, true);
  } else if (message.type === 'speed') {
    speed = message.speed;
    accumulated = 0;
  } else if (message.type === 'save') {
    if (!sim) return;
    const save = sim.save();
    scope.postMessage({ type: 'saved', requestId: message.requestId, save }, [save.owners.buffer, save.supply.buffer]);
  } else if (sim) {
    sim.apply(message.command);
    // En pause, le joueur doit voir tout de suite l'effet de ses ordres.
    send(0, true, message.command.type === 'setEffort' || message.command.type === 'build' || message.command.type === 'cancelBuild');
  }
};
