"""CPU-only distribution and epic contract checks."""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class RepoContractTests(unittest.TestCase):
    def test_pin_files_are_complete(self):
        lock = json.loads((ROOT/"config/upstreams.lock.json").read_text())
        for name in ("matrix_game", "comfystream"):
            entry = lock["repositories"][name]
            self.assertEqual(len(entry["commit"]), 40)
            self.assertTrue(entry["url"].startswith("https://github.com/"))
            self.assertIn("license", entry["code_license"].lower())

    def test_operator_static_assets(self):
        for suffix in ("index.html", "style.css", "app.js"):
            self.assertGreater((ROOT/"src/comfy_race/static"/suffix).stat().st_size, 200)

    def test_ui_has_no_ai_passthrough(self):
        js = (ROOT/"src/comfy_race/static/app.js").read_text()
        self.assertIn("AI OUTPUT STALLED", js)
        self.assertIn("OBS Virtual Camera", js)
        self.assertIn("prompts:[state.workflow]", js)
        self.assertNotIn("noop:true", js)

if __name__ == "__main__":
    unittest.main()
