"""Explainable mini-game intelligence derived only from ranking snapshots."""

from __future__ import annotations

from collections import Counter, defaultdict


BOARD_LABELS = {
    "bestsellerList": "畅销榜",
    "popularityList": "人气榜",
    "freshGameList": "新游榜",
    "mostPlayedList": "畅玩榜",
}
PROVIDER_LABELS = {"douyin": "抖音小游戏", "wechat": "微信小游戏"}
TYPE_PRIORITY = {"new": 0, "rise": 1, "fall": 2, "leader": 3}


def _rank_text(row: dict) -> str:
    change = row.get("rank_change")
    if row.get("new_entry"):
        movement = " · 新进榜"
    elif isinstance(change, (int, float)) and change:
        movement = f" · {'↑' if change > 0 else '↓'}{abs(int(change))}位"
    else:
        movement = ""
    return f"{PROVIDER_LABELS.get(row.get('provider'), row.get('provider'))} · {BOARD_LABELS.get(row.get('rank_type'), row.get('rank_type'))} #{row.get('rank')}{movement}"


def _classify(rows: list[dict]):
    fresh = [row for row in rows if row.get("rank_type") == "freshGameList" and row.get("rank", 999) <= 10]
    new_entries = [row for row in rows if row.get("new_entry")]
    rises = [row for row in rows if isinstance(row.get("rank_change"), (int, float)) and row["rank_change"] >= 3]
    falls = [row for row in rows if isinstance(row.get("rank_change"), (int, float)) and row["rank_change"] <= -3]
    leaders = [row for row in rows if isinstance(row.get("rank"), (int, float)) and row["rank"] <= 3]
    if fresh or new_entries:
        candidates = fresh or new_entries
        return "new", min(candidates, key=lambda row: (row.get("rank", 999), not row.get("new_entry")))
    if rises:
        return "rise", max(rises, key=lambda row: (row.get("rank_change", 0), -row.get("rank", 999)))
    if falls:
        return "fall", min(falls, key=lambda row: (row.get("rank_change", 0), row.get("rank", 999)))
    if leaders:
        return "leader", min(leaders, key=lambda row: row.get("rank", 999))
    return None, None


def _copy_for(signal_type: str) -> dict:
    return {
        "new": {
            "conclusion": "进入新游榜前十或被来源标注为新进榜，纳入新品测试观察池；上线时间待核验。",
            "development": "拆解首局体验与核心循环，验证玩法差异。",
            "publishing": "加入新品观察池，小预算测试题材与素材。",
            "operations": "跟踪后续榜单，补齐留存与付费验证。",
        },
        "rise": {
            "conclusion": "来源排名明显走强，列入短期重点观察；变化原因仍需结合产品和投放事件核验。",
            "development": "拆解玩法循环与近期版本，验证可借鉴机制。",
            "publishing": "核对素材和投放节奏，小预算验证卖点。",
            "operations": "连续跟踪榜单并对照活动、版本与用户反馈。",
        },
        "fall": {
            "conclusion": "来源排名明显回落，应先识别短期波动或产品问题，再决定是否调整方向。",
            "development": "检查首局、成长与内容消耗问题，不直接照搬。",
            "publishing": "复核素材衰减、流量结构和获客成本。",
            "operations": "对照活动结束、版本反馈和留存变化排查原因。",
        },
        "leader": {
            "conclusion": "位于来源榜单头部，可作为产品对标样本；头部名次不代表可复制的商业结果。",
            "development": "拆解核心循环、内容结构和差异化边界。",
            "publishing": "分析题材表达和素材卖点，避免只复制表层包装。",
            "operations": "观察长期榜单稳定性，并补齐活动与用户反馈。",
        },
    }[signal_type]


def _brief(item: dict, focus: str) -> str:
    description = item.get("source_description")
    source_copy = f"榜单描述为“{description}”。" if description else "来源未提供玩法、题材或画风描述，不作事实推断。"
    prefix = f"{item['as_of']}，{item['game_name']}的榜单信号为：{item['evidence']}。{source_copy}结论：{item['conclusion']}"
    if focus == "development":
        body = f"立项建议：{item['actions']['development']}先用可玩原型和用户测试核验理解成本、游玩意愿与留存，再评估内容产能和研发投入。"
    elif focus == "publishing":
        body = f"发行建议：{item['actions']['publishing']}以相同预算做素材对照，补齐点击、转化、获客成本和回收周期后再决定是否放量。"
    elif focus == "operations":
        body = f"运营建议：{item['actions']['operations']}不把名次变化直接归因于活动，并用真实活跃、留存和付费反馈验证。"
    else:
        body = f"研发方面，{item['actions']['development']}发行方面，{item['actions']['publishing']}运营方面，{item['actions']['operations']}"
    return f"{prefix}{body}排名不等于收入或留存；以上建议均是待验证假设。"


