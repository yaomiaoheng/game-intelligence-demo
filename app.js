const games = [{"id":"starfall","name":"星落远征","company":"远望互动","publisher":"远望互动","region":"中国","channel":"App Store","category":"策略RPG","tags":["卡牌","科幻","放置"],"rating":4.7,"sentiment":86,"status":"高潜力","revenue":4280,"downloads":286,"growth":31.8,"free_rank":6,"grossing_rank":3,"signal":"版本活动带动收入连续三周增长，付费转化优于同类均值。","trend":[["09/01",23,980,18],["09/08",16,1260,24],["09/15",11,1880,31],["09/22",8,2740,37],["09/29",6,4280,46]]},{"id":"harbor","name":"港湾物语","company":"青屿网络","publisher":"青屿网络","region":"中国","channel":"微信小游戏","category":"模拟经营","tags":["治愈","经营","社交"],"rating":4.8,"sentiment":91,"status":"趋势爆发","revenue":3160,"downloads":512,"growth":48.6,"free_rank":2,"grossing_rank":7,"signal":"模拟经营赛道新增用户显著抬升，小游戏渠道传播效率突出。","trend":[["09/01",38,510,42],["09/08",22,830,61],["09/15",12,1420,78],["09/22",5,2260,96],["09/29",2,3160,118]]},{"id":"mecha","name":"机甲破晓","company":"极昼工作室","publisher":"北辰发行","region":"全球","channel":"Google Play","category":"动作竞技","tags":["机甲","PVP","动作"],"rating":4.4,"sentiment":72,"status":"重点观察","revenue":2570,"downloads":341,"growth":12.4,"free_rank":14,"grossing_rank":12,"signal":"下载增长保持稳定，但评分受匹配机制反馈影响，需观察留存。","trend":[["09/01",19,1680,52],["09/08",16,1940,57],["09/15",12,2190,61],["09/22",13,2410,65],["09/29",14,2570,69]]},{"id":"chef","name":"今晚吃什么","company":"小满科技","publisher":"小满科技","region":"中国","channel":"华为应用市场","category":"休闲益智","tags":["合成","美食","轻度"],"rating":4.6,"sentiment":83,"status":"稳健增长","revenue":1640,"downloads":448,"growth":18.9,"free_rank":9,"grossing_rank":21,"signal":"低获客成本带动规模增长，商业化深度仍有提升空间。","trend":[["09/01",17,930,66],["09/08",14,1080,74],["09/15",12,1250,81],["09/22",10,1460,89],["09/29",9,1640,96]]},{"id":"kingdom","name":"王国边境线","company":"狮鹫游戏","publisher":"Aurora Games","region":"欧美","channel":"App Store","category":"塔防策略","tags":["塔防","中世纪","单机"],"rating":4.5,"sentiment":79,"status":"成熟产品","revenue":1980,"downloads":176,"growth":-3.6,"free_rank":32,"grossing_rank":18,"signal":"核心用户付费稳定，新用户增长放缓，适合通过内容更新再激活。","trend":[["09/01",26,2110,39],["09/08",28,2070,38],["09/15",29,2030,37],["09/22",31,2000,36],["09/29",32,1980,35]]}];

const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  },
});

const publicGame = (game, includeTrend = false) => {
  const { trend, ...item } = game;
  if (includeTrend) {
    item.trend = trend.map(([date, rank, revenue, downloads]) => ({ date, rank, revenue, downloads }));
  }
  return item;
};

