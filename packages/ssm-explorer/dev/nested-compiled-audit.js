async (page) => {
    const tab = await page.context().newPage();
    const compiled = true; // Use nested-compiled-audit.js for the generated bundle.
    await tab.goto(`http://127.0.0.1:5186/${compiled ? 'packaged.html' : ''}?nested-showroom-audit`);
    await tab.waitForFunction(() => !!window.__ssm?.setShowroom && !!window.__ssm?.setObjects);
    const failures = [];
    const check = (condition, message) => { if (!condition) failures.push(message); };
    const key = id => JSON.stringify(['equipment', 'East Plant', id]);
    const byNode = async id => tab.locator('.ssm-node[data-role="member"]').filter({ hasText: id }).first();
    const children = async id => {
        const source = await (await byNode(id)).getAttribute('data-occurrence');
        await tab.locator('[data-action="equipment-children"]').evaluateAll((buttons, source) => buttons.find(button => button.dataset.source === source)?.click(), source);
        await tab.waitForTimeout(220);
    };
    const setup = async (theme = 'light', status = false) => {
        await tab.evaluate(({ theme, status }) => {
            window.__ssm.setObjects({ appearance: { theme }, highlighting: { highlightField: status ? JSON.stringify(['metadata', 'SyntheticRegistry.status']) : JSON.stringify(['discipline']) } });
            window.__ssm.resetVisual(); window.__ssm.setShowroom();
        }, { theme, status });
        await tab.locator('.ssm-node.l1').first().click();
        await tab.locator('.ssm-node.l2').filter({ hasText: 'Airside ready' }).click();
        await children('AHU-101');
        await tab.locator('[data-search]').fill('FAN-101'); await tab.waitForTimeout(150);
        await tab.locator('.ssm-search-result').first().click(); await tab.waitForTimeout(220);
        await children('FAN-101');
        await tab.getByRole('button', { name: 'Supply fan: 2 dependencies', exact: true }).click(); await tab.waitForTimeout(220);
        await tab.locator('[data-action="highlight"]').click();
        await tab.locator('[data-highlight-values] label').filter({ hasText: status ? 'Awaiting power' : 'Electrical' }).locator('input').check();
        await tab.locator('[data-action="highlight-close"]').click();
        await tab.locator('[data-action="zoom-out"]').click(); await tab.locator('[data-action="zoom-out"]').click();
        await tab.waitForTimeout(220);
    };
    const scene = () => tab.evaluate(() => {
        const cards = [...document.querySelectorAll('.ssm-node')];
        const asset = id => cards.find(card => card.dataset.role === 'member' && JSON.parse(card.dataset.node)[2] === id);
        const source = asset('FAN-101'), motor = asset('MOTOR-101'), parent = asset('AHU-101');
        const dependencies = cards.filter(card => card.dataset.role === 'dependency');
        const style = card => { if (!card) return null; const label = card.querySelector('.ssm-node-label'), s = getComputedStyle(card); return { key: card.dataset.node, occurrence: card.dataset.occurrence, role: card.dataset.role, box: card.getBoundingClientRect().toJSON(), worldX: parseFloat(card.style.left), worldY: parseFloat(card.style.top), worldWidth: parseFloat(card.style.width), color: getComputedStyle(label).color, background: s.backgroundColor, matched: card.classList.contains('is-highlight-match'), selected: card.classList.contains('is-selected'), badge: card.querySelector('.ssm-highlight-badge')?.textContent, branch: card.dataset.branch }; };
        const ids = new Set(dependencies.map(card => card.dataset.occurrence));
        const connectors = [...document.querySelectorAll('.ssm-links path.dependency')].filter(path => ids.has(path.dataset.toOccurrence)).map(path => ({ target: path.dataset.toOccurrence, d: path.getAttribute('d') }));
        const controls = [...document.querySelectorAll('[data-action="equipment-children"],[data-action="quick-dependencies"]')].map(button => ({ source: button.dataset.source, action: button.dataset.action, clientWidth: button.clientWidth, scrollWidth: button.scrollWidth, box: button.getBoundingClientRect().toJSON() }));
        return { parent: style(parent), source: style(source), motor: style(motor), dependencies: dependencies.map(style), connectors, controls, mounted: cards.length, count: document.querySelector('.ssm-counts').textContent, highlighted: document.querySelector('[data-highlight-count]').textContent, failures: window.__ssm.calls.renderFailures };
    });
    await setup();
    const light = await scene();
    check(light.parent && light.source && light.motor, 'The showroom parent, fan and motor are not reachable together');
    check(light.dependencies.length === 2, 'Showroom has other than two direct prerequisites');
    check(light.dependencies.every(card => card.worldX >= light.source.worldX + light.source.worldWidth), 'A prerequisite overlaps the structural source lane');
    check(light.dependencies.find(card => card.key === key('DB-101'))?.matched, 'Electrical prerequisite does not highlight');
    check(!light.dependencies.find(card => card.key === key('CWP-101'))?.matched, 'Mechanical prerequisite incorrectly highlights Electrical');
    check(light.motor?.matched && light.motor?.badge === 'Match', 'Electrical motor lacks its non-color highlight badge');
    check(light.controls.every(control => control.scrollWidth <= control.clientWidth + 1), 'A child/dependency control label is clipped');
    check(light.mounted <= 300 && !light.failures.length, 'Mounted budget or host render failures');
    await tab.locator('#visual').screenshot({ path: '/Users/noahgarrett/Codebase/PowerBI/.playwright-mcp/ssm-nested-compiled-showroom-light.png', scale: 'css' });
    await setup('dark'); const dark = await scene();
    await tab.locator('#visual').screenshot({ path: '/Users/noahgarrett/Codebase/PowerBI/.playwright-mcp/ssm-nested-compiled-showroom-dark.png', scale: 'css' });
    await setup('light', true); const status = await scene();
    check(status.source?.matched && status.dependencies.find(card => card.key === key('DB-101'))?.matched, 'Status matches are missing from source or side lane');
    await tab.locator('#visual').screenshot({ path: '/Users/noahgarrett/Codebase/PowerBI/.playwright-mcp/ssm-nested-compiled-showroom-status.png', scale: 'css' });
    await setup(); await tab.evaluate(() => window.__ssm.setHighContrast(true)); await tab.locator('.ssm-node.l1').first().click(); await tab.locator('.ssm-node.l2').filter({ hasText: 'Airside ready' }).click(); await children('AHU-101'); await tab.locator('[data-search]').fill('FAN-101'); await tab.waitForTimeout(150); await tab.locator('.ssm-search-result').first().click(); await tab.waitForTimeout(220); await children('FAN-101'); await tab.getByRole('button', { name: 'Supply fan: 2 dependencies', exact: true }).click(); await tab.waitForTimeout(220); const highContrast = await scene();
    check(highContrast.source?.color === 'rgb(0, 0, 0)' && highContrast.source?.background === 'rgb(255, 255, 0)', 'Selected high-contrast card text/fill mismatch');
    await tab.locator('#visual').screenshot({ path: '/Users/noahgarrett/Codebase/PowerBI/.playwright-mcp/ssm-nested-compiled-showroom-high-contrast.png', scale: 'css' });
    await tab.evaluate(() => window.__ssm.setHighContrast(false)); await setup();
    await tab.evaluate(() => window.__ssm.update(420, 620));
    await tab.locator('[data-action="close"]').click(); await tab.waitForTimeout(40);
    await tab.getByRole('button', { name: 'Focus selected', exact: true }).click();
    await tab.locator('[data-action="zoom-out"]').click(); await tab.locator('[data-action="zoom-out"]').click();
    await tab.locator('[data-viewport]').focus(); await tab.keyboard.press('ArrowRight'); await tab.keyboard.press('ArrowRight'); await tab.waitForTimeout(60);
    await tab.locator('[data-action="highlight"]').focus();
    const tooltip = await tab.locator('[role="tooltip"]').evaluate(element => ({ hidden: element.hidden, box: element.getBoundingClientRect().toJSON(), text: element.textContent, pointerEvents: getComputedStyle(element).pointerEvents }));
    const visualBounds = await tab.locator('#visual').boundingBox();
    check(!tooltip.hidden && tooltip.text.includes('without hiding'), 'Keyboard highlight hint is missing');
    check(tooltip.box.left >= visualBounds.x && tooltip.box.right <= visualBounds.x + visualBounds.width && tooltip.box.top >= visualBounds.y && tooltip.box.bottom <= visualBounds.y + visualBounds.height, 'Compact tooltip escapes fixed Power BI bounds');
    check(tooltip.pointerEvents === 'none', 'Tooltip blocks a compact control');
    await tab.locator('#visual').screenshot({ path: '/Users/noahgarrett/Codebase/PowerBI/.playwright-mcp/ssm-nested-compiled-tooltip-compact.png', scale: 'css' });
    await tab.keyboard.press('Escape');
    check(await tab.locator('[role="tooltip"]').isHidden(), 'Compact tooltip remains orphaned after Escape');
    return { light, dark, status, highContrast, tooltip, failures, powerBiHost: false };
}
