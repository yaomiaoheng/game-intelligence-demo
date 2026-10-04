// The public static experience has no permission to redistribute collector records.
// Real data remains in the authenticated cloud API until publication rights are verified.
const sourceRegistry = [{"source_id":"app-store-public","source_name":"Apple App Store Search","source_type":"official_public","platform":"ios","access_method":"api","authorization":"none","data_scope":["metadata","publisher","genres","version","price","rating","reviews"],"official":true,"estimated":false,"commercial_license":false,"collection_allowed":true,"retention_allowed":true,"redistribution_allowed":false,"update_frequency":"daily_catalog","quality_grade":"B","terms_url":"https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/","last_compliance_reviewed_at":null,"rate_limit":{}},{"source_id":"commercial-csv","source_name":"Licensed Commercial Data Import","source_type":"commercial_estimate","platform":"cross_platform","access_method":"csv","authorization":"licensed_export","data_scope":["sales_estimate","revenue_estimate","downloads_estimate","market_share"],"official":false,"estimated":true,"commercial_license":true,"collection_allowed":true,"retention_allowed":true,"redistribution_allowed":false,"update_frequency":"provider_schedule","quality_grade":"B","terms_url":"","last_compliance_reviewed_at":null,"rate_limit":{}},{"source_id":"diandian-cloud","source_name":"点点数据授权云采集","source_type":"commercial_estimate","platform":"mobile","access_method":"authorized_browser","authorization":"persistent_cloud_session","data_scope":["rank","download_estimate","revenue_estimate","rating","reviews","historical_trend"],"official":false,"estimated":true,"commercial_license":true,"collection_allowed":true,"retention_allowed":true,"redistribution_allowed":false,"update_frequency":"six_hourly_rank_daily_game","quality_grade":"C","terms_url":"https://app.diandian.com/","last_compliance_reviewed_at":null,"rate_limit":{}},{"source_id":"editorial-research","source_name":"Human Product Research","source_type":"editorial_manual","platform":"cross_platform","access_method":"manual","authorization":"internal_reviewer","data_scope":["gameplay","features","systems","content","monetization"],"official":false,"estimated":false,"commercial_license":false,"collection_allowed":true,"retention_allowed":true,"redistribution_allowed":false,"update_frequency":"after_major_version","quality_grade":"B","terms_url":"","last_compliance_reviewed_at":null,"rate_limit":{}},{"source_id":"igdb","source_name":"IGDB","source_type":"official_public","platform":"cross_platform","access_method":"api","authorization":"oauth_client","data_scope":["metadata","platforms","genres","themes","release_dates"],"official":true,"estimated":false,"commercial_license":false,"collection_allowed":true,"retention_allowed":true,"redistribution_allowed":false,"update_frequency":"weekly","quality_grade":"B","terms_url":"https://api-docs.igdb.com/","last_compliance_reviewed_at":null,"rate_limit":{}},{"source_id":"mock-product-lab","source_name":"Mock Product Lab","source_type":"mock","platform":"demo","access_method":"fixture","authorization":"none","data_scope":["all_demo_fields"],"official":false,"estimated":true,"commercial_license":false,"collection_allowed":true,"retention_allowed":true,"redistribution_allowed":false,"update_frequency":"fixed","quality_grade":"D","terms_url":"","last_compliance_reviewed_at":null,"rate_limit":{}},{"source_id":"steam-public","source_name":"Steam Public Data","source_type":"official_public","platform":"steam","access_method":"api","authorization":"none_or_api_key","data_scope":["metadata","price","discount","current_players","reviews","news"],"official":true,"estimated":false,"commercial_license":false,"collection_allowed":true,"retention_allowed":true,"redistribution_allowed":false,"update_frequency":"hourly_players_daily_catalog","quality_grade":"B","terms_url":"https://store.steampowered.com/api/","last_compliance_reviewed_at":null,"rate_limit":{}},{"source_id":"youtube-data","source_name":"YouTube Data API","source_type":"official_public","platform":"youtube","access_method":"api","authorization":"api_key","data_scope":["video_count","views","likes","comments","channel_coverage"],"official":true,"estimated":false,"commercial_license":false,"collection_allowed":true,"retention_allowed":true,"redistribution_allowed":false,"update_frequency":"daily","quality_grade":"B","terms_url":"https://developers.google.com/youtube/v3","last_compliance_reviewed_at":null,"rate_limit":{}}];
// Apple Games RSS is a separate source from the App Store Search API. Long-term
// JSON redistribution remains under review; this switch permits a quick rollback.
const PUBLIC_APPLE_RADAR_ENABLED = true;
sourceRegistry.push({source_id: "apple-games-rss", source_name: "Apple Games RSS 榜单",
  source_type: "official_public", platform: "ios", access_method: "rss",
  authorization: "none", data_scope: ["rank", "app_store_id", "name", "publisher", "official_link"],
  official: true, estimated: false, collection_allowed: true,
  retention_allowed: null, redistribution_allowed: null,
  update_frequency: "six_hourly_local_fetch", quality_grade: "B",
  terms_url: "https://www.apple.com/in/itunes/link/",
  last_compliance_reviewed_at: null,
  rights_note: "网站热门榜单展示有官方说明；长期完整 JSON 镜像再发布许可尚未确认。"});
