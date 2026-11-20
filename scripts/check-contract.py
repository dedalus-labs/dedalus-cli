#!/usr/bin/env python3
"""Compare generated operations with the independently pinned public API contract."""
import json
from collections import Counter
from pathlib import Path


def check(contract, manifest):
    expected = {(op["method"], op["path"]): op for op in contract["operations"]}
    counts = Counter((op["method"].upper(), op["path"]) for op in manifest["operations"])
    errors = []
    for key in sorted(expected.keys() - counts.keys()):
        errors.append(f"missing operation: {key}")
    for key in sorted(counts.keys() - expected.keys()):
        errors.append(f"obsolete operation: {key}")
    for key, count in counts.items():
        if count != 1:
            errors.append(f"duplicate operation: {key}")
    for op in manifest["operations"]:
        key = (op["method"].upper(), op["path"])
        if key in expected and sorted(op.get("bodyParams", [])) != expected[key]["bodyParams"]:
            errors.append(f"request fields differ: {key}")
    return errors


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    contract = json.loads((root / "api-contract.json").read_text())
    manifest = json.loads((root / "scalar-sdk.manifest.json").read_text())
    errors = check(contract, manifest)
    if errors:
        raise SystemExit("\n".join(errors))
    print(f"Contract verified: {len(contract['operations'])} operations; source {contract['source_sha']}")
