# Implementation status

Updated 2 November 2026. Actual Matrix engine, two-human gateway/UI, optional Comfy later.

## Verified

- Official source pin and all 13 racing asset SHA256/size checks.
- Mac builds of CitySampleRaceServer and upstream test-race.
- Upstream native rules test: navigation, shared physics, independent controls, pause/reconnect/recovery.
- Ten pure Node contract/session tests.
- Vite production build and browser review of the landing interface.

## Delivered, runtime acceptance pending

Native IPC gateway; host/room/ready/start/reset; two projector camera subscriptions; phone telemetry/touch controls; reconnect credentials; pause/resume; recovery/results; local QR; explicit leave/room cleanup; native patches and desktop launcher.

Optional Comfy capture/signaling/returned-video module is implemented. No real GPU execution is verified.

## Environment limits

Rendered native startup fails before hello: SDL reports “The video driver did not add any displays”. The automated shell lacks macOS desktop access. Desktop automation also refuses Terminal. Run **Run Comfy Race.command** directly in the desktop session.

The WebSocket integration test is written but the shell denies loopback bind (EPERM). Ten pure Node tests pass; the complete eleven-test suite is not reported green. Its synthetic transport fixture verifies routing, not gameplay.

The opt-in native smoke script checks two real slots, independent movement, two JPEG streams and reconnect/resume. It has not passed because the renderer cannot open a display in this execution environment.

No generated story graph/interpreter, native audio integration, rendered two-human playthrough, five-human capacity proof, 4K native-source benchmark or live AI playability measurement is verified.

See [the tracker](BUILD_PLAN.md).