sourceRegistry.push({source_id: "dataeye-mini-rankings", source_name: "DataEye ADX 小游戏榜单",
  source_type: "commercial_estimate", platform: "douyin/wechat", access_method: "published_snapshot",
  data_scope: ["rank", "game_name", "publisher", "source_date", "rank_change"],
  official: false, estimated: false, quality_grade: "B", terms_url: "",
  rights_note: "公开站仅展示已脱敏的只读榜单快照；不等于实时采集。"});
sourceRegistry.push({source_id: "qimai", source_name: "七麦数据",
  source_type: "commercial_estimate", platform: "mobile", access_method: "not_connected",
  data_scope: [], official: false, estimated: true, quality_grade: "—", terms_url: "https://www.qimai.cn/",
  rights_note: "未接入公开站；没有可展示的七麦数据。"});
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
    if (url.pathname === "/api/data-sources/registry") return json({ items: sourceRegistry });
    if (url.pathname === "/api/games") return json({ items: [] });
    if (url.pathname === "/api/mini-game-rankings") return json({ error: { code: "MINI_RANKINGS_UNAVAILABLE", message: "公开静态站暂无安全的 HTTPS 快照代理；请在云端 GamePulse 站查看实时榜单。" } }, 503);
    if (url.pathname === "/api/opportunities/analyze" && request.method === "POST") return json({
      recommendations: [], sources: [], updated_at: null, status: "insufficient_evidence",
      methodology: { version: "real-evidence-gate-v1", weights: {}, limitations: ["暂无足够已授权、可公开的真实证据。"], missing_value_policy: "缺失不补零、不参与评分", recommendation_language: "证据不足，建议继续采集" },
    });
    if (url.pathname === "/api/project-plans/generate" && request.method === "POST") return json({ error: { code: "REAL_DATA_NOT_PUBLIC", message: "暂无获准公开的真实证据，不能生成项目方案" } }, 403);
    if (url.pathname === "/api/query" && request.method === "POST") return json({
      status: "insufficient_evidence",
      answer: "公开榜单事实查询暂不可用；未使用演示数据替代。",
    });
    if (url.pathname.startsWith("/api/games/") || url.pathname === "/api/intelligence") return json({ error: { code: "REAL_DATA_NOT_PUBLIC", message: "暂无获准公开展示的真实数据" } }, 404);
    if (url.pathname.startsWith("/api/")) return json({ error: "接口不存在" }, 404);
    return nativeFetch(request);
  },
};

