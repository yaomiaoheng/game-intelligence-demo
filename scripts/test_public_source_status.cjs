const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const sourcePage = fs.readFileSync(path.join(root, 'interface-layout.js'), 'utf8');
const assistantPage = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const apple = JSON.parse(fs.readFileSync(path.join(root, 'apple-game-charts.json'), 'utf8'));
const mini = JSON.parse(fs.readFileSync(path.join(root, 'mini-ranking-snapshot.json'), 'utf8'));
const registryContext = vm.createContext({});
vm.runInContext(app.slice(0, app.indexOf('const json =')) + '\nglobalThis.registry = sourceRegistry;', registryContext);
const registry = registryContext.registry;
const appleCount = apple.charts.reduce((count, chart) => count + chart.items.length, 0);
const miniCount = mini.providers.douyin.rows.length + mini.providers.wechat.rows.length;
const now = Date.parse(apple.charts.at(-1).observed_at) + 15 * 60 * 1000;
class FixedDate extends Date { static now() { return now; } }

async function render({applePayload = apple, miniPayload = mini, missingMini = false} = {}) {
  const elements = new Map([
    ['sourceRegistryGrid', {innerHTML: ''}],
    ['sourceRegistryCount', {textContent: ''}],
  ]);
  const fetch = async (input) => {
    const pathname = new URL(String(input), 'https://example.test/').pathname;
    if (pathname === '/api/data-sources/registry') return new Response(JSON.stringify({items: registry}));
    if (pathname === '/apple-game-charts.json') return new Response(JSON.stringify(applePayload));
    if (pathname === '/mini-ranking-snapshot.json') return missingMini
      ? new Response('{}', {status: 503}) : new Response(JSON.stringify(miniPayload));
    throw new Error(`Unexpected public path: ${pathname}`);
  };
  vm.runInNewContext(sourcePage, {
    document: {getElementById: (id) => elements.get(id)},
    window: {location: {href: 'https://example.test/index.html'}},
    fetch, URL, Date: FixedDate, Intl, Set,
  });
  for (let attempt = 0; attempt < 30 && !elements.get('sourceRegistryGrid').innerHTML; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return {
    summary: elements.get('sourceRegistryCount').textContent,
    cards: elements.get('sourceRegistryGrid').innerHTML,
  };
}

async function run() {
  assert.equal(apple.charts.length, 9);
  assert.ok(appleCount > 0 && appleCount <= 900, 'nine charts may contain fewer than 100 actual entries each');
  assert.equal(miniCount, 120);
  assert.ok(registry.some((item) => item.source_id === 'qimai'));
  assert.ok(registry.some((item) => item.source_id === 'dataeye-mini-rankings'));

  const current = await render();
  assert.match(current.summary, /2 个有公开快照/);
  assert.match(current.cards, new RegExp(`9 张榜单 / ${appleCount} 条实际名次`));
  assert.match(current.cards, new RegExp(`6 张榜单 / ${miniCount} 条实际名次`));
  assert.match(current.cards, /最近本系统抓取/);
  assert.match(current.cards, /最近来源观察/);
  assert.match(current.cards, /旧快照/);
  assert.match(current.cards, /七麦数据<\/h3><span>未接入公开站/);
  assert.match(current.cards, /Mock Product Lab<\/h3><span>演示来源（未启用）/);
  assert.doesNotMatch(current.summary, /0 个有公开快照/);

  const partialApple = structuredClone(apple);
  partialApple.charts[0].stale = true;
  assert.match((await render({applePayload: partialApple})).cards, /部分榜单为旧快照/);

  const missing = await render({missingMini: true});
  assert.match(missing.summary, /1 个有公开快照/);
  assert.match(missing.cards, /DataEye ADX 小游戏榜单<\/h3><span>快照读取失败/);
  assert.doesNotMatch(missing.cards, /0 条实际名次（抖音/);

  assert.match(app, /window\.PublicFactAnswer\.answer/);
  assert.match(app, /"evidence_fact", "clarification", "insufficient_evidence"/);
  const facts = fs.readFileSync(path.join(root, 'public-fact-answer.js'), 'utf8');
  const queryContext = vm.createContext({
    window: {location: {href: 'https://example.test/index.html'}, fetch: async (request) => {
      const pathname = new URL(request.url).pathname;
      if (pathname === '/apple-game-charts.json') return new Response(JSON.stringify(apple));
      if (pathname === '/mini-ranking-snapshot.json') return new Response(JSON.stringify(mini));
      throw new Error(`Unexpected public path: ${pathname}`);
    }},
    URL, URLSearchParams, Request, Response, Date: FixedDate, Set, Map,
  });
  vm.runInContext(facts, queryContext);
  vm.runInContext(app.slice(0, app.indexOf('const state = {')) + '\nglobalThis.testFetch = window.fetch;', queryContext);
  const ask = async (query) => (await queryContext.testFetch('https://example.test/api/query', {
    method: 'POST', body: JSON.stringify({query}),
  })).json();
  const one = await ask('中国 App Store 免费榜前 3 名？');
  const two = await ask('某游戏收入多少？');
  assert.equal(one.status, 'evidence_fact');
  assert.equal(one.evidence_count, 3);
  assert.equal(two.status, 'insufficient_evidence');
  assert.notEqual(one.answer, two.answer, 'factual ranking replies must retain their source scope');
  assert.match(assistantPage, /当前尚不能生成分析报告/);
  assert.match(assistantPage, /public-fact-answer\.js/);
  assert.doesNotMatch(assistantPage, /报告将在这里生成|整体分析报告/);
  process.stdout.write('Public source status and assistant evidence-gate contract passed.\n');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
