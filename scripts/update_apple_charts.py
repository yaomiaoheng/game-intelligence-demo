"""Publish a small, source-linked Apple Games chart snapshot without credentials."""

from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

COUNTRIES = ("CN", "US", "JP", "GB", "KR", "TW", "HK", "SG")
CHARTS = {"top-free": "topfreeapplications", "top-paid": "toppaidapplications",
          "top-grossing": "topgrossingapplications"}


def fetch_chart(country: str, chart: str) -> dict:
    url = f"https://itunes.apple.com/{country.lower()}/rss/{CHARTS[chart]}/limit=100/genre=6014/json"
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "GamePulse-PublicGameCharts/1.0"})
    with urlopen(request, timeout=18) as response:
        payload = json.load(response)
    entries = (payload.get("feed") or {}).get("entry")
    if not isinstance(entries, list) or not 1 <= len(entries) <= 100:
        raise ValueError("Apple feed returned no valid game entries")
    items, seen = [], set()
    for rank, entry in enumerate(entries, 1):
        identity = entry.get("id") or {}
        app_id = str((identity.get("attributes") or {}).get("im:id") or "")
        app_url = identity.get("label")
        name = (entry.get("im:name") or {}).get("label")
        category = (entry.get("category") or {}).get("attributes") or {}
        if (not app_id.isdecimal() or app_id in seen or not name or
                category.get("im:id") != "6014" or
                urlparse(app_url or "").hostname != "apps.apple.com"):
            raise ValueError("Apple feed contains a malformed, duplicate or non-game item")
        seen.add(app_id)
        items.append({"app_store_id": int(app_id), "rank": rank, "name": name,
                      "publisher": (entry.get("im:artist") or {}).get("label"),
                      "source_url": app_url})
    return {"country": country, "chart": chart,
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "observed_at_kind": "fetch_time", "source_updated_at": None,
            "status": "live", "stale": False, "items": items}


def update(path: Path) -> dict:
    previous = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    old = {(item["country"], item["chart"]): item for item in previous.get("charts", [])
           if isinstance(item, dict) and item.get("country") and item.get("chart")}
    charts, errors = [], {}
    for country in COUNTRIES:
        for chart in CHARTS:
            key = (country, chart)
            try:
                charts.append(fetch_chart(country, chart))
            except (OSError, ValueError, KeyError, TypeError) as exc:
                errors[f"{country}:{chart}"] = type(exc).__name__
                if key in old and old[key].get("items"):
                    charts.append({**old[key], "status": "stale", "stale": True})
            time.sleep(3.2)
    if not charts:
        raise RuntimeError("No successful Apple chart; preserving previous publication")
    result = {"source": {"id": "apple-app-store", "label": "Apple App Store Games Chart",
                         "mode": "public_read_only"},
              "charts": charts, "errors": errors,
              "published_at": datetime.now(timezone.utc).isoformat(),
              "scope_note": "仅游戏分类榜单；观察时间为抓取时间，非 Apple 官方更新时间；榜单名次不是下载量或收入。"}
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    temporary.replace(path)
    return result


if __name__ == "__main__":
    destination = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("apple-game-charts.json")
    result = update(destination)
    print(json.dumps({"charts": len(result["charts"]), "records": sum(len(item["items"]) for item in result["charts"]),
                      "errors": result["errors"]}, ensure_ascii=False))