// Static Pages publishes only redacted read-only snapshots. No browser session or token is used.
const publicGameCatalog = (() => {
  const countryNames = {CN: "中国", US: "美国", JP: "日本", GB: "英国", KR: "韩国",
    TW: "中国台湾", HK: "中国香港", SG: "新加坡"};
  const boardNames = {topFree: "免费榜", topPaid: "付费榜", topGrossing: "畅销榜",
    topFresh: "新游榜", popularityList: "人气榜", bestsellerList: "畅销榜",
    freshGameList: "新游榜", mostPlayedList: "畅玩榜",
    "top-free": "免费榜", "top-paid": "付费榜", "top-grossing": "畅销榜"};
  const typeLoops = {
    "休闲": ["短局核心操作", "即时反馈", "重复挑战"],
    "解谜": ["理解谜题", "尝试解法", "解锁关卡"],
    "策略": ["收集信息", "制定策略", "复盘结果"],
    "模拟经营": ["配置资源", "处理事件", "扩展目标"],
    "角色扮演": ["探索", "交互或战斗", "角色成长"],
  };
  const MAX_FRESH_AGE_MS = 12 * 60 * 60 * 1000;
  function isStale(fetchedAt, upstreamStale = false) {
    const timestamp = Date.parse(fetchedAt || "");
    return Boolean(upstreamStale) || !Number.isFinite(timestamp) ||
      Date.now() - timestamp > MAX_FRESH_AGE_MS || timestamp - Date.now() > 5 * 60 * 1000;
  }
  async function readJson(nativeFetch, name) {
    const file = new URL(`./${name}`, window.location.href);
    file.searchParams.set("_", String(Date.now()));
    const response = await nativeFetch(new Request(file, {cache: "no-store"}));
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    return response.json();
  }
  function miniItems(snapshot) {
    const groups = new Map();
    for (const provider of ["douyin", "wechat"]) {
      const providerSnapshot = snapshot?.providers?.[provider];
      const providerStale = isStale(providerSnapshot?.observed_at, snapshot?.connection?.stale);
      for (const row of snapshot?.providers?.[provider]?.rows || []) {
        if (!row.external_id || !row.source_date || !row.game_name) continue;
        const id = `${provider}|${row.external_id}|${row.source_date}`;
        const board = {board: row.rank_type, label: boardNames[row.rank_type] || row.rank_type,
          rank: row.rank, rank_change: row.rank_change, new_entry: Boolean(row.new_entry)};
        const existing = groups.get(id);
        if (existing) {
          existing.boards.push(board);
          if (Number.isInteger(row.rank) && (!Number.isInteger(existing.rank) || row.rank < existing.rank)) {
            Object.assign(existing, {rank: row.rank, rank_change: row.rank_change,
              primary_board_label: board.label, new_entry: board.new_entry});
          }
          continue;
        }
        groups.set(id, {id, provider, provider_label: provider === "douyin" ? "抖音小游戏" : "微信小游戏",
          external_id: String(row.external_id), game_name: row.game_name, publisher: row.publisher || null,
          as_of: row.source_date, observed_at: row.observed_at || null,
          primary_board_label: board.label, rank: row.rank, rank_change: row.rank_change,
          new_entry: board.new_entry, boards: [board], source: {id: "dataeye-mini-rankings", label: "DataEye 小游戏榜单"},
          stale: providerStale, estimated: false});
      }
    }
    return [...groups.values()];
  }
  function appleItems(snapshot) {
    const groups = new Map();
    for (const chart of snapshot?.charts || []) {
      const date = String(chart.observed_at || "").slice(0, 10);
      if (!chart.country || !date || !boardNames[chart.chart]) continue;
      for (const row of chart.items || []) {
        const appId = String(row.app_store_id || "");
        if (!/^\d+$/.test(appId) || !row.name) continue;
        const id = `app-store|${chart.country}|${appId}|${date}`;
        const board = {board: chart.chart, label: boardNames[chart.chart], rank: row.rank,
          rank_change: null, new_entry: false, stale: isStale(chart.observed_at, chart.stale),
          observed_at: chart.observed_at};
        const existing = groups.get(id);
        if (existing) {
          existing.boards.push(board);
          existing.stale ||= board.stale;
          if (Number.isInteger(row.rank) && (!Number.isInteger(existing.rank) || row.rank < existing.rank)) {
            Object.assign(existing, {rank: row.rank, primary_board_label: board.label});
          }
          continue;
        }
        groups.set(id, {id, provider: "app-store", provider_label: `App Store · ${chart.country}`,
          external_id: appId, game_name: row.name, publisher: row.publisher || null,
          market: chart.country, platform: "ios", as_of: date, observed_at: chart.observed_at,
          observed_at_kind: "fetch_time", source_updated_at: null,
          primary_board_label: board.label, rank: row.rank, rank_change: null, new_entry: false,
          boards: [board], source: {id: "apple-app-store", label: "Apple App Store 游戏榜单", url: row.source_url},
          stale: board.stale, estimated: false});
      }
    }
    return [...groups.values()];
  }
  async function catalog(nativeFetch) {
    const errors = {};
    let mini = [], apple = [];
    try { mini = miniItems(await readJson(nativeFetch, "mini-ranking-snapshot.json")); }
    catch (error) { errors.mini_games = error.message; }
    try { apple = appleItems(await readJson(nativeFetch, "apple-game-charts.json")); }
    catch (error) { errors.app_store = error.message; }
    const items = mini.concat(apple);
    return {items, count: items.length, groups: {mini_games: mini.length, app_store: apple.length},
      updated_at: items.map((item) => item.observed_at).filter(Boolean).sort().at(-1) || null,
      source_errors: errors,
      scope_note: "只读已发布快照；名次不等于收入、下载量或成功概率。"};
  }
  function officialAppleLink(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname === "apps.apple.com" ? url.href : null;
    } catch { return null; }
  }
  async function radar(nativeFetch) {
    if (!PUBLIC_APPLE_RADAR_ENABLED) return {items: [], updated_at: null, source_error: "公开雷达已关闭"};
    const snapshot = await readJson(nativeFetch, "apple-game-charts.json");
    const items = [];
    for (const chart of snapshot?.charts || []) {
      if (!countryNames[chart.country] || !boardNames[chart.chart]) continue;
      const observedAt = chart.observed_at || null;
      const date = String(observedAt || "").slice(0, 10);
      if (!date) continue;
      for (const row of chart.items || []) {
        const appId = String(row.app_store_id || "");
        if (!/^\d+$/.test(appId) || !row.name || !Number.isInteger(row.rank) || row.rank < 1) continue;
        const link = officialAppleLink(row.source_url);
        items.push({
          id: `apple-rss|${chart.country}|${chart.chart}|${appId}|${date}`,
          name: String(row.name), company: row.publisher || "发行商暂无数据", tags: [boardNames[chart.chart]],
          region: countryNames[chart.country], country: chart.country, channel: "App Store",
          board: chart.chart, board_label: boardNames[chart.chart], app_store_id: appId,
          rank: row.rank, free_rank: chart.chart === "top-free" ? row.rank : null,
          revenue: null, downloads: null, growth: null, rating: null, score: null,
          status: isStale(observedAt, chart.stale || chart.status !== "live") ? "旧快照" : "榜单观测",
          stale: isStale(observedAt, chart.stale || chart.status !== "live"),
          observed_at: observedAt, source_updated_at: null, official_url: link,
          source: {id: "apple-games-rss", label: "Apple Games RSS", url: link},
          signal: `${countryNames[chart.country]} App Store ${boardNames[chart.chart]}第 ${row.rank} 名；仅为本系统单次抓取的榜单名次，不能推断收入、下载或增长。`,
          trend: [{date, rank: row.rank, revenue: null, downloads: null}],
        });
      }
    }
    return {items, updated_at: items.map((item) => item.observed_at).filter(Boolean).sort().at(-1) || null,
      source_error: null, scope_note: "本系统抓取时间，不代表 Apple 官方更新时间；单次名次不能计算趋势。"};
  }
  async function plan(nativeFetch, request) {
    let payload;
    try { payload = await request.json(); }
    catch { return json({error: {code: "INVALID_REQUEST", message: "请求体不是 JSON"}}, 400); }
    const selected = (await catalog(nativeFetch)).items.find((item) => item.id === payload.selected_game_id);
    const types = payload.game_types;
    if (!selected || !Array.isArray(types) || !types.length || types.length > 8 ||
        types.some((type) => !typeLoops[type]) ||
        !Number.isInteger(payload.team_size) || payload.team_size <= 0 ||
        !Number.isFinite(payload.budget_cny) || payload.budget_cny < 0 ||
        !Number.isInteger(payload.development_months) || payload.development_months <= 0 ||
        !payload.market || !payload.platform) {
      return json({error: {code: "INVALID_REQUEST", message: "请选择已发布游戏和类型，并填写市场、平台、团队、预算及周期"}}, 400);
    }
    const constraints = {team_size: payload.team_size, budget_cny: payload.budget_cny,
      development_months: payload.development_months};
    const briefs = [...new Set(types)].map((type) => ({
      game_type: type, market: payload.market, platform: payload.platform,
      status: "research_hypothesis", recommendation: "仅建议验证该方向，不构成立项或投资结论",
      positioning_hypothesis: `面向${payload.market}市场、${payload.platform}平台的${type}游戏；目标用户和差异化仍需访谈验证`,
      core_loop_hypothesis: typeLoops[type], mvp_scope: ["最小可玩循环", "行为埋点", "用户反馈与退出机制"],
      constraints, feasibility: "unverified", feasibility_note: "尚无经核验的工时和成本基准，不能断言可交付",
      evidence: [], comparable_game_count: 0, source_count: 0, source_ids: [],
      counterevidence_and_limits: [{type: "single_chart_only", detail: "当前仅有选定游戏的榜单上下文，没有同类型独立市场证据；排名不能证明收入或需求。"}],
      missing_evidence: [
        {label: "目标用户与需求", verification: "访谈目标用户并记录样本与反例"},
        {label: "留存与核心循环", verification: "可玩原型预注册留存与完成率阈值"},
        {label: "获客与单位经济", verification: "小额渠道实验并核对成本、转化和回收"},
        {label: "版权、合规与人工审核", verification: "核查上架规则、素材权利和产品字段"},
      ],
      phases: [
        {phase: "发现与核验", deliverable: "用户访谈、同类证据矩阵、风险登记", gate: "来源和用户问题未经人工确认则停止"},
        {phase: "可玩原型", deliverable: "最小核心循环和行为埋点", gate: "未达预设玩法阈值则迭代或停止"},
        {phase: "MVP 小规模测试", deliverable: "留存、获客、成本与反例记录", gate: "单位经济未经实测不得放量"},
        {phase: "投资审查", deliverable: "财务敏感性、权利与独立复核", gate: "产品、财务、法务分别签核"},
      ],
      review_gate: "补齐独立来源、反面证据及人工复核后，才可编制投资人材料",
      human_review_required: true, investor_ready: false,
    }));
    return json({briefs, count: briefs.length, status: "research_only", investor_ready: false,
      analysis_subject: {id: selected.id, name: selected.game_name, rank: selected.rank,
        board: selected.primary_board_label,
        board_code: selected.boards?.find((board) => board.label === selected.primary_board_label && board.rank === selected.rank)?.board || null,
        country: selected.market || null, platform: selected.platform || selected.provider,
        external_id: selected.external_id, source: selected.source,
        observed_at: selected.observed_at, observed_at_kind: selected.observed_at_kind || null,
        source_updated_at: selected.source_updated_at || null, stale: selected.stale},
      updated_at: selected.observed_at, generated_at: new Date().toISOString(),
      methodology: "榜单仅作为研究对象上下文。当前缺少三方交叉证据，不评分、不排序、不把名次换算收入、下载或成功概率。"});
  }
  return {catalog, radar, plan};
})();