const intelligence = (game) => {
  const competitors = games
    .filter((item) => item.id !== game.id)
    .sort((a, b) => b.growth - a.growth)
    .slice(0, 2)
    .map((item) => ({
      game_id: item.id,
      name: item.name,
      reason: item.region === game.region ? "同市场高增长产品" : "跨市场增长参照",
      growth_rate: item.growth,
    }));
  const risks = [
    { code: "DEMO_SOURCE", level: "medium", summary: "当前为 Mock 演示数据，不能直接用于商业决策。" },
  ];
  if (game.growth < 0) risks.push({ code: "NEGATIVE_GROWTH", level: "high", summary: "近期增长为负，需要验证内容与获客效率。" });
  if (game.rating < 4.5) risks.push({ code: "RATING_PRESSURE", level: "medium", summary: "评分低于样本均值，需关注用户反馈。" });
  return {
    game: { id: game.id, name: game.name, company: game.company, publisher: game.publisher, category: game.category, tags: game.tags },
    snapshots: [],
    analysis: {
      trend: {
        direction: game.growth > 3 ? "up" : game.growth < -3 ? "down" : "flat",
        change_rate: game.growth,
        summary: `${game.name}近周期增长${game.growth >= 0 ? "+" : ""}${game.growth}%，${game.signal}`,
        evidence: [`收入 ${game.revenue} 万元`, `下载 ${game.downloads} 万次`, `免费榜第 ${game.free_rank} 名`],
        window: { points: game.trend.length },
      },
      competitors,
      risks,
    },
    sources: [{ id: "mock-platform", label: "Mock Platform", quality: "demo" }],
    updated_at: "2026-10-03T03:30:00Z",
  };
};

function answer(query) {
  const selected = games.find((game) => query.includes(game.name));
  if (selected) return `${selected.name}当前监测收入 ${selected.revenue} 万元，近周期增长 ${selected.growth}%。${selected.signal}`;
  const leader = [...games].sort((a, b) => b.growth - a.growth)[0];
  return `Mock 样本中增长最快的是《${leader.name}》，近周期增长 ${leader.growth}%。所有结果仅供产品体验。`;
}

const mockWorker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") return json({ ok: true, service: "game-intel-public-demo" });
    if (url.pathname === "/api/overview") {
      const leader = [...games].sort((a, b) => b.growth - a.growth)[0];
      return json({
        games: games.length,
        revenue: games.reduce((sum, item) => sum + item.revenue, 0),
        downloads: games.reduce((sum, item) => sum + item.downloads, 0),
        avgGrowth: Math.round(games.reduce((sum, item) => sum + item.growth, 0) / games.length * 10) / 10,
        leader: leader.name,
        updatedAt: "2026-10-03 11:30",
        notice: "公开体验版仅使用 Mock 演示数据，不代表真实市场表现或商业结论。",
      });
    }
    if (url.pathname === "/api/games") {
      const q = (url.searchParams.get("q") || "").toLowerCase();
      const region = url.searchParams.get("region") || "";
      const channel = url.searchParams.get("channel") || "";
      const sort = url.searchParams.get("sort") || "growth";
      const items = games.filter((game) => {
        const haystack = [game.name, game.company, game.publisher, game.category, ...game.tags].join(" ").toLowerCase();
        return (!q || haystack.includes(q)) && (!region || game.region === region) && (!channel || game.channel === channel);
      }).sort((a, b) => (b[sort] || 0) - (a[sort] || 0)).map((game) => publicGame(game));
      return json({ items });
    }
    if (url.pathname.startsWith("/api/games/")) {
      const game = games.find((item) => item.id === url.pathname.split("/").pop());
      return game ? json(publicGame(game, true)) : json({ error: "未找到游戏" }, 404);
    }
    if (url.pathname === "/api/intelligence") {
      const name = url.searchParams.get("game_name") || "";
      const game = games.find((item) => item.name === name);
      return game ? json(intelligence(game)) : json({ error: { code: "GAME_NOT_FOUND", message: "未找到匹配的游戏" } }, 404);
    }
    if (url.pathname === "/api/query" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      return json({ answer: answer(String(body.query || "")) });
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "接口不存在" }, 404);
    return nativeFetch(request);
  },
};



const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const request = input instanceof Request
    ? input
    : new Request(new URL(String(input), window.location.href), init);
  if (new URL(request.url).pathname.startsWith('/api/')) {
    return mockWorker.fetch(request, {});
  }
  return nativeFetch(input, init);
};

const state = { games: [], selected: null, metric: "revenue", rangeDays: 30 };
const $ = (selector) => document.querySelector(selector);

