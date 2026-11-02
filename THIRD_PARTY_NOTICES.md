# Third-party notices and attribution

## Multiplayer app dependencies

The web app uses Three.js (MIT), ws (MIT), qrcode (MIT) and Vite (MIT, build tooling). Exact versions and transitive dependencies are recorded in game/package-lock.json; retain package license notices when redistributing dependencies or bundles. The landing showcase is original procedural artwork, not a screenshot of native or generated gameplay.

Native Matrix patches and the racing asset downloader reference the official v4 source/release. Downloaded audio retains its upstream audio/CREDITS.md attribution.

The root Apache-2.0 license applies to original Comfy Race contributions. It does not relicense the materials below.

## Matrix-Game 4.0

- Authors/credit: Skywork AI / Matrix-Game Team.
- Project: https://matrix-game-v4-0.github.io/page/
- Source: https://github.com/SkyworkAI/Matrix-Game
- Inspected v4 revision: `51913b2bfa78a6d54de912b8348b1d318f4d36e2`.
- V4 license: https://github.com/SkyworkAI/Matrix-Game/blob/51913b2bfa78a6d54de912b8348b1d318f4d36e2/Matrix-Game-4/LICENSE

The current repository contains references and a source-based implementation plan, not a vendored copy of the engine. If source is incorporated later, retain its license/notice files and separately audit bundled dependencies and assets. Earlier Matrix versions and third-party components can have different terms.

## Research website media

Images and videos are remotely linked from the official project page and its source repository at revision `6642fe456208814c7d0ae4f7b25d4daa94c60a3a`.

No website-media license was located during inspection. Attribution and a link are not a redistribution license. Media is not copied into this repository or included in our license grant. If a rights holder requests a change, remove or replace the remote reference. See [the media catalog](docs/SOURCES.md#official-research-media).

## Models and game assets

No model weights or game asset bundles are included. Matrix scene models, shared encoders/codecs, H3/LTX models, and any future generated assets require their own license review. Open weights do not imply unrestricted use or zero compute cost.

The native racing audio bundle includes materials with separate notices, including CC0 and CC BY attribution. Retain and audit upstream `racing/assets/audio/CREDITS.md` if those sounds are used. Do not assume the root application license covers them.

## Comfy and other names

Comfy, ComfyUI, MiniMax, LTX, GitHub, and other product names identify their respective products/owners. This project does not claim official affiliation, endorsement, partnership, or competition acceptance.