const nativeFetch = window.fetch.bind(window);
async function publicRadarData() {
  try { return await publicGameCatalog.radar(nativeFetch); }
  catch (error) { return {items: [], updated_at: null, source_error: String(error.message || error)}; }
}
window.fetch = (input, init) => {
  const request = input instanceof Request
    ? input
    : new Request(new URL(String(input), window.location.href), init);
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {

  if (url.pathname === '/api/query' && request.method === 'POST') {
    if (!window.PublicFactAnswer) return Promise.resolve(json({status: 'insufficient_evidence',
      answer: '公开榜单事实查询暂不可用；未使用演示数据替代。'}));
    return request.json().then(payload => window.PublicFactAnswer.answer(
      payload?.query, nativeFetch, {appleEnabled: PUBLIC_APPLE_RADAR_ENABLED}))
      .then(result => json(result))
      .catch(() => json({status: 'insufficient_evidence',
        answer: '公开榜单事实查询暂不可用；未使用演示数据替代。'}));
  }

  if (url.pathname === '/api/overview') {
    return publicRadarData().then((data) => json({
      games: new Set(data.items.map((item) => item.app_store_id)).size,
      observations: data.items.length,
      countries: [...new Set(data.items.map((item) => item.country))],
      charts: new Set(data.items.map((item) => `${item.country}|${item.board}`)).size,
      revenue: null, downloads: null, avgGrowth: null, leader: null,
      updatedAt: data.updated_at, collectionStatus: data.source_error ? "unavailable" : "snapshot",
      stale: Boolean(data.source_error) || data.items.every((item) => item.stale),
      notice: data.source_error
        ? `Apple 榜单快照暂不可读：${data.source_error}；不使用演示数据。`
        : `已读取 ${data.items.length} 条 Apple Games 榜单观测；仅显示名次，本系统抓取时间不等于 Apple 官方更新时间。收入、下载及增速暂无数据。`,
    }));
  }
  if (url.pathname === '/api/games') {
    return publicRadarData().then((data) => {
      const q = (url.searchParams.get('q') || '').trim().toLocaleLowerCase();
      const region = url.searchParams.get('region') || '';
      const channel = url.searchParams.get('channel') || '';
      const category = url.searchParams.get('category') || '';
      const requested = Number(url.searchParams.get('limit'));
      const limit = Number.isSafeInteger(requested) && requested > 0
        ? Math.min(requested, data.items.length) : data.items.length;
      const items = data.items.filter((item) =>
        (!q || `${item.name} ${item.company} ${item.app_store_id} ${item.board_label}`.toLocaleLowerCase().includes(q)) &&
        (!region || item.region === region) && (!channel || item.channel === channel) && !category);
      items.sort((a, b) => (a.rank - b.rank) || a.country.localeCompare(b.country));
      return json({items: items.slice(0, limit), total: items.length,
        updated_at: data.updated_at, source_error: data.source_error, source: 'apple-games-rss'});
    });
  }
  if (/^\/api\/games\/[^/]+\/product-analysis$/.test(url.pathname)) {
    return publicRadarData().then((data) => {
      const encodedId = url.pathname.slice('/api/games/'.length, -'/product-analysis'.length);
      const id = decodeURIComponent(encodedId);
      const item = data.items.find((game) => game.id === id);
      if (!item) return json({error: {code: 'GAME_NOT_FOUND', message: '没有该公开榜单观测'}}, 404);
      return json({
        kind: 'chart_evidence', data_mode: 'real', review_status: '仅榜单事实，产品字段未审核',
        name: item.name, updated_at: item.observed_at,
        fields: {
          publisher: item.company === '发行商暂无数据' ? null : item.company,
          app_store_id: item.app_store_id, region: item.region, channel: item.channel,
          chart: item.board_label, rank: item.rank, observed_at: item.observed_at,
          source_updated_at: item.source_updated_at, source_url: item.official_url,
          source_name: 'Apple Games RSS', stale: item.stale,
        },
        limitations: [
          '本系统抓取时间不等于 Apple 官方更新时间；单次榜单名次不能证明收入、下载量或增长。',
          '玩法、评论、版本事件、运营和独立来源尚无已审核的产品证据，不生成产品拆解结论。',
        ],
      });
    });
  }
  if (url.pathname.startsWith('/api/games/')) {
    return publicRadarData().then((data) => {
      const id = decodeURIComponent(url.pathname.slice('/api/games/'.length));
      const item = data.items.find((game) => game.id === id);
      return item ? json(item) : json({error: '没有该公开榜单观测'}, 404);
    });
  }
  if (url.pathname === '/api/intelligence') {
    return publicRadarData().then((data) => {
      const item = data.items.find((game) => game.id === url.searchParams.get('game_id'));
      if (!item) return json({error: '没有该公开榜单观测'}, 404);
      return json({sources: [{id: 'apple-games-rss', label: 'Apple Games RSS',
        quality: item.stale ? '旧快照' : '单次榜单观测', url: item.official_url}],
        updated_at: item.observed_at, analysis: {
          trend: {summary: '目前只有一轮榜单名次，不能判断走势；收入和下载暂无来源。',
            evidence: [`${item.region} ${item.board_label}第 ${item.rank} 名`, '本系统抓取时间；Apple 官方更新时间未知'],
            window: {points: 1}},
          competitors: [], risks: [],
        }});
    });
  }

  if (url.pathname === '/api/development-decision/games') {
    return publicGameCatalog.catalog(nativeFetch).then((value) => json(value));
  }
  if (url.pathname === '/api/project-plans/generate' && request.method === 'POST') {
    return publicGameCatalog.plan(nativeFetch, request);
  }
  if (url.pathname === '/api/mini-game-rankings') {
    const file = new URL('./mini-ranking-snapshot.json', window.location.href);
    file.searchParams.set('_', String(Date.now()));
    return nativeFetch(new Request(file, { cache: 'no-store' }));
  }
  if (url.pathname === '/api/mini-game-intelligence') {
    const provider = url.searchParams.get('provider') || 'all';
    if (!['all', 'douyin', 'wechat'].includes(provider)) {
      return json({ error: { code: 'INVALID_PROVIDER', message: '平台筛选无效' } }, 400);
    }
    const file = new URL(`./mini-intelligence-${provider}.json`, window.location.href);
    file.searchParams.set('_', String(Date.now()));
    return nativeFetch(new Request(file, { cache: 'no-store' }));
  }

    return publicWorker.fetch(request, {});
  }
  return nativeFetch(input, init);
};

