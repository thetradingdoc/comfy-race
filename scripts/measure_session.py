#!/usr/bin/env python3
"""E10: summarize measured CSV timing. Never fabricates action-to-photon observations.

CSV required: output_timestamp_ms, input_timestamp_ms (optional), stalled (optional).
Input timestamps must be obtained from observable same-event input/output correlations;
backend inference timing alone is not sufficient.
"""
import argparse
import csv
import json
import math
from pathlib import Path

def pct(values, percentile):
    if not values:
        return None
    v=sorted(values)
    pos=(len(v)-1)*percentile/100
    low=int(math.floor(pos)); high=int(math.ceil(pos))
    return round(v[low]+(v[high]-v[low])*(pos-low),2)

def summarize(rows):
    output=[]
    latency=[]
    stalls=0
    for row in rows:
        t=row.get("output_timestamp_ms","")
        if not t:
            continue
        output.append(float(t))
        if row.get("input_timestamp_ms",""):
            latency.append(float(t)-float(row["input_timestamp_ms"]))
        if str(row.get("stalled","")).strip().lower() in ("1","true","yes"):
            stalls+=1
    if any(b<=a for a,b in zip(output,output[1:])):
        raise ValueError("Output timestamps must increase strictly")
    if any(x<0 for x in latency):
        raise ValueError("Negative input-to-output latency")
    elapsed=(output[-1]-output[0])/1000 if len(output)>=2 else None
    return {"frames":len(output),"duration_s":round(elapsed,3) if elapsed is not None else None,
            "presented_fps":round((len(output)-1)/elapsed,2) if elapsed and elapsed>0 else None,
            "p50_input_to_output_ms":pct(latency,50),"p95_input_to_output_ms":pct(latency,95),
            "latency_samples":len(latency),"stalled_frames":stalls,
            "valid_playability_evidence":False,
            "note":"CSV values must be measured on-device. This summary is not a verified action-to-photon result without correlated presentation timestamps."}

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("csv",type=Path)
    p.add_argument("--output",type=Path)
    a=p.parse_args()
    with a.csv.open(newline="") as f:
        summary=summarize(csv.DictReader(f))
    result=json.dumps(summary,indent=2)+"\n"
    print(result,end="")
    if a.output:
        a.output.parent.mkdir(parents=True,exist_ok=True)
        a.output.write_text(result)
