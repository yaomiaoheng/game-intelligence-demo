(() => {
  "use strict";

  const host = document.getElementById("sourceRegistryGrid");
  if (!host) return;

  const MAX_FRESH_AGE_MS = 12 * 60 * 60 * 1000;
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
  const labels = {
    api: "API", authorized_browser: "授权浏览器", csv: "文件导入", manual: "人工维护",
    fixture: "固定样例", rss: "RSS", published_snapshot: "已发布只读快照", not_connected: "未接入",
  };

  function isStale(observedAt, upstreamStale = false) {
    const time = Date.parse(observedAt || "");
    return Boolean(upstreamStale) || !Number.isFinite(time) ||
      Date.now() - time > MAX_FRESH_AGE_MS || time - Date.now() > 5 * 60 * 1000;
  }

  function latestTime(values) {
    return values.filter((value) => Number.isFinite(Date.parse(value || "")))
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null;
  }

  function formatTime(value) {
    if (!value) return "暂无";
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(new Date(value)) + "（北京时间）";
  }

  function appleStatus(snapshot) {
    const charts = Array.isArray(snapshot?.charts) ? snapshot.charts : [];
    const records = charts.reduce((count, chart) => count + (Array.isArray(chart.items) ? chart.items.length : 0), 0);
    const staleCharts = charts.filter((chart) => isStale(chart.observed_at, chart.stale || chart.status !== "live")).length;
    return {
      records,
      label: !records ? "快照无有效榜单" : staleCharts === charts.length ? "旧快照" : staleCharts ? "部分榜单为旧快照" : "已发布快照",
      coverage: `${charts.length} 张榜单 / ${records} 条实际名次${staleCharts ? ` · ${staleCharts} 张旧榜` : ""}`,
      timeLabel: "最近本系统抓取",
      observedAt: latestTime(charts.map((chart) => chart.observed_at)),
      note: "Apple 官方榜单更新时间未知；单次名次不能推断收入、下载或增长。",
    };
  }

  function miniStatus(snapshot) {
    const providers = ["douyin", "wechat"].map((name) => ({name, data: snapshot?.providers?.[name] || {}}));
    const counts = providers.map(({name, data}) => ({name, rows: Array.isArray(data.rows) ? data.rows : []}));
    const records = counts.reduce((sum, item) => sum + item.rows.length, 0);
    const boards = new Set(counts.flatMap(({name, rows}) => rows.map((row) => `${name}:${row.rank_type}`)));
    const staleProviders = providers.filter(({name, data}) => isStale(data.observed_at,
      snapshot?.connection?.stale || snapshot?.connection?.provider_stale?.[name] || data.upstream_stale)).length;
    return {
      records,
      label: !records ? "快照无有效榜单" : staleProviders === providers.length ? "旧快照" : staleProviders ? "部分平台为旧快照" : "已发布快照",
      coverage: `${boards.size} 张榜单 / ${records} 条实际名次（抖音 ${counts[0].rows.length}，微信 ${counts[1].rows.length}）`,
      timeLabel: "最近来源观察",
      observedAt: latestTime(providers.map(({data}) => data.observed_at)),
      note: "已保存的 DataEye 榜单快照，不是实时采集；来源日期以榜单页面标注为准。",
    };
  }

  function unavailableStatus(error) {
    return {records: 0, label: "快照读取失败", coverage: "无法确认公开快照条数",
      timeLabel: "最近观察", observedAt: null, note: `读取失败：${error.message}`};
  }

  function sourceCard(item, status) {
    const current = status || {
      label: item.source_id === "mock-product-lab" ? "演示来源（未启用）" : "未接入公开站",
      coverage: "没有已发布的真实快照", timeLabel: "最近观察", observedAt: null,
      note: item.rights_note || "来源登记不代表已经接入或采集。",
    };
    const scopes = (item.data_scope || []).slice(0, 6).map((scope) => `<span>${escapeHTML(scope)}</span>`).join("");
    const link = item.terms_url
      ? `<a href="${escapeHTML(item.terms_url)}" target="_blank" rel="noopener noreferrer">访问来源网站 <span>↗</span></a>`
      : '<span class="source-no-link">暂无公开来源链接 <span>—</span></span>';
    return `<article class="source-registry-card">
      <header><h3>${escapeHTML(item.source_name || item.source_id)}</h3><span>${escapeHTML(current.label)}</span></header>
      <p>${escapeHTML(current.coverage)}。${escapeHTML(current.note)}</p>
      <div class="source-scope">${scopes || "<span>公开数据范围暂无</span>"}</div>
      <dl><div><dt>平台</dt><dd>${escapeHTML(item.platform || "—")}</dd></div>
      <div><dt>获取方式</dt><dd>${escapeHTML(labels[item.access_method] || item.access_method || "—")}</dd></div>
      <div><dt>公开站状态</dt><dd>${escapeHTML(current.label)}</dd></div>
      <div><dt>${escapeHTML(current.timeLabel)}</dt><dd>${escapeHTML(formatTime(current.observedAt))}</dd></div></dl>
      ${link}
    </article>`;
  }

  async function readJSON(url) {
    const response = await fetch(url, {cache: "no-store"});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  Promise.all([
    readJSON("/api/data-sources/registry"),
    readJSON(new URL("./apple-game-charts.json", window.location.href)).then(appleStatus).catch(unavailableStatus),
    readJSON(new URL("./mini-ranking-snapshot.json", window.location.href)).then(miniStatus).catch(unavailableStatus),
  ]).then(([registry, apple, mini]) => {
    const items = Array.isArray(registry.items) ? registry.items : [];
    const statuses = {"apple-games-rss": apple, "dataeye-mini-rankings": mini};
    const published = [apple, mini].filter((status) => status.records > 0).length;
    const unconnected = items.filter((item) => !(item.source_id in statuses)).length;
    document.getElementById("sourceRegistryCount").textContent =
      `已登记 ${items.length} 个来源 · ${published} 个有公开快照（旧快照单独标注） · ${unconnected} 个未接入或未启用`;
    host.innerHTML = items.length ? items.map((item) => sourceCard(item, statuses[item.source_id])).join("")
      : '<div class="workspace-empty">当前暂无已登记的数据来源。</div>';
  }).catch((error) => {
    document.getElementById("sourceRegistryCount").textContent = "来源台账暂不可用";
    host.innerHTML = `<div class="workspace-empty">${escapeHTML(error.message)}</div>`;
  });
})();
