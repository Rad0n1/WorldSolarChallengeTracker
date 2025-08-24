import json
from pathlib import Path
from typing import Dict, List, Tuple

from analysis.model import Point


class TimelineWriter:
    """
    Writes per-team timelines as JSON arrays:
    public/teams/<teamKey>/timeseries.json

    Also writes a small index file:
    public/teams/index.json  (teamKey -> {team, teamnum, shortname, count})
    """

    def __init__(self, out_root: Path):
        self.out_root = out_root
        (self.out_root / "teams").mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _safe_dirname(key: str) -> str:
        # Safe folder name (e.g., "06" or "TopDutch"). Keep it short and predictable.
        sanitized = "".join(ch for ch in key if ch.isalnum() or ch in ("-", "_"))
        return sanitized or "UNKNOWN"

    def write_team(self, key: str, seq: List[Point]) -> Tuple[Path, int, str]:
        folder_name = self._safe_dirname(key)
        folder = self.out_root / "teams" / self._safe_dirname(key)
        folder.mkdir(parents=True, exist_ok=True)
        rows = [p.as_json_row() for p in seq]
        path = folder / "timeseries.json"
        path.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
        return path, len(rows), folder_name

    def write_index(self, grouped: Dict[str, List[Point]], dir_map: Dict[str, str]) -> Path:
        idx = {}
        for key, seq in grouped.items():
            # derive human label from latest point
            label_team = seq[-1].team if seq else ""
            idx[key] = {
                "messengerid": seq[-1].messengerid if seq else "",
                "team": label_team,
                "teamnum": seq[-1].teamnum if seq else "",
                "shortname": seq[-1].shortname if seq else "",
                "carname": seq[-1].carname if seq else "",
                "class": seq[-1].raceClass if seq else "",
                "count": len(seq),
                "dir": dir_map.get(key, self._safe_dirname(key))
            }
        path = self.out_root / "teams" / "index.json"
        path.write_text(json.dumps(idx, ensure_ascii=False), encoding="utf-8")
        return path