const state = {
  games: [], opportunityGames: [], selected: null, metric: "revenue", rangeDays: 30,
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
  $("#dataNoticeText").textContent = data.notice;
  $("#overviewVerdict").textContent = data.games ? "已有真实榜单观测" : "暂无可用榜单";
  $("#overviewSummary").textContent = data.games
    ? `${data.charts} 张 Apple 游戏榜单、${data.observations} 条实际名次，覆盖${data.countries.join("、")}；仅是本系统抓取快照，不能推断销量、收入或市场增长。${data.stale ? "当前快照已过本系统新鲜度阈值。" : ""}`
    : "暂无可用的真实榜单，未使用演示数据。";
  $("#briefCoverage").textContent = data.games
    ? `${data.charts} 张榜、${data.observations} 条名次；本系统抓取 ${formatDateTime(data.updatedAt)}，Apple 官方更新时间未知。`
    : "当前暂无可用的真实榜单。";
}

function renderRows(games) {
  $("#resultCount").textContent = `${games.length} 个结果`;
  $("#gameRows").innerHTML = games.map((game) => `
    <tr data-id="${escapeHTML(game.id)}">
      <td><div class="game-name"><span class="game-icon">${escapeHTML(game.name.slice(0, 1))}</span><span><strong>${escapeHTML(game.name)}</strong><small>${escapeHTML(game.company)} · App ID ${escapeHTML(game.app_store_id)}</small><span class="tags"><i class="tag">${escapeHTML(game.board_label)}</i></span>${game.official_url ? `<a class="official-game-link" href="${escapeHTML(game.official_url)}" target="_blank" rel="noopener noreferrer">Apple 官方页面 ↗</a>` : ""}</span></div></td>
      <td>${escapeHTML(game.region)}<br><small>${escapeHTML(game.channel)}</small></td>
      <td><span class="rank">${escapeHTML(game.board_label)} 第 ${formatNumber(game.rank)} 名</span></td>
      <td><strong>${valueCell(game.revenue, " 万")}</strong></td>
      <td class="growth ${game.growth < 0 ? "negative" : ""}">${hasValue(game.growth) ? `${game.growth > 0 ? "+" : ""}${game.growth}%` : '<span class="missing-value">暂无数据</span>'}</td>
      <td><span class="status">${escapeHTML(game.status)}</span><br><small>本系统抓取 ${escapeHTML(formatDateTime(game.observed_at))}</small></td>
    </tr>`).join("") || `<tr><td colspan="6">暂无符合条件的真实游戏数据</td></tr>`;
  document.querySelectorAll("tr[data-id]").forEach(row => row.addEventListener("click", () => selectGame(row.dataset.id)));
  document.querySelectorAll(".official-game-link").forEach(link => link.addEventListener("click", event => event.stopPropagation()));
}

