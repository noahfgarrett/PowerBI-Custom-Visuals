async (page) => {
    const auditPage = await page.context().newPage();
    await auditPage.goto('http://127.0.0.1:5186/?hierarchy-audit');
    await auditPage.waitForFunction(() => !!window.__ssm?.setHierarchy);
    await auditPage.evaluate(() => window.__ssm.setHierarchy());
    await auditPage.waitForTimeout(60);
    const parentKey = JSON.stringify(['l1', 'Hierarchy Alpha', 'Parent A']);
    const parent = () => auditPage.locator('.ssm-node.l1').filter({ hasText: 'Parent A' }).first();
    const startup = await auditPage.evaluate(() => ({
        counts: document.querySelector('.ssm-counts').textContent,
        kinds: [...document.querySelectorAll('.ssm-node')].map(element => JSON.parse(element.dataset.node)[0]),
    }));
    await parent().click();
    await auditPage.waitForTimeout(45);
    const during = await auditPage.evaluate(() => {
        const animations = document.querySelector('#visual').getAnimations({ subtree: true });
        return { count: animations.length, durations: animations.map(animation => animation.effect?.getTiming().duration), nodes: document.querySelectorAll('.ssm-node').length };
    });
    await auditPage.waitForTimeout(200);
    const opened = await auditPage.evaluate(parentKey => ({
        childCount: document.querySelectorAll('.ssm-node.l2').length,
        parents: [...document.querySelectorAll('.ssm-node.l2')].map(element => element.dataset.parent),
        childRows: [...new Set([...document.querySelectorAll('.ssm-node.l2')].map(element => element.style.top))],
        worldWidth: window.__ssm.visual.worldWidth,
        activeAnimations: document.querySelector('#visual').getAnimations({ subtree: true }).length,
    }), parentKey);
    await auditPage.locator('#visual').screenshot({ path: '/Users/noahgarrett/Codebase/PowerBI/.playwright-mcp/ssm-nested-parent-open.png', scale: 'css' });
    // Repeated clicks arrive faster than the transition; only the final collapsed state remains.
    for (let click = 0; click < 5; click++) { await parent().click({ force: true }); await auditPage.waitForTimeout(20); }
    await auditPage.waitForTimeout(230);
    const rapid = await auditPage.evaluate(() => ({
        nodes: document.querySelectorAll('.ssm-node').length,
        children: document.querySelectorAll('.ssm-node.l2,.ssm-node.equipment').length,
        activeAnimations: document.querySelector('#visual').getAnimations({ subtree: true }).length,
        ghosts: document.querySelectorAll('[data-ghost],.ssm-ghost,.ssm-leaving').length,
    }));
    await auditPage.emulateMedia({ reducedMotion: 'reduce' });
    await auditPage.evaluate(() => window.__ssm.update());
    await parent().click();
    await auditPage.waitForTimeout(40);
    const reduced = await auditPage.evaluate(() => ({
        className: document.querySelector('.ssm-root').className,
        activeAnimations: document.querySelector('#visual').getAnimations({ subtree: true }).length,
        children: document.querySelectorAll('.ssm-node.l2').length,
    }));
    await auditPage.emulateMedia({ reducedMotion: 'no-preference' });
    await auditPage.locator('[data-search]').fill('EQ-B-240-03');
    await auditPage.waitForTimeout(150);
    await auditPage.locator('.ssm-search-result').filter({ hasText: 'Hierarchy Beta' }).first().click();
    await auditPage.waitForTimeout(230);
    const late = await auditPage.evaluate(() => ({
        selected: document.querySelector('.ssm-node.is-selected')?.dataset.node,
        parent: document.querySelector('.ssm-node.is-selected')?.dataset.parent,
        branch: document.querySelector('.ssm-node.is-selected')?.dataset.branch,
        count: document.querySelectorAll('.ssm-node').length,
        drawer: document.querySelector('.ssm-drawer').innerText,
        ghosts: document.querySelectorAll('[data-ghost],.ssm-ghost,.ssm-leaving').length,
        activeAnimations: document.querySelector('#visual').getAnimations({ subtree: true }).length,
    }));
    await auditPage.locator('#visual').screenshot({ path: '/Users/noahgarrett/Codebase/PowerBI/.playwright-mcp/ssm-nested-late-search.png', scale: 'css' });
    return { startup, during, opened, rapid, reduced, late };
}
