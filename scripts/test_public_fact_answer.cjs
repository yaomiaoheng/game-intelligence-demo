const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'public-fact-answer.js'), 'utf8');
const apple = JSON.parse(fs.readFileSync(path.join(root, 'apple-game-charts.json'), 'utf8'));
const mini = JSON.parse(fs.readFileSync(path.join(root, 'mini-ranking-snapshot.json'), 'utf8'));
const now = Date.parse(apple.charts[0].observed_at) + 15 * 60 * 1000;
class FixedDate extends Date { static now() { return now; } }
const context = vm.createContext({window: {location: {href: 'https://example.test/index.html'}},
  URL, Request, Response, Date: FixedDate, Number, Set});
vm.runInContext(source, context);

function snapshots({applePayload = apple, miniPayload = mini, failApple = false, failMini = false} = {}) {
  return async (request) => {
    const name = new URL(request.url).pathname;
    if (name === '/apple-game-charts.json') return failApple ? new Response('{}', {status: 503})
      : new Response(JSON.stringify(applePayload));
    if (name === '/mini-ranking-snapshot.json') return failMini ? new Response('{}', {status: 503})
      : new Response(JSON.stringify(miniPayload));
    throw new Error(`Unexpected request: ${name}`);
  };
}

async function run() {
  const ask = (query, settings = {}) => context.window.PublicFactAnswer.answer(
    query, snapshots(settings), {now, appleEnabled: settings.appleEnabled});
  const top = await ask('中国 App Store 免费榜前 5 名？');
  assert.equal(top.status, 'evidence_fact');
  assert.equal(top.evidence_count, 5);
  const gbTop = await ask('英国 App Store 付费榜前 2 名？');
  assert.equal(gbTop.status, 'evidence_fact');
  assert.equal(gbTop.evidence_count, 2);
  assert.match(gbTop.answer, /英国 App Store/);
  assert.ok(gbTop.evidence.every(item => item.source_url?.includes('/gb/')));
  assert.match(top.answer, /Apple Games RSS/);
  assert.match(top.answer, /Apple 官方榜单更新时间未知/);
  assert.match(top.answer, /名次不代表下载量/);
  const first = apple.charts.find(chart => chart.country === 'CN' && chart.chart === 'top-free').items[0];
  const exact = await ask(`中国 App Store 免费榜 App ID ${first.app_store_id} 排名？`);
  assert.equal(exact.evidence_count, 1);
  assert.equal(exact.evidence[0].rank, first.rank);
  assert.equal(exact.evidence[0].source_id, 'apple-games-rss');
  assert.equal((await ask('中国 App Store 免费榜前 11 名')).status, 'clarification');
  assert.equal((await ask('中国 App Store 免费榜')).status, 'clarification');
  assert.equal((await ask('中国 App Store 免费榜收入？')).status, 'insufficient_evidence');
  assert.equal((await ask('中国 App Store 免费榜下载多少？')).status, 'insufficient_evidence');
  assert.equal((await ask('中国 App Store 免费榜前 3 名', {appleEnabled: false})).status, 'insufficient_evidence');
  assert.equal((await ask('中国 App Store 免费榜前 3 名', {failApple: true})).status, 'insufficient_evidence');
  const staleApple = structuredClone(apple);
  staleApple.charts[0].stale = true;
  assert.match((await ask('中国 App Store 免费榜前 1 名', {applePayload: staleApple})).answer, /旧快照/);

  const miniTop = await ask('抖音小游戏畅销榜前 3 名？');
  assert.equal(miniTop.status, 'evidence_fact');
  assert.equal(miniTop.evidence_count, 3);
  assert.match(miniTop.answer, /旧快照/);
  assert.match(miniTop.answer, /不是实时同步/);
  assert.equal((await ask('微信小游戏畅玩榜前 2 名？')).evidence_count, 2);
  assert.equal((await ask('抖音小游戏畅销榜前 2 名？', {failMini: true})).status, 'insufficient_evidence');
  const cover = await ask('数据来源覆盖多少条？');
  const appleCount = apple.charts.reduce((sum, chart) => sum + chart.items.length, 0);
  assert.match(cover.answer, new RegExp(`${appleCount} 条实际名次`));
  assert.match(cover.answer, /6 张榜、120 条实际名次/);
  assert.equal((await ask('数据来源覆盖多少条？', {failApple: true, failMini: true})).status, 'insufficient_evidence');
  assert.equal((await ask('帮我推荐最具潜力的投资方案')).status, 'insufficient_evidence');
  assert.equal((await ask('<img src=x onerror=alert(1)>')).status, 'clarification');
  assert.doesNotMatch(source, /innerHTML|eval\(/);
  process.stdout.write('Published snapshot fact-answer contract passed.\n');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
