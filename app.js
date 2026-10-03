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
      const requestedLimit = Number(url.searchParams.get("limit") || 100);
      const limit = Math.max(1, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 100, 500));
      const items = games.filter((game) => {
        const haystack = [game.name, game.company, game.publisher, game.category, ...game.tags].join(" ").toLowerCase();
        return (!q || haystack.includes(q)) && (!region || game.region === region) && (!channel || game.channel === channel);
      }).sort((a, b) => (b[sort] || 0) - (a[sort] || 0)).slice(0, limit).map((game) => publicGame(game));
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

const state = {
  games: [], selected: null, metric: "revenue", rangeDays: 30,
  startDate: null, endDate: null, rangeMode: "preset", referenceYear: new Date().getUTCFullYear(),
};
const $ = (selector) => document.querySelector(selector);

async function getJSON(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function hasValue(value) { return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)); }
function formatNumber(value) { return hasValue(value) ? new Intl.NumberFormat("zh-CN").format(value) : "暂无数据"; }
function valueCell(value, suffix = "") {
  return hasValue(value) ? `${formatNumber(value)}${suffix}` : '<span class="missing-value">暂无数据</span>';
}

async function loadOverview() {
  const data = await getJSON("/api/overview");
  const overviewYear = Number(String(data.updatedAt || "").slice(0, 4));
  if (Number.isInteger(overviewYear)) state.referenceYear = overviewYear;
  $("#gamesMetric").textContent = data.games;
  $("#revenueMetric").textContent = formatNumber(data.revenue);
  $("#downloadsMetric").textContent = formatNumber(data.downloads);
  $("#growthMetric").textContent = hasValue(data.avgGrowth) ? `${data.avgGrowth > 0 ? "+" : ""}${data.avgGrowth}%` : "暂无数据";
  $("#leaderMetric").textContent = data.leader || "暂无数据";
  $("#updatedAt").textContent = `更新于 ${data.updatedAt}`;
  $("#dataNotice").textContent = data.notice;
}