function renderOpportunityBoard() {
  const country = $("#opportunityCountry").value;
  const board = $("#opportunityChart").value;
  const rows = state.opportunityGames.filter(game => game.region === country && game.board === board &&
    Number.isInteger(game.rank) && game.rank >= 1 && game.rank <= 100)
    .sort((a, b) => a.rank - b.rank).slice(0, 100);
  $("#opportunityBoardCount").textContent = `${rows.length} / 100 条实际名次`;
  $("#opportunityBoardNote").textContent = `${country} App Store ${({"top-free":"免费榜","top-paid":"付费榜","top-grossing":"畅销榜"})[board]}：实际采到 ${rows.length} 条。仅为本系统抓取时的排名，Apple 官方更新时间未知；收入、下载和增长暂无数据。`;
  $("#opportunityBoardRows").innerHTML = rows.map(game => `<tr data-opportunity-id="${escapeHTML(game.id)}">
    <td><strong>第 ${formatNumber(game.rank)} 名</strong></td>
    <td>${escapeHTML(game.name)}<small>App ID ${escapeHTML(game.app_store_id)}</small></td>
    <td>${escapeHTML(game.company)}</td>
    <td>${game.official_url ? `<a href="${escapeHTML(game.official_url)}" target="_blank" rel="noopener noreferrer">Apple 官方页面 ↗</a>` : "暂无链接"}</td>
    <td>${escapeHTML(formatDateTime(game.observed_at))}${game.stale ? " · 旧快照" : ""}</td>
  </tr>`).join("") || '<tr><td colspan="5">该榜单暂无实际采到的游戏；未补造至 100 名。</td></tr>';
  document.querySelectorAll("tr[data-opportunity-id]").forEach(row => row.addEventListener("click", event => {
    if (event.target.closest("a")) return;
    selectGame(row.dataset.opportunityId);
    $("#opportunities").scrollIntoView({behavior: "smooth"});
  }));
}

