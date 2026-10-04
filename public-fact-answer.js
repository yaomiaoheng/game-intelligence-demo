// Deterministic answers from the two already-published, read-only snapshots.
// This is not a model, a live collector, or a commercial opportunity scorer.
(() => {
  "use strict";

  const MAX_LIST = 10;
  const FRESH_MS = 12 * 60 * 60 * 1000;
  const APPLE_BOARDS = {"免费榜": "top-free", "付费榜": "top-paid", "畅销榜": "top-grossing"};
  const MINI_BOARDS = {"畅销榜": "bestsellerList", "人气榜": "popularityList",
    "新游榜": "freshGameList", "畅玩榜": "mostPlayedList"};
  const APPLE_COUNTRIES = {"中国": "CN", "美国": "US", "日本": "JP", "英国": "GB", "韩国": "KR",
    "中国台湾": "TW", "台湾": "TW", "中国香港": "HK", "香港": "HK", "新加坡": "SG",
    "CN": "CN", "US": "US", "JP": "JP", "GB": "GB", "KR": "KR", "TW": "TW", "HK": "HK", "SG": "SG"};
  const MINI_PROVIDERS = {"抖音": "douyin", "微信": "wechat"};
  const APPLE_LABEL = {CN: "中国", US: "美国", JP: "日本", GB: "英国", KR: "韩国",
    TW: "中国台湾", HK: "中国香港", SG: "新加坡"};
  const FORBIDDEN = /收入|营收|下载|销量|销售额|留存|增速|增长率|市场趋势|趋势预测|预测|潜力|立项|投资|成功率|成功概率|推荐方案|最火|最热门|玩法|运营表现|评分|评论|忽略.*指令|绕过|密码|cookie|token/i;

  function reply(status, answer, evidence = []) {
    return {status, answer, evidence, evidence_count: evidence.length,
      methodology: "仅从已发布脱敏快照确定性检索；名次不推算下载、收入或增长。"};
  }

  function stale(at, upstream = false, now = Date.now()) {
    const time = Date.parse(at || "");
    return Boolean(upstream) || !Number.isFinite(time) || now - time > FRESH_MS || time - now > 5 * 60 * 1000;
  }

  async function read(fetcher, filename) {
    const url = new URL(`./${filename}`, window.location.href);
    url.searchParams.set("_", String(Date.now()));
    const response = await fetcher(new Request(url, {cache: "no-store"}));
    if (!response.ok) throw new Error("published snapshot unavailable");
    return response.json();
  }

  function sourceScope(query) {
    const apple = /App\s*Store|Apple|苹果|iOS/i.test(query);
    const mini = /小游戏|抖音|微信/.test(query);
    if (apple && mini) return "both";
    if (apple) return "apple";
    if (mini) return "mini";
    return null;
  }

  function findChoice(query, choices) {
    return Object.entries(choices).filter(([label]) => query.includes(label))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] || null;
  }

  function itemCount(rows) {
    return rows.filter(row => Number.isInteger(row?.rank) && row.rank >= 1 && row.rank <= 100).length;
  }

  function coverage(apple, mini, now) {
    const parts = [];
    if (Array.isArray(apple?.charts)) {
      const count = apple.charts.reduce((sum, chart) => sum + itemCount(chart.items || []), 0);
      const old = apple.charts.filter(chart => stale(chart.observed_at, chart.stale || chart.status !== "live", now)).length;
      parts.push(`Apple Games RSS：${apple.charts.length} 张榜、${count} 条实际名次；${old ? `${old} 张为旧快照或失效` : "本系统抓取未超过 12 小时"}。Apple 官方榜单更新时间未知。`);
    } else parts.push("Apple 榜单快照当前无法读取。 ");
    if (mini?.providers && typeof mini.providers === "object") {
      const rows = Object.entries(mini.providers).flatMap(([provider, value]) =>
        (Array.isArray(value?.rows) ? value.rows : []).map(row => ({provider, ...row})));
      const boards = new Set(rows.map(row => `${row.provider}|${row.rank_type}`));
      const observed = rows.map(row => row.source_date).filter(Boolean).sort().at(-1) || "未知";
      parts.push(`DataEye 小游戏已保存日榜：${boards.size} 张榜、${rows.length} 条实际名次；来源观测日 ${observed}${mini.connection?.stale ? "，当前为旧快照" : ""}。不是实时同步。`);
    } else parts.push("小游戏榜单快照当前无法读取。 ");
    if (!Array.isArray(apple?.charts) && !mini?.providers)
      return reply("insufficient_evidence", "两份公开快照当前均无法读取；不使用演示数据替代。 ");
    return reply("evidence_fact", parts.join("\n") + "缺失的收入、下载和市场趋势不补造。 ");
  }

  function exactMatch(rows, query, idField, nameField) {
    const explicitId = /(?:App\s*ID|应用\s*ID|游戏\s*ID)\s*[:：#]?\s*(\d{5,})/i.exec(query)?.[1];
    if (explicitId) return rows.filter(row => String(row[idField] || "") === explicitId);
    const matches = rows.filter(row => {
      const name = String(row[nameField] || "").trim();
      return name.length >= 2 && query.toLocaleLowerCase().includes(name.toLocaleLowerCase());
    });
    if (!matches.length) return [];
    const longest = Math.max(...matches.map(row => String(row[nameField]).length));
    return matches.filter(row => String(row[nameField]).length === longest);
  }

  function chartAnswer(query, chart, details, now) {
    const rows = (Array.isArray(chart?.items) ? chart.items : [])
      .filter(row => Number.isInteger(row.rank) && row.rank >= 1 && row.rank <= 100)
      .sort((a, b) => a.rank - b.rank);
    const prefix = `${details.scope} ${details.boardLabel}`;
    const old = stale(details.observedAt, details.upstreamStale, now);
    const provenance = `来源：${details.source}；${details.timeKind}：${details.observedAt || "未知"}；${old ? "旧快照" : "本系统抓取未超过 12 小时"}。${details.caveat}`;
    const top = /(?:前|top)\s*(\d{1,3})\s*(?:名|条)?/i.exec(query);
    if (top) {
      const requested = Number(top[1]);
      if (!requested || requested > MAX_LIST) return reply("clarification", `问答一次最多列出 ${MAX_LIST} 条；完整榜单请到相应榜单页面查看。`);
      const selected = rows.slice(0, requested);
      if (!selected.length) return reply("insufficient_evidence", `${prefix}当前已发布快照没有可用名次。${provenance}`);
      const evidence = selected.map(row => ({name: row[details.nameField], rank: row.rank,
        source_id: details.sourceId, observed_at: details.observedAt,
        source_url: details.sourceUrl(row)}));
      const names = evidence.map(item => `第 ${item.rank} 名 ${item.name}`).join("；");
      return reply("evidence_fact", `${prefix}：当前快照实际收录 ${rows.length} 条；${names}。\n${provenance}名次不代表下载量、收入或增长。`, evidence);
    }
    if (!/排名|名次|第几名|排第几/.test(query)) {
      return reply("clarification", `请指定 ${prefix}的游戏名或 App ID 查询名次，或询问“前 5 名”。`);
    }
    const matches = exactMatch(rows, query, details.idField, details.nameField);
    if (!matches.length) return reply("insufficient_evidence", `${prefix}当前已发布快照未收录该游戏；这不表示它在市场上不存在。${provenance}`);
    const identities = new Set(matches.map(row => String(row[details.idField] || "") + "|" + row[details.nameField]));
    if (identities.size > 1) return reply("clarification", "同名游戏在当前榜单有多个身份；请补充 App ID 或游戏 ID。 ");
    const row = matches[0];
    const evidence = [{name: row[details.nameField], rank: row.rank,
      source_id: details.sourceId, observed_at: details.observedAt,
      source_url: details.sourceUrl(row)}];
    return reply("evidence_fact", `${row[details.nameField]}在${prefix}当前已发布快照中排第 ${row.rank} 名。\n${provenance}名次不代表下载量、收入或增长。`, evidence);
  }

  function crossMarketAnswer(query, snapshot, now) {
    const board = findChoice(query, APPLE_BOARDS);
    const charts = (snapshot?.charts || []).filter(chart => APPLE_LABEL[chart.country] &&
      (!board || chart.chart === board));
    const groups = new Map();
    for (const chart of charts) {
      for (const row of chart.items || []) {
        const id = String(row.app_store_id || "");
        if (!/^\d+$/.test(id) || !row.name || !Number.isInteger(row.rank) || row.rank < 1 || row.rank > 100) continue;
        if (!groups.has(id)) groups.set(id, {id, name: row.name, entries: [], regions: new Set()});
        const game = groups.get(id);
        game.regions.add(chart.country);
        game.entries.push({country: chart.country, chart: chart.chart, rank: row.rank,
          observed_at: chart.observed_at, stale: stale(chart.observed_at, chart.stale || chart.status !== "live", now),
          source_url: /^https:\/\/apps\.apple\.com\//.test(row.source_url || "") ? row.source_url : null});
      }
    }
    const all = [...groups.values()];
    const matches = exactMatch(all, query, "id", "name");
    const requestedId = /(?:App\s*ID|应用\s*ID)\s*[:：#]?\s*(\d{5,})/i.test(query);
    if (requestedId && !matches.length) return reply("insufficient_evidence", "所查 App ID 未出现在当前已发布的 Apple 游戏榜单快照；这不表示它不在市场上。 ");
    if (matches.length) {
      const ids = new Set(matches.map(game => game.id));
      if (ids.size > 1) return reply("clarification", "同名游戏对应多个 App ID；请用 App ID 指定要核查的游戏。 ");
      const game = matches[0];
      const entries = game.entries.sort((a, b) => a.country.localeCompare(b.country) || a.chart.localeCompare(b.chart));
      const facts = entries.map(item => `${APPLE_LABEL[item.country]}${Object.keys(APPLE_BOARDS).find(label => APPLE_BOARDS[label] === item.chart)}第 ${item.rank} 名${item.stale ? "（旧快照）" : ""}`);
      return reply("evidence_fact", `${game.name}（App ID ${game.id}）在当前已发布快照中覆盖 ${game.regions.size} 个地区、${entries.length} 张榜：${facts.join("；")}。\n这是同一 Apple 榜单来源的本系统抓取观察，不是多个独立来源；Apple 官方更新时间未知，不能推断收入、下载、增长或市场潜力。`,
        entries.map(item => ({name: game.name, app_store_id: game.id, country: item.country,
          chart: item.chart, rank: item.rank, source_id: "apple-games-rss",
          observed_at: item.observed_at, stale: item.stale, source_url: item.source_url})));
    }
    const top = /(?:前|top)\s*(\d{1,3})\s*(?:名|条)?/i.exec(query);
    const limit = top ? Number(top[1]) : 5;
    if (!limit || limit > MAX_LIST) return reply("clarification", `一次最多列出 ${MAX_LIST} 款跨地区在榜游戏，请缩小数量。`);
    const repeated = all.filter(game => game.regions.size >= 2)
      .sort((a, b) => b.regions.size - a.regions.size || b.entries.length - a.entries.length || a.name.localeCompare(b.name))
      .slice(0, limit);
    if (!repeated.length) return reply("insufficient_evidence", "当前已发布的 Apple 游戏榜单快照没有同一 App ID 跨地区在榜记录；不以同名推测是同一游戏。 ");
    const facts = repeated.map(game => `${game.name}（App ID ${game.id}）：${game.regions.size} 个地区、${game.entries.length} 张榜`);
    const oldCount = charts.filter(chart => stale(chart.observed_at, chart.stale || chart.status !== "live", now)).length;
    return reply("evidence_fact", `按同一 App ID 合并，当前 Apple 游戏${board ? `${Object.keys(APPLE_BOARDS).find(label => APPLE_BOARDS[label] === board)}` : "各类榜单"}快照中跨地区在榜的前 ${repeated.length} 款：${facts.join("；")}。\n覆盖 ${charts.length} 张榜${oldCount ? `，其中 ${oldCount} 张为旧快照` : ""}；Apple 官方更新时间未知。这是单一来源的榜单覆盖统计，不是独立证据交叉验证，也不能推断收入、下载、增长或开发潜力。`,
      repeated.map(game => ({name: game.name, app_store_id: game.id,
        countries: [...game.regions], chart_count: game.entries.length,
        source_id: "apple-games-rss", observed_at: snapshot.published_at || null})));
  }

  async function answer(rawQuery, fetcher, options = {}) {
    const query = String(rawQuery || "").trim();
    if (!query || query.length > 200) return reply("clarification", "请用 200 字以内的问题指定平台、地区、榜单与游戏。 ");
    if (FORBIDDEN.test(query)) return reply("insufficient_evidence", "已发布快照只能证明榜单名次和覆盖范围，不能回答收入、下载、增长、玩法、预测、投资或确定性开发建议。请查看开发决策的待验证研究方案。 ");
    const now = options.now ?? Date.now();
    const scope = sourceScope(query);
    if (!scope || scope === "both" || /数据来源|数据状态|覆盖|多少条|多少张/.test(query)) {
      const snapshots = await Promise.allSettled([
        options.appleEnabled === false ? Promise.resolve(null) : read(fetcher, "apple-game-charts.json"),
        read(fetcher, "mini-ranking-snapshot.json"),
      ]);
      if (!scope && !/数据来源|数据状态|覆盖|多少条|多少张/.test(query))
        return reply("clarification", "请说明要查 App Store 还是抖音/微信小游戏，并指定地区与榜单。 ");
      return coverage(snapshots[0].status === "fulfilled" ? snapshots[0].value : null,
        snapshots[1].status === "fulfilled" ? snapshots[1].value : null, now);
    }
    if (scope === "apple") {
      if (options.appleEnabled === false) return reply("insufficient_evidence", "公开 Apple 榜单读取已关闭，当前不提供该来源的问答。 ");
      const crossMarket = /多(?:个)?地区|多个国家|跨(?:地区|市场)|哪些地区|多少(?:个)?地区/.test(query);
      if (crossMarket) {
        let snapshot;
        try { snapshot = await read(fetcher, "apple-game-charts.json"); }
        catch { return reply("insufficient_evidence", "Apple 榜单快照当前读取失败；未使用演示数据替代。 "); }
        return crossMarketAnswer(query, snapshot, now);
      }
      const country = findChoice(query, APPLE_COUNTRIES);
      const board = findChoice(query, APPLE_BOARDS);
      if (!country || !board) return reply("clarification", "请指定 App Store 地区（中国/美国/日本/英国/韩国/中国台湾/中国香港/新加坡）和榜单（免费/付费/畅销）。 ");
      let snapshot;
      try { snapshot = await read(fetcher, "apple-game-charts.json"); }
      catch { return reply("insufficient_evidence", "Apple 榜单快照当前读取失败；未使用演示或旧的内置数据代替。 "); }
      const chart = (snapshot?.charts || []).find(item => item.country === country && item.chart === board);
      if (!chart) return reply("insufficient_evidence", "当前已发布快照没有该国家与榜单组合；不能推断其名次。 ");
      return chartAnswer(query, chart, {scope: `${APPLE_LABEL[country]} App Store`,
        boardLabel: Object.keys(APPLE_BOARDS).find(label => APPLE_BOARDS[label] === board),
        source: "Apple Games RSS", sourceId: "apple-games-rss", observedAt: chart.observed_at,
        upstreamStale: chart.stale || chart.status !== "live", timeKind: "本系统抓取时间",
        caveat: "Apple 官方榜单更新时间未知。", nameField: "name", idField: "app_store_id",
        sourceUrl: row => /^https:\/\/apps\.apple\.com\//.test(row.source_url || "") ? row.source_url : null}, now);
    }
    const provider = findChoice(query, MINI_PROVIDERS);
    const board = findChoice(query, MINI_BOARDS);
    if (!provider || !board) return reply("clarification", "请指定抖音或微信小游戏，以及畅销、人气、新游或畅玩榜。 ");
    let snapshot;
    try { snapshot = await read(fetcher, "mini-ranking-snapshot.json"); }
    catch { return reply("insufficient_evidence", "小游戏榜单快照当前读取失败；未使用演示数据代替。 "); }
    const providerSnapshot = snapshot?.providers?.[provider];
    if (!providerSnapshot) return reply("insufficient_evidence", "当前已发布快照没有该小游戏平台。 ");
    const rows = (providerSnapshot.rows || []).filter(row => row.rank_type === board);
    return chartAnswer(query, {items: rows}, {scope: provider === "douyin" ? "抖音小游戏" : "微信小游戏",
      boardLabel: Object.keys(MINI_BOARDS).find(label => MINI_BOARDS[label] === board),
      source: "DataEye 小游戏已保存日榜", sourceId: "dataeye-mini-rankings",
      observedAt: rows[0]?.source_date || providerSnapshot.observed_at,
      upstreamStale: snapshot.connection?.stale || providerSnapshot.stale,
      timeKind: "来源观察日", caveat: "这是已保存的日榜快照，不是实时同步。",
      nameField: "game_name", idField: "external_id", sourceUrl: () => null}, now);
  }

  window.PublicFactAnswer = {answer};
})();
