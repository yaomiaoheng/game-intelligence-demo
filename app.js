// The public static experience has no permission to redistribute collector records.
// Real data remains in the authenticated cloud API until publication rights are verified.
const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

const publicWorker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") return json({ ok: true, service: "game-intel-public", data_mode: "real" });
    if (url.pathname === "/api/overview") return json({
      games: 0, revenue: null, downloads: null, avgGrowth: null, leader: null,
      updatedAt: null, collectionStatus: "not_public", stale: true,
      notice: "暂无获准公开展示的真实游戏数据；缺失值不补零，不使用演示数据。",
    });
    if (url.pathname === "/api/games") return json({ items: [] });
    if (url.pathname === "/api/opportunities/analyze" && request.method === "POST") return json({
      recommendations: [], sources: [], updated_at: null, status: "insufficient_evidence",
      methodology: { version: "real-evidence-gate-v1", weights: {}, limitations: ["暂无足够已授权、可公开的真实证据。"], missing_value_policy: "缺失不补零、不参与评分", recommendation_language: "证据不足，建议继续采集" },
    });
    if (url.pathname === "/api/query" && request.method === "POST") return json({ answer: "暂无获准公开展示的真实游戏数据；当前不使用演示回答。" });
    if (url.pathname.startsWith("/api/games/") || url.pathname === "/api/intelligence") return json({ error: { code: "REAL_DATA_NOT_PUBLIC", message: "暂无获准公开展示的真实数据" } }, 404);
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
    if (new URL(request.url).pathname === '/api/mini-game-rankings') {
      const snapshotUrl = new URL('./mini-ranking-snapshot.json', window.location.href);
      snapshotUrl.searchParams.set('_', String(Date.now()));
      return nativeFetch(new Request(snapshotUrl, { cache: 'no-store' }));
    }
    return publicWorker.fetch(request, {});
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
  $("#updatedAt").textContent = data.updatedAt ? `最后成功 ${formatDateTime(data.updatedAt)}${data.stale ? " · 采集状态待恢复" : ""}` : "暂无成功采集";
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
    </tr>`).join("") || `<tr><td colspan="6">暂无符合条件的真实游戏数据</td></tr>`;
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
  const hasScoreEvidence = hasValue(game.growth) && hasValue(game.rating);
  const score = hasScoreEvidence ? Math.max(55, Math.min(96, Math.round(70 + game.growth / 3 + (game.rating - 4) * 8))) : null;
  $("#scoreValue").textContent = score ?? "/";
  $(".score-ring").style.background = score === null ? "#e7ece9" : `conic-gradient(var(--green) 0 ${score}%, #e7ece9 ${score}%)`;
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