class MiniIntelligenceService:
    """Create deterministic decision signals without inventing missing metrics."""

    def analyze(self, snapshot: dict, provider: str = "all") -> dict:
        if provider not in {"all", "douyin", "wechat"}:
            raise ValueError("provider 必须是 all、douyin 或 wechat")

        provider_ids = ("douyin", "wechat") if provider == "all" else (provider,)
        valid_rows = []
        invalid_records = 0
        boards = []
        for provider_id in provider_ids:
            payload = snapshot.get("providers", {}).get(provider_id) or {}
            rows = payload.get("rows") if isinstance(payload.get("rows"), list) else []
            board_groups = defaultdict(list)
            for source_row in rows:
                row = dict(source_row) if isinstance(source_row, dict) else {}
                row["provider"] = provider_id
                required = (row.get("source_date"), row.get("rank_type"), row.get("rank"), row.get("game_name"), row.get("external_id"))
                if any(value is None or value == "" for value in required):
                    invalid_records += 1
                    continue
                valid_rows.append(row)
                board_groups[row["rank_type"]].append(row)
            for board_type, board_rows in board_groups.items():
                boards.append({
                    "provider": provider_id,
                    "board": board_type,
                    "label": BOARD_LABELS.get(board_type, board_type),
                    "source_date": max(row["source_date"] for row in board_rows),
                    "records": len(board_rows),
                })

        latest = max((row["source_date"] for row in valid_rows), default=None)
        product_groups = defaultdict(list)
        for row in valid_rows:
            product_groups[(row["provider"], str(row["external_id"]), row["source_date"])].append(row)

        items = []
        for (provider_id, external_id, source_date), rows in product_groups.items():
            signal_type, primary = _classify(rows)
            if not primary:
                continue
            copy = _copy_for(signal_type)
            supporting_rows = sorted(
                (row for row in rows if row is not primary),
                key=lambda row: (row.get("rank", 999), BOARD_LABELS.get(row.get("rank_type"), "")),
            )
            item = {
                "id": f"{provider_id}|{external_id}|{source_date}",
                "provider": provider_id,
                "board": primary["rank_type"],
                "game_name": primary["game_name"],
                "external_id": external_id,
                "publisher": primary.get("publisher"),
                "source_description": primary.get("description") or next((row.get("description") for row in rows if row.get("description")), None),
                "as_of": source_date,
                "type": signal_type,
                "rank": primary["rank"],
                "rank_change": primary.get("rank_change"),
                "new_entry": bool(primary.get("new_entry")),
                "evidence": _rank_text(primary),
                "support": [_rank_text(row) for row in supporting_rows],
                "sources": ["DataEye 官方 MCP · 小游戏榜单"],
                "actions": {key: copy[key] for key in ("development", "publishing", "operations")},
                "conclusion": copy["conclusion"],
                "risk": "仅凭榜单不能确认收入、留存、利润或增长原因；建议是待验证假设。",
                "stale": bool(latest and source_date != latest),
            }
            item["briefs"] = {focus: _brief(item, focus) for focus in ("combined", "development", "publishing", "operations")}
            items.append(item)

        items.sort(key=lambda item: (TYPE_PRIORITY[item["type"]], item["stale"], item["rank"], item["game_name"]))
        counts = Counter(item["type"] for item in items)
        featured = max(
            items,
            key=lambda item: (
                item["as_of"] == latest,
                bool(item.get("source_description")),
                item["type"] == "rise",
                -item["rank"],
                abs(item.get("rank_change") or 0),
            ),
            default=None,
        )
        return {
            "scope": "mini_game_rankings_only",
            "latest_featured_id": featured["id"] if featured else None,
            "provider": provider,
            "latest_available": latest,
            "latest": latest,
            "boards": sorted(boards, key=lambda board: (board["provider"], board["label"])),
            "records": len(valid_rows),
            "invalid_records": invalid_records,
            "items": items,
            "counts": {signal_type: counts.get(signal_type, 0) for signal_type in ("new", "rise", "fall", "leader")},
            "method": "仅参考“小游戏榜单”的最新成功快照；排名变化沿用来源字段，不另算周期增长。新进榜不等于新品上线；不推断收入、留存或全市场品类机会。",
            "connection": snapshot.get("connection") or {},
        }
