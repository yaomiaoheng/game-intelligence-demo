(() => {
  "use strict";

  const form = document.querySelector("#developmentDecisionForm");
  if (!form) return;

  const decisionState = { result: null, selectedIndex: 0, evidenceType: "supporting", games: [], selectedGame: null };
  const byId = (id) => document.getElementById(id);
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
  const present = (value) => value !== null && value !== undefined && value !== "";
  const text = (value, fallback = "暂无数据") => present(value) ? escapeHTML(value) : fallback;
  const list = (value) => Array.isArray(value) ? value : [];
  const number = (value, digits = 1) => present(value) && Number.isFinite(Number(value))
    ? Number(value).toFixed(digits).replace(/\.0$/, "") : "暂无数据";
  const percent = (value) => present(value) ? `${number(Number(value) * 100, 0)}%` : "暂无数据";
  const money = (value) => present(value) ? `${new Intl.NumberFormat("zh-CN").format(Number(value))} 元` : "暂无数据";
  const dateTime = (value) => {
    if (!value) return "暂无数据";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? text(value) : new Intl.DateTimeFormat("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(date);
  };

  function checkedValues(name) {
    return [...form.querySelectorAll(`[name="${name}"]:checked`)].map((input) => input.value);
  }

  function optionalNumber(formData, key) {
    const value = formData.get(key);
    return value === "" || value === null ? null : Number(value);
  }

  function requestPayload() {
    const data = new FormData(form);
    const monetization = data.get("monetization");
    return {
      selected_game_id: data.get("selected_game_id"),
      market: data.get("market"),
      platform: data.get("platform"),
      limit: 3,
      team_profile: {
        team_size: optionalNumber(data, "team_size"),
        budget_cny: optionalNumber(data, "budget_cny"),
        development_months: optionalNumber(data, "development_months"),
        capabilities: checkedValues("capabilities"),
        limitations: String(data.get("limitations") || "").split(/[，,]/).map((item) => item.trim()).filter(Boolean),
        art_capacity: data.get("art_capacity") || null,
        online_service_capacity: data.get("online_service_capacity") || null,
        monetization_preferences: monetization ? [monetization] : [],
        risk_preference: data.get("risk_preference") || null,
      },
      preferences: {},
    };
  }

  function rankMovement(game) {
    if (game.new_entry) return "新进榜";
    if (!present(game.rank_change) || Number(game.rank_change) === 0) return "持平";
    return `${Number(game.rank_change) > 0 ? "上升" : "下降"} ${Math.abs(Number(game.rank_change))} 位`;
  }

  function renderSelectedGame() {
    const selector = byId("developmentDecisionGame");
    const context = byId("developmentDecisionGameContext");
    decisionState.selectedGame = decisionState.games.find((item) => item.id === selector.value) || null;
    const game = decisionState.selectedGame;
    context.classList.remove("error");
    if (!game) {
      context.innerHTML = "<strong>请先选择一个小游戏</strong><span>未选择时不会生成针对具体产品的分析结论。</span>";
      return;
    }
    form.elements.platform.value = "Mobile";
    context.innerHTML = `<strong>${text(game.game_name)} · ${text(game.provider_label)}</strong><dl>
      <div><dt>榜单与名次</dt><dd>${text(game.primary_board_label)} · 第 ${text(game.rank)} 名</dd></div>
      <div><dt>排名变化</dt><dd>${text(rankMovement(game))}</dd></div>
      <div><dt>观察日期</dt><dd>${text(game.as_of)}</dd></div>
      <div><dt>数据来源</dt><dd>${text(game.source?.label)}</dd></div>
    </dl><span>该榜单事实仅作为观察上下文，不直接参与开发方向评分。</span>`;
  }

  function catalogFromIntelligence(result) {
    const providerLabels = { douyin: "抖音小游戏", wechat: "微信小游戏" };
    const boardLabels = { bestsellerList: "畅销榜", popularityList: "人气榜", freshGameList: "新游榜", mostPlayedList: "畅玩榜" };
    return list(result.items).map((item) => ({
      ...item,
      provider_label: providerLabels[item.provider] || item.provider,
      primary_board: item.board,
      primary_board_label: boardLabels[item.board] || item.board,
      source: { id: "dataeye-mini-rankings", label: list(item.sources)[0] || "DataEye 官方 MCP · 小游戏榜单" },
      estimated: false,
    }));
  }

  async function loadMiniGames() {
    const selector = byId("developmentDecisionGame");
    const context = byId("developmentDecisionGameContext");
    try {
      let response = await fetch("/api/development-decision/mini-games");
      let result = await response.json();
      if (response.ok) decisionState.games = list(result.items);
      else {
        response = await fetch("/api/mini-game-intelligence?provider=all");
        result = await response.json();
        if (!response.ok) throw new Error(result.error?.message || result.error || "小游戏榜单读取失败");
        decisionState.games = catalogFromIntelligence(result);
      }
      selector.innerHTML = '<option value="">请选择要分析的小游戏</option>' + decisionState.games.map((game) =>
        `<option value="${escapeHTML(game.id)}">${text(game.game_name)} · ${text(game.provider_label)} · ${text(game.primary_board_label)} #${text(game.rank)}</option>`
      ).join("");
      selector.disabled = !decisionState.games.length;
      if (!decisionState.games.length) {
        context.classList.add("error");
        context.innerHTML = "<strong>暂无可选真实小游戏</strong><span>当前榜单快照没有可用产品，恢复数据后再进行具体产品分析。</span>";
      }
    } catch (error) {
      selector.innerHTML = '<option value="">真实小游戏榜单暂不可用</option>';
      selector.disabled = true;
      context.classList.add("error");
      context.innerHTML = `<strong>小游戏选择器加载失败</strong><span>${text(error.message)}；未使用 Mock 产品代替。</span>`;
    }
  }

  function recommendationLevel(score) {
    if (!present(score)) return "证据不足，建议先补充数据";
    if (score >= 80) return "优先进入概念验证";
    if (score >= 65) return "值得小规模验证";
    if (score >= 50) return "证据不足，建议先补充数据";
    return "当前不建议投入";
  }

  function scoreClass(score) {
    if (!present(score)) return "unknown";
    if (score >= 80) return "priority";
    if (score >= 65) return "validate";
    if (score >= 50) return "insufficient";
    return "avoid";
  }

  function selectedRecommendation() {
    return decisionState.result?.recommendations?.[decisionState.selectedIndex] || null;
  }

  function renderRecommendationTabs() {
    const recommendations = list(decisionState.result?.recommendations);
    byId("recommendationTabs").innerHTML = recommendations.map((item, index) => `
      <button type="button" role="tab" aria-selected="${index === decisionState.selectedIndex}" class="${index === decisionState.selectedIndex ? "active" : ""}" data-recommendation-index="${index}">
        <b>${String(index + 1).padStart(2, "0")}</b><span>${text(item.title)}</span><strong>${number(item.score?.confidence_adjusted)}</strong>
      </button>`).join("");
  }

  function renderSelectedRecommendation() {
    const recommendation = selectedRecommendation();
    if (!recommendation) return;
    const score = recommendation.score || {};
    const concept = recommendation.concept || {};
    const tags = list(recommendation.tags);
    const level = recommendationLevel(score.opportunity);
    const feasibility = recommendation.feasibility_status === "not_assessed"
      ? "团队资料不完整：仅评价市场方向，不输出确定的项目可行性结论"
      : `团队适配结论：${({ supported: "适配", conditional: "有条件适配", not_recommended: "当前不适配" })[recommendation.feasibility_status] || "待验证"}`;

    byId("selectedRecommendation").innerHTML = `
      ${recommendation.selected_game_context ? `<p class="selected-game-reference">分析对象：${text(recommendation.selected_game_context.game_name)} · ${text(recommendation.selected_game_context.provider_label)} · ${text(recommendation.selected_game_context.primary_board_label)} #${text(recommendation.selected_game_context.rank)}</p>` : ""}
      <div class="recommendation-overview">
        <div><span class="recommendation-genre">${text(recommendation.genre)}</span><h4>${text(recommendation.title)}</h4><p>${text(concept.positioning)}</p></div>
        <span class="recommendation-level ${scoreClass(score.opportunity)}">${level}</span>
      </div>
      <div class="recommendation-tags">${tags.map((tag) => `<span>${text(tag)}</span>`).join("") || "<span>暂无标签</span>"}</div>
      <div class="score-summary">
        <div><small>原始机会分</small><strong>${number(score.opportunity)}</strong><span>/ 100</span></div>
        <div><small>数据置信度</small><strong>${number(score.confidence, 2)}</strong><span>${percent(score.confidence)}</span></div>
        <div class="trusted-score"><small>开发方向可信机会分</small><strong>${number(score.confidence_adjusted)}</strong><span>非成功概率</span></div>
      </div>
      <p class="feasibility-note">${feasibility}</p>`;

    const scores = Object.values(score.breakdown || {});
    byId("decisionScoreGrid").innerHTML = scores.map((item) => {
      const available = item.status === "available" && present(item.value);
      return `<div class="score-factor ${available ? "" : "missing"}"><div><span>${text(item.label)}</span><strong>${available ? number(item.value) : "暂无数据"}</strong></div><i><b style="width:${available ? Math.max(0, Math.min(100, Number(item.value))) : 0}%"></b></i><small>${available ? `置信度 ${percent(item.confidence)}` : "缺失值未计为 0"}</small></div>`;
    }).join("");
  }

  function evidenceCard(item, type) {
    if (type === "missing") return `<article class="evidence-item missing"><span class="evidence-kind">待补充</span><p>${text(item)}</p></article>`;
    const source = item.source || {};
    const period = item.period && (item.period.from || item.period.to)
      ? `${text(item.period.from)} — ${text(item.period.to)}` : "暂无数据";
    const observation = list(item.source_observations)[0] || {};
    const sample = observation.sample_size ?? item.sample_size;
    return `<article class="evidence-item ${type}">
      <div class="evidence-item-head"><span class="evidence-kind">${type === "supporting" ? "支持" : "反面"}</span><span>${item.estimated ? "估算值" : "观测值"}</span></div>
      <h4>${text(item.claim)}</h4>
      <dl>
        <div><dt>指标</dt><dd>${text(item.metric_key)}</dd></div><div><dt>指标值</dt><dd>${text(item.value)} ${text(item.unit, "")}</dd></div>
        <div><dt>比较基准</dt><dd>${text(item.comparison)}</dd></div><div><dt>观察周期</dt><dd>${period}</dd></div>
        <div><dt>样本量</dt><dd>${text(sample)}</dd></div><div><dt>数据来源</dt><dd>${text(source.label || source.id)}</dd></div>
        <div><dt>更新时间</dt><dd>${dateTime(item.observed_at || source.updated_at)}</dd></div><div><dt>置信度</dt><dd>${percent(item.confidence)}</dd></div>
      </dl>
    </article>`;
  }

  function renderEvidence() {
    const recommendation = selectedRecommendation();
    if (!recommendation) return;
    const evidenceMap = {
      supporting: list(recommendation.supporting_evidence),
      counter: list(recommendation.counter_evidence),
      missing: list(recommendation.missing_evidence),
    };
    byId("supportingCount").textContent = evidenceMap.supporting.length;
    byId("counterCount").textContent = evidenceMap.counter.length;
    byId("missingCount").textContent = evidenceMap.missing.length;
    document.querySelectorAll(".evidence-tabs button").forEach((button) => {
      const active = button.dataset.evidence === decisionState.evidenceType;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    const items = evidenceMap[decisionState.evidenceType];
    byId("decisionEvidenceList").innerHTML = items.length
      ? items.map((item) => evidenceCard(item, decisionState.evidenceType)).join("")
      : '<p class="evidence-empty">当前没有该类证据，这不代表相关风险不存在。</p>';

    const risks = list(recommendation.risks).map((risk) => typeof risk === "string" ? risk : risk.summary);
    const assumptions = list(recommendation.assumptions).map((assumption) => `待验证：${assumption}`);
    byId("decisionRisks").innerHTML = [...risks, ...assumptions].map((item) => `<li>${text(item)}</li>`).join("") || "<li>暂无已识别风险；仍需在验证阶段持续观察。</li>";
    byId("decisionSource").textContent = `数据来源：${list(recommendation.sources).map((source) => source.label || source.id).join("、") || "暂无数据"}`;
    byId("decisionUpdatedAt").textContent = `更新时间：${dateTime(recommendation.data_updated_at || decisionState.result?.updated_at)}`;
  }

  function proposalCard(numberLabel, title, content, wide = false) {
    const values = list(content);
    const body = values.length
      ? `<ul>${values.map((item) => `<li>${text(typeof item === "string" ? item : item.experiment || item.summary || JSON.stringify(item))}</li>`).join("")}</ul>`
      : `<p>${text(content)}</p>`;
    return `<article class="proposal-card ${wide ? "wide" : ""}"><span>${numberLabel}</span><div><small>${title}</small>${body}</div></article>`;
  }

  function renderProposal() {
    const recommendation = selectedRecommendation();
    if (!recommendation) return;
    const concept = recommendation.concept || {};
    const scale = recommendation.recommended_project_scale || {};
    const months = recommendation.recommended_development_months || {};
    const validation = list(recommendation.validation_plan);
    const technicalRisks = list(recommendation.risks).filter((risk) => String(typeof risk === "string" ? risk : risk.code || risk.summary).match(/TECH|技术|联网/i));
    const marketRisks = list(recommendation.risks).filter((risk) => !technicalRisks.includes(risk));
    const cards = [
      ["01", "产品定位", concept.positioning], ["02", "目标玩家", concept.target_users],
      ["03", "目标平台和地区", [`${recommendation.target_platform || "暂无数据"} · ${recommendation.target_market || "暂无数据"}`]],
      ["04", "核心玩法循环", concept.core_loop], ["05", "差异化设计", concept.differentiators],
      ["06", "美术和题材方向", concept.art_direction], ["07", "商业化方式", concept.monetization],
      ["08", "建议团队规模", present(scale.team_min) ? `${scale.team_min}–${scale.team_max} 人` : null],
      ["09", "建议预算范围", present(scale.budget_min_cny) ? `${money(scale.budget_min_cny)}–${money(scale.budget_max_cny)}` : null],
      ["10", "建议开发周期", present(months.min) ? `${months.min}–${months.max} 个月` : null],
      ["11", "MVP 功能范围", concept.mvp_scope], ["12", "暂不开发的功能", concept.out_of_scope],
      ["13", "内容生产方案", concept.content_plan], ["14", "获客与发行建议", concept.acquisition_plan],
      ["15", "主要技术风险", technicalRisks.map((risk) => typeof risk === "string" ? risk : risk.summary)],
      ["16", "主要市场风险", marketRisks.map((risk) => typeof risk === "string" ? risk : risk.summary)],
      ["17", "立项前验证实验", validation.map((item) => `${item.hypothesis}：${item.experiment}；成功标准：${item.success_criterion}`), true],
      ["18", "继续投入条件", validation.map((item) => item.success_criterion), true],
      ["19", "停止投入条件", validation.map((item) => item.stop_condition), true],
    ];
    byId("developmentProposalGrid").innerHTML = cards.map((card) => proposalCard(...card)).join("");
  }

  function renderAll() {
    renderRecommendationTabs();
    renderSelectedRecommendation();
    renderEvidence();
    renderProposal();
  }

  async function analyze(event) {
    event.preventDefault();
    const status = byId("developmentDecisionStatus");
    const submit = form.querySelector("button[type='submit']");
    if (!decisionState.selectedGame) {
      status.textContent = "请先选择一个真实榜单中的小游戏，再开始分析。";
      byId("developmentDecisionGame").focus();
      return;
    }
    status.textContent = "正在组合市场证据与团队约束…";
    submit.disabled = true;
    try {
      const response = await fetch("/api/opportunities/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestPayload()),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || result.error || "分析请求失败");
      if (result.status === "insufficient_evidence" && !list(result.recommendations).length) {
        decisionState.result = null;
        byId("decisionEmptyState").hidden = false;
        byId("evidenceEmptyState").hidden = false;
        byId("decisionResultContent").hidden = true;
        byId("decisionEvidenceContent").hidden = true;
        byId("decisionEmptyState").querySelector("span").textContent = "当前只有榜单观察，缺少足够独立来源和已审核的产品证据，暂不生成开发推荐。";
        status.textContent = `已选择 ${decisionState.selectedGame.game_name}；证据不足，建议继续采集和验证。这不是采集失败。`;
        return;
      }
      if (!list(result.recommendations).length) throw new Error("当前筛选条件下暂无可推荐方向，请调整目标市场或平台");
      decisionState.result = result;
      decisionState.selectedIndex = 0;
      decisionState.evidenceType = "supporting";
      byId("decisionEmptyState").hidden = true;
      byId("evidenceEmptyState").hidden = true;
      byId("decisionResultContent").hidden = false;
      byId("decisionEvidenceContent").hidden = false;
      byId("developmentProposal").hidden = true;
      status.textContent = `已生成 ${result.recommendations.length} 个方向；结果用于验证优先级，不代表成功概率。`;
      renderAll();
    } catch (error) {
      status.textContent = `分析失败：${error.message}`;
    } finally {
      submit.disabled = false;
    }
  }

  form.addEventListener("submit", analyze);
  byId("developmentDecisionGame").addEventListener("change", renderSelectedGame);
  byId("recommendationTabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-recommendation-index]");
    if (!button) return;
    decisionState.selectedIndex = Number(button.dataset.recommendationIndex);
    byId("developmentProposal").hidden = true;
    renderAll();
  });
  document.querySelector(".evidence-tabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-evidence]");
    if (!button) return;
    decisionState.evidenceType = button.dataset.evidence;
    renderEvidence();
  });
  byId("showDevelopmentProposal").addEventListener("click", () => {
    byId("developmentProposal").hidden = false;
    renderProposal();
    byId("developmentProposal").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  byId("closeDevelopmentProposal").addEventListener("click", () => {
    byId("developmentProposal").hidden = true;
    byId("development-decision").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  loadMiniGames();
})();
