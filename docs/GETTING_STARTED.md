# Get started with the actual Matrix multiplayer game

The current launcher and build instructions are in the [README](../README.md). On the prepared Mac, double-click **Run Comfy Race.command**, then open http://localhost:8093. A normal desktop Terminal session is necessary for the native OpenGL renderer.

On a fresh checkout, run scripts/setup_game.sh, then scripts/run_game.sh. Requirements and environment variables are documented in the README and [native integration guide](NATIVE_GAME.md).

For two phone drivers, create a room on phone one in controller mode and join from phone two using its QR code. On the laptop select Open the shared screen and enter the room code; it watches without using a driver slot. Load the reviewed Nairobi experience from the host phone if desired, confirm ready on both phones, then start. No Comfy key is needed to reuse the saved manifest or run native gameplay.

Current evidence: native server compiles, native multiplayer rules test passes, UI builds and has been visually reviewed. Actual rendered two-human gameplay still needs the desktop test. See [implementation status](IMPLEMENTATION_STATUS.md).

Later Comfy rendering requires a compatible running ComfyStream GPU, workflow/models and media connectivity. Browser credits or an API key alone do not supply that service. Story generation is a separate planned workflow. Follow the [tracker](BUILD_PLAN.md) for its acceptance gates.
