# Snodgrass Eliot Peter, A0269684H

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path


def read_manifest(path: Path):
    rows = []
    with path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def read_summary(path: Path):
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def metric_values(summary, key):
    if not summary:
        return {}
    metrics = summary.get("metrics", {})
    metric = metrics.get(key)
    if not metric:
        return {}
    # k6 --summary-export puts stats directly on the metric object (no "values" sub-key)
    return {k: v for k, v in metric.items() if k != "thresholds"}


def metric_thresholds(summary, key):
    if not summary:
        return {}
    metrics = summary.get("metrics", {})
    metric = metrics.get(key)
    if not metric:
        return {}
    return metric.get("thresholds", {})


def first_matching_metric(summary, prefix):
    if not summary:
        return None
    for k in summary.get("metrics", {}).keys():
        if k.startswith(prefix):
            return k
    return None


def find_metric_by_tokens(summary, base_name, required_tokens=None):
    if not summary:
        return None
    required_tokens = required_tokens or []
    for key in summary.get("metrics", {}).keys():
        if not key.startswith(base_name):
            continue
        if all(token in key for token in required_tokens):
            return key
    return None


def as_percent(value):
    if value is None:
        return "-"
    return f"{value * 100:.2f}%"


def as_ms(value):
    if value is None:
        return "-"
    return f"{value:.2f} ms"


def to_float(value):
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def threshold_statuses_for_metric(summary, metric_key):
    if not metric_key:
        return []
    statuses = []
    for _name, data in metric_thresholds(summary, metric_key).items():
        if isinstance(data, bool):
            statuses.append(data)
        elif isinstance(data, dict):
            statuses.append(bool(data.get("ok")))
    return statuses


def build_row(manifest_row, summary):
    test_id = manifest_row["test_id"]
    peak_vus = int(manifest_row["peak_vus"])
    repeat = int(manifest_row["repeat"])
    dependency = manifest_row["dependency_mode"] or "-"
    exit_code = int(manifest_row["exit_code"])

    checks_values = metric_values(summary, "checks")
    checks_rate = to_float(checks_values.get("rate"))
    if checks_rate is None:
        checks_rate = to_float(checks_values.get("value"))

    http_failed_values = metric_values(summary, "http_req_failed")
    http_failed = to_float(http_failed_values.get("rate"))
    if http_failed is None:
        http_failed = to_float(http_failed_values.get("value"))

    threshold_pass = []

    key_latency = None
    latency_p95 = None

    if test_id == "discovery":
        key_latency = "http_req_duration"
        latency_p95 = to_float(metric_values(summary, key_latency).get("p(95)"))
    elif test_id == "auth_session":
        key_latency = find_metric_by_tokens(summary, "http_req_duration", ["endpoint:login", "auth_case:valid"])
        latency_p95 = to_float(metric_values(summary, key_latency).get("p(95)")) if key_latency else None
    elif test_id.startswith("checkout"):
        if dependency == "internal":
            key_latency = find_metric_by_tokens(summary, "checkout_e2e_duration", ["dependency:internal"])
        else:
            key_latency = find_metric_by_tokens(summary, "checkout_e2e_duration", [f"dependency:{dependency}"])
            if not key_latency:
                key_latency = find_metric_by_tokens(summary, "checkout_e2e_duration", [])
        latency_p95 = to_float(metric_values(summary, key_latency).get("p(95)")) if key_latency else None
    elif test_id == "admin_mutation":
        key_latency = "write_operation_duration"
        latency_p95 = to_float(metric_values(summary, key_latency).get("p(95)"))

    if test_id == "discovery":
        threshold_pass.extend(threshold_statuses_for_metric(summary, "http_req_duration"))
        threshold_pass.extend(threshold_statuses_for_metric(summary, "http_req_failed"))
    elif test_id == "auth_session":
        threshold_pass.extend(threshold_statuses_for_metric(summary, key_latency))
        threshold_pass.extend(threshold_statuses_for_metric(summary, "server_error_rate"))
    elif test_id.startswith("checkout"):
        # Internal-only thresholds are defined in the k6 script for latency/failure.
        if dependency == "internal":
            threshold_pass.extend(threshold_statuses_for_metric(summary, key_latency))
            key_failure = find_metric_by_tokens(summary, "checkout_failure_rate", ["dependency:internal"])
            threshold_pass.extend(threshold_statuses_for_metric(summary, key_failure))
        threshold_pass.extend(threshold_statuses_for_metric(summary, "server_error_rate"))
    elif test_id == "admin_mutation":
        threshold_pass.extend(threshold_statuses_for_metric(summary, "write_operation_duration"))
        threshold_pass.extend(threshold_statuses_for_metric(summary, "server_error_rate"))

    threshold_pass.extend(threshold_statuses_for_metric(summary, "checks"))

    all_thresholds_ok = all(threshold_pass) if threshold_pass else (exit_code == 0)

    return {
        "test_id": test_id,
        "dependency_mode": dependency,
        "peak_vus": peak_vus,
        "repeat": repeat,
        "exit_code": exit_code,
        "thresholds_passed": all_thresholds_ok,
        "latency_p95_ms": latency_p95,
        "http_req_failed_rate": http_failed,
        "checks_rate": checks_rate,
        "summary_file": manifest_row["summary_file"],
        "raw_log_file": manifest_row["raw_log_file"],
        "started_at": manifest_row["started_at"],
        "ended_at": manifest_row["ended_at"],
    }


