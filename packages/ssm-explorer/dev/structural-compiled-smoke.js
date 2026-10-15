async (page) => {
    const tab = await page.context().newPage();
    await tab.goto('http://127.0.0.1:5186/packaged.html?structural-final-smoke');
    await tab.waitForFunction(() => !!window.__ssm?.setStructural);
    const version = await tab.evaluate(async () => (await (await fetch('/pbiviz.json', { cache: 'no-store' })).json()).visual.version);
    await tab.evaluate(() => window.__ssm.setStructural(4));
    const startup = await tab.evaluate(() => [...document.querySelectorAll('.ssm-node')].map(element => JSON.parse(element.dataset.node)[0]));
    await tab.locator('[data-search]').fill('Z-ROOT'); await tab.waitForTimeout(150);
    await tab.locator('.ssm-search-result').first().click(); await tab.waitForTimeout(220);
    await tab.getByRole('button', { name: 'Main assembly: 2 dependencies', exact: true }).click(); await tab.waitForTimeout(220);
    const outgoing = await tab.evaluate(() => ({
        targets: [...document.querySelectorAll('.is-dependency-row')].map(element => element.dataset.node),
        directions: [...document.querySelectorAll('.ssm-inline-direction button:not(.ssm-inline-close)')].map(element => ({ text: element.textContent, width: element.clientWidth, scrollWidth: element.scrollWidth, whiteSpace: getComputedStyle(element).whiteSpace })),
        parentLinks: [...document.querySelectorAll('.ssm-links path.parent')].map(path => ({ from: path.dataset.from, to: path.dataset.to, fromOccurrence: path.dataset.fromOccurrence, toOccurrence: path.dataset.toOccurrence })),
        mounted: document.querySelectorAll('.ssm-node').length,
    }));
    await tab.locator('#visual').screenshot({ path: '/Users/noahgarrett/Codebase/PowerBI/.playwright-mcp/ssm-structural-compiled-dependencies.png', scale: 'css' });
    await tab.locator('[data-action="dependencies-in"]').click(); await tab.waitForTimeout(220);
    const incoming = await tab.evaluate(() => [...document.querySelectorAll('.is-dependency-row')].map(element => element.dataset.node));
    await tab.locator('[data-action="dependencies-out"]').click(); await tab.waitForTimeout(220);
    await tab.locator('.is-dependency-row').filter({ hasText: 'Remote prerequisite' }).click();
    await tab.locator('[data-action="select-report"]').click();
    const native = await tab.evaluate(() => ({ selection: window.__ssm.calls.selections.at(-1), failures: window.__ssm.calls.renderFailures }));
    await tab.evaluate(() => window.__ssm.update(420, 620));
    await tab.locator('[data-search]').fill('D-10'); await tab.waitForTimeout(150);
    await tab.locator('.ssm-search-result').first().click(); await tab.waitForTimeout(220);
    await tab.locator('[data-action="close"]').click(); await tab.waitForTimeout(40);
    await tab.getByRole('button', { name: 'Deep structural level 10: 1 dependencies', exact: true }).click(); await tab.waitForTimeout(220);
    const compact = await tab.evaluate(() => { const header = document.querySelector('.ssm-inline-direction'); return { clientWidth: header?.clientWidth, scrollWidth: header?.scrollWidth, height: header?.getBoundingClientRect().height, targets: [...document.querySelectorAll('.is-dependency-row')].map(element => element.dataset.node), mounted: document.querySelectorAll('.ssm-node').length }; });
    await tab.locator('#visual').screenshot({ path: '/Users/noahgarrett/Codebase/PowerBI/.playwright-mcp/ssm-structural-compiled-compact.png', scale: 'css' });
    const failures = [];
    const key = (id, project = 'Project Alpha') => JSON.stringify(['equipment', project, id]);
    if (!startup.every(kind => kind === 'l1')) failures.push('Compiled startup exposes child nodes');
    if (outgoing.targets.sort().join('|') !== [key('P-LOCAL'), key('D-REMOTE', 'Project Beta')].sort().join('|')) failures.push('Compiled direct prerequisites mismatch');
    if (incoming.length !== 1 || incoming[0] !== key('C-CONSUMER')) failures.push('Compiled Required by direction mismatch');
    if (!native.selection?.keys.every(value => value.includes('Project Beta:D-REMOTE:'))) failures.push('Compiled prerequisite native identity mismatch');
    if (native.failures.length) failures.push('Compiled host recorded render failures');
    if (outgoing.directions.some(button => button.scrollWidth > button.width + 1 || button.whiteSpace !== 'nowrap')) failures.push('Compiled panel labels do not fit whole words');
    if (!compact.clientWidth || compact.scrollWidth > compact.clientWidth + 1) failures.push('Compiled compact panel is absent or overflows');
    if (Math.max(outgoing.mounted, compact.mounted) > 300) failures.push('Compiled occurrence cap exceeded');
    return { version, startup, outgoing, incoming, native, compact, failures, productionBundle: 'http://127.0.0.1:5186/visual.js', powerBiHost: false };
}
