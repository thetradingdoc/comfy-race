# Get started with the actual Matrix multiplayer game

The current launcher and build instructions are in the [README](../README.md). On the prepared Mac, double-click **Run Comfy Race.command**, then open http://localhost:8093. A normal desktop Terminal session is necessary for the native OpenGL renderer.

On a fresh checkout, run scripts/setup_game.sh, then scripts/run_game.sh. Requirements and environment variables are documented in the README and [native integration guide](NATIVE_GAME.md).

Create a room, invite a second human with its QR code on the same Wi-Fi, confirm ready on both devices, then start. Two native camera views belong on the shared screen; phones carry controls and telemetry. No Comfy key is needed for the native game.

Current evidence: native server compiles, native multiplayer rules test passes, UI builds and has been visually reviewed. Actual rendered two-human gameplay still needs the desktop test. See [implementation status](IMPLEMENTATION_STATUS.md).

Later Comfy rendering requires a compatible running ComfyStream GPU, workflow/models and media connectivity. Browser credits or an API key alone do not supply that service. Story generation is a separate planned workflow. Follow the [tracker](BUILD_PLAN.md) for its acceptance gates.
