(() => {
  const ROUTE = "mini-game-intelligence";
  const CUSTOM_ROUTES = ["mini-game-rankings", ROUTE];
  const view = document.getElementById(ROUTE);
  const content = document.querySelector(".content");
  const topbarTitle = document.querySelector(".topbar h1");
  const defaultTitle = "游戏商业机会雷达";
  const state = { snapshot: null, provider: "all", signal: "all", role: "all", limit: 12, product: null, focus: "combined" };
  let pollTimer = null;

  const typeLabels = { new: "新游 / 新进榜", rise: "排名走强", fall: "排名回落", leader: "头部对标" };
  const roleLabels = { development: "研发", publishing: "发行", operations: "运营" };
  const providerLabels = { all: "微信与抖音", douyin: "抖音", wechat: "微信" };
  const focusLabels = { combined: "综合决策", development: "研发立项", publishing: "发行买量", operations: "运营与用户" };

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);
  }

  function isStale(value, upstreamStale = false) {
    const timestamp = Date.parse(value || "");
    return Boolean(upstreamStale) || !Number.isFinite(timestamp) ||
      Date.now() - timestamp > 12 * 60 * 60 * 1000 || timestamp - Date.now() > 5 * 60 * 1000;
  }

  function selectedProduct() {
    const items = state.snapshot?.items || [];
    return items.find(item => item.id === state.product)
      || items.find(item => item.id === state.snapshot?.latest_featured_id)
      || items.find(item => item.as_of === state.snapshot?.latest)
      || null;
  }

  function renderLatest() {
    const items = state.snapshot?.items || [];
    const selected = selectedProduct();
    if (selected) state.product = selected.id;
    const productSelect = document.getElementById("miniIntelProduct");
    productSelect.disabled = !items.length;
    productSelect.innerHTML = items.length ? items.map(item => `<option value="${escapeHTML(item.id)}" ${item.id === selected?.id ? "selected" : ""}>${escapeHTML(item.game_name)} · ${item.provider === "douyin" ? "抖音" : "微信"}${item.stale ? ` · ${escapeHTML(item.as_of)}` : ""}</option>`).join("") : "<option>暂无可选产品</option>";
    const host = document.getElementById("miniLatestBody");
    if (!selected) {
      host.innerHTML = '<div class="mini-intel-empty">暂无可展开的真实小游戏情报。榜单成功更新后，将选取重点产品生成决策简报；不以演示内容补充。</div>';
      return;
    }
    const text = selected.briefs?.[state.focus] || "摘要尚未更新，请刷新结论。";
    const enrichment = selected.enrichment || {};
    const extraSources = enrichment.sources || [];
    host.innerHTML = `<div class="mini-latest-product"><h4>${escapeHTML(selected.game_name)}</h4><span class="mini-date-tag">${escapeHTML(selected.as_of)}${selected.stale ? " · 旧快照" : ""}</span><span class="mini-latest-length">${[...text].length} 字</span></div>
      <p class="mini-latest-summary">${escapeHTML(text)}</p>
      <div class="mini-latest-footer"><span>依据：${escapeHTML(selected.evidence)} · 榜单描述 + 待验证建议</span><details><summary>核验来源</summary><p>榜单事实：DataEye 官方 MCP · 小游戏榜单${selected.external_id ? ` · 产品 ID ${escapeHTML(selected.external_id)}` : ""}</p>${extraSources.length ? `<p>外部补充：${extraSources.map(escapeHTML).join("、")} · 更新 ${escapeHTML(enrichment.updated_at || "暂无")}</p>` : "<p>外部产品与运营资料尚未匹配，不作补写。</p>"}${selected.publisher ? `<p>研发 / 发行：${escapeHTML(selected.publisher)}</p>` : ""}${selected.source_description ? `<p>来源描述：${escapeHTML(selected.source_description)}</p>` : "<p>玩法、题材与画风信息未提供，不作事实推断。</p>"}${(selected.support || []).map(value => `<p>${escapeHTML(value)}</p>`).join("")}<p>${escapeHTML(selected.risk)}</p></details></div>`;
  }

  function card(item) {
    const roles = state.role === "all" ? ["development", "publishing", "operations"] : [state.role];
    return `<article class="mini-intel-card"><div class="mini-intel-card-top"><span class="mini-intel-kind ${item.type}">${escapeHTML(typeLabels[item.type] || item.type)}</span><small>${escapeHTML(item.as_of)}${item.stale ? " · 旧快照" : ""}</small></div>
      <h4>${escapeHTML(item.game_name)}</h4><p class="mini-intel-fact">${escapeHTML(item.evidence)}</p><p class="mini-intel-conclusion">${escapeHTML(item.conclusion)}</p>
      <div class="mini-intel-decisions">${roles.map(role => `<p><span>${roleLabels[role]}</span>${escapeHTML(item.actions?.[role] || "暂无建议")}</p>`).join("")}</div>
      <details class="mini-intel-evidence"><summary>来源与边界</summary><p>榜单事实：DataEye 官方 MCP · ${escapeHTML(item.as_of)}${item.external_id ? ` · 产品 ID ${escapeHTML(item.external_id)}` : ""}</p>${item.enrichment?.sources?.length ? `<p>产品与运营补充：${item.enrichment.sources.map(escapeHTML).join("、")}</p>` : "<p>产品与运营补充：暂无匹配证据</p>"}${(item.support || []).map(value => `<p>${escapeHTML(value)}</p>`).join("")}<p>${escapeHTML(item.risk)}</p></details></article>`;
  }

  function renderCards() {
    const allItems = state.snapshot?.items || [];
    const filtered = allItems.filter(item => state.signal === "all" || item.type === state.signal);
    const host = document.getElementById("miniIntelCards");
    host.innerHTML = filtered.length ? filtered.slice(0, state.limit).map(card).join("") : '<div class="mini-intel-empty">暂无符合条件的小游戏线索。仅分析小游戏榜单真实快照，不使用演示数据或 APP / PC 榜单。</div>';
    const more = document.getElementById("miniIntelMore");
    more.hidden = filtered.length <= state.limit;
    more.querySelector("button").textContent = `查看更多（剩余 ${Math.max(0, filtered.length - state.limit)} 条）`;
    document.querySelectorAll("[data-mini-signal]").forEach(button => button.classList.toggle("active", button.dataset.miniSignal === state.signal));
  }

  function renderSnapshot(snapshot) {
    const times = snapshot.connection?.provider_observed_at || {};
    const providerStale = Object.fromEntries(["douyin", "wechat"].map(provider => [provider,
      isStale(times[provider] || snapshot.connection?.fetched_at, snapshot.connection?.stale)]));
    snapshot.items = (snapshot.items || []).map(item => ({...item,
      stale: Boolean(item.stale) || providerStale[item.provider]}));
    snapshot.connection = {...snapshot.connection, stale: Object.values(providerStale).some(Boolean)};
    state.snapshot = snapshot;
    const counts = snapshot.counts || {};
    for (const type of ["new", "rise", "fall", "leader"]) {
      const label = document.getElementById(`miniIntel${type[0].toUpperCase()}${type.slice(1)}Count`);
      label.innerHTML = `${counts[type] || 0}<small> 条</small>`;
    }
    document.getElementById("miniIntelCoverage").textContent = `真实快照 · 来源日 ${snapshot.latest || "暂无"} · ${(snapshot.boards || []).length} 张榜单 / ${snapshot.records || 0} 条排名`;
    document.getElementById("miniIntelItemCount").textContent = `${(snapshot.items || []).length} 条线索`;
    const note = document.getElementById("miniIntelSourceNote");
    note.classList.toggle("stale", Boolean(snapshot.connection?.stale));
    note.textContent = `榜单名次只读已保存榜单，不触发付费取数；其他来源仅补充产品、厂商、版本、评价与运营证据，不将其改写为榜单、收入或下载量。${snapshot.connection.stale ? "上游超过 12 小时未提供新观测或状态异常，以下为最后成功的旧快照。" : ""}${(snapshot.boards || []).some(board => board.source_date !== snapshot.latest) ? "部分榜单为旧快照，日期分别标注。" : ""}${snapshot.invalid_records ? `有 ${snapshot.invalid_records} 条来源日期或字段不完整的记录未用于结论。` : ""}${snapshot.connection?.warning ? ` ${snapshot.connection.warning}` : ""}`;
    document.getElementById("miniIntelMethodText").textContent = snapshot.method || "只参考小游戏榜单真实快照。";
    document.getElementById("miniIntelBoardList").innerHTML = (snapshot.boards || []).map(board => `<li>${board.provider === "douyin" ? "抖音" : "微信"} · ${escapeHTML(board.label)} · ${escapeHTML(board.source_date)} · ${board.records} 条</li>`).join("");
    renderLatest();
    renderCards();
  }

  async function loadSnapshot() {
    const refresh = document.getElementById("miniIntelRefresh");
    refresh.disabled = true;
    try {
      const response = await fetch(`/api/mini-game-intelligence?provider=${encodeURIComponent(state.provider)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "小游戏情报暂不可用");
      renderSnapshot(payload);
    } catch (error) {
      document.getElementById("miniIntelSourceNote").classList.add("stale");
      document.getElementById("miniIntelSourceNote").textContent = `${error.message} 未使用演示数据替代。`;
      if (!state.snapshot) {
        document.getElementById("miniLatestBody").innerHTML = `<div class="mini-intel-empty">${escapeHTML(error.message)}</div>`;
        document.getElementById("miniIntelCards").innerHTML = `<div class="mini-intel-empty">${escapeHTML(error.message)}<br>请先确认小游戏榜单可读取。</div>`;
      }
    } finally {
      refresh.disabled = false;
    }
  }

  function buildReport() {
    const snapshot = state.snapshot;
    const selected = selectedProduct();
    const header = `# 小游戏决策摘要\n\n榜单事实来源：DataEye 官方 MCP 已保存快照；产品与运营信息可由其他已采集来源补充。\n来源最新日期：${snapshot?.latest || "暂无"}；平台：${providerLabels[state.provider]}。\n\n`;
    const latest = selected ? `## 最新情报 · ${selected.game_name}\n解读方向：${focusLabels[state.focus]}\n\n${selected.briefs?.[state.focus] || "摘要待更新"}\n\n` : "";
    const items = (snapshot?.items || []).map((item, index) => `## ${index + 1}. ${item.game_name}\n- 依据：${item.as_of} · ${item.evidence}\n- 结论：${item.conclusion}\n- 研发：${item.actions.development}\n- 发行：${item.actions.publishing}\n- 运营：${item.actions.operations}`).join("\n\n") || "暂无满足条件的真实小游戏榜单线索。";
    return `${header}${latest}${items}\n\n口径：${snapshot?.method || "无榜单数据"}\n建议仅供决策验证，不证明收入、利润、留存或增长原因。\n`;
  }

  function exportReport() {
    if (!state.snapshot) return;
    const blob = new Blob([buildReport()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `GamePulse-mini-intelligence-${state.snapshot.latest || "latest"}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function syncRoute() {
    const route = location.hash.slice(1);
    const active = route === ROUTE;
    const customRoute = CUSTOM_ROUTES.includes(route);
    view.hidden = !active;
    content.hidden = customRoute;
    document.body.classList.toggle("mini-intelligence-mode", active);
    if (topbarTitle && active) topbarTitle.textContent = "小游戏情报";
    else if (topbarTitle && !customRoute) topbarTitle.textContent = defaultTitle;
    document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.getAttribute("href") === location.hash || (!location.hash && item.getAttribute("href") === "#overview")));
    clearInterval(pollTimer);
    pollTimer = null;
    if (active) {
      loadSnapshot();
      pollTimer = setInterval(() => { if (!document.hidden) loadSnapshot(); }, 5000);
      window.scrollTo(0, 0);
    }
  }

  document.querySelectorAll("[data-mini-provider]").forEach(button => button.addEventListener("click", () => {
    state.provider = button.dataset.miniProvider;
    state.signal = "all";
    state.limit = 12;
    state.product = null;
    document.querySelectorAll("[data-mini-provider]").forEach(item => item.classList.toggle("active", item === button));
    loadSnapshot();
  }));
  document.querySelectorAll("[data-mini-signal]").forEach(button => button.addEventListener("click", () => {
    state.signal = button.dataset.miniSignal;
    state.limit = 12;
    renderCards();
  }));
  document.getElementById("miniIntelRole").addEventListener("change", event => { state.role = event.target.value; renderCards(); });
  document.getElementById("miniIntelProduct").addEventListener("change", event => { state.product = event.target.value; renderLatest(); });
  document.getElementById("miniIntelFocus").addEventListener("change", event => { state.focus = event.target.value; renderLatest(); });
  document.getElementById("miniIntelMore").querySelector("button").addEventListener("click", () => { state.limit += 12; renderCards(); });
  document.getElementById("miniIntelRefresh").addEventListener("click", loadSnapshot);
  document.getElementById("miniIntelExport").addEventListener("click", exportReport);
  window.addEventListener("hashchange", syncRoute);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && location.hash.slice(1) === ROUTE) loadSnapshot(); });
  syncRoute();
})();