async function loadOpportunityBoard() {
  try {
    const data = await getJSON("/api/games");
    state.opportunityGames = data.items || [];
    renderOpportunityBoard();
  } catch (error) {
    $("#opportunityBoardCount").textContent = "读取失败";
    $("#opportunityBoardNote").textContent = `真实榜单暂时无法读取：${error.message}。未使用演示数据。`;
    $("#opportunityBoardRows").innerHTML = '<tr><td colspan="5">暂无可用的真实榜单</td></tr>';
  }
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
  if (state.games[0] && !state.games.some((game) => game.id === state.selected?.id)) selectGame(state.games[0].id);
}

async function selectGame(id) {
  const selected = state.games.find((game) => game.id === id);
  const [game, intelligence] = await Promise.all([
    getJSON(`/api/games/${id}`),
    getJSON(`/api/intelligence?game_id=${encodeURIComponent(id)}`),
  ]);
  state.selected = game;
  window.gamePulseSelectedGameId = id;
  // A selection can originate in either the radar or the opportunity chart.
  // Keep the product profile in sync without inventing missing product facts.
  document.dispatchEvent(new CustomEvent("gamepulse:game-selected", {detail: {gameId: id}}));
  state.metric = "rank";
  document.querySelectorAll(".metric-tabs button").forEach(item => {
    const active = item.dataset.metric === "rank";
    item.classList.toggle("active", active);
    item.setAttribute("aria-selected", String(active));
  });
  syncDateControls();
  document.querySelectorAll("tr[data-id]").forEach(row => row.classList.toggle("selected", row.dataset.id === id));
  $("#selectedInsight").textContent = game.signal;
  // Growth and rating alone do not establish a reviewed commercial opportunity score.
  $("#scoreValue").textContent = "/";
  $(".score-ring span").textContent = "暂无经审核评分";
  $(".score-ring").style.background = "#e7ece9";
  renderIntelligence(intelligence);
  renderSelectedTrend();
}

