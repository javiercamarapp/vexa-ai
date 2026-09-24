"""Run the author-owned cross-layer regressions against isolated mutations.

No production data or network. A timeout, syntax/setup error or an unrelated
assertion is never classified as a killed mutant. This is not an acceptance gate.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
INPUTS = ["packages/economics/index.mjs", "packages/economics/adapter.mjs",
          "packages/metrics/money.mjs", "packages/metrics/money-adapter.mjs",
          "packages/metrics/scope.mjs"]
GATE = ROOT / "packages/economics/robustness.test.mjs"
MUTATIONS = [
    ("unknown-as-observed-zero", INPUTS[0], "if (value === null) return null;",
     "if (value === null) return 0n;", "UNKNOWN_TOTAL_IS_NOT_ZERO"),
    ("replayed-metric-added-twice", INPUTS[2], "const items=[...unique.values()].sort(",
     "const items=[...rows].sort(", "METRIC_REPLAY_MUST_NOT_ADD"),
    ("ignore-currency-on-sum", INPUTS[2], "row.currency===first.currency&&",
     "", "NO_IMPLICIT_CROSS_CURRENCY_SUM"),
    ("omit-row-tenant-validation", INPUTS[1], "requireValue(r&&r.tenantId===a.tenantId,'TENANT_MISMATCH');",
     "requireValue(r,'TENANT_MISMATCH');", "FOREIGN_ROW_MUST_NOT_BE_HIDDEN_BY_FILTER"),
    ("coerce-minor-units-to-number", INPUTS[0], "return BigInt(value);",
     "return BigInt(Number(value));", "EXACT_KNOWN_SUBTOTAL"),
]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(argv, log, candidate=None):
    env = dict(os.environ)
    env.pop("VEXA_CANDIDATE", None)
    if candidate:
        env["VEXA_CANDIDATE"] = str(candidate)
    started = time.monotonic()
    try:
        completed = subprocess.run(argv, cwd=ROOT, env=env, capture_output=True,
                                   text=True, timeout=20)
        output = completed.stdout + completed.stderr
        code, timeout = completed.returncode, False
    except subprocess.TimeoutExpired as failure:
        output = (failure.stdout or b"").decode(errors="replace") + (failure.stderr or b"").decode(errors="replace")
        code, timeout = None, True
    log.write_text(output)
    return {"command": argv, "candidate": str(candidate) if candidate else None,
            "exit_code": code, "timeout": timeout, "seconds": time.monotonic()-started,
            "log": str(log), "log_sha256": digest(log)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--node", action="append", help="Runtime executable; repeat for multiple runtimes")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if not args.output.is_absolute():
        parser.error("--output must be an absolute path")
    if args.output.exists():
        parser.error("Refusing to overwrite an existing report; preserve failed runs")
    nodes = args.node or ["node"]
    before = {relative: digest(ROOT/relative) for relative in INPUTS}
    before[str(GATE.relative_to(ROOT))] = digest(GATE)
    artifacts = Path(tempfile.mkdtemp(prefix="vexa-economic-robustness-"))
    report = {"task_id": "F07-02", "status": "running", "seed": 42,
              "scope": "five named mutations of the pure ledger-to-money boundary; not whole-product coverage",
              "independent_acceptance": False, "source_hashes": before,
              "runner_sha256": digest(Path(__file__)), "artifacts": str(artifacts), "runtimes": [],
              "pending": ["Independent acceptance gate/review", "CRM identity persistence is outside this pure resolved-record test", "RLS and HTTP authorization are outside this suite"]}
    try:
        for runtime_index, node in enumerate(nodes):
            version = run([node,"--version"],artifacts/f"runtime-{runtime_index}.log")
            baseline = run([node,"--test","--test-reporter=tap",str(GATE)],artifacts/f"baseline-{runtime_index}.log")
            runtime = {"version":version,"baseline":baseline,"mutations":[]}
            report["runtimes"].append(runtime)
            if version["exit_code"] != 0 or baseline["exit_code"] != 0 or baseline["timeout"]:
                report["status"] = "baseline_failed_no_mutation_conclusion"
                break
            for name,relative,old,new,oracle in MUTATIONS:
                record={"id":name,"oracle":oracle,"status":"invalid"}
                runtime["mutations"].append(record)
                with tempfile.TemporaryDirectory(prefix="vexa-economic-mutant-") as directory:
                    candidate=Path(directory)
                    for path in INPUTS:
                        destination=candidate/path
                        destination.parent.mkdir(parents=True,exist_ok=True)
                        shutil.copyfile(ROOT/path,destination)
                    source=candidate/relative
                    original=source.read_text()
                    if original.count(old)!=1:
                        record["reason"]="Mutation target does not match exactly once"
                        continue
                    source.write_text(original.replace(old,new))
                    record["mutant_sha256"]=digest(source)
                    syntax=run([node,"--check",str(source)],artifacts/f"{runtime_index}-{name}-syntax.log")
                    record["syntax"]=syntax
                    if syntax["exit_code"]!=0 or syntax["timeout"]:
                        record["reason"]="Invalid syntax/setup/timeout; not killed"
                        continue
                    result=run([node,"--test","--test-reporter=tap",str(GATE)],artifacts/f"{runtime_index}-{name}.log",candidate)
                    record["run"]=result
                    output=Path(result["log"]).read_text()
                    if result["timeout"]:
                        record.update(status="invalid",reason="Timeout is not a killed mutant")
                    elif result["exit_code"]==0:
                        record["status"]="survived"
                    elif "ERR_ASSERTION" in output and oracle in output:
                        record["status"]="killed"
                    else:
                        record.update(status="invalid",reason="Required value assertion did not fail")
        all_results=[m for runtime in report["runtimes"] for m in runtime["mutations"]]
        report["totals"]={status:sum(m["status"]==status for m in all_results) for status in ["killed","survived","invalid"]}
        if report["status"]=="running":
            report["status"]="author_pass_pending_independent_review" if len(all_results)==len(nodes)*len(MUTATIONS) and all(m["status"]=="killed" for m in all_results) else "mutation_review_required"
    finally:
        report["source_unchanged"]=all(digest(ROOT/path)==expected for path,expected in before.items())
        if not report["source_unchanged"]:
            report["status"]="source_changed_invalid"
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(json.dumps(report,indent=2)+"\n")
        print(json.dumps({"status":report["status"],"report":str(args.output),"totals":report.get("totals"),"source_unchanged":report["source_unchanged"]}))
    return 0 if report["status"]=="author_pass_pending_independent_review" else 1


if __name__=="__main__":
    raise SystemExit(main())
