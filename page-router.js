(() => {
  "use strict";

  const content = document.getElementById("overview");
  const topbarTitle = document.querySelector(".topbar h1");
  if (!content) return;

  const pageMap = {
    overview: { title: "游戏商业机会雷达", selectors: ["#dataNotice", ".hero-grid", ".metric-grid"] },
    games: { title: "游戏雷达", selectors: ["#games", "#product-analysis"] },
    opportunities: { title: "机会洞察", selectors: ["#opportunities", ".intel-grid"] },
    "development-decision": { title: "开发决策", selectors: ["#development-decision"] },
    "data-sources": { title: "数据来源", selectors: ["#data-sources"] },
    assistant: { title: "智能分析", selectors: ["#assistant"] },
  };
  const externalRoutes = new Set(["mini-game-rankings", "mini-game-intelligence"]);
  const externalTitles = { "mini-game-rankings": "小游戏真实榜单", "mini-game-intelligence": "小游戏情报" };
  const pageChildren = [...content.children];

  function syncPage() {
    const requested = location.hash.slice(1) || "overview";
    const route = pageMap[requested] ? requested : (externalRoutes.has(requested) ? requested : "overview");
    const external = externalRoutes.has(route);
    content.hidden = external;
    pageChildren.forEach((child) => {
      child.hidden = !external && !pageMap[route]?.selectors.some((selector) => child.matches(selector));
    });
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.getAttribute("href") === `#${route}`));
    if (topbarTitle) topbarTitle.textContent = external ? externalTitles[route] : pageMap[route].title;
    document.body.dataset.page = route;
    document.getElementById("development-decision")?.classList.toggle("route-page-active", route === "development-decision");
    document.querySelector(".sidebar")?.classList.remove("open");
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", syncPage);
  syncPage();
})();
