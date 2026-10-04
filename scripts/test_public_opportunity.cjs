const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.ok(page.indexOf('class="panel opportunity-board-panel"') < page.indexOf('class="analysis-grid" id="opportunities"'),
  'Top 100 rankings must appear before the single-game observation detail');
assert.match(fs.readFileSync(path.join(root, 'page-router.js'), 'utf8'),
  /opportunities:.*\.opportunity-board-panel/, 'opportunity page must show the ranking panel');
const start = source.indexOf('function renderOpportunityBoard()');
const end = source.indexOf('async function loadOpportunityBoard()', start);
assert.ok(start >= 0 && end > start, 'opportunity ranking renderer exists');
const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'apple-game-charts.json'), 'utf8'));
const elements = new Map(['#opportunityCountry', '#opportunityChart', '#opportunityBoardCount',
  '#opportunityBoardNote', '#opportunityBoardRows'].map(id => [id, {value: '', textContent: '', innerHTML: ''}]));
const escapeHTML = value => String(value).replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[ch]);
const state = {opportunityGames: snapshot.charts.flatMap(chart => chart.items.map(row => ({
  id: `${chart.country}|${chart.chart}|${row.app_store_id}`,
  region: {CN: '中国', US: '美国', JP: '日本'}[chart.country], board: chart.chart,
  rank: row.rank, name: row.name, app_store_id: row.app_store_id,
  company: row.publisher, official_url: row.source_url, observed_at: chart.observed_at,
  stale: chart.stale,
})))};
const context = vm.createContext({state, Number, escapeHTML,
  formatNumber: value => String(value), formatDateTime: value => value,
  $: id => elements.get(id),
  document: {querySelector: id => elements.get(id), querySelectorAll: () => []},
});
vm.runInContext(`${source.slice(start, end)}\nglobalThis.render = renderOpportunityBoard;`, context);
for (const chart of snapshot.charts) {
  elements.get('#opportunityCountry').value = {CN: '中国', US: '美国', JP: '日本'}[chart.country];
  elements.get('#opportunityChart').value = chart.chart;
  context.render();
  const html = elements.get('#opportunityBoardRows').innerHTML;
  const shown = (html.match(/data-opportunity-id=/g) || []).length;
  assert.equal(shown, Math.min(100, chart.items.filter(item => item.rank <= 100).length));
  assert.match(elements.get('#opportunityBoardCount').textContent, new RegExp(`^${shown} / 100`));
}
const unsafe = state.opportunityGames.find(item => item.region === '中国' && item.board === 'top-paid');
unsafe.name = '<img src=x>';
unsafe.company = '" onmouseover="alert(1)';
elements.get('#opportunityCountry').value = '中国';
elements.get('#opportunityChart').value = 'top-paid';
context.render();
assert.ok(!elements.get('#opportunityBoardRows').innerHTML.includes('<img src=x>'));
assert.ok(!elements.get('#opportunityBoardRows').innerHTML.includes(' onmouseover="alert(1)'));
process.stdout.write('Opportunity board: all nine real charts display up to 100 actual rows.\n');
