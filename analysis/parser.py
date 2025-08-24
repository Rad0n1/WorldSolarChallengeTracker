import csv
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from analysis.model import Point

class TelemetryParser:
       
    """
    Parses CSV rows from telemetry/alldata-latest.csv into Point objects.
    No external deps: we parse ISO8601 by normalizing 'Z' to '+00:00'.
    """

    # Column names we will look for (case-insensitive)
    REQUIRED = {
        "time": {"time"},
        "lat": {"latitude"},
        "lon": {"longitude"},
        "messengerid": {"messengerid"}
    }
    OPTIONAL = {
        "speed": {"speed"},
        "alt": {"altitude"},
        "team": {"team"},
        "short": {"shortname"},
        "carname": {"car"},
        "teamnum": {"teamnum"},
        "distance": {"distance"},
        "class": {"class"},
    }

    @staticmethod
    def _norm_ts(s: str) -> datetime:
        # Accepts strings like "2025-08-24T10:29:08Z" or with offset
        s = s.strip()
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        # fromisoformat handles "+00:00" offsets
        return datetime.fromisoformat(s).astimezone(timezone.utc)

    def parse_csv(self, path: Path) -> List[Point]:
        def norm_header(h: str) -> str:
            # strip whitespace + BOM, then lowercase
            if h is None:
                return ""
            return h.strip().lstrip("\ufeff").lower()

        points: List[Point] = []
        with path.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            
            raw_headers = list(reader.fieldnames or [])
            normalized_to_original: dict[str, str] = {}
            for h in raw_headers:
                nh = norm_header(h)
                # keep the first seen original name for this normalized key
                if nh not in normalized_to_original:
                    normalized_to_original[nh] = h

            # Build case-insensitive column map once
            cols = {k.lower(): k for k in reader.fieldnames or []}
        
            def pick(aliases: set[str]) -> Optional[str]:
                # find any normalized header that matches one of the aliases
                for alias in aliases:
                    if alias in normalized_to_original:
                        return normalized_to_original[alias]
                return None

            col_time    = pick(self.REQUIRED["time"])
            col_lat     = pick(self.REQUIRED["lat"])
            col_lon     = pick(self.REQUIRED["lon"])
            col_messid  = pick(self.REQUIRED["messengerid"])

            if not (col_time and col_lat and col_lon and col_messid):
                # helpful error with both raw and normalized header views
                have_norm = sorted(normalized_to_original.keys())
                have_raw  = [normalized_to_original[k] for k in have_norm]
                raise ValueError(
                    "CSV missing required columns.\n"
                    f" Wanted time={self.REQUIRED['time']}, lat={self.REQUIRED['lat']}, lon={self.REQUIRED['lon']}\n"
                    f" Have (normalized): {have_norm}\n"
                    f" Have (raw):        {have_raw}"
                )

            col_speed = pick(self.OPTIONAL["speed"])
            col_alt   = pick(self.OPTIONAL["alt"])
            col_team  = pick(self.OPTIONAL["team"])
            col_short = pick(self.OPTIONAL["short"])
            col_car   = pick(self.OPTIONAL["carname"])
            col_num   = pick(self.OPTIONAL["teamnum"])
            col_dist  = pick(self.OPTIONAL["distance"])
            col_class = pick(self.OPTIONAL["class"])

            for row in reader:
                try:
                    ts = self._norm_ts(row[col_time])
                    lat = float(row[col_lat])
                    lon = float(row[col_lon])
                    messid = str(row[col_messid])
                    speed = float(row[col_speed]) if col_speed and row.get(col_speed) not in (None, "", "NaN") else None
                    alt   = float(row[col_alt]) if col_alt and row.get(col_alt) not in (None, "", "NaN") else None
                    dist = float(row[col_dist]) if col_dist and row.get(col_dist) not in (None, "", "NaN") else None
                    team  = (row.get(col_team) or row.get(col_short) or "").strip()
                    short = (row.get(col_short) or "").strip()
                    car = (row.get(col_car) or "").strip()
                    teamnum = str(row.get(col_num) or "").strip()
                    rclass = str(row.get(col_class) or "").strip()
                    points.append(Point(ts, lat, lon, speed, alt, dist, team, teamnum, short, car, messid, rclass))
                except Exception:
                    # Ignore malformed rows; CSVs in the wild can be dirty
                    continue
        return points