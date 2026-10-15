import { describe, expect, it } from 'vitest';
import { packNestedForest, type NestedLayoutNode } from '../ui/nested-layout';

const options = { columns: 3, cardWidth: 190, gap: 24, rowGap: 20 };
const node = (id: string, children: string[] = []): NestedLayoutNode => ({ id, children, width: 190, height: 88, childGap: 12 });

describe('compact nested forest planner', () => {
    it('chooses narrow spans for several open sibling groups rather than stacking full-width groups', () => {
        const nodes = ['A', 'B', 'C'].flatMap(id => [node(id, [`${id}1`, `${id}2`]), node(`${id}1`), node(`${id}2`)]);
        const result = packNestedForest(nodes, ['A', 'B', 'C'], options);
        expect(new Set(['A', 'B', 'C'].map(id => result.placements.get(id)!.y)).size).toBe(1);
        expect(result.height).toBe(296);
        for (const id of ['A', 'B', 'C']) expect(result.placements.get(`${id}1`)!.x).toBe(result.placements.get(id)!.x);
    });

    it('lets one broad parent use all available columns and puts its footer below every child', () => {
        const children = Array.from({ length: 12 }, (_, index) => `child${index}`);
        const root = { ...node('root', children), footerHeight: 34 };
        const result = packNestedForest([root, ...children.map(id => node(id))], ['root'], options);
        expect(new Set(children.map(id => result.placements.get(id)!.x)).size).toBe(3);
        const rootRect = result.placements.get('root')!;
        expect(rootRect.footerY).toBeGreaterThan(Math.max(...children.map(id => result.placements.get(id)!.y + 88)));
        expect(result.height).toBe(rootRect.footerY + 34);
    });

    it('keeps reserved side-lane groups separate from neighbouring branches', () => {
        const result = packNestedForest([{ ...node('wide'), minimumSpan: 3, minimumHeight: 500 }, node('next')], ['wide', 'next'], options);
        expect(result.placements.get('next')!.y).toBe(520);
    });

    it('handles a deep bounded materialized chain iteratively and deterministically', () => {
        const nodes = Array.from({ length: 5000 }, (_, i) => node(String(i), i < 4999 ? [String(i + 1)] : []));
        const first = packNestedForest(nodes, ['0'], options), second = packNestedForest(nodes, ['0'], options);
        expect(first.placements.size).toBe(5000);
        expect(first.placements.get('4999')!.y).toBe(499900);
        expect(first.placements).toEqual(second.placements);
    });
});
