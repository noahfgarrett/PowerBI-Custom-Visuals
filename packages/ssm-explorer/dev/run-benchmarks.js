// Execute with the Playwright browser_run_code tool's filename argument.
// Run only after the indexed model and final Visual implementation are frozen.
async (page) => {
    const results = [];
    for (const size of [10000, 50000, 100000]) {
        const benchmarkPage = await page.context().newPage();
        await benchmarkPage.goto(`http://127.0.0.1:5186/?benchmark=${size}`);
        await benchmarkPage.waitForFunction(() => !!window.__ssm?.benchmark);
        results.push(await benchmarkPage.evaluate(size => window.__ssm.benchmark(size), size));
        // Close only this explicit benchmark-owned tab to release its large synthetic graph.
        await benchmarkPage.close();
    }
    return results;
}
