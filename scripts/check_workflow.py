#!/usr/bin/env python3
"""Static ComfyStream ComfyUI API-graph validation; does not run inference."""
import argparse
import json
import sys
from pathlib import Path

def check(graph):
    errors = []
    if not isinstance(graph, dict) or not graph:
        return ["Expected non-empty ComfyUI API-format node dictionary"]
    sources = []
    outputs = []
    for node_id, node in graph.items():
        if not isinstance(node, dict) or "class_type" not in node or not isinstance(node.get("inputs"), dict):
            errors.append(f"{node_id}: missing class_type or inputs")
            continue
        if node["class_type"] in ("LoadImage", "PrimaryInputLoadImage"):
            sources.append(node_id)
        if node["class_type"] in ("PreviewImage", "SaveImage"):
            outputs.append(node_id)
        for field, v in node["inputs"].items():
            if isinstance(v, list) and len(v) == 2 and isinstance(v[0], str) and isinstance(v[1], int) and v[0] not in graph:
                errors.append(f"{node_id}.{field}: missing upstream node {v[0]}")
    if len(sources) != 1:
        errors.append(f"Expected exactly one primary image input; found {len(sources)}")
    if len(outputs) != 1:
        errors.append(f"Expected exactly one image output; found {len(outputs)}")
    if len(sources) == 1 and len(outputs) == 1:
        visited = set()
        def connected(node_id):
            if node_id == sources[0]:
                return True
            if node_id in visited:
                return False
            visited.add(node_id)
            node = graph.get(node_id, {})
            return any(connected(v[0]) for v in node.get("inputs", {}).values()
                       if isinstance(v, list) and len(v) == 2 and isinstance(v[0], str) and isinstance(v[1], int))
        if not connected(outputs[0]):
            errors.append("Output is not connected to streaming input")
    return errors

def main():
    p = argparse.ArgumentParser()
    p.add_argument("workflow", type=Path)
    args = p.parse_args()
    try:
        graph = json.loads(args.workflow.read_text())
        errors = check(graph)
    except (OSError, ValueError) as exc:
        errors = [str(exc)]
    print("FAIL" if errors else "PASS", args.workflow)
    for e in errors:
        print(" -", e)
    if not errors:
        print("Static graph only. GPU, models, custom nodes, media and latency remain UNVERIFIED.")
    return bool(errors)

if __name__ == "__main__":
    sys.exit(main())
