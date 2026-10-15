async (page) => {
    const auditPage = await page.context().newPage();
    await auditPage.goto('http://127.0.0.1:5186/?structural-audit');
    await auditPage.waitForFunction(() => !!window.__ssm?.setStructural);
    await auditPage.evaluate(() => window.__ssm.setStructural(80));
    await auditPage.waitForTimeout(60);
    const failures = [];
    const check = (condition, message) => { if (!condition) failures.push(message); };
    const key = (id, project = 'Project Alpha') => JSON.stringify(['equipment', project, id]);
    const locate = async (id, project = 'Project Alpha') => {
        await auditPage.locator('[data-search]').fill(id);
        await auditPage.waitForTimeout(150);
        const result = auditPage.locator('.ssm-search-result').filter({ hasText: project }).first();
        await result.click(); await auditPage.waitForTimeout(220);
    };
    const startup = await auditPage.evaluate(() => [...document.querySelectorAll('.ssm-node')].map(element => JSON.parse(element.dataset.node)[0]));
    check(startup.every(kind => kind === 'l1'), 'Startup includes children before L1 expansion');
    await locate('Z-ROOT');
    const tree = await auditPage.evaluate(() => window.__ssm.visual.occurrences.map(item => ({ key: item.node.key, y: item.y, role: item.role, branch: item.branch, id: item.id })));
    const find = id => tree.find(item => item.key === key(id) && item.role === 'member');
    check(find('Z-ROOT')?.y < find('A-CHILD')?.y, 'Structural child sorts before parent');
    check(find('A-CHILD')?.y < find('B-GRANDCHILD')?.y, 'Grandchild sorts before parent');
    const quick = () => auditPage.locator('[data-action="quick-dependencies"]').filter({ hasText: 'Dependencies · 2' }).first();
    await quick().click(); await auditPage.waitForTimeout(220);
    const outgoing = await auditPage.evaluate(() => ({
        occurrences: window.__ssm.visual.occurrences.filter(item => item.role === 'dependency').map(item => ({ key: item.node.key, y: item.y, origin: item.origin, id: item.id })),
        outgoing: document.querySelector('[data-action="dependencies-out"]')?.textContent,
        incoming: document.querySelector('[data-action="dependencies-in"]')?.textContent,
        mounted: document.querySelectorAll('.ssm-node').length,
        nestedButtons: document.querySelectorAll('button button').length,
    }));
    check(outgoing.outgoing === 'Dependencies 2' && outgoing.incoming === 'Required by 1', 'Direct dependency direction counts are wrong');
    check(outgoing.occurrences.map(item => item.key).sort().join('|') === [key('P-LOCAL'), key('D-REMOTE', 'Project Beta')].sort().join('|'), 'Remote prerequisite resolves to wrong project or includes transitive records');
    check(outgoing.mounted <= 300 && outgoing.nestedButtons === 0, 'Occurrence budget or HTML button semantics violated');
    await auditPage.locator('#visual').screenshot({ path: '/Users/noahgarrett/Codebase/PowerBI/.playwright-mcp/ssm-structural-dependencies.png', scale: 'css' });
    await auditPage.locator('[data-action="dependencies-in"]').click(); await auditPage.waitForTimeout(220);
    const incoming = await auditPage.evaluate(() => window.__ssm.visual.occurrences.filter(item => item.role === 'dependency').map(item => item.node.key));
    check(incoming.length === 1 && incoming[0] === key('C-CONSUMER'), 'Required by shows the wrong direction');
    await auditPage.locator('#visual').screenshot({ path: '/Users/noahgarrett/Codebase/PowerBI/.playwright-mcp/ssm-structural-required-by.png', scale: 'css' });
    await auditPage.locator('[data-action="dependencies-out"]').click(); await auditPage.waitForTimeout(220);
    const remote = auditPage.locator('.ssm-node.is-dependency-row').filter({ hasText: 'Remote prerequisite' });
    if (await remote.count()) {
        await remote.click({ force: true }); await auditPage.locator('[data-action="select-report"]').click();
    } else failures.push('Remote inline prerequisite is not reachable in the mounted viewport');
    const native = await auditPage.evaluate(() => ({ selection: window.__ssm.calls.selections.at(-1), drawer: document.querySelector('.ssm-drawer').innerText, failures: window.__ssm.calls.renderFailures }));
    check(native.selection?.keys.every(value => value.includes('Project Beta:D-REMOTE:')), 'Native identity belongs to source rather than remote prerequisite');
    await locate('W-079');
    const late = await auditPage.evaluate(() => ({ selected: document.querySelector('.ssm-node.is-selected')?.dataset.node, mounted: document.querySelectorAll('.ssm-node').length, occurrences: window.__ssm.visual.occurrences.map(item => ({ key: item.node.key, role: item.role, y: item.y })), graphEquipment: [...window.__ssm.visual.graph.nodes.values()].filter(node => node.kind === 'equipment').length }));
    check(late.selected === key('W-079') && late.mounted <= 300, 'Late forest search failed or exceeded cap');
    check(late.occurrences.some(item => item.key === key('Z-ROOT') && item.role === 'ancestor'), 'Late member page lost its parent context');
    await auditPage.emulateMedia({ reducedMotion: 'reduce' });
    const lateQuick = auditPage.locator('[data-action="quick-dependencies"]').filter({ hasText: 'Dependencies · 2' }).first();
    if (await lateQuick.count()) { await lateQuick.click({ force: true }); await auditPage.waitForTimeout(40); }
    const reduced = await auditPage.evaluate(() => ({ animations: document.querySelector('#visual').getAnimations({ subtree: true }).length, ghosts: document.querySelectorAll('[data-ghost],.ssm-ghost,.ssm-leaving').length }));
    check(reduced.animations === 0 && reduced.ghosts === 0, 'Reduced motion retained animations or ghost rows');
    await auditPage.selectOption('#size', '420x620');
    await auditPage.evaluate(() => window.__ssm.setStructural(4));
    await locate('D-10');
    // Narrow Power BI bounds use an overlay drawer. Close it before clicking
    // the canvas control rather than forcing a click through the overlay.
    await auditPage.locator('[data-action="close"]').click(); await auditPage.waitForTimeout(40);
    const deepQuick = auditPage.getByRole('button', { name: 'Deep structural level 10: 1 dependencies', exact: true });
    await deepQuick.click(); await auditPage.waitForTimeout(50);
    const compact = await auditPage.evaluate(() => {
        const panel = document.querySelector('[data-dependency-panel]');
        const header = panel?.querySelector('.ssm-inline-direction');
        return { panelWidth: panel?.getBoundingClientRect().width, headerWidth: header?.getBoundingClientRect().width, headerHeight: header?.getBoundingClientRect().height, headerClientWidth: header?.clientWidth, headerScrollWidth: header?.scrollWidth, mounted: document.querySelectorAll('.ssm-node').length, animations: document.querySelector('#visual').getAnimations({ subtree: true }).length };
    });
    check(compact.headerScrollWidth <= compact.headerClientWidth + 1, 'Compact deep dependency direction controls overflow');
    await auditPage.locator('#visual').screenshot({ path: '/Users/noahgarrett/Codebase/PowerBI/.playwright-mcp/ssm-structural-compact.png', scale: 'css' });
    return { startup, tree, outgoing, incoming, native, late, reduced, compact, failures, powerBiHost: false };
}