function renderRows(games) {
  $("#resultCount").textContent = `${games.length} 个结果`;
  $("#gameRows").innerHTML = games.map((game) => `
    <tr data-id="${game.id}">
      <td><div class="game-name"><span class="game-icon">${game.name.slice(0, 1)}</span><span><strong>${game.name}</strong><small>${game.company}</small><span class="tags">${game.tags.slice(0, 2).map(tag => `<i class="tag">${tag}</i>`).join("")}</span></span></div></td>
      <td>${game.region}<br><small>${game.channel}</small></td>
      <td><span class="rank">${valueCell(game.free_rank)}</span></td>
      <td><strong>${valueCell(game.revenue, " 万")}</strong></td>
      <td class="growth ${game.growth < 0 ? "negative" : ""}">${hasValue(game.growth) ? `${game.growth > 0 ? "+" : ""}${game.growth}%` : '<span class="missing-value">暂无数据</span>'}</td>
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
    limit: "100",
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
  syncDateControls();
  document.querySelectorAll("tr[data-id]").forEach(row => row.classList.toggle("selected", row.dataset.id === id));
  $("#selectedInsight").textContent = game.signal;
  const score = Math.max(55, Math.min(96, Math.round(70 + game.growth / 3 + (game.rating - 4) * 8)));
  $("#scoreValue").textContent = score;
  $(".score-ring").style.background = `conic-gradient(var(--green) 0 ${score}%, #e7ece9 ${score}%)`;
  renderIntelligence(intelligence);
  renderSelectedTrend();
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

function parseTrendDate(value) {
  if (!value) return NaN;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
  const match = /^(\d{1,2})\/(\d{1,2})$/.exec(value);
  if (!match) return Date.parse(value);
  return Date.UTC(state.referenceYear, Number(match[1]) - 1, Number(match[2]));
}

function inputDate(timestamp) {
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : "";
}

function dateLabel(value) {
  if (!value) return "未设置";
  const timestamp = parseTrendDate(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(timestamp);
}

function trendBounds() {
  const timestamps = (state.selected?.trend || []).map(point => parseTrendDate(point.date)).filter(Number.isFinite);
  return timestamps.length ? { min: Math.min(...timestamps), max: Math.max(...timestamps) } : { min: NaN, max: NaN };
}

function syncDateControls() {
  const bounds = trendBounds();
  const start = $("#trendStartDate");
  const end = $("#trendEndDate");
  const min = inputDate(bounds.min);
  const max = inputDate(bounds.max);
  for (const input of [start, end]) { input.min = min; input.max = max; }
  if (state.rangeMode === "custom" && state.startDate && state.endDate) {
    start.value = state.startDate;
    end.value = state.endDate;
    return;
  }
  applyPresetRange(state.rangeDays, false);
}

function applyPresetRange(days, shouldRender = true) {
  const bounds = trendBounds();
  state.rangeDays = days;
  state.rangeMode = "preset";
  state.endDate = inputDate(bounds.max);
  state.startDate = days === null ? inputDate(bounds.min) : inputDate(Math.max(bounds.min, bounds.max - days * 86400000));
  $("#trendStartDate").value = state.startDate;
  $("#trendEndDate").value = state.endDate;
  $("#trendRangeStatus").textContent = "";
  document.querySelectorAll(".range-tabs button").forEach(item => {
    const active = (days === null ? "all" : String(days)) === item.dataset.range;
    item.classList.toggle("active", active);
    item.setAttribute("aria-pressed", String(active));
  });
  if (shouldRender) renderSelectedTrend();
}

function updateChartSummary() {
  if (!state.selected) return;
  const game = state.selected;
  const points = selectedTrendPoints();
  const validPoints = points.filter(point => hasValue(point[state.metric]));
  const latest = validPoints.at(-1);
  const first = validPoints[0];
  const rangeName = state.startDate && state.endDate ? `${dateLabel(state.startDate)} 至 ${dateLabel(state.endDate)}` : "未设置区间";
  const percentChange = (key) => {
    if (!first || !latest || Number(first[key]) === 0 || validPoints.length < 2) return "该区间暂无足够数据";
    const value = ((latest[key] - first[key]) / first[key]) * 100;
    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  };
  const rankChange = first && latest ? Number(first.rank) - Number(latest.rank) : 0;
  const metricCopy = {
    revenue: { title: "收入走势", value: hasValue(latest?.revenue) ? `${formatNumber(latest.revenue)} 万元` : "暂无数据", delta: percentChange("revenue") },
    downloads: { title: "下载走势", value: hasValue(latest?.downloads) ? `${formatNumber(latest.downloads)} 万次` : "暂无数据", delta: percentChange("downloads") },
    rank: { title: "免费榜走势", value: hasValue(latest?.rank) ? `第 ${formatNumber(latest.rank)} 名` : "暂无数据", delta: validPoints.length < 2 ? "该区间暂无足够数据" : `${rankChange >= 0 ? "上升" : "下降"} ${Math.abs(rankChange)} 位` },
  }[state.metric];
  $("#chartTitle").textContent = `${game.name} · ${metricCopy.title}`;
  $("#chartRevenue").textContent = metricCopy.value;
  $("#chartDelta").textContent = `${metricCopy.delta} · ${rangeName} · ${validPoints.length}/${points.length} 个有效观测点`;
}

function selectedTrendPoints() {
  const points = state.selected?.trend || [];
  const start = parseTrendDate(state.startDate);
  const end = parseTrendDate(state.endDate);
  return points.filter((point) => {
    const timestamp = parseTrendDate(point.date);
    return Number.isFinite(timestamp) && (!Number.isFinite(start) || timestamp >= start) && (!Number.isFinite(end) || timestamp <= end);
  });
}

function renderSelectedTrend() {
  if (!state.selected) return;
  const points = selectedTrendPoints();
  updateChartSummary();
  drawChart(points, state.metric);
  renderTrendTable(points);
  updateRangeTrendSummary(points);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function renderTrendTable(points) {
  const rows = points.map(point => {
    const cells = {
      revenue: valueCell(point.revenue),
      downloads: valueCell(point.downloads),
      rank: hasValue(point.rank) ? `第 ${formatNumber(point.rank)} 名` : '<span class="missing-value">暂无数据</span>',
    };
    return `<tr><td>${escapeHTML(dateLabel(point.date))}</td>${["revenue", "downloads", "rank"].map(key =>
      `<td class="${state.metric === key ? "selected-value" : ""}">${cells[key]}</td>`
    ).join("")}</tr>`;
  }).join("");
  $("#trendDataRows").innerHTML = rows || '<tr><td class="empty-row" colspan="4">所选时间区间暂无观测数据</td></tr>';
  $("#trendDataCount").textContent = `${points.length} 条`;
  document.querySelectorAll("#trendDataTable th[data-column]").forEach(header => {
    header.classList.toggle("active-column", header.dataset.column === state.metric);
  });
}

function updateRangeTrendSummary(points) {
  const labels = { revenue: "收入", downloads: "下载", rank: "免费榜排名" };
  const valid = points.filter(point => hasValue(point[state.metric]));
  const range = state.startDate && state.endDate ? `${dateLabel(state.startDate)} 至 ${dateLabel(state.endDate)}` : "当前区间";
  let summary;
  if (!valid.length) {
    summary = `该时间区间没有可用的${labels[state.metric]}观测，暂不生成趋势结论。`;
  } else if (valid.length === 1) {
    summary = `该时间区间只有 1 个有效观测点，暂时无法判断${labels[state.metric]}趋势。`;
  } else if (state.metric === "rank") {
    const change = Number(valid[0].rank) - Number(valid.at(-1).rank);
    summary = change === 0 ? "免费榜排名在所选区间保持不变。" : `免费榜排名在所选区间${change > 0 ? "上升" : "下降"} ${Math.abs(change)} 位。`;
  } else {
    const first = Number(valid[0][state.metric]);
    const latest = Number(valid.at(-1)[state.metric]);
    if (first === 0) {
      summary = `${labels[state.metric]}基期为 0，不能计算可靠增长率。`;
    } else {
      const change = ((latest - first) / first) * 100;
      summary = `${labels[state.metric]}在所选区间${change >= 0 ? "增长" : "下降"} ${Math.abs(change).toFixed(1)}%。`;
    }
  }
  $("#trendSummary").textContent = summary;
  $("#trendEvidence").textContent = `证据：${labels[state.metric]} · ${range} · ${valid.length}/${points.length} 个有效观测点`;
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
  const styles = {
    revenue: { color: "#136f52", dash: [] },
    downloads: { color: "#ff7a45", dash: [2, 5] },
    rank: { color: "#7257d5", dash: [9, 5] },
  };
  const makePath = (key, style) => {
    const values = points.map(p => hasValue(p[key]) ? Number(p[key]) : null);
    const available = values.filter(value => value !== null);
    if (!available.length) return false;
    const min = Math.min(...available) * .9;
    const max = Math.max(...available) * 1.08;
    let drawing = false;
    ctx.beginPath();
    values.forEach((value, index) => {
      if (value === null) { drawing = false; return; }
      const x = values.length === 1 ? width / 2 : pad.x + index * ((width - pad.x * 2) / (values.length - 1));
      const progress = (value - min) / (max - min || 1);
      const y = key === "rank" ? pad.y + progress * (height - pad.y - pad.bottom) : height - pad.bottom - progress * (height - pad.y - pad.bottom);
      drawing ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      drawing = true;
    });
    ctx.strokeStyle = style.color; ctx.setLineDash(style.dash); ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
    ctx.setLineDash([]);
    values.forEach((value, index) => {
      if (value === null) return;
      const x = values.length === 1 ? width / 2 : pad.x + index * ((width - pad.x * 2) / (values.length - 1));
      const progress = (value - min) / (max - min || 1);
      const y = key === "rank" ? pad.y + progress * (height - pad.y - pad.bottom) : height - pad.bottom - progress * (height - pad.y - pad.bottom);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fillStyle = style.color; ctx.fill();
    });
    return true;
  };
  const hasLine = makePath(metric, styles[metric]);
  const empty = $("#chartEmptyState");
  empty.hidden = hasLine;
  empty.textContent = points.length ? `所选区间暂无${{ revenue: "收入", downloads: "下载", rank: "免费榜" }[metric]}数据` : "所选时间区间暂无观测数据";
  $("#chartAxis").innerHTML = points.length ? points.map(point => `<span>${dateLabel(point.date)}</span>`).join("") : `<span>${dateLabel(state.startDate)}</span><span>${dateLabel(state.endDate)}</span>`;
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
  applyPresetRange(button.dataset.range === "all" ? null : Number(button.dataset.range));
}));
$("#trendDateForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const start = $("#trendStartDate").value;
  const end = $("#trendEndDate").value;
  if (!start || !end || parseTrendDate(start) > parseTrendDate(end)) {
    $("#trendRangeStatus").textContent = "请选择有效的开始和结束日期";
    return;
  }
  state.startDate = start;
  state.endDate = end;
  state.rangeMode = "custom";
  document.querySelectorAll(".range-tabs button").forEach(item => {
    item.classList.remove("active");
    item.setAttribute("aria-pressed", "false");
  });
  $("#trendRangeStatus").textContent = "已应用自定义区间";
  renderSelectedTrend();
});
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
