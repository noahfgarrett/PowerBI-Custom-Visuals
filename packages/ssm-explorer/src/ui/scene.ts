export interface SceneRect { id: string; x: number; y: number; width: number; height: number }
export interface Bounds { x: number; y: number; width: number; height: number }

/** Uniform grid keeps pan/zoom work proportional to the visible neighborhood. */
export class SceneIndex<T extends SceneRect> {
  private readonly cells = new Map<string, T[]>();
  private readonly cellSize = 384;

  rebuild(items: T[]): void {
    this.cells.clear();
    for (const item of items) {
      const left = Math.floor(item.x / this.cellSize), right = Math.floor((item.x + item.width) / this.cellSize);
      const top = Math.floor(item.y / this.cellSize), bottom = Math.floor((item.y + item.height) / this.cellSize);
      for (let x = left; x <= right; x++) for (let y = top; y <= bottom; y++) {
        const key = `${x}:${y}`;
        const cell = this.cells.get(key);
        if (cell) cell.push(item); else this.cells.set(key, [item]);
      }
    }
  }

  query(bounds: Bounds): T[] {
    const found = new Map<string, T>();
    const left = Math.floor(bounds.x / this.cellSize), right = Math.floor((bounds.x + bounds.width) / this.cellSize);
    const top = Math.floor(bounds.y / this.cellSize), bottom = Math.floor((bounds.y + bounds.height) / this.cellSize);
    for (let x = left; x <= right; x++) for (let y = top; y <= bottom; y++) {
      for (const item of this.cells.get(`${x}:${y}`) ?? []) {
        if (item.x + item.width >= bounds.x && item.x <= bounds.x + bounds.width && item.y + item.height >= bounds.y && item.y <= bounds.y + bounds.height) found.set(item.id, item);
      }
    }
    return [...found.values()];
  }
}
