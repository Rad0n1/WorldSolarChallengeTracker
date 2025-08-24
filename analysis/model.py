from dataclasses import dataclass
from datetime import datetime
import math
from typing import Optional

@dataclass(frozen=True)
class Point:
    """One telemetry sample for a team."""
    ts: datetime       # UTC timestamp
    lat: float                  # latitude of coordinates
    lon: float                  # longitude of coordinates
    speed: Optional[float]      # km/h if provided in CSV (could be empty)
    altitude: Optional[float]   # meters if provided (could be empty)
    distance: Optional[float]   # Kilometers
    team: str                   # human name (e.g., "Top Dutch Solar Racing")
    teamnum: str                # numeric/string ID (e.g., "06")
    shortname: str              # short code if available
    carname: str
    messengerid: str            # Guaranteed id of car
    raceClass: str              # car class

    def as_json_row(self) -> dict:
        """Shape we want in the output timeline JSON."""
        row = {
            "ts": self.ts.isoformat().replace("+00:00", "Z"),
            "lat": round(self.lat, 6),
            "lon": round(self.lon, 6),
        }
        if self.speed is not None and math.isfinite(self.speed):
            row["speed"] = round(self.speed, 2)
        if self.altitude is not None and math.isfinite(self.altitude):
            row["alt"] = round(self.altitude, 1)
        return row