async function getJSON(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function formatNumber(value) { return new Intl.NumberFormat("zh-CN").format(value); }

async function loadOverview() {
  const data = await getJSON("/api/overview");
  $("#gamesMetric").textContent = data.games;
  $("#revenueMetric").textContent = formatNumber(data.revenue);
  $("#downloadsMetric").textContent = formatNumber(data.downloads);
  $("#growthMetric").textContent = `+${data.avgGrowth}%`;
  $("#leaderMetric").textContent = data.leader;
  $("#updatedAt").textContent = `更新于 ${data.updatedAt}`;
  $("#dataNotice").textContent = data.notice;
}

function renderRows(games) {
  $("#resultCount").textContent = `${games.length} 个结果`;
  $("#gameRows").innerHTML = games.map((game) => `
    <tr data-id="${game.id}">
      <td><div class="game-name"><span class="game-icon">${game.name.slice(0, 1)}</span><span><strong>${game.name}</strong><small>${game.company}</small><span class="tags">${game.tags.slice(0, 2).map(tag => `<i class="tag">${tag}</i>`).join("")}</span></span></div></td>
      <td>${game.region}<br><small>${game.channel}</small></td>
      <td><span class="rank">${game.free_rank}</span></td>
      <td><strong>${formatNumber(game.revenue)} 万</strong></td>
      <td class="growth ${game.growth < 0 ? "negative" : ""}">${game.growth > 0 ? "+" : ""}${game.growth}%</td>
      <td><span class="status">${game.status}</span></td>
    </tr>`).join("") || `<tr><td colspan="6">没有符合条件的产品</td></tr>`;
  document.querySelectorAll("tr[data-id]").forEach(row => row.addEventListener("click", () => selectGame(row.dataset.id)));
}

async function loadGames() {
  const params = new URLSearchParams({
    q: $("#searchInput").value,
    category: $("#categoryFilter").value,
    region: $("#regionFilter").value,
    channel: $("#channelFilter").value,
    sort: $("#sortFilter").value,
  });
  const data = await getJSON(`/api/games?${params}`);
  state.games = data.items;
  renderRows(state.games);
  if (!state.selected && state.games[0]) selectGame(state.games[0].id);
}

async function selectGame(id) {
  const selected = state.games.find((game) => game.id === id);
  const [game, intelligence] = await Promise.all([
    getJSON(`/api/games/${id}`),
    getJSON(`/api/intelligence?game_name=${encodeURIComponent(selected?.name || "")}`),
  ]);
  state.selected = game;
  document.querySelectorAll("tr[data-id]").forEach(row => row.classList.toggle("selected", row.dataset.id === id));
  $("#selectedInsight").textContent = game.signal;
  const score = Math.max(55, Math.min(96, Math.round(70 + game.growth / 3 + (game.rating - 4) * 8)));
  $("#scoreValue").textContent = score;
  $(".score-ring").style.background = `conic-gradient(var(--green) 0 ${score}%, #e7ece9 ${score}%)`;
  renderSelectedTrend();
  renderIntelligence(intelligence);
}

function renderIntelligence(intelligence) {
  const source = intelligence.sources[0];
  const trend = intelligence.analysis.trend;
  $("#sourceBadge").textContent = `${source.label} · ${source.quality === "demo" ? "演示数据" : source.quality}`;
  $("#sourceUpdated").textContent = `来源更新 ${formatDateTime(intelligence.updated_at)}`;
  $("#sourceUpdated").dateTime = intelligence.updated_at;
  $("#trendSummary").textContent = trend.summary;
  $("#trendEvidence").textContent = `证据：${trend.evidence.join("、")} · ${trend.window.points} 个观测点`;
  $("#competitorList").innerHTML = intelligence.analysis.competitors.map((item) =>
    `<li><strong>${item.name}</strong><span>${item.reason} · 增速 ${item.growth_rate > 0 ? "+" : ""}${item.growth_rate}%</span></li>`
  ).join("") || "<li>暂无可比产品</li>";
  $("#riskList").innerHTML = intelligence.analysis.risks.map((item) =>
    `<li><span class="risk-level ${item.level}">${item.level}</span><span>${item.summary}</span></li>`
  ).join("") || "<li>当前未识别到风险信号</li>";
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date);
}

function updateChartSummary() {
  if (!state.selected) return;
  const game = state.selected;
  const points = selectedTrendPoints();
  const latest = points.at(-1);
  const first = points[0];
  const rangeName = state.rangeDays === null ? "全部" : `${state.rangeDays}天`;
  const percentChange = (key) => {
    if (!first || !latest || first[key] === 0 || points.length < 2) return "样本不足";
    const value = ((latest[key] - first[key]) / first[key]) * 100;
    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  };
  const rankChange = first && latest ? first.rank - latest.rank : 0;
  const metricCopy = {
    revenue: { title: "收入走势", value: `${formatNumber(latest?.revenue ?? game.revenue)} 万元`, delta: percentChange("revenue") },
    downloads: { title: "下载走势", value: `${formatNumber(latest?.downloads ?? game.downloads)} 万次`, delta: percentChange("downloads") },
    rank: { title: "免费榜走势", value: `第 ${latest?.rank ?? game.free_rank} 名`, delta: points.length < 2 ? "样本不足" : `${rankChange >= 0 ? "上升" : "下降"} ${Math.abs(rankChange)} 位` },
  }[state.metric];
  $("#chartTitle").textContent = `${game.name} · ${metricCopy.title}`;
  $("#chartRevenue").textContent = metricCopy.value;
  $("#chartDelta").textContent = `${metricCopy.delta} · ${rangeName} · ${points.length} 个观测点`;
}

function selectedTrendPoints() {
  const points = state.selected?.trend || [];
  if (state.rangeDays === null || points.length < 2) return points;
  const parseDate = (value) => {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return Date.parse(value);
    const [month, day] = value.split("/").map(Number);
    return Date.UTC(new Date().getUTCFullYear(), month - 1, day);
  };
  const latest = parseDate(points.at(-1).date);
  const cutoff = latest - state.rangeDays * 24 * 60 * 60 * 1000;
  return points.filter((point) => parseDate(point.date) >= cutoff);
}

function renderSelectedTrend() {
  if (!state.selected) return;
  const points = selectedTrendPoints();
  updateChartSummary();
  drawChart(points, state.metric);
}

function drawChart(points, metric = "revenue") {
  const canvas = $("#trendChart");
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = 220;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, width, height);
  const pad = { x: 10, y: 18, bottom: 14 };
  ctx.strokeStyle = "#e7ece9";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) { const y = pad.y + i * 43; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  const makePath = (key, color) => {
    const values = points.map(p => p[key]);
    const min = Math.min(...values) * .9;
    const max = Math.max(...values) * 1.08;
    ctx.beginPath();
    values.forEach((value, index) => {
      const x = values.length === 1 ? width / 2 : pad.x + index * ((width - pad.x * 2) / (values.length - 1));
      const progress = (value - min) / (max - min || 1);
      const y = key === "rank" ? pad.y + progress * (height - pad.y - pad.bottom) : height - pad.bottom - progress * (height - pad.y - pad.bottom);
      index ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
  };
  const colors = { revenue: "#136f52", downloads: "#ff7a45", rank: "#7257d5" };
  makePath(metric, colors[metric]);
  $("#chartAxis").innerHTML = points.map(point => `<span>${point.date}</span>`).join("");
}

let debounce;
$("#filterForm").addEventListener("input", () => { clearTimeout(debounce); debounce = setTimeout(loadGames, 180); });
$("#resetFilters").addEventListener("click", () => { $("#filterForm").reset(); loadGames(); });
document.querySelectorAll(".metric-tabs button").forEach(button => button.addEventListener("click", () => {
  state.metric = button.dataset.metric;
  document.querySelectorAll(".metric-tabs button").forEach(item => {
    const active = item === button;
    item.classList.toggle("active", active);
    item.setAttribute("aria-selected", String(active));
  });
  renderSelectedTrend();
}));
document.querySelectorAll(".range-tabs button").forEach(button => button.addEventListener("click", () => {
  state.rangeDays = button.dataset.range === "all" ? null : Number(button.dataset.range);
  document.querySelectorAll(".range-tabs button").forEach(item => {
    const active = item === button;
    item.classList.toggle("active", active);
    item.setAttribute("aria-pressed", String(active));
  });
  renderSelectedTrend();
}));
$("#assistantForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = $("#assistantInput").value.trim();
  if (!query) return;
  $("#assistantAnswer").textContent = "正在分析…";
  try {
    const data = await getJSON("/api/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
    $("#assistantAnswer").textContent = data.answer;
  } catch (error) { $("#assistantAnswer").textContent = error.message; }
});
$(".menu-button").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
window.addEventListener("resize", () => state.selected && drawChart(selectedTrendPoints(), state.metric));
Promise.all([loadOverview(), loadGames()]).catch(error => { $("#dataNotice").textContent = `加载失败：${error.message}`; });
