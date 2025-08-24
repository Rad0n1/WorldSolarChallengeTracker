from datetime import datetime
from typing import Dict, Iterable, List
from analysis.model import Point


class Grouper:
    """Groups points by team key, sorts, and deduplicates per timestamp."""

    @staticmethod
    def team_key(p: Point) -> str:
        """
        Prefer messenger_id if present (stable ID).
        Fallback to teamnum, shortname, then team name.
        """
        return p.shortname or p.teamnum or p.messengerid or p.team or "UNKNOWN"

    def by_team(self, points: Iterable[Point]) -> Dict[str, List[Point]]:
        out: Dict[str, List[Point]] = {}
        for p in points:
            out.setdefault(self.team_key(p), []).append(p)
        # Sort each list by timestamp
        for k in out:
            out[k].sort(key=lambda x: x.ts)
        return out

    @staticmethod
    def dedupe_by_timestamp(seq: List[Point]) -> List[Point]:
        """
        If multiple samples share the exact same timestamp for a team,
        keep the LAST (most recent in file order after sorting).
        """
        if not seq:
            return seq
        seen: Dict[datetime, Point] = {}
        for p in seq:
            seen[p.ts] = p
        # Rebuild in time order
        return [seen[t] for t in sorted(seen.keys())]