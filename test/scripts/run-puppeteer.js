const puppeteer = require('puppeteer');
const http = require('http');
const ecstatic = require('ecstatic');
const JasmineReporter = require('jasmine-terminal-reporter');

const PORT = 8080;

const [,, path] = process.argv;

if (!path) {
  /* eslint-disable no-console */
  console.log('The `path` argument is missing.');

  return;
}

const cleanupFactory = (browser, server) => async (exitCode) => {
  await browser.close();
  await new Promise((resolve) => server.close(() => resolve()));
  process.exit(exitCode);
};

(async () => {
  const browser = await puppeteer.launch({
    timeout: 10000,
    // devtools: true,
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--headless', '--disable-gpu', '--mute-audio'],
  });

  const page = await browser.newPage();

  page.setCacheEnabled(false);
  page.setViewport({
    width: 1200,
    height: 1000,
  });

  const server = http.createServer(ecstatic({
    root: `${__dirname}/../..`,
    showDir: true,
    autoIndex: true,
  }));
  const cleanup = cleanupFactory(browser, server);

  server.listen(PORT);

  const reporter = new JasmineReporter({
    colors: 1,
    cleanStack: 1,
    verbosity: 4,
    listStyle: 'flat',
    activity: true,
    isVerbose: false,
  });
  let errorCount = 0;

  await page.exposeFunction('jasmineStarted', (specInfo) => reporter.jasmineStarted(specInfo));
  await page.exposeFunction('jasmineSpecStarted', () => {});
  await page.exposeFunction('jasmineSuiteStarted', (suite) => reporter.suiteStarted(suite));
  await page.exposeFunction('jasmineSuiteDone', () => reporter.suiteDone());
  await page.exposeFunction('jasmineSpecDone', (result) => {
    if (result.failedExpectations.length) {
      errorCount += result.failedExpectations.length;
    }
    reporter.specDone(result);
  });
  await page.exposeFunction('jasmineDone', async () => {
    reporter.jasmineDone();

    await cleanup(errorCount === 0 ? 0 : 1);
  });

  page.on('pageerror', async (msg) => {
    /* eslint-disable no-console */
    console.log(msg);
    await cleanup(1);
  });

  await page.goto(`http://0.0.0.0:${PORT}/${path}`);
})();