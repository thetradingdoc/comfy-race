# Comfy Race roadmap

This is an implementation sequence, not a list of completed features. The full [epic and tracker](BUILD_PLAN.md) defines task IDs, dependencies, costs, acceptance criteria and deferred work.

## 0. Repository foundation

- [x] Name and product brief: Comfy Race.
- [x] Documentation-first README with attributed upstream racing media.
- [x] End-to-end epic and tracker.
- [x] Apache-2.0 license for original contributions and separate third-party notices.
- [x] Contribution guide and task/pull-request templates.
- [x] Verify the public GitHub repository and introductory README.

No architecture or application source code is included in this milestone.

## 1. Prove the native game

Tasks: A09–A12, B01–B07.

- Pin the native source/assets and verify toolchain/license requirements.
- Build the racer and add the separate race-server target.
- Reuse rule tests and verify IPC lifecycle/input handling.
- Prove two independent human inputs control distinct cars in one world.

**Gate:** a real race completes and resets. Five AI cars do not count as human multiplayer.

## 2. Make it playable in the room

Tasks: B08–B11, C01–C11, D01–D03.

- Guest QR lobby and controller-only phones.
- Two-player split-screen, then a measured five-view projector composite.
- Player colours/numbers, countdown, results and queue.
- Documented contact/recovery/disconnect rules.
- Responsive live audio, input release and usable sightlines.

**Gate:** every claimed human player can steer from their displayed view; repeat heat/reset/interruption tests at that capacity.

## 3. Capture a clean moment

Tasks: D04–D06.

- Reuse the renderer's existing clean scene layer.
- Bounded selected-camera clip, frame identity and authoritative telemetry.
- Begin with 3–5 seconds; attempt up to 10 only after measuring cost and fidelity.
- Keep HUD, exact text and scores separate from model input.

**Gate:** an actual source segment has correct duration, no burned-in HUD and traceable race provenance.

## 4. Ship the Comfy Director workflow

Tasks: E01–E12, E14, F01–F03.

- Mock adapter first, then one real API job.
- Persist request keys/job IDs and outputs; bound attempts/credits.
- Verify exact full-video/reference/control conditioning on the chosen backend.
- First NYC-inspired presentation, source/result comparison and export.
- Preflight the actual workflow; dedicated warm-worker settings only within an approved budget.

**Gate:** a real recorded input reaches a real workflow and produces a usable, honestly labeled output. A mock or unrelated cached video is not completion.

## 5. Release and demonstrate

Tasks: G01–G11, H01–H09.

- Device/failure/capacity checks, licenses, reproducible setup and sample input.
- Venue projector/audio/network rehearsal and a clearly labeled backup recording.
- Show live play, selected source, a real Comfy job and the completed transformation.
- Publish original contribution versus upstream reuse; submit through the official form.
- Shut down compute and record any retained storage costs.

**Gate:** another developer can reproduce the supported release and the demo claims match evidence.

## Later scope

Second city treatment; automatic moment detection; recorded alternate camera views; richer car selection; remote per-phone video; optional neural spectator rendering. Five geographic maps, per-player neural streaming, flight and battle royale remain separate expansion work.
