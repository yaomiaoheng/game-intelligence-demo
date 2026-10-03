(() => {
  "use strict";

  const host = document.getElementById("sourceRegistryGrid");
  if (!host) return;

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
  const labels = {
    official_public: "官方公开", commercial_estimate: "商业估算", editorial_manual: "人工研究", mock: "演示数据",
    api: "API", authorized_browser: "授权浏览器", csv: "文件导入", manual: "人工维护", fixture: "固定样例",
  };

  function sourceCard(item) {
    const scopes = (item.data_scope || []).slice(0, 6).map((scope) => `<span>${escapeHTML(scope)}</span>`).join("");
    const link = item.terms_url
      ? `<a href="${escapeHTML(item.terms_url)}" target="_blank" rel="noreferrer">访问来源网站 <span>↗</span></a>`
      : '<span class="source-no-link">内部或文件型来源 <span>—</span></span>';
    const collection = item.collection || {};
    const live = Number(collection.records || 0) > 0;
    return `<article class="source-registry-card">
      <header><h3>${escapeHTML(item.source_name || item.source_id)}</h3><span>${live ? `已采集 ${escapeHTML(collection.records)} 条` : "尚无快照"}</span></header>
      <p>${item.official ? "官方来源" : "非官方直接来源"} · ${item.estimated ? "包含估算字段" : "不以估算替代事实"} · 质量等级 ${escapeHTML(item.quality_grade || "—")}</p>
      <div class="source-scope">${scopes || "<span>范围待补充</span>"}</div>
      <dl><div><dt>平台</dt><dd>${escapeHTML(item.platform || "—")}</dd></div><div><dt>获取方式</dt><dd>${escapeHTML(labels[item.access_method] || item.access_method || "—")}</dd></div><div><dt>采集状态</dt><dd>${escapeHTML(collection.status || "not_collected")}</dd></div><div><dt>最近更新</dt><dd>${escapeHTML(collection.updated_at || "暂无")}</dd></div></dl>
      ${link}
    </article>`;
  }

  fetch("/api/data-sources/registry", { cache: "no-store" })
    .then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "数据来源台账读取失败");
      return data;
    })
    .then((data) => {
      const items = Array.isArray(data.items) ? data.items : [];
      const summary = data.summary || {};
      document.getElementById("sourceRegistryCount").textContent = `已登记 ${items.length} 个来源 · ${summary.source_count || 0} 个有可用快照 · ${summary.profile_count || 0} 个游戏档案`;
      host.innerHTML = items.length ? items.map(sourceCard).join("") : '<div class="workspace-empty">当前暂无已登记的数据来源。</div>';
    })
    .catch((error) => {
      document.getElementById("sourceRegistryCount").textContent = "来源台账暂不可用";
      host.innerHTML = `<div class="workspace-empty">${escapeHTML(error.message)}</div>`;
    });
})();