def avg(values):
    values = [v for v in values if v is not None]
    if not values:
        return None
    return sum(values) / len(values)


def render_table(headers, rows):
    out = []
    out.append("| " + " | ".join(headers) + " |")
    out.append("| " + " | ".join(["---"] * len(headers)) + " |")
    for row in rows:
        out.append("| " + " | ".join(row) + " |")
    return "\n".join(out)


def build_markdown(results, output_path: Path):
    lines = []
    lines.append("# Stress Testing Report")
    lines.append("")
    lines.append("Generated by `stress-testing/tools/build_stress_report.py`.")
    lines.append("")

    lines.append("## Run-Level Results")
    lines.append("")

    run_headers = [
        "Test",
        "Dependency",
        "Peak VUs",
        "Repeat",
        "Exit",
        "Thresholds Passed",
        "P95 Latency",
        "HTTP Failed",
        "Checks",
    ]
    run_rows = []
    for r in sorted(results, key=lambda x: (x["test_id"], x["dependency_mode"], x["peak_vus"], x["repeat"])):
        run_rows.append(
            [
                r["test_id"],
                r["dependency_mode"],
                str(r["peak_vus"]),
                str(r["repeat"]),
                str(r["exit_code"]),
                "yes" if r["thresholds_passed"] else "no",
                as_ms(r["latency_p95_ms"]),
                as_percent(r["http_req_failed_rate"]),
                as_percent(r["checks_rate"]),
            ]
        )
    lines.append(render_table(run_headers, run_rows))
    lines.append("")

    lines.append("## Aggregated by Test Point")
    lines.append("")

    grouped = defaultdict(list)
    for r in results:
        key = (r["test_id"], r["dependency_mode"], r["peak_vus"])
        grouped[key].append(r)

    agg_headers = [
        "Test",
        "Dependency",
        "Peak VUs",
        "Runs",
        "Pass Count",
        "Avg P95 Latency",
        "Avg HTTP Failed",
        "Avg Checks",
    ]
    agg_rows = []
    for key in sorted(grouped.keys()):
        rows = grouped[key]
        pass_count = sum(1 for r in rows if r["thresholds_passed"])
        agg_rows.append(
            [
                key[0],
                key[1],
                str(key[2]),
                str(len(rows)),
                str(pass_count),
                as_ms(avg([r["latency_p95_ms"] for r in rows])),
                as_percent(avg([r["http_req_failed_rate"] for r in rows])),
                as_percent(avg([r["checks_rate"] for r in rows])),
            ]
        )
    lines.append(render_table(agg_headers, agg_rows))
    lines.append("")

    lines.append("## Artifacts")
    lines.append("")
    lines.append("- Raw logs and k6 JSON summaries are referenced in `manifest.csv`.")
    lines.append("- Use those files for deeper drill-down and evidence screenshots.")
    lines.append("")

    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Build markdown stress-test report from k6 summary exports.")
    parser.add_argument("--manifest", required=True, help="Path to manifest.csv")
    parser.add_argument("--output", required=True, help="Path to output markdown file")
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    output_path = Path(args.output)

    rows = read_manifest(manifest_path)
    results = []
    for row in rows:
        summary = read_summary(Path(row["summary_file"]))
        results.append(build_row(row, summary))

    build_markdown(results, output_path)


if __name__ == "__main__":
    main()
