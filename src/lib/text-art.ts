export type Point = readonly [number, number];
type Sample = (x: number, y: number) => boolean;

const blocks = [" ", "▘", "▝", "▀", "▖", "▌", "▞", "▛", "▗", "▚", "▐", "▜", "▄", "▙", "▟", "█"];

export function blockAt(sample: Sample, x: number, y: number): string {
  const mask = Number(sample(x + .25, y + .25))
    | Number(sample(x + .75, y + .25)) << 1
    | Number(sample(x + .25, y + .75)) << 2
    | Number(sample(x + .75, y + .75)) << 3;
  return blocks[mask];
}

export function dotsAt(sample: Sample, x: number, y: number): string {
  const bits = [[1, 8], [2, 16], [4, 32], [64, 128]];
  let mask = 0;
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 2; column++) {
      if (sample(x + .25 + column * .5, y + .125 + row * .25)) mask |= bits[row][column];
    }
  }
  return mask ? String.fromCodePoint(0x2800 + mask) : " ";
}

export function insidePolygon(x: number, y: number, points: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
