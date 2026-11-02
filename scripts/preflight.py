#!/usr/bin/env python3
"""Host inventory: reports missing dependencies, never asserts playable AI rendering."""
import argparse
import importlib.util
import json
import platform
import shutil
import subprocess
import sys
from pathlib import Path

def command(args):
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=5)
        return ((p.stdout or p.stderr).strip().splitlines() or [""])[0][:200] if p.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None

def inspect(mode, workspace=None):
    result = {"mode": mode, "platform": platform.platform(), "checks": [], "verified_live_ai": False}
    def add(name, ok, detail):
        result["checks"].append({"name": name, "ok": bool(ok), "detail": detail})
    if mode == "mac":
        for label, cmd in [("cmake", ["cmake","--version"]), ("ffmpeg", ["ffmpeg","-version"]), ("c++",["c++","--version"]), ("pkg-config",["pkg-config","--version"]), ("SDL2",["pkg-config","--modversion","sdl2"])]:
            v = command(cmd)
            add(label, v is not None, v or "Not found")
        add("OBS installed", Path("/Applications/OBS.app").exists(), "OBS Virtual Camera and capture must still be verified manually")
    else:
        gpu = command(["nvidia-smi","--query-gpu=name,memory.total,driver_version","--format=csv,noheader"])
        add("NVIDIA GPU", gpu is not None, gpu or "GPU not detected")
        for module in ("torch", "comfystream", "tensorrt", "aiortc"):
            ok = importlib.util.find_spec(module) is not None
            add(module, ok, "Found in active Python" if ok else "Missing from active Python")
        add("ComfyUI workspace", bool(workspace and (workspace/"main.py").is_file()), str(workspace or "Provide --workspace"))
    result["required_pass"] = all(c["ok"] for c in result["checks"])
    return result

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--mode", required=True, choices=["mac","gpu"])
    p.add_argument("--workspace", type=Path)
    p.add_argument("--output", type=Path)
    a = p.parse_args()
    data = inspect(a.mode, a.workspace)
    print(json.dumps(data, indent=2))
    if a.output:
        a.output.parent.mkdir(parents=True, exist_ok=True)
        a.output.write_text(json.dumps(data, indent=2)+"\n")
    return 0 if data["required_pass"] else 2

if __name__ == "__main__":
    sys.exit(main())
