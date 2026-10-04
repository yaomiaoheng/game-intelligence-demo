(() => {
  "use strict";
  const escape = (value) => String(value ?? "暂无数据").replace(/[&<>'"]/g, (char) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"})[char]);
  const list = (value) => Array.isArray(value) ? value : [];
  const sourceLink = (value) => {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? ` · <a href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">查看来源</a>` : "";
    } catch { return ""; }
  };
  let modePromise;
  async function dataMode() {
    if (!modePromise) modePromise = fetch("/api/health").then((response) => response.json()).then((data) => data.data_mode || "mock");
    return modePromise;
  }
  function selectedTypes(form, name) {
    return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
  }
  function render(output, result) {
    const subject = result.analysis_subject || {};
    const chartContext = subject.rank ? `<p>榜单上下文：${escape(subject.platform)}${subject.country ? ` · ${escape(subject.country)}` : ""} · ${escape(subject.board)}${subject.board_code ? `（${escape(subject.board_code)}）` : ""} · 第 ${escape(subject.rank)} 名 · ID ${escape(subject.external_id)} · ${escape(subject.source?.label)}${sourceLink(subject.source?.url)}。${subject.observed_at_kind === "fetch_time" ? "本系统抓取时间（不是平台官方榜单更新时间）" : "来源观察时间"}：${escape(subject.observed_at)}；平台更新时间：${escape(subject.source_updated_at)}；状态：${subject.stale ? "已过期/最后成功快照" : "近期抓取"}。榜单上下文不计入方向论证的独立证据来源。</p>` : "";
    output.innerHTML = `<div class="research-warning"><strong>研究版 · 不可直接提交投资人</strong><span>分析对象：${escape(subject.name)}。${escape(result.methodology)} 所有方向均未通过人工审查。</span>${chartContext}</div>` +
      list(result.briefs).map((brief) => `<article class="research-brief">
        <header><div><small>方向对比 · 无评分排序</small><h4>${escape(brief.game_type)} · ${escape(brief.market)} / ${escape(brief.platform)}</h4></div><span>仅建议验证</span></header>
        <p>${escape(brief.positioning_hypothesis)}</p>
        <dl><div><dt>可比游戏</dt><dd>${escape(brief.comparable_game_count)} 款</dd></div><div><dt>参与方向论证的独立证据来源</dt><dd>${escape(brief.source_count)} 个</dd></div><div><dt>团队 / 预算 / 周期</dt><dd>${escape(brief.constraints?.team_size)} 人 / ${escape(brief.constraints?.budget_cny)} 元 / ${escape(brief.constraints?.development_months)} 月</dd></div></dl>
        <section><h5>原始证据（非成功率）</h5><ul>${list(brief.evidence).map((item) => `<li>${escape(item.game_name)}：${escape(item.metric)} ${escape(item.value)}${escape(item.unit)}${item.estimated ? "（估算）" : ""} · ${escape(item.source_id)} · ${escape(item.observed_at)}${sourceLink(item.source_url)}</li>`).join("") || "<li>暂无同类可量化观测；不能据此推荐立项。</li>"}</ul></section>
        <section><h5>反证与限制</h5><ul>${list(brief.counterevidence_and_limits).map((item) => `<li>${escape(item.detail)}</li>`).join("") || "<li>未发现可量化反证；这不表示风险不存在。</li>"}</ul></section>
        <section><h5>缺失证据与核验动作</h5><ul>${list(brief.missing_evidence).map((item) => `<li>${escape(item.label)}：${escape(item.verification)}</li>`).join("")}</ul></section>
        <section><h5>可执行阶段与停止闸门</h5><ol>${list(brief.phases).map((item) => `<li><strong>${escape(item.phase)}</strong>：${escape(item.deliverable)}。门槛：${escape(item.gate)}</li>`).join("")}</ol></section>
        <p class="research-gate">${escape(brief.review_gate)}；团队可行性：${escape(brief.feasibility_note)}</p>
      </article>`).join("");
  }
  async function submit(payload) {
    const response = await fetch("/api/project-plans/generate", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload)});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || "项目方案生成失败");
    if (result.status !== "research_only" || result.investor_ready !== false) throw new Error("方案状态异常，已停止展示");
    return result;
  }
  async function initAssistant() {
    const workspace = document.querySelector("#assistantProjectWorkspace");
    if (!workspace || await dataMode() === "mock") return;
    workspace.hidden = false;
    const form = document.querySelector("#assistantProjectForm");
    const select = form.elements.selected_game_id;
    const status = document.querySelector("#assistantProjectStatus");
    try {
      const response = await fetch("/api/games?limit=100");
      const data = await response.json();
      const gamesById = new Map(list(data.items).filter((game) => game.id?.startsWith("evidence-"))
        .map((game) => [game.id, game]));
      const catalogResponse = await fetch("/api/development-decision/games");
      if (catalogResponse.ok) {
        for (const game of list((await catalogResponse.json()).items)) {
          if (game.id && !gamesById.has(game.id)) gamesById.set(game.id, {
            id: game.id, name: game.game_name,
            category: `${game.provider_label} · ${game.primary_board_label} #${game.rank}`,
          });
        }
      }
      const games = [...gamesById.values()];
      select.innerHTML = '<option value="">请选择已收录游戏</option>' + games.map((game) => `<option value="${escape(game.id)}">${escape(game.name)} · ${escape(game.category)}</option>`).join("");
      select.disabled = !games.length;
      if (!games.length) status.textContent = "暂无获准公开的真实游戏；不能生成项目方案。";
    } catch (error) {
      select.disabled = true;
      status.textContent = `真实游戏读取失败：${error.message}`;
    }
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const game_types = selectedTypes(form, "game_type");
      if (!game_types.length) { status.textContent = "请至少选择一种待比较游戏类型。"; return; }
      const data = new FormData(form);
      const payload = {selected_game_id: data.get("selected_game_id"), game_types, market: data.get("market"), platform: data.get("platform"),
        team_size: Number(data.get("team_size")), budget_cny: Number(data.get("budget_cny")), development_months: Number(data.get("development_months"))};
      status.textContent = "正在核对真实证据与缺口…";
      try {
        const result = await submit(payload);
        render(document.querySelector("#assistantProjectOutput"), result);
        status.textContent = `已生成 ${result.count} 个待验证方向；不是投资建议。`;
      } catch (error) { status.textContent = error.message; }
    });
  }
  window.ProjectPlanUI = {dataMode, selectedTypes, render, submit};
  initAssistant().catch(() => {});
})();
