const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const profile = fs.readFileSync(path.join(root, 'product-analysis.js'), 'utf8');
const charts = JSON.parse(fs.readFileSync(path.join(root, 'apple-game-charts.json'), 'utf8'));
const elements = new Map();
const documentHandlers = {};
function element(selector) {
  if (!elements.has(selector)) elements.set(selector, {
    innerHTML: '', textContent: '', disabled: false, dataset: {},
    handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; },
    classList: {toggle() {}},
  });
  return elements.get(selector);
}
const tabs = ['summary', 'gameplay', 'features', 'feedback', 'events', 'comparison', 'lessons']
  .map((tab) => ({dataset: {productTab: tab}, disabled: false, classList: {toggle() {}}}));
const nativeFetch = async (request) => {
  if (new URL(request.url).pathname === '/apple-game-charts.json') {
    return new Response(JSON.stringify(charts), {status: 200});
  }
  throw new Error(`unexpected file: ${request.url}`);
};
const context = vm.createContext({
  window: {location: {href: 'https://example.test/index.html'}, fetch: nativeFetch},
  document: {querySelector: element, querySelectorAll: () => tabs,
    addEventListener(type, fn) { documentHandlers[type] = fn; }},
  URL, URLSearchParams, Request, Response, Date, Set, Map,
});
vm.runInContext(app.slice(0, app.indexOf('const state = {')), context);
context.fetch = (...args) => context.window.fetch(...args);

async function run() {
  const listing = await (await context.window.fetch('https://example.test/api/games?limit=1')).json();
  const item = listing.items[0];
  assert.match(app, /dispatchEvent\(new CustomEvent\("gamepulse:game-selected"/);
  assert.match(app, /window\.gamePulseSelectedGameId = id/);
  // Simulate the first selection resolving before this external script is loaded.
  context.window.gamePulseSelectedGameId = item.id;
  vm.runInContext(profile, context);
  assert.equal(typeof documentHandlers['gamepulse:game-selected'], 'function');
  for (let attempt = 0; attempt < 20 && !element('#productAnalysisBody').innerHTML.includes('已核验的榜单观测'); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const rendered = element('#productAnalysisBody').innerHTML;
  assert.match(rendered, /已核验的榜单观测/);
  assert.match(rendered, new RegExp(item.app_store_id));
  assert.match(rendered, /玩法循环、玩家反馈、版本事件和运营信息暂无/);
  assert.doesNotMatch(rendered, /成功概率：\d|真实收入：\d/);
  assert.equal(tabs[0].disabled, false);
  assert.ok(tabs.slice(1).every((tab) => tab.disabled));
  const secondListing = await (await context.window.fetch('https://example.test/api/games?limit=2')).json();
  const next = secondListing.items.find((game) => game.id !== item.id);
  assert.ok(next);
  documentHandlers['gamepulse:game-selected']({detail: {gameId: next.id}});
  for (let attempt = 0; attempt < 20 && !element('#productAnalysisTitle').textContent.includes(next.name); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.match(element('#productAnalysisBody').innerHTML, new RegExp(next.app_store_id));
  process.stdout.write('Public product profile: real chart evidence rendered; unsupported tabs disabled.\n');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
