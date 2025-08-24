# analysis/run.py
from pathlib import Path
from analysis.grouping import Grouper
from analysis.parser import TelemetryParser
from analysis.writer import TimelineWriter

CSV_PATH = Path("telemetry/alldata-latest.csv")
OUT_ROOT = Path("public")

def main() -> None:
    # 1) Parse
    points = TelemetryParser().parse_csv(CSV_PATH)
    print(f"[parse] loaded {len(points)} rows from {CSV_PATH}")

    # 2) Group & clean
    g = Grouper()
    grouped = g.by_team(points)
    print(f"[group] found {len(grouped)} teams")

    for k in list(grouped.keys()):
        seq = grouped[k]
        deduped = g.dedupe_by_timestamp(seq)
        grouped[k] = deduped
        if len(deduped) != len(seq):
            print(f"[dedupe] {k}: {len(seq)} -> {len(deduped)}")

    # 3) Write per-team timelines + index
    writer = TimelineWriter(OUT_ROOT)
    dir_map = {}
    total_rows = 0
    for key, seq in grouped.items():
        path, n, folder_name = writer.write_team(key, seq)
        dir_map[key] = folder_name
        total_rows += n
        print(f"[write] {key}: {n} rows -> {path}")

    idx_path = writer.write_index(grouped, dir_map)
    print(f"[index] wrote {idx_path} (teams={len(grouped)}, rows={total_rows})")

if __name__ == "__main__":
    main()