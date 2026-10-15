# Actual visual browser harness

From the repository root:

```sh
npx vite --config packages/ssm-explorer/dev/vite.config.ts
```

Open `http://127.0.0.1:5186`. This harness imports `src/visual.ts` and its real settings and model. It uses synthetic fixtures only; it never connects to SQL or an SSM registry. The host mock records selection and native context-menu identities at `window.__ssm.calls`. This provides browser evidence for the actual rendered implementation, but Power BI report filtering, drillthrough destinations, security, persistent host formatting, and segmented fetching require Power BI host verification.

Viewport presets deliberately fix the visual's bounds, as Power BI does. The default view starts with parent milestones; click a parent to show its paged milestone grid, then click a milestone to show equipment. Test metadata refresh, project filtering, the 600-equipment graph, partial-data recovery, keyboard controls, and high contrast. The nested hierarchy fixture supplies 240 milestones per parent across two projects. The structural fixture has parents whose IDs sort after their children, header and unavailable parent context, a ten-level chain, a cycle, repeated assignments, and explicit prerequisites in another project. `window.__ssm.setRows(rows)`, `window.__ssm.setHierarchy()`, `window.__ssm.setStructural()` and `window.__ssm.setObjects(objects)` support additional synthetic checks without replacing the renderer.

Local screenshots and browser audit outputs are inspection artifacts and are excluded from visual distribution.

After `npm run build --workspace @pbi/ssm-explorer`, open `http://127.0.0.1:5186/packaged.html` to smoke the actual generated `.tmp/drop/visual.js` and `visual.css`. This separate harness instantiates the compiled plugin and deliberately never imports `src/visual.ts`.

For scalability inspection, choose the 10k, 50k, or 100k synthetic dataset, or invoke `await window.__ssm.benchmark(100000)` in the dedicated preview tab. The benchmark creates a fresh actual Visual, separates fixture construction from ingestion, expands a visible parent and its 1000-equipment milestone, checks dense relationship paging and quick direct dependency directions, searches the final project-scoped identity, and samples selection and pan work. `dev/run-benchmarks.js` is a Playwright tool function that runs all three sizes in its own temporary tabs; `dev/hierarchy-audit.js` inspects nested paging, short transitions, rapid toggles and reduced motion. `dev/structural-audit.js` checks the parent-first forest, inline prerequisites versus consumers, target native identities, late page ancestors, and compact dependency controls. Run only when production source changes are paused, because Vite hot reload can interrupt measurements.

The representative timing record and limitations are in `scalability-audit-results.json`. Large snapshot ingestion remains synchronous; the 100k test measured approximately 1.5 seconds for one update. An actual Visual audit with fifty 2000-row delta segments yielded between batches, loaded all records and preserved the final native row identity, but the largest batch still took 207ms. These measurements do not establish Power BI host performance guarantees.

The parent forest and inline dependency audit is saved in `structural-audit-results.json`, including the fresh 100k navigation run and the actual compiled 1.3.0.0 smoke. `dev/structural-compiled-smoke.js` checks the generated bundle's initial L1 view, prerequisite versus consumer direction, remote target identity, and complete labels in a narrow panel. Narrow inspectors overlay the canvas; close the inspector before using a canvas control it covers.
