(() => {
  "use strict";
  const body = document.querySelector("#productAnalysisBody");
  const rows = document.querySelector("#gameRows");
  if (!body || !rows) return;
  const state = { profile: null, comparison: null, tab: "summary" };
  const escape = (value) => String(value ?? "暂无数据").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);
  const list = value => Array.isArray(value) ? value : [];
  const title = key => ({onboarding_barrier:"上手门槛",operation_intensity:"操作强度",strategy_depth:"策略深度",randomness:"随机性",social_intensity:"社交强度",content_consumption:"内容消耗",replayability:"重复可玩性",monetization_intensity:"商业化强度",liveops_dependency:"持续运营依赖",implementation_difficulty:"团队实现难度"})[key] || key;
  const cards = items => `<div class="product-detail-grid">${items.join("")}</div>`;
  const card = (heading, content) => `<article class="product-detail-card"><h3>${escape(heading)}</h3>${content}</article>`;
  const bullets = values => `<ul>${list(values).map(item => `<li>${escape(item)}</li>`).join("") || "<li>暂无数据</li>"}</ul>`;

  function renderChartEvidence() {
    const fields = state.profile.fields || {};
    const rank = Number.isInteger(fields.rank) ? `第 ${fields.rank} 名` : "暂无数据";
    const official = /^https:\/\/apps\.apple\.com\//.test(fields.source_url || "")
      ? `<p><a href="${escape(fields.source_url)}" target="_blank" rel="noopener noreferrer">查看 Apple 官方商店页面 ↗</a></p>` : "";
    body.innerHTML = cards([
      card("已核验的榜单观测", bullets([
        `地区与渠道：${fields.region || "暂无数据"} · ${fields.channel || "暂无数据"}`,
        `榜单与名次：${fields.chart || "暂无数据"} · ${rank}`,
        `发行商：${fields.publisher || "暂无数据"}`,
        `App ID：${fields.app_store_id || "暂无数据"}`,
        `来源：${fields.source_name || "暂无数据"}`,
        `本系统抓取：${fields.observed_at || "暂无数据"}；Apple 官方更新时间：${fields.source_updated_at || "暂无数据"}`,
        `快照状态：${fields.stale ? "旧快照" : "当前可读"}`,
      ]) + official),
      card("分析边界与下一步", bullets([
        "单次上榜只说明该地区该榜单的名次，不能推断下载、收入、增长或成功概率。",
        "玩法循环、玩家反馈、版本事件和运营信息暂无经过来源核验的资料。",
        "下一步：核对官方商店描述与版本记录，补充独立来源和人工审核后再做产品拆解。",
      ])),
    ]);
  }

  function renderSummary() {
    const p = state.profile, s = p.executive_summary;
    body.innerHTML = `<div class="executive-card"><div class="executive-main"><h3>${escape(s.one_line_conclusion)}</h3><p>${escape(s.core_gameplay)}</p><div class="executive-findings">${list(s.why_it_performs).map((x,i)=>`<article><small>关键依据 ${i+1}</small><p>${escape(x)}</p></article>`).join("")}</div><ul class="risk-list">${list(s.main_risks).map(x=>`<li>${escape(x)}</li>`).join("")}</ul></div><aside class="executive-side"><dl><div><dt>产品定位</dt><dd>${escape(s.product_positioning)}</dd></div><div><dt>主要差异化</dt><dd>${escape(s.main_differentiator)}</dd></div><div><dt>建议动作</dt><dd>${escape(s.recommended_action)}</dd></div><div><dt>置信度</dt><dd>${Math.round((s.confidence||0)*100)}% · ${escape(s.strength)}</dd></div><div><dt>独立来源</dt><dd>${escape(s.source_count)} 个</dd></div></dl></aside></div>`;
  }
  function renderGameplay() {
    const p=state.profile,g=p.core_gameplay||{};
    body.innerHTML=cards([card("核心玩法循环",bullets(g.core_loop)),card("主要决策与爽点",bullets([...(g.decision_points||[]),...(g.fun_points||[])])),card("容易流失的节点",bullets(g.churn_points)),card("玩法 DNA",Object.entries(p.gameplay_dna||{}).map(([k,v])=>`<div class="dna-row"><span>${escape(title(k))}</span><i><b style="width:${Number(v)||0}%"></b></i><strong>${escape(v)}</strong></div>`).join(""))]);
  }
  function renderFeatures(){const p=state.profile,f=p.product_features||{},c=p.content_structure||{},m=p.monetization||{};body.innerHTML=cards([card("产品特色",bullets([f.theme,f.world,f.narrative,f.art_style,f.emotional_experience,...list(f.differentiators)].filter(Boolean))),card("宣传兑现",`<p>${escape(f.promise_alignment)}</p>${bullets(f.marketing_promises)}`),card("内容结构",bullets([`内容量：${c.volume||"暂无"}`,`更新频率：${c.update_frequency||"暂无"}`,`内容复用：${c.reuse_level||"暂无"}`,`小团队适配：${c.small_team_suitability||"暂无"}`])),card("商业化结构",bullets([`模式：${p.monetization_model}`,`价格：${m.premium_price??"暂无"}`,`玩法耦合：${m.gameplay_coupling||"暂无"}`,`玩家反馈：${m.feedback||"暂无"}`]))]);}
  function renderFeedback(){body.innerHTML=cards(list(state.profile.feedback_topics).map(t=>card(t.topic,`<div class="feedback-topic"><header><strong>${Math.round((t.positive_ratio||0)*100)}% 正面</strong><span>${t.count||"—"} 条 · 占比 ${Math.round((t.share||0)*100)}%</span></header>${bullets(t.mapped_systems)}<p>${escape(t.representative_excerpt)}</p><span>审核置信度 ${Math.round((t.confidence||0)*100)}%</span></div>`)));}
  function renderEvents(){const events=list(state.profile.events);body.innerHTML=events.length?cards(events.map(e=>card(e.title,`<div class="event-card"><header><strong>${escape(e.type)}</strong><span>${escape(e.occurred_at)}</span></header>${bullets(list(e.metrics).map(m=>`${m.metric_key}: 前7天 ${m.before_7d} → 后7天 ${m.after_7d}`))}<p>同期事件：${escape(list(e.coincident_events).join("、")||"无已知记录")}</p><span class="correlation-badge">${escape(e.causality)} · 归因风险 ${escape(e.attribution_risk)}</span></div>`))).join(""):"<div class='product-analysis-empty'>暂无已审核版本事件。</div>";}
  function renderComparison(){const c=state.comparison;if(!c){body.innerHTML="<div class='product-analysis-empty'>竞品矩阵加载中…</div>";return;}body.innerHTML=`<div class="comparison-scroll"><table class="comparison-table"><thead><tr><th>维度</th>${c.games.map(g=>`<th>${escape(g.name)}</th>`).join("")}</tr></thead><tbody>${c.rows.map(r=>`<tr><th>${escape(r.dimension)}</th>${c.games.map(g=>`<td>${escape(r.values[g.game_id])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;}
  function renderLessons(){body.innerHTML=cards([card("可借鉴",bullets(list(state.profile.feature_metric_links).map(x=>x.claim))),card("不可照搬",bullets(state.profile.main_risks)),card("相关性边界",bullets(list(state.profile.feature_metric_links).map(x=>`${x.feature_name}：${x.causality}，置信度 ${Math.round((x.confidence||0)*100)}%`))),card("建议动作",`<p>${escape(state.profile.recommended_action)}</p>`)]);}
  function render(){if(!state.profile)return;if(state.profile.kind==="chart_evidence")return renderChartEvidence();({summary:renderSummary,gameplay:renderGameplay,features:renderFeatures,feedback:renderFeedback,events:renderEvents,comparison:renderComparison,lessons:renderLessons}[state.tab]||renderSummary)();}
  async function load(gameId){body.innerHTML="<div class='product-analysis-empty'>正在加载产品档案…</div>";try{const response=await fetch(`/api/games/${encodeURIComponent(gameId)}/product-analysis`);const result=await response.json();if(!response.ok)throw new Error(result.error?.message||"暂无产品档案");state.profile=result;state.tab="summary";document.querySelectorAll("[data-product-tab]").forEach(b=>{b.classList.toggle("active",b.dataset.productTab==="summary");b.disabled=result.kind==="chart_evidence"&&b.dataset.productTab!=="summary";});document.querySelector("#productAnalysisTitle").textContent=`${result.name} · 游戏产品画像`;document.querySelector("#productAnalysisMode").textContent=`${String(result.data_mode).toUpperCase()} · ${result.review_status}`;document.querySelector("#productAnalysisUpdated").textContent=`更新于 ${result.updated_at}`;document.querySelector("#productAnalysisNotice").textContent=result.limitations?.join(" ")||"字段来源和审核状态可下钻查看。";render();if(result.kind==="chart_evidence")return;const compare=await fetch(`/api/games/${encodeURIComponent(gameId)}/comparisons`);state.comparison=compare.ok?await compare.json():null;if(state.tab==="comparison")render();}catch(error){state.profile=null;body.innerHTML=`<div class="product-analysis-empty">${escape(error.message)}。当前游戏仍可查看市场数据，但不会根据名称虚构玩法。</div>`;}}
  document.addEventListener("gamepulse:game-selected", event => {
    if (event.detail?.gameId) load(event.detail.gameId);
  });
  document.querySelector(".product-tabs").addEventListener("click",event=>{const button=event.target.closest("[data-product-tab]");if(!button||!state.profile)return;state.tab=button.dataset.productTab;document.querySelectorAll("[data-product-tab]").forEach(b=>b.classList.toggle("active",b===button));render();});
})();
