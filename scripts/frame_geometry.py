#!/usr/bin/env python3
"""E08: calculate safe fit/crop dimensions; does not modify ComfyStream video frames."""
import argparse
import json

def geometry(width, height, target_width=512, target_height=512, mode="contain"):
    if min(width,height,target_width,target_height) <= 0:
        raise ValueError("Dimensions must be positive")
    if mode not in ("contain","cover"):
        raise ValueError("mode must be contain or cover")
    ratio = min(target_width/width,target_height/height) if mode=="contain" else max(target_width/width,target_height/height)
    new_w,new_h=round(width*ratio),round(height*ratio)
    x=(target_width-new_w)//2
    y=(target_height-new_h)//2
    return {"source":[width,height],"target":[target_width,target_height],"mode":mode,"scaled":[new_w,new_h],"offset":[x,y],"note":"contain adds bars; cover crops content. Must be applied in actual video adapter and evaluated visually."}

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--width",type=int,default=1280)
    p.add_argument("--height",type=int,default=720)
    p.add_argument("--target-width",type=int,default=512)
    p.add_argument("--target-height",type=int,default=512)
    p.add_argument("--mode",choices=["contain","cover"],default="contain")
    a=p.parse_args()
    print(json.dumps(geometry(a.width,a.height,a.target_width,a.target_height,a.mode),indent=2))
