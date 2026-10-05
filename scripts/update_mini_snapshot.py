"""Publish only the public mini-game ranking fields, never source internals."""

import json
from datetime import datetime, time as clock_time, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen

from mini_intelligence import MiniIntelligenceService


BASE = "http://106.54.20.29:8088/api/dataeye/mini/"
DESTINATION = Path(__file__).resolve().parents[1] / "mini-ranking-snapshot.json"
INTELLIGENCE_DESTINATIONS = {
    provider: DESTINATION.parent / f"mini-intelligence-{provider}.json"
    for provider in ("all", "douyin", "wechat")
}
ROW_FIELDS = (
    "rank_type", "rank", "external_id", "game_name", "publisher", "rank_change",
    "observed_at", "source_date", "new_entry", "description",
)
RUN_FIELDS = (
    "provider", "ranking_type", "period", "status", "started_at", "record_count",
    "error", "billing",
)
CHINA_TIME = timezone(timedelta(hours=8))
COLLECTION_TIME = clock_time(10, 10)


def expected_source_day(now=None):
    local = (now or datetime.now(timezone.utc)).astimezone(CHINA_TIME)
    day = local.date() if local.time() >= COLLECTION_TIME else local.date() - timedelta(days=1)
    return day.isoformat()


def is_stale(observed_at, source_date=None, upstream_stale=False, now=None):
    if upstream_stale or not observed_at:
        return True
    try:
        observed = datetime.fromisoformat(observed_at.replace("Z", "+00:00"))
        if observed.tzinfo is None:
            return True
        current = now or datetime.now(timezone.utc)
        day = source_date or observed.astimezone(CHINA_TIME).date().isoformat()
        return day < expected_source_day(current) or (observed - current).total_seconds() > 5 * 60
    except (TypeError, ValueError, AttributeError):
        return True


def fetch(name):
    request = Request(BASE + name, headers={"Accept": "application/json", "User-Agent": "GamePulse-PublicSnapshot/1.0"})
    with urlopen(request, timeout=15) as response:
        if response.status != 200:
            raise RuntimeError(f"upstream HTTP {response.status}")
        payload = json.load(response)
    if not isinstance(payload, dict):
        raise ValueError("upstream payload must be an object")
    return payload


def build():
    raw_status = fetch("status")
    raw_config = raw_status.get("config") if isinstance(raw_status.get("config"), dict) else {}
    boards = raw_config.get("boards") if isinstance(raw_config.get("boards"), dict) else {}
    providers = {}
    for provider in ("douyin", "wechat"):
        source = fetch("latest?provider=" + provider)
        rows = source.get("rows") if isinstance(source.get("rows"), list) else []
        providers[provider] = {
            "provider": provider,
            "observed_at": source.get("observed_at"),
            "source_date": source.get("source_date"),
            "upstream_stale": bool(source.get("stale") or
                                   (source.get("connection") if isinstance(source.get("connection"), dict) else {}).get("stale")),
            "rows": [{field: row.get(field) for field in ROW_FIELDS} for row in rows if isinstance(row, dict)][:100],
        }
    runs = raw_status.get("last_runs") if isinstance(raw_status.get("last_runs"), list) else []
    provider_times = {provider: item.get("observed_at") for provider, item in providers.items()}
    provider_stale = {provider: is_stale(provider_times[provider], item.get("source_date"),
                                       bool(raw_status.get("stale") or item.get("upstream_stale")))
                      for provider, item in providers.items()}
    latest_time = max((value or "" for value in provider_times.values()), default="") or None
    return {
        "source": {"name": "GameScope / DataEye ADX", "mode": "published_read_only_snapshot", "real_data": True},
        "connection": {"state": "published_snapshot", "fetched_at": latest_time,
                       "provider_observed_at": provider_times, "provider_stale": provider_stale,
                       "stale": any(provider_stale.values()),
                       "warning": "公开体验站每天北京时间 10:10 读取一次源站已保存榜单；未取得当日观测时保留最后成功快照。"},
        "status": {
            "configured": bool(raw_status.get("configured")), "running": bool(raw_status.get("running")),
            "transport": raw_status.get("transport"), "period": raw_status.get("period"),
            "config": {"enabled": bool(raw_config.get("enabled")), "topN": raw_config.get("topN"),
                       "boards": {provider: list(boards.get(provider) or []) for provider in providers},
                       "daily_call_limit": raw_config.get("daily_call_limit")},
            "update_time": raw_status.get("update_time"), "calls_today": raw_status.get("calls_today"),
            "last_runs": [{field: run.get(field) for field in RUN_FIELDS} for run in runs if isinstance(run, dict)],
            "public_read_only": True,
        },
        "providers": providers,
    }


def main():
    now = datetime.now(timezone.utc)
    local = now.astimezone(CHINA_TIME)
    if local.time() < COLLECTION_TIME:
        print("daily mini snapshot window has not opened")
        return
    if DESTINATION.is_file():
        try:
            existing = json.loads(DESTINATION.read_text(encoding="utf-8"))
            if existing.get("connection", {}).get("checked_on") == local.date().isoformat():
                print("daily mini snapshot already checked today")
                return
        except (OSError, ValueError, AttributeError):
            pass
    payload = build()
    if not all(payload["providers"][provider]["rows"] for provider in ("douyin", "wechat")):
        raise RuntimeError("refusing to replace last successful snapshot with an empty result")
    payload["connection"]["checked_on"] = local.date().isoformat()
    write_if_changed(DESTINATION, payload)
    intelligence = MiniIntelligenceService()
    for provider, path in INTELLIGENCE_DESTINATIONS.items():
        write_if_changed(path, intelligence.analyze(payload, provider))
    print(json.dumps({"douyin": len(payload["providers"]["douyin"]["rows"]),
                      "wechat": len(payload["providers"]["wechat"]["rows"]),
                      "source_date": {key: item["source_date"] for key, item in payload["providers"].items()}}, ensure_ascii=False))


def write_if_changed(path, payload):
    new_text = json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
    if not path.exists() or path.read_text(encoding="utf-8") != new_text:
        path.write_text(new_text, encoding="utf-8")


if __name__ == "__main__":
    main()
