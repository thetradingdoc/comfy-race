import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from frame_geometry import geometry
from measure_session import summarize

class P0Test(unittest.TestCase):
    def test_letterbox_16_9(self):
        g=geometry(1280,720)
        self.assertEqual(g["scaled"],[512,288])
        self.assertEqual(g["offset"],[0,112])
    def test_cover_16_9(self):
        g=geometry(1280,720,mode="cover")
        self.assertEqual(g["scaled"],[910,512])
        self.assertTrue(g["offset"][0]<0)
    def test_no_measured_latency_is_unverified(self):
        s=summarize([{"output_timestamp_ms":"0"},{"output_timestamp_ms":"100"}])
        self.assertEqual(s["presented_fps"],10)
        self.assertIsNone(s["p95_input_to_output_ms"])
        self.assertFalse(s["valid_playability_evidence"])
    def test_reject_non_monotonic(self):
        with self.assertRaises(ValueError):
            summarize([{"output_timestamp_ms":"100"},{"output_timestamp_ms":"100"}])
