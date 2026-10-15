async (page) => {
    const auditPage = await page.context().newPage();
    await auditPage.goto('http://127.0.0.1:5186/?theme-audit');
    await auditPage.waitForFunction(() => !!window.__ssm);
    await auditPage.addStyleTag({ content: '#visual .ssm-node.is-selected span { color: rgb(17,17,17); }' });
    const results = [];
    for (const mode of ['light', 'dark', 'high-contrast']) {
        if (mode === 'high-contrast') await auditPage.locator('#high-contrast').check();
        else await auditPage.evaluate(mode => window.__ssm.setObjects({ appearance: { theme: mode } }), mode);
        const parent = auditPage.locator('.ssm-node.l1').filter({ hasText: 'Building ready' }).first();
        if (await parent.getAttribute('aria-expanded') !== 'true') await parent.click();
        await auditPage.waitForTimeout(210);
        const milestone = auditPage.locator('.ssm-node.l2').filter({ hasText: 'Mechanical completion' }).first();
        if (await milestone.getAttribute('aria-expanded') !== 'true') await milestone.click();
        await auditPage.waitForTimeout(50);
        const node = auditPage.locator('.ssm-node.equipment').filter({ hasText: 'EQ-002' }).first();
        await node.focus();
        await auditPage.keyboard.press('Enter');
        await auditPage.waitForTimeout(50);
        results.push(await auditPage.evaluate(mode => {
            const node = document.querySelector('.ssm-node.is-selected');
            const root = document.querySelector('.ssm-root');
            const names = ['ssm-node-label', 'ssm-node-type', 'ssm-node-id'];
            return {
                mode,
                rootFg: getComputedStyle(root).color, rootBg: getComputedStyle(root).backgroundColor,
                nodeBg: getComputedStyle(node).backgroundColor,
                parts: Object.fromEntries(names.map(name => [name, {
                    color: getComputedStyle(node.querySelector('.' + name)).color,
                    inlineColor: node.querySelector('.' + name).style.color,
                }])),
                legendFont: getComputedStyle(document.querySelector('.ssm-legend')).fontSize,
                legendLineWidth: getComputedStyle(document.querySelector('.ssm-line')).width,
                legendLineBorder: getComputedStyle(document.querySelector('.ssm-line')).borderTopWidth,
            };
        }, mode));
        await auditPage.locator('#visual').screenshot({ path: `/Users/noahgarrett/Codebase/PowerBI/.playwright-mcp/ssm-scalable-${mode}.png` });
        await auditPage.locator('[data-action=close]').click();
    }
    await auditPage.locator('#high-contrast').uncheck();
    await auditPage.evaluate(() => window.__ssm.setObjects({ appearance: { theme: 'light' } }));
    await auditPage.locator('#size').selectOption('320x280');
    await auditPage.waitForTimeout(50);
    await auditPage.locator('[data-action=fit]').click();
    await auditPage.waitForTimeout(50);
    await auditPage.locator('#visual').screenshot({ path: '/Users/noahgarrett/Codebase/PowerBI/.playwright-mcp/ssm-scalable-compact-startup.png' });
    const compactParent = auditPage.locator('.ssm-node.l1').filter({ hasText: 'Building ready' }).first();
    await compactParent.focus();
    await auditPage.keyboard.press('Enter');
    await auditPage.waitForTimeout(210);
    const compactMilestone = auditPage.locator('.ssm-node.l2').filter({ hasText: 'Mechanical completion' }).first();
    await compactMilestone.focus();
    await auditPage.keyboard.press('Enter');
    await auditPage.waitForTimeout(50);
    await auditPage.locator('[data-action=close]').click();
    await auditPage.locator('[data-search]').fill('EQ-002');
    await auditPage.waitForTimeout(150);
    await auditPage.locator('.ssm-search-result').filter({ hasText: 'Project Alpha' }).first().click();
    await auditPage.waitForTimeout(50);
    await auditPage.locator('#visual').screenshot({ path: '/Users/noahgarrett/Codebase/PowerBI/.playwright-mcp/ssm-scalable-compact.png' });
    return results;
}
