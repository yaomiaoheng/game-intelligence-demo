const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const prefix = source.slice(0, source.indexOf('const state = {'));
const chartFile = JSON.parse(fs.readFileSync(path.join(root, 'apple-game-charts.json'), 'utf8'));
const expected = chartFile.charts.reduce((sum, chart) => sum + chart.items.length, 0);

async function run() {
  const nativeFetch = async (request) => {
    if (new URL(request.url).pathname === '/apple-game-charts.json') {
      return new Response(JSON.stringify(chartFile), {status: 200});
    }
    throw new Error(`unexpected public file: ${request.url}`);
  };
  const context = vm.createContext({
    window: {location: {href: 'https://example.test/index.html'}, fetch: nativeFetch},
    URL, URLSearchParams, Request, Response, Date, Set, Map,
  });
  vm.runInContext(`${prefix}\nglobalThis.testFetch = window.fetch; globalThis.testRegistry = sourceRegistry;`, context);
  const get = async (url) => (await context.testFetch(`https://example.test${url}`)).json();

  const all = await get('/api/games');
  assert.equal(all.total, expected, 'every real published ranking row is available');
  assert.equal(all.items.length, expected);
  assert.ok(all.items.every((item) => item.source.id === 'apple-games-rss'));
  assert.ok(all.items.every((item) => item.revenue === null && item.downloads === null && item.growth === null && item.score === null));
  assert.ok(all.items.every((item) => item.official_url?.startsWith('https://apps.apple.com/')));
  assert.ok(all.items.every((item) => item.app_store_id && item.country && item.board && item.rank > 0));
  assert.ok(all.items.every((item) => item.trend.length === 1), 'one fetch must not pretend to be a trend');
  const us = await get('/api/games?region=%E7%BE%8E%E5%9B%BD');
  assert.equal(us.total, chartFile.charts.filter((chart) => chart.country === 'US')
    .reduce((sum, chart) => sum + chart.items.length, 0));
  const gb = await get('/api/games?region=%E8%8B%B1%E5%9B%BD');
  assert.equal(gb.total, chartFile.charts.filter((chart) => chart.country === 'GB')
    .reduce((sum, chart) => sum + chart.items.length, 0));
  const item = all.items[0];
  const detail = await get(`/api/games/${encodeURIComponent(item.id)}`);
  assert.equal(detail.id, item.id);
  const profile = await get(`/api/games/${encodeURIComponent(item.id)}/product-analysis`);
  assert.equal(profile.kind, 'chart_evidence');
  assert.equal(profile.fields.app_store_id, item.app_store_id);
  assert.equal(profile.fields.rank, item.rank);
  assert.equal(profile.fields.source_url, item.official_url);
  assert.equal(profile.fields.source_updated_at, null);
  assert.ok(!('core_gameplay' in profile) && !('revenue' in profile.fields), 'do not invent product facts');
  const intelligence = await get(`/api/intelligence?game_id=${encodeURIComponent(item.id)}`);
  assert.equal(intelligence.analysis.trend.window.points, 1);
  assert.equal(intelligence.analysis.competitors.length, 0);
  assert.ok(context.testRegistry.some((source) => source.source_id === 'apple-games-rss' && source.redistribution_allowed === null));
  process.stdout.write(`Public radar: ${expected} published Apple rows, country filters and evidence-only detail passed.\n`);
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
