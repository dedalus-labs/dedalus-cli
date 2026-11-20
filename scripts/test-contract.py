"""Mutation tests: stale output must never satisfy the pinned contract."""

import copy
import json
import runpy
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
check = runpy.run_path(str(ROOT / "scripts/check-contract.py"))["check"]


class ContractGuardTests(unittest.TestCase):
    def test_rejects_missing_obsolete_duplicate_and_changed_fields(self):
        contract = json.loads((ROOT / "api-contract.json").read_text())
        manifest = json.loads((ROOT / "scalar-sdk.manifest.json").read_text())
        self.assertEqual(check(contract, manifest), [])
        for mode in ("missing", "obsolete", "duplicate", "field"):
            with self.subTest(mode=mode):
                changed = copy.deepcopy(manifest)
                operations = changed["operations"]
                if mode == "missing":
                    operations.pop()
                elif mode == "obsolete":
                    operations[0]["method"] = "TRACE"
                elif mode == "duplicate":
                    operations.append(operations[0])
                else:
                    next(op for op in operations if op["method"] == "POST" and op["path"] == "/v1/machines")[
                        "bodyParams"
                    ].remove("image_id")
                self.assertTrue(check(contract, changed))


if __name__ == "__main__":
    unittest.main()
