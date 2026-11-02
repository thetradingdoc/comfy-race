"""CPU-only tests of local operator gateway, SDP contract, and static delivery."""
import json
import sys
import threading
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from comfy_race.server import Handler, parse_offer, validate_gpu_url

WORKFLOW = json.loads((Path(__file__).resolve().parents[1] /
                       "workflows/comfy-race-sd15-depth-api.json").read_text())


class ContractTests(unittest.TestCase):
    def test_gpu_url(self):
        self.assertEqual(validate_gpu_url("https://gpu.example:8889/"), "https://gpu.example:8889")
        for wrong in ("file:///tmp/server", "http://me:secret@localhost:8889",
                      "http://localhost:8889/offer", "http://localhost:8889?secret=x"):
            with self.subTest(wrong=wrong), self.assertRaises(ValueError):
                validate_gpu_url(wrong)

    def test_workflow_offer_valid(self):
        payload = {"offer": {"type": "offer", "sdp": "v=0\r\no=- 0 0 IN IP4 127.0.0.1"},
                   "prompts": [WORKFLOW], "resolution": {"width": 512, "height": 512}}
        self.assertEqual(parse_offer(json.dumps(payload).encode()), payload)

    def test_no_passthrough_or_other_media(self):
        basic = {"offer": {"type": "offer", "sdp": "v=0\n"}, "prompts": [],
                 "resolution": {"width": 512, "height": 512}}
        for prompts in ([], [{}], None):
            bad = dict(basic, prompts=prompts)
            with self.subTest(prompts=prompts), self.assertRaises(ValueError):
                parse_offer(json.dumps(bad).encode())

    def test_wrong_resolution_rejected(self):
        payload = {"offer": {"type": "offer", "sdp": "v=0\r\n"},
                   "prompts": [WORKFLOW], "resolution": {"width": 1280, "height": 720}}
        with self.assertRaises(ValueError):
            parse_offer(json.dumps(payload).encode())


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        local = type("NoGPUHandler", (Handler,), {"gpu_url": ""})
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), local)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=3)

    def request(self, method, path, body=None):
        conn = HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        conn.request(method, path, body=body)
        response = conn.getresponse()
        code = response.status
        content = response.read()
        headers = dict(response.getheaders())
        conn.close()
        return code, content, headers

    def test_serves_real_app(self):
        for path, expected in (("/", b"AI-GENERATED RACE VIEW"),
                               ("/app.js", b"RTCPeerConnection"),
                               ("/style.css", b".stage")):
            with self.subTest(path=path):
                status, content, headers = self.request("GET", path)
                self.assertEqual(status, 200)
                self.assertIn(expected, content)
                self.assertIn("no-store", headers["Cache-Control"])

    def test_game_routes_and_asset(self):
        for route, expected in (("/", b"PLAY RACE"), ("/play", b"READY TO RACE"),
                                ("/race", b"race-stage"), ("/race-complete", b"RACE VERIFICATION"),
                                ("/operator", b"Source"), ("/game.js", b"showPage"),
                                ("/hero.svg", b"<svg")):
            with self.subTest(route=route):
                status, body, _ = self.request("GET", route)
                self.assertEqual(status, 200)
                self.assertIn(expected, body)

    def test_workflow_is_bundled(self):
        status, body, headers = self.request("GET", "/api/workflow")
        self.assertEqual(status, 200)
        self.assertIn(b"TensorRTLoader", body)
        self.assertIn("application/json", headers["Content-Type"])

    def test_no_gpu_cannot_start(self):
        status, content, _ = self.request("POST", "/api/offer", body=b"{}")
        self.assertEqual(status, 503)
        self.assertIn(b"not configured", content)

    def test_forbidden_paths(self):
        for path in ("/../../LICENSE", "/server.py", "/other"):
            with self.subTest(path=path):
                status, _, _ = self.request("GET", path)
                self.assertEqual(status, 404)
