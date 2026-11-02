#!/usr/bin/env python3
"""E05: workflow-referenced assets inventory; not proof of CUDA or node availability."""
import argparse
import json
from pathlib import Path

FIELDS = ("engine", "unet_name", "control_net_name", "vae_name", "clip_name", "ckpt_name", "lora_name")

def extract(graph):
    result = []
    for node_id, node in graph.items():
        for name, value in node.get("inputs", {}).items():
            if name in FIELDS and isinstance(value, str):
                result.append({"node": node_id, "type": node["class_type"], "parameter": name, "value": value})
    return result

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("workflow", type=Path)
    parser.add_argument("--workspace", type=Path, help="ComfyUI workspace to search, optionally")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    graph = json.loads(args.workflow.read_text())
    assets = extract(graph)
    if args.workspace:
        base = args.workspace/"models"
        if not base.is_dir():
            raise SystemExit(f"ComfyUI models directory missing: {base}")
        # Model paths are determined by installed custom-node conventions, not just basenames.
        found = {p.name for p in base.rglob("*") if p.is_file()}
        for asset in assets:
            asset["found_matching_basename"] = Path(asset["value"]).name in found
        missing = [v["value"] for v in assets if not v["found_matching_basename"]]
    else:
        missing = []
    if args.json:
        print(json.dumps({"assets": assets, "missing": missing, "note": "Matching filenames is not sufficient to prove engine compatibility, licensing or loadability"}, indent=2))
    else:
        for a in assets:
            flag = "UNVERIFIED" if not args.workspace else ("FOUND NAME" if a["found_matching_basename"] else "MISSING")
            print(f'{flag:12s} {a["node"]:>3s} {a["type"]:<27s} {a["value"]}')
        if not args.workspace:
            print("No --workspace: inventory only; all models/engines unverified")
    return 2 if missing else 0

if __name__ == "__main__":
    raise SystemExit(main())
