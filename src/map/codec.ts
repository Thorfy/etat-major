// Grille de provinces en RLE : paires (id, longueur) sur 16 bits. Le fichier est
// ensuite compressé en deflate, ce qui réduit 16 Mo bruts à quelques centaines de Ko.

export function encodeRle(cells: Uint16Array): Uint16Array {
  const out: number[] = [];
  let i = 0;
  while (i < cells.length) {
    const id = cells[i];
    let run = 1;
    while (i + run < cells.length && cells[i + run] === id && run < 0xffff) run++;
    out.push(id, run);
    i += run;
  }
  return Uint16Array.from(out);
}

export function decodeRle(rle: Uint16Array, cellCount: number): Uint16Array {
  const cells = new Uint16Array(cellCount);
  let at = 0;
  for (let i = 0; i + 1 < rle.length; i += 2) {
    const end = at + rle[i + 1];
    if (end > cellCount) throw new Error('Grille RLE plus longue que la carte');
    cells.fill(rle[i], at, end);
    at = end;
  }
  if (at !== cellCount) throw new Error(`Grille RLE incomplète : ${at}/${cellCount} cellules`);
  return cells;
}
