"""Local-only static server and strictly configured ComfyStream signaling proxy.

Run: python3 -m comfy_race.server --gpu-url http://GPU_HOST:8889
No GPU required to boot the UI. Connection requires a real ComfyStream GPU backend.
"""
from __future__ import annotations

import argparse
from functools import partial
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
import os
from pathlib import Path
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

MAX_BODY = 1_500_000
STATIC_ROOT = Path(__file__).resolve().parent / "static"
ROUTES = {"/": "index.html", "/app.js": "app.js", "/style.css": "style.css"}
MIMES = {"index.html": "text/html", "app.js": "text/javascript", "style.css": "text/css"}


def validate_gpu_url(value: str) -> str:
    if not value:
        return ""
    parsed = urlsplit(value)
    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("GPU URL must be an http(s) origin without embedded credentials")
    if parsed.path not in ("", "/") or parsed.query or parsed.fragment:
        raise ValueError("GPU URL must not include a path, query, or fragment")
    return value.rstrip("/")


def parse_offer(body: bytes) -> dict:
    try:
        payload = json.loads(body)
    except (UnicodeDecodeError, ValueError) as exc:
        raise ValueError("Request must be UTF-8 JSON") from exc
    if not isinstance(payload, dict):
        raise ValueError("Offer payload must be an object")
    offer = payload.get("offer")
    prompts = payload.get("prompts")
    if not isinstance(offer, dict) or offer.get("type") != "offer":
        raise ValueError("Expected WebRTC SDP offer")
    sdp = offer.get("sdp")
    if not isinstance(sdp, str) or not sdp.startswith("v=0") or len(sdp) > 120_000:
        raise ValueError("Malformed SDP offer")
    if not isinstance(prompts, list) or len(prompts) != 1 or not isinstance(prompts[0], dict) or not prompts[0]:
        raise ValueError("Exactly one nonempty ComfyUI workflow is required; no passthrough")
    graph = prompts[0]
    inputs = [v for v in graph.values() if isinstance(v, dict) and v.get("class_type") in ("LoadImage", "PrimaryInputLoadImage")]
    outputs = [v for v in graph.values() if isinstance(v, dict) and v.get("class_type") in ("PreviewImage", "SaveImage")]
    if len(inputs) != 1 or len(outputs) != 1:
        raise ValueError("Workflow needs one ComfyStream image input and one output")
    # Explicit size matches the captured canvas; ComfyStream may ignore resolution
    resolution = payload.get("resolution")
    if resolution != {"width": 512, "height": 512}:
        raise ValueError("V1 requires a 512x512 frame canvas")
    return {"offer": {"sdp": sdp, "type": "offer"}, "prompts": prompts, "resolution": resolution}


class Handler(BaseHTTPRequestHandler):
    gpu_url = ""
    timeout = 20

    def _response(self, status: int, body: bytes, mime: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; base-uri 'none'; form-action 'none'")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status: int, value: dict) -> None:
        self._response(status, json.dumps(value, separators=(",", ":")).encode(), "application/json; charset=utf-8")

    def do_GET(self) -> None:
        if self.path == "/api/status":
            return self._json(200, {"configured": bool(self.gpu_url), "gpu_tested": False,
                                    "message": "GPU URL configured" if self.gpu_url else "Start server with --gpu-url"})
        name = ROUTES.get(self.path)
        if name is None:
            return self._json(404, {"error": "Not found"})
        path = (STATIC_ROOT / name).resolve()
        if path.parent != STATIC_ROOT.resolve():
            return self._json(403, {"error": "Forbidden"})
        try:
            content = path.read_bytes()
        except OSError:
            return self._json(500, {"error": "Missing static application file"})
        return self._response(200, content, MIMES[name] + "; charset=utf-8")

    def do_POST(self) -> None:
        if self.path != "/api/offer":
            return self._json(404, {"error": "Not found"})
        if not self.gpu_url:
            return self._json(503, {"error": "GPU backend not configured"})
        try:
            n = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return self._json(400, {"error": "Invalid Content-Length"})
        if not 0 < n <= MAX_BODY:
            return self._json(413, {"error": "Invalid offer size"})
        try:
            payload = parse_offer(self.rfile.read(n))
        except ValueError as exc:
            return self._json(400, {"error": str(exc)})
        req = Request(self.gpu_url + "/offer", data=json.dumps(payload).encode(),
                      headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urlopen(req, timeout=self.timeout) as response:
                result = response.read(MAX_BODY + 1)
                if len(result) > MAX_BODY:
                    return self._json(502, {"error": "GPU response too large"})
                answer = json.loads(result)
        except (HTTPError, URLError, TimeoutError, ValueError, OSError) as exc:
            self.log_error("GPU offer failed (%s)", type(exc).__name__)
            return self._json(502, {"error": "GPU signaling request failed; inspect GPU server logs"})
        if not isinstance(answer, dict) or answer.get("type") != "answer" or not isinstance(answer.get("sdp"), str):
            return self._json(502, {"error": "GPU returned an invalid SDP answer"})
        return self._json(200, {"type": "answer", "sdp": answer["sdp"]})

    def log_message(self, fmt, *args):
        sys.stderr.write("comfy-race: " + fmt % args + "\n")


def run(host: str = "127.0.0.1", port: int = 8090, gpu_url: str = "") -> None:
    gpu_url = validate_gpu_url(gpu_url)
    if host not in ("127.0.0.1", "localhost", "::1"):
        raise ValueError("Operator gateway must bind to loopback; do not expose it publicly")
    klass = type("ConfiguredHandler", (Handler,), {"gpu_url": gpu_url})
    with ThreadingHTTPServer((host, port), klass) as httpd:
        print(f"Comfy Race operator: http://{host}:{httpd.server_port}")
        print("GPU configured:" if gpu_url else "GPU not configured:", gpu_url or "No")
        httpd.serve_forever()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8090)
    parser.add_argument("--gpu-url", default=os.environ.get("COMFY_RACE_GPU_URL", ""))
    args = parser.parse_args()
    run(args.host, args.port, args.gpu_url)


if __name__ == "__main__":
    main()
