"""No external dependencies: python -m unittest discover -s tests -v"""
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from check_workflow import check

WORKFLOW = Path(__file__).resolve().parents[1] / "workflows/comfy-race-sd15-depth-api.json"

class WorkflowTest(unittest.TestCase):
    def test_reference_graph_structure(self):
        self.assertEqual(check(json.loads(WORKFLOW.read_text())), [])
    def test_bad_input_count(self):
        g = json.loads(WORKFLOW.read_text())
        g["extra"] = {"class_type":"LoadImage","inputs":{"image":"extra.png"}}
        self.assertTrue(any("one primary image input" in e for e in check(g)))
    def test_missing_upstream_node(self):
        g = json.loads(WORKFLOW.read_text())
        g["15"]["inputs"]["images"] = ["unknown",0]
        self.assertTrue(any("missing upstream" in e for e in check(g)))
    def test_disconnected_output(self):
        g = json.loads(WORKFLOW.read_text())
        g["15"]["inputs"]["images"] = ["16",0]
        self.assertTrue(any("not connected" in e for e in check(g)))

if __name__ == "__main__":
    unittest.main()
