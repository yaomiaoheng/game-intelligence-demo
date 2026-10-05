(() => {
  const ROUTE = "mini-game-rankings";
  const view = document.getElementById(ROUTE);
  const content = document.querySelector(".content");
  const topbarTitle = document.querySelector(".topbar h1");
  const refreshButton = document.getElementById("miniRefresh");
  const titleDefault = topbarTitle?.textContent || "游戏商业机会雷达";
  let pollTimer = null;
  let loaded = false;

  const boardNames = {
    popularityList: "人气榜",
    bestsellerList: "畅销榜",
    freshGameList: "新游榜",
    mostPlayedList: "畅玩榜",
  };
  const boardOrder = {
    douyin: ["bestsellerList", "freshGameList", "popularityList"],
    wechat: ["bestsellerList", "mostPlayedList", "popularityList"],
  };

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);
  }

  function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value || "暂无";
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).format(date);
  }

  function expectedSourceDay() {
    const china = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const afterCollection = china.getUTCHours() > 10 || (china.getUTCHours() === 10 && china.getUTCMinutes() >= 10);
    return new Date(china.getTime() - (afterCollection ? 0 : 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
  }

  function isStale(value, sourceDate, upstreamStale = false) {
    const timestamp = Date.parse(value || "");
    return Boolean(upstreamStale) || !Number.isFinite(timestamp) ||
      !sourceDate || sourceDate < expectedSourceDay() || timestamp - Date.now() > 5 * 60 * 1000;
  }

  function rankChange(row) {
    if (row.new_entry) return '<span class="mini-new-tag">新进榜</span>';
    if (row.rank_change === null || row.rank_change === undefined) return "—";
    const change = Number(row.rank_change);
    if (change === 0) return "持平";
    return `<span class="mini-change ${change > 0 ? "up" : "down"}">${change > 0 ? "↑" : "↓"} ${Math.abs(change)}</span>`;
  }

  function renderBoard(type, rows) {
    const sourceDate = rows[0]?.source_date || "历史未标注";
    return `<section class="mini-rank-group">
      <h4 class="mini-rank-title">${escapeHTML(boardNames[type] || type)} <span class="mini-date-tag">观测日 ${escapeHTML(sourceDate)}</span><span class="mini-count-tag">当前 ${rows.length} 条</span></h4>
      <div class="mini-table-wrap"><table class="mini-table"><thead><tr><th>排名</th><th>游戏 / App ID</th><th>发行商</th><th>来源排名变化</th></tr></thead><tbody>
        ${rows.map(row => `<tr>
          <td data-label="排名"><span class="mini-rank-badge">${escapeHTML(row.rank ?? "—")}</span></td>
          <td data-label="游戏 / App ID"><span class="mini-game-cell"><strong>${escapeHTML(row.game_name || "名称未提供")}</strong><small>${escapeHTML(row.external_id || "App ID 未提供")}</small>${row.description ? `<small title="${escapeHTML(row.description)}">${escapeHTML(row.description)}</small>` : ""}${row.supplement?.status === "available" ? `<small>商店补充（字段待核实）：${escapeHTML([row.supplement.category, row.supplement.version && `版本 ${row.supplement.version}`].filter(Boolean).join(" · ") || "暂无其他字段")}${row.supplement.store_url ? ` · <a href="${escapeHTML(row.supplement.store_url)}" target="_blank" rel="noopener noreferrer">来源</a>` : ""}</small>` : ""}</span></td>
          <td data-label="发行商">${escapeHTML(row.publisher || (row.supplement?.status === "available" ? `${row.supplement.publisher || "暂无"}（商店待核实）` : "暂无"))}</td>
          <td data-label="排名变化">${rankChange(row)}</td>
        </tr>`).join("")}
      </tbody></table></div>
      <p class="mini-time">最近成功采集：${escapeHTML(formatTime(rows[0]?.observed_at))}</p>
    </section>`;
  }

  function renderProvider(provider, payload, configuredBoards = [], stale = false) {
    const card = document.querySelector(`[data-provider="${provider}"]`);
    if (!card) return;
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    const subtitle = card.querySelector(".mini-source-head p");
    subtitle.textContent = `DataEye ADX 官方 · 已选 ${configuredBoards.length || new Set(rows.map(row => row.rank_type)).size} 张日榜${stale ? " · 旧快照" : ""}`;
    const body = card.querySelector(".mini-source-body");
    if (!rows.length) {
      body.innerHTML = '<div class="mini-empty"><span>◎</span><strong>暂无真实榜单快照</strong><small>不会使用演示排名代替。</small></div>';
      return;
    }
    const groups = rows.reduce((result, row) => {
      (result[row.rank_type] ||= []).push(row);
      return result;
    }, {});
    const types = [...(boardOrder[provider] || []), ...Object.keys(groups).filter(type => !boardOrder[provider]?.includes(type))];
    body.innerHTML = types.filter(type => groups[type]?.length).map(type => renderBoard(type, groups[type])).join("");
  }

  function renderRuns(runs) {
    const host = document.getElementById("miniRunLog");
    if (!Array.isArray(runs) || !runs.length) {
      host.innerHTML = '<div class="mini-empty"><span>◎</span><strong>暂无官方调用日志</strong></div>';
      return;
    }
    host.innerHTML = `<div class="mini-table-wrap"><table class="mini-table mini-sync-table"><thead><tr><th>平台 / 榜单</th><th>观测日</th><th>状态</th><th>请求时间</th><th>数量</th><th>积分回执 / 错误</th></tr></thead><tbody>${runs.map(run => `<tr>
      <td>${run.provider === "douyin" ? "抖音" : "微信"} / ${escapeHTML(run.ranking_type || "—")}</td>
      <td>${escapeHTML(run.period || "—")}</td>
      <td><span class="mini-state-tag ${run.status === "success" ? "success" : run.status === "failed" ? "failed" : ""}">${escapeHTML(run.status || "未知")}</span></td>
      <td>${escapeHTML(formatTime(run.started_at))}</td><td>${escapeHTML(run.record_count ?? "—")}</td><td>${escapeHTML(run.error || run.billing || "—")}</td>
    </tr>`).join("")}</tbody></table></div>`;
  }

  function renderSnapshot(data) {
    const status = data.status || {};
    const connection = data.connection || {};
    const config = status.config || {};
    const providerStale = Object.fromEntries(["douyin", "wechat"].map(provider => [provider,
      isStale(data.providers?.[provider]?.observed_at, data.providers?.[provider]?.source_date,
        connection.provider_stale?.[provider] ?? connection.stale)]));
    const stale = Object.values(providerStale).some(Boolean);
    const banner = document.getElementById("miniStatusBanner");
    banner.classList.toggle("stale", stale);
    banner.classList.remove("error");
    document.getElementById("miniConnectionTitle").textContent = stale
      ? `真实榜单包含旧快照（${Object.entries(providerStale).filter(([, value]) => value).map(([provider]) => provider === "douyin" ? "抖音" : "微信").join("、")}）· 展示最后成功结果`
      : connection.state === "published_snapshot"
        ? "真实榜单已发布快照 · 非实时采集"
        : status.configured
        ? `官方 MCP 已连接 · 自动更新${config.enabled ? "已开启" : "已关闭"}`
        : "源站真实快照可读 · 官方 MCP 尚未配置";
    document.getElementById("miniConnectionCopy").innerHTML = `${escapeHTML(status.update_time || "由源站维护采集周期")}<br>每天北京时间 10:10 读取一次源站已保存榜单；页面只重读当日发布快照，手动刷新不会重新采集。${connection.warning ? `<br>${escapeHTML(connection.warning)}` : ""}`;
    const calls = status.calls_today ?? "—";
    const limit = config.daily_call_limit ?? "—";
    const maxRows = data.display?.max_rows_per_board || 100;
    document.getElementById("miniScopeNote").textContent = `本页只展示 DataEye 真实数据。当前请求观测日：${status.period || "—"} · 今日已请求 ${calls}/${limit} 次。每榜按来源实际返回展示，最多 ${maxRows} 条，不足时不补齐；来源未提供收入、下载、素材数时不补造。`;
    for (const provider of ["douyin", "wechat"]) renderProvider(provider, data.providers?.[provider], config.boards?.[provider] || [], providerStale[provider]);
    renderRuns(status.last_runs);
    loaded = true;
  }

  async function loadSnapshot(force = false) {
    if (refreshButton) {
      refreshButton.disabled = true;
      refreshButton.lastChild.textContent = "读取中…";
    }
    try {
      const response = await fetch(`/api/mini-game-rankings${force ? "?refresh=1" : ""}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "真实榜单暂不可用");
      renderSnapshot(data);
    } catch (error) {
      const banner = document.getElementById("miniStatusBanner");
      banner.classList.add("error");
      document.getElementById("miniConnectionTitle").textContent = "真实榜单暂时无法读取";
      document.getElementById("miniConnectionCopy").textContent = error.message;
      if (!loaded) document.querySelectorAll(".mini-source-body").forEach(body => { body.innerHTML = `<div class="mini-source-error">${escapeHTML(error.message)}<br>未使用 Mock 数据替代。</div>`; });
    } finally {
      if (refreshButton) {
        refreshButton.disabled = false;
        refreshButton.lastChild.textContent = "刷新本地结果";
      }
    }
  }

  function isMiniRoute() { return location.hash.slice(1) === ROUTE; }

  function syncRoute() {
    const route = location.hash.slice(1);
    const mini = isMiniRoute();
    const customRoute = [ROUTE, "mini-game-intelligence"].includes(route);
    view.hidden = !mini;
    content.hidden = customRoute;
    document.body.classList.toggle("mini-ranking-mode", mini);
    if (topbarTitle && mini) topbarTitle.textContent = "小游戏真实榜单";
    else if (topbarTitle && !customRoute) topbarTitle.textContent = titleDefault;
    document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.getAttribute("href") === location.hash || (!location.hash && item.getAttribute("href") === "#overview")));
    document.querySelector(".sidebar")?.classList.remove("open");
    clearInterval(pollTimer);
    pollTimer = null;
    if (mini) {
      loadSnapshot(!loaded);
      pollTimer = setInterval(() => { if (!document.hidden) loadSnapshot(false); }, 60000);
      window.scrollTo(0, 0);
    } else if (location.hash) {
      requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
    }
  }

  refreshButton?.addEventListener("click", () => loadSnapshot(true));
  window.addEventListener("hashchange", syncRoute);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && isMiniRoute()) loadSnapshot(false); });
  syncRoute();
})();