function renderIntelligence(intelligence) {
  const source = intelligence.sources[0];
  const trend = intelligence.analysis.trend;
  $("#sourceBadge").textContent = `${source.label} · ${source.quality}`;
  $("#sourceUpdated").textContent = `本系统抓取 ${formatDateTime(intelligence.updated_at)} · Apple 官方更新时间未知`;
  $("#sourceUpdated").dateTime = intelligence.updated_at;
  $("#trendSummary").textContent = trend.summary;
  $("#trendEvidence").textContent = `证据：${trend.evidence.join("、")} · ${trend.window.points} 个观测点`;
  $("#competitorList").innerHTML = intelligence.analysis.competitors.map((item) =>
    `<li><strong>${item.name}</strong><span>${item.reason} · 增速 ${hasValue(item.growth_rate) ? `${item.growth_rate > 0 ? "+" : ""}${item.growth_rate}%` : "/"}</span></li>`
  ).join("") || "<li>暂无可比产品</li>";
  $("#riskList").innerHTML = intelligence.analysis.risks.map((item) =>
    `<li><span class="risk-level ${item.level}">${item.level}</span><span>${item.summary}</span></li>`
  ).join("") || "<li>证据不足，尚不能评估风险</li>";
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
    rank: { title: `${game.board_label}观测`, value: hasValue(latest?.rank) ? `第 ${formatNumber(latest.rank)} 名` : "暂无数据", delta: validPoints.length < 2 ? "单次观测，暂无趋势" : `${rankChange >= 0 ? "上升" : "下降"} ${Math.abs(rankChange)} 位` },
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
  const labels = { revenue: "收入", downloads: "下载", rank: `${state.selected?.board_label || "榜单"}排名` };
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
  empty.textContent = points.length ? `所选区间暂无${{ revenue: "收入", downloads: "下载", rank: state.selected?.board_label || "榜单" }[metric]}数据` : "所选时间区间暂无观测数据";
  $("#chartAxis").innerHTML = points.length ? points.map(point => `<span>${dateLabel(point.date)}</span>`).join("") : `<span>${dateLabel(state.startDate)}</span><span>${dateLabel(state.endDate)}</span>`;
}

let debounce;
$("#filterForm").addEventListener("input", () => { clearTimeout(debounce); debounce = setTimeout(loadGames, 180); });
$("#resetFilters").addEventListener("click", () => { $("#filterForm").reset(); loadGames(); });
$("#opportunityCountry").addEventListener("change", renderOpportunityBoard);
$("#opportunityChart").addEventListener("change", renderOpportunityBoard);
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
  const report = $("#assistantAnswer");
  const reportStatus = $("#assistantReportStatus");
  report.className = "assistant-report-output is-loading";
  report.textContent = "正在检索已发布的只读榜单快照…";
  reportStatus.textContent = "检索中";
  try {
    const data = await getJSON("/api/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
    if (!["evidence_fact", "clarification", "insufficient_evidence"].includes(data.status) || typeof data.answer !== "string")
      throw new Error("公开站问答状态异常，未展示未经核实的结果");
    report.className = "assistant-report-output is-ready";
    report.textContent = data.answer;
    reportStatus.textContent = data.status === "evidence_fact" ? "榜单事实 · 非投资建议"
      : data.status === "clarification" ? "请补充查询范围" : "证据不足";
  } catch (error) {
    report.className = "assistant-report-output is-ready";
    report.textContent = error.message;
    reportStatus.textContent = "生成失败";
  }
});
$(".menu-button").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
window.addEventListener("resize", () => state.selected && drawChart(selectedTrendPoints(), state.metric));
Promise.all([loadOverview(), loadGames(), loadOpportunityBoard()]).catch(error => { $("#dataNoticeText").textContent = `加载失败：${error.message}`; });
