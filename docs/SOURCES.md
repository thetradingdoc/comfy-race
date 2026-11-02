# Sources, media and research provenance

Reviewed November 2, 2026. Source-file inspection is not proof of successful video playback, a local build, measured performance, or a functioning Comfy Race implementation.

## Official Matrix-Game references

| Reference | Source | How we use it |
|---|---|---|
| Matrix-Game 4.0 project page | https://matrix-game-v4-0.github.io/page/ | Research inspiration and linked demonstrations |
| Official source | https://github.com/SkyworkAI/Matrix-Game | Native racing foundation and release documentation |
| Pinned code audit | https://github.com/SkyworkAI/Matrix-Game/tree/51913b2bfa78a6d54de912b8348b1d318f4d36e2/Matrix-Game-4 | Reproducible source-review snapshot |
| Native games | https://github.com/SkyworkAI/Matrix-Game/blob/51913b2bfa78a6d54de912b8348b1d318f4d36e2/Matrix-Game-4/game/README.md | Native modes, shared shooter implementation, recording boundary |
| Racing guide | https://github.com/SkyworkAI/Matrix-Game/blob/51913b2bfa78a6d54de912b8348b1d318f4d36e2/Matrix-Game-4/docs/racing.md | Controls and native setup |
| Model card | https://huggingface.co/Skywork/Matrix-Game-4.0 | Scene specialization and limitations |

The [epic's source audit](BUILD_PLAN.md#3-code-audit-reusable-foundation-and-actual-gaps) links individual files for multiplayer, build, audio and capture findings.

## Official research media

Credit: **Skywork AI / Matrix-Game Team**. All items below are upstream demonstrations, **not Comfy Race gameplay**.

The assets exist in the official page source at revision [`6642fe456208814c7d0ae4f7b25d4daa94c60a3a`](https://github.com/matrix-game-v4-0/page/tree/6642fe456208814c7d0ae4f7b25d4daa94c60a3a). This repository links remotely and does not vendor media. No media license was located in that website repository; do not assume the separate engine license covers the website's images/videos.

### Racing comparison

[![Official Matrix-Game City Racing research comparison; not Comfy Race gameplay](https://raw.githubusercontent.com/matrix-game-v4-0/page/6642fe456208814c7d0ae4f7b25d4daa94c60a3a/assets/gallery/racing_03.jpg)](https://matrix-game-v4-0.github.io/page/assets/gallery/racing_03.mp4)

[Watch comparison video](https://matrix-game-v4-0.github.io/page/assets/gallery/racing_03.mp4) · [Source file](https://github.com/matrix-game-v4-0/page/blob/6642fe456208814c7d0ae4f7b25d4daa94c60a3a/assets/gallery/racing_03.mp4)

### Longer racing demonstration

[![Official Matrix-Game longer racing research demonstration; not Comfy Race gameplay](https://raw.githubusercontent.com/matrix-game-v4-0/page/6642fe456208814c7d0ae4f7b25d4daa94c60a3a/assets/long/long_racing.jpg)](https://matrix-game-v4-0.github.io/page/assets/long/long_racing.mp4)

[Watch longer racing video](https://matrix-game-v4-0.github.io/page/assets/long/long_racing.mp4) · [Source file](https://github.com/matrix-game-v4-0/page/blob/6642fe456208814c7d0ae4f7b25d4daa94c60a3a/assets/long/long_racing.mp4)

### Upstream research method

![Matrix-Game Team's upstream research method figure; this is not Comfy Race's implemented architecture](https://raw.githubusercontent.com/matrix-game-v4-0/page/6642fe456208814c7d0ae4f7b25d4daa94c60a3a/assets/fig/overview_en.png)

[Original method explanation](https://matrix-game-v4-0.github.io/page/#method). Comfy Race's planned asynchronous Director is a separate application design and does not claim to reproduce every component in this research figure.

### Additional official overview

[Overview teaser](https://matrix-game-v4-0.github.io/page/assets/video/teaser_en.mp4) · [GitHub-hosted upstream overview video](https://github.com/user-attachments/assets/4ded08da-1309-43c9-9662-6e2f2b3fbb41)

Linked poster images are used because arbitrary HTML video embeds are not reliable in GitHub README rendering. Media can become unavailable upstream; preserve citations, and do not silently replace it with unrelated footage.

## Comfy platform and workflow references

- [Comfy Developer Platform](https://comfy.org/platform/)
- [API v2](https://docs.comfy.org/api-reference/v2/overview)
- [Official SDKs](https://docs.comfy.org/development/api-development/sdks)
- [Cloud workflow quickstart](https://docs.comfy.org/development/deploy/cloud)
- [Dedicated deployment and billing behavior](https://docs.comfy.org/development/serverless/overview)
- [MiniMax H3 workflows](https://docs.comfy.org/tutorials/video/minimax/minimax-h3)
- [LTX-2.5 workflows](https://docs.comfy.org/tutorials/video/ltx/ltx-2-5)

These describe available products/templates. Our exact workflow/backend integration remains unimplemented and must be validated before making performance or fidelity claims.

## Competition and community references

- [Open Source Higgsfield competition](https://comfy.org/open-source-higgsfield)
- [NYC Build Night](https://luma.com/nyc-yjfm)
- [Community H3 long-video tutorial](https://www.reddit.com/r/comfyui/comments/1wo2dsg/comfyui_tutorial_minimax_h3_long_video_40_seconds/)
- [Community H3 character-swap tutorial](https://www.reddit.com/r/comfyui/comments/1wzy0w2/comfyui_tutorial_character_swap_with_minimax_h3/)

The Reddit posts are author-reported experiments, not independently reproduced benchmarks or verified competition entries. They inspire offline media work; they do not establish live multiplayer rendering speed.

## Academic citation supplied by the upstream project

```bibtex
@misc{zhang2026matrixgame40harnessingvideo,
  title={Matrix-Game 4.0: Harnessing Video Models for Real-Time Playable Game Worlds},
  author={Jihai Zhang and Runjia Qian and Kaiqin Kong and Biao Jiang and Puyi Wang and Siru Chen and Tianle Li and Guanjie Chen and Junyi Wu and Chubin Chen and Yuanhang Li and Kaichen Huang and Haobo Zhang and Yangguang Li and Wei Yu and Guibin Chen and Yu Cheng and Yahui Zhou},
  year={2026},
  eprint={2610.27999},
  archivePrefix={arXiv},
  primaryClass={cs.CV},
  url={https://arxiv.org/abs/2610.27999}
}
```

This citation is reproduced from the official project page. Comfy Race is an application project and is not that research paper.
