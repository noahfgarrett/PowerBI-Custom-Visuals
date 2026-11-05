# SSM Explorer browser harness

From the repository root:

```sh
npx vite --config packages/ssm-explorer/dev/vite.config.ts
```

Open `http://127.0.0.1:5186`. The harness imports `src/visual.ts` with its real settings and model and feeds it synthetic fixtures. It never connects to SQL or an SSM registry. The host mock records selection and context-menu identities at `window.__ssm.calls`. Power BI report filtering, drillthrough, persisted formatting and segmented fetching still need checking in a real Power BI host.

Viewport presets fix the visual's bounds, as Power BI does. The default view starts with parent milestones; click a parent to show its paged milestone grid, then a milestone to show equipment. The nested hierarchy fixture has 240 milestones per parent across two projects. The structural fixture has parents whose IDs sort after their children, a ten-level chain, a cycle, repeated assignments and prerequisites in another project. `window.__ssm.setRows(rows)`, `window.__ssm.setHierarchy()`, `window.__ssm.setStructural()` and `window.__ssm.setObjects(objects)` load other synthetic data without replacing the renderer.

After `npm run build --workspace @pbi/ssm-explorer`, open `http://127.0.0.1:5186/packaged.html` to smoke-test the generated `.tmp/drop/visual.js` and `visual.css`. That page loads the compiled plugin and never imports `src/visual.ts`.

For scale testing, pick the 10k, 50k or 100k synthetic dataset, or run `await window.__ssm.benchmark(100000)` in the browser console. The benchmark builds a fresh visual, times fixture construction separately from ingestion, expands a parent and its 1,000-equipment milestone, pages through dependencies, searches, and samples selection and pan times. Run it while no source files are changing, since Vite hot reload interrupts the measurement. Ingesting a large snapshot is synchronous: 100k rows took about 1.5 seconds for one update in my runs. These numbers are from a browser, not the Power BI host.
