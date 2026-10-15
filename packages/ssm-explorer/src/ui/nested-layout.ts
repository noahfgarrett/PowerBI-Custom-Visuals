/** A bounded, ordered forest of cards. Children remain inside their parent's
 * allocated columns; a small branch can share a row with another open branch. */
export interface NestedLayoutNode {
    id: string;
    width: number;
    height: number;
    children: string[];
    childInset?: number;
    childGap?: number;
    footerHeight?: number;
    minimumSpan?: number;
    minimumHeight?: number;
}
export interface NestedPlacement {
    x: number; y: number; width: number; height: number;
    groupWidth: number; groupHeight: number; footerY: number;
}
export interface NestedLayout {
    placements: Map<string, NestedPlacement>;
    width: number;
    height: number;
}
type Item = { id: string; span: number; x: number; y: number };
type Forest = { items: Item[]; height: number };
type Plan = { height: number; footerY: number; children: Forest };

/** Three columns keep the row optimizer constant-sized. Both planning and
 * placement are iterative, including pathological source parent chains. */
export function packNestedForest(nodes: readonly NestedLayoutNode[], roots: readonly string[], options: { columns: number; cardWidth: number; gap: number; rowGap: number }): NestedLayout {
    const columns = Math.max(1, Math.min(3, Math.floor(options.columns)));
    const byId = new Map(nodes.map(node => [node.id, node]));
    const plans = new Map<string, Map<number, Plan>>();
    const track = options.cardWidth + options.gap;
    const spanWidth = (span: number) => span * track - options.gap;
    const forest = (ids: readonly string[], available: number): Forest => {
        const costs = new Float64Array(ids.length + 1), choices: Item[][] = new Array(ids.length);
        for (let i = ids.length - 1; i >= 0; i--) {
            let best = Infinity, bestRow: Item[] = [];
            const row: Item[] = [];
            const visit = (next: number, used: number, height: number): void => {
                if (next > i) {
                    const cost = height + (next < ids.length ? options.rowGap + costs[next] : 0);
                    if (cost < best || cost === best && row.length > bestRow.length) { best = cost; bestRow = row.map(item => ({ ...item })); }
                }
                if (next >= ids.length || used === available) return;
                const variants = plans.get(ids[next]);
                if (!variants) return;
                for (let span = 1; span <= available - used; span++) {
                    const plan = variants.get(span); if (!plan) continue;
                    row.push({ id: ids[next], span, x: used * track, y: 0 });
                    visit(next + 1, used + span, Math.max(height, plan.height)); row.pop();
                }
            };
            visit(i, 0, 0); costs[i] = best; choices[i] = bestRow;
        }
        const items: Item[] = []; let y = 0;
        for (let i = 0; i < ids.length;) {
            const row = choices[i]; if (!row?.length) break;
            let height = 0;
            for (const item of row) { items.push({ ...item, y }); height = Math.max(height, plans.get(item.id)!.get(item.span)!.height); }
            i += row.length; y += height + (i < ids.length ? options.rowGap : 0);
        }
        return { items, height: y };
    };
    const order: string[] = [], seen = new Set<string>(), pending = [...roots].reverse();
    while (pending.length) {
        const id = pending.pop()!, node = byId.get(id); if (!node || seen.has(id)) continue;
        seen.add(id); order.push(id);
        for (let i = node.children.length - 1; i >= 0; i--) pending.push(node.children[i]);
    }
    for (let i = order.length - 1; i >= 0; i--) {
        const node = byId.get(order[i])!, variants = new Map<number, Plan>();
        for (let span = node.minimumSpan ?? 1; span <= columns; span++) {
            const children = forest(node.children, span);
            // A child with a deliberately reserved wider side lane must not be
            // silently dropped by a narrower parent variant.
            if (children.items.length !== node.children.length) continue;
            const childY = node.height + (node.children.length ? node.childGap ?? 12 : 0);
            const footerY = childY + children.height + (node.footerHeight ? 8 : 0);
            variants.set(span, { children, footerY, height: Math.max(node.minimumHeight ?? 0, node.footerHeight ? footerY + node.footerHeight : node.children.length ? childY + children.height : node.height) });
        }
        plans.set(node.id, variants);
    }
    const rootPlan = forest(roots, columns), placements = new Map<string, NestedPlacement>();
    const queue = rootPlan.items.map(item => ({ ...item, ancestorInset: 0 }));
    while (queue.length) {
        const item = queue.pop()!, node = byId.get(item.id)!, plan = plans.get(item.id)!.get(item.span)!;
        placements.set(item.id, { x: item.x, y: item.y, width: node.width, height: node.height, groupWidth: spanWidth(item.span), groupHeight: plan.height, footerY: item.y + plan.footerY });
        const childY = item.y + node.height + (node.childGap ?? 12), inset = node.childInset ?? 0;
        for (const child of plan.children.items) queue.push({ ...child, x: item.x + inset + child.x, y: childY + child.y, ancestorInset: item.ancestorInset + inset });
    }
    return { placements, width: spanWidth(columns), height: rootPlan.height };
}
