# Implementation status

Updated 2 November 2026. Actual Matrix engine, two-human gateway/UI, optional Comfy later.

## Verified

- Official source pin and all 13 racing asset SHA256/size checks.
- Mac builds of CitySampleRaceServer and upstream test-race.
- Upstream native rules test: navigation, shared physics, independent controls, pause/reconnect/recovery.
- Nineteen Node tests, including strict experience validation and two phone drivers plus a projector spectator using a synthetic native transport fixture.
- Twenty existing Python tests, including HTTP checks. The earlier loopback EPERM restriction is resolved for these checks.
- Vite production build and browser review of the landing interface.
- Comfy Cloud authentication and one explicitly approved Gemini text pilot. The saved two-node workflow completed, its real JSON output passes the app validator, and a reviewed example corrects misleading penalty wording. No image/video/audio/3D generation was run.

## Delivered, runtime acceptance pending

Native IPC gateway; host/room/ready/start/reset; projector spectator with no driver slot; two camera subscriptions; phone telemetry/touch controls and host resume; reconnect credentials; recovery/results; local QR; explicit leave/room cleanup; native patches and desktop launcher. The host can load the reviewed pilot or import a bounded manifest. The gateway validates it, selects an existing native route and freezes one shared configuration/hash. A motorsport timing tower and radio text use native events.

Optional Comfy capture/signaling/returned-video module is implemented. No real GPU execution is verified.

## Environment limits

Rendered native startup fails before hello: SDL reports “The video driver did not add any displays”. The automated shell lacks macOS desktop access. Desktop automation also refuses Terminal. Run **Run Comfy Race.command** directly in the desktop session.

The complete local Node and Python suites now pass. WebSocket tests use a synthetic native transport to verify roles, routing and phone payload separation; they are not evidence of rendered gameplay.

The opt-in native smoke script checks two real slots, independent movement, two JPEG streams and reconnect/resume. It has not passed because the renderer cannot open a display in this execution environment.

The bounded text-authoring graph and manifest application are verified at the Cloud/contract level. General mission scripting, Formula cars/handling, new geographical maps, native audio integration, rendered two-human playthrough, five-human capacity, native 4K performance and live AI playability remain unverified or unimplemented.

See [the tracker](BUILD_PLAN.md).
