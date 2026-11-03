# Comfy Race

**Race with friends using Matrix's actual native racing engine. Connect ComfyUI when the base game is ready.**

Comfy Race adds a multiplayer room, phone controllers and a racing interface to the official [Matrix-Game 4 City Racing source](https://github.com/SkyworkAI/Matrix-Game/tree/51913b2bfa78a6d54de912b8348b1d318f4d36e2/Matrix-Game-4/game/racing). The C++ engine owns vehicle motion, collisions, checkpoints, recovery penalties and finishing times.

![Comfy Race landing interface; the car showcase is illustrative](docs/screenshots/landing.png)

## What is built

- Original racing UI, city-story presets, room codes, locally generated QR invites and driver accents.
- Node gateway to the actual CitySampleRaceServer through framed Unix socket IPC.
- Two human drivers by default. Native capacity is five; larger sessions need performance testing.
- Keyboard/phone controls, readiness, pause/resume, recovery, reconnect and results paths.
- Two native camera views on the projector; phone controllers receive telemetry rather than video.
- Optional ComfyStream connection, with explicitly labelled engine/AI views.
- Pinned source/assets, SHA256 checks, native patches and desktop setup/launch scripts.

**Status:** the native server compiles on the development Mac and its upstream multiplayer rules test passes. The UI builds and has been visually reviewed. Rendered two-human gameplay is **not verified**: the automated shell cannot access the macOS desktop display. Launch directly from a desktop Terminal. GPU output and live AI latency are also unverified.

## Run on the prepared Mac

Double-click **Run Comfy Race.command**, or run from this repository:

~~~bash
bash scripts/run_game.sh
~~~

Open **http://localhost:8093** on the laptop to find its LAN join address. Phone one opens the game on that LAN address and creates a room in controller mode; phone two scans its QR code and joins. On the laptop choose **Open the shared screen** and enter the room code. The projector watches both native cameras without taking a driver slot. Both phones confirm ready; the phone host starts.

The phone host can choose **Load reviewed Nairobi pilot** before starting. This applies saved output from our tested Comfy workflow, selects the actual Avenue route and configures the shared briefing, presentation and radio text. It submits no new generation. See [the tested workflow and artifacts](workflows/experiences/README.md).

Controls: W/S or arrows for throttle/reverse, A/D or arrows to steer, Space to brake. Recovery adds the native five-second penalty. A disconnect pauses the race; reconnect, confirm ready on both devices, then let the host resume.

## Fresh setup

Requirements: a macOS desktop session, Xcode command-line tools/C++20, Python 3.10+, Node 22.12+, SDL2, FFmpeg development libraries, Git and curl. Linux desktop operation is not tested by this project. The native renderer needs an OpenGL display.

Install missing system libraries with your preferred package manager; for example, on macOS: brew install sdl2 ffmpeg. Then:

~~~bash
bash scripts/setup_game.sh
bash scripts/run_game.sh
~~~

Setup installs local CMake/pkgconf tools, checks out the pinned source, verifies approximately 54 MiB of racing assets, applies the patches and builds/tests the native race server. No neural weights are downloaded. Assets, dependencies and binaries stay outside Git.

Settings include HOST, PORT, MATRIX_RACE_BIN, MATRIX_RACE_ASSETS, MATRIX_RACE_MAX_PLAYERS, MATRIX_FRAME_WIDTH, MATRIX_FRAME_HEIGHT and MATRIX_FRAME_FPS. Default native feeds are 800 x 450 at a requested 24 FPS per view. Delivered performance still needs measurement. A 4K display canvas upscales these feeds; it does not create 4K source detail.

## ComfyUI's role

Two workflows are intended:

1. **Story authoring:** city/mission brief -> validated mission manifest -> objectives, checkpoint events, narration and chapter progression used during multiplayer play.
2. **Optional live rendering:** native game frames -> ComfyStream -> ComfyUI workflow -> generated view during play.

Starter city chapters remain authored presets. A real Cloud text workflow has now generated and saved a Nairobi experience manifest, with a reviewed example that the host can apply. The manifest selects supported native routes and supplies briefing/presentation/radio text; it does not generate new vehicle physics or geographical maps. The existing SD1.5/depth graph remains a candidate live visual renderer.

The [F1 feasibility review](docs/F1_EXPERIENCE_FEASIBILITY.md) explains how street/open-wheel classes and city experiences could grow, what the supplied timing-tower ZIP actually does, and which engine integrations remain necessary.

No credits or API keys are required for native racing. Later live rendering requires a running, compatible ComfyStream GPU endpoint; a browser trial or key alone does not supply this service.

For Comfy Cloud workflow jobs, put COMFY_API_KEY and COMFY_BASE_URL in private .env.local. The launcher loads it automatically. Run python3 scripts/check_comfy_cloud.py for a read-only authentication check. See [Cloud key setup](docs/COMFY_CLOUD_SETUP.md); this is separate from the live renderer endpoint below.

~~~bash
COMFY_RACE_GPU_URL=https://YOUR_COMFYSTREAM_ORIGIN bash scripts/run_game.sh
~~~

Optional COMFY_RACE_GPU_TOKEN authenticates upstream. COMFY_RACE_OPERATOR_TOKEN protects AI controls accessed from another device. Keep credentials server-side. Use Comfy AI / Setup after a native race has fresh frames. GPU dependencies, HUD conditioning, split-view quality and input latency remain validation gates.

## Checks and tracker

~~~bash
npm --prefix game test
npm --prefix game run build
node game/scripts/native-smoke.mjs
~~~

The native smoke requires a desktop OpenGL session. It checks two native slots, independent movement, both JPEG streams and reconnect/resume; it has not passed in the automated shell. Unit-test transport fixtures are explicitly synthetic and are not gameplay evidence.

See the [build tracker](docs/BUILD_PLAN.md), [implementation status](docs/IMPLEMENTATION_STATUS.md) and [native integration](docs/NATIVE_GAME.md). The earlier Python operator remains a separate diagnostic tool.

## Source and license

App code is Apache-2.0. Matrix v4 code is Apache-2.0; ComfyStream is MIT. Racing audio has separate CC0/CC BY 3.0 credits in the downloaded audio/CREDITS.md. Model/derivative licenses need verification before AI release. Retain [third-party notices](THIRD_PARTY_NOTICES.md).

Primary sources: [native race session](https://github.com/SkyworkAI/Matrix-Game/blob/51913b2bfa78a6d54de912b8348b1d318f4d36e2/Matrix-Game-4/game/racing/src/RaceSession.cpp), [racing asset manifest](https://github.com/SkyworkAI/Matrix-Game/blob/51913b2bfa78a6d54de912b8348b1d318f4d36e2/Matrix-Game-4/releases/game-assets.json), [ComfyStream](https://github.com/livepeer/comfystream).
