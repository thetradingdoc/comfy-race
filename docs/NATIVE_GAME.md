# Native integration

The Node gateway launches the official CitySampleRaceServer with a duplex Unix socket on FD 3. Packets use two big-endian uint32 lengths, JSON and optional media bytes. The gateway contains no replacement vehicle simulation.

Native RaceSession/World own independent driver slots, shared collisions, checkpoints, penalties, recovery and results. The gateway waits for fresh native race/epoch state after joins, reset and reconnect. Browser credentials identify one native slot and controls are sequenced/bounded.

Phones receive telemetry. The shared display subscribes to two native JPEG camera feeds and composites them into a persistent canvas. Media subscriptions are independent of controller focus. Native stale-input braking remains authoritative; the UI also brakes continuously on lost focus.

## Patches

1. Enable existing native race server and multiplayer test in CMake.
2. Render only subscribed views, independently of controller presence.
3. Match upstream desktop game's macOS OpenGL 4.1 context request.

No Matrix neural weights or 5B renderer are used for base racing.

## Launch and verification

Run scripts/setup_game.sh on a fresh checkout, then scripts/run_game.sh from a normal desktop Terminal. The prepared checkout already contains the binary/assets. Default port is 8093; HOST defaults to 0.0.0.0 for same-network phones. No public tunnel is configured.

~~~bash
node game/scripts/native-smoke.mjs
~~~

The smoke needs a desktop OpenGL display. Run it, then have two humans complete a route before marking gameplay accepted.

## Visual/source honesty

The original Three.js landing showcase is illustrative. During racing the canvas receives actual Matrix JPEG frames. Driver accents do not repaint native car liveries. City chapter names are authored settings on existing native geometry.

Default source is 800 x 450 at requested 24 FPS per view. Display-size controls can make a 4K compositing canvas; source detail remains unchanged. Higher source settings use MATRIX_FRAME_WIDTH/HEIGHT/FPS and need a world restart and performance measurement.

## Optional Comfy

The browser can capture native frames into a letterboxed 512-square stream, submit one workflow through the configured server origin, and display returned video after frames arrive. Stalled AI returns to a labelled engine view. GPU tokens stay server-side; non-local AI controls require the operator token.

This is GPU-unverified. Native HUD text in conditioning, two-view identity, road continuity, transport/TURN, model compatibility and input-to-screen delay remain explicit gates.
