async (page) => {
    const benchmarkPage = await page.context().newPage();
    await benchmarkPage.goto('http://127.0.0.1:5186/?structural-scale=100000');
    await benchmarkPage.waitForFunction(() => !!window.__ssm?.benchmark);
    const result = await benchmarkPage.evaluate(() => window.__ssm.benchmark(100000));
    await benchmarkPage.locator('#visual').screenshot({ path: '/Users/noahgarrett/Codebase/PowerBI/.playwright-mcp/ssm-structural-100k.png', scale: 'css' });
    await benchmarkPage.close();
    return result;
}
