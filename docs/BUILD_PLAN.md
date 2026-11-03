# Comfy Race: multiplayer Matrix build tracker

Updated 2 November 2026. Supersedes the single-driver baseline. Confirmed engine: **actual Matrix native racing**, with our UI and multiplayer gateway. No replacement browser simulation.

## Release definition

Two humans join one room, independently drive native Matrix cars, see their road on the projector, pass native checkpoints and receive native results. Native rendering works without credits. Comfy story authoring and live rendering are separate additions.

Code delivered, a passing unit test and successful human gameplay are different states.

| ID | Phase | Task | Current state / remaining acceptance |
|---|---|---|---|
| M01 | Foundation | Pin native source/assets | Verified source 51913b2 and asset revision 2c531004 |
| M02 | Foundation | Download and verify racing assets | All 13 release hashes/sizes verified locally |
| M03 | Foundation | Enable native server/test build targets | Patches delivered; native server compiles on Mac |
| M04 | Foundation | Run native multiplayer rules test | Passed: shared physics, independent controls, rules, reconnect/recovery |
| M05 | Foundation | Launch rendered native server | **Needs desktop launch**; automated shell cannot access macOS display |
| M06 | Gateway | Native process and framed IPC | Implemented; pure contract checks pass; actual media/control smoke pending |
| M07 | Gateway | Two human slots, host, ready/start/reset | Implemented; two physical people/devices still needed |
| M08 | Gateway | Identity, stale inputs, reconnect/pause/resume | Implemented/tested with fixtures; device interruption rehearsal pending |
| M09 | Gateway | Separate media subscription from controller presence | Native patch built; two native projector views still need runtime proof |
| M10 | UI | Racing landing, room/join and driver accents | Built and visually reviewed |
| M11 | UI | Local QR and touch controller | Implemented; physical iPhone/Android scan/control test pending |
| M12 | UI | Native split view, route HUD, stalled/error states | Implemented; actual JPEG/rendered driving proof pending |
| M13 | UI | Native results, recovery, rematch | Implemented; complete a human-driven route |
| M14 | Release | Desktop launcher and reproducible setup | Delivered; second-machine clean reproduction pending |
| M15 | Verification | WebSocket routing/phone-no-video test | Passed locally, including two phone sessions plus a projector without a third slot; fixture transport, not rendered gameplay |
| M16 | Verification | Actual native IPC/media/control smoke | Written; desktop OpenGL execution pending |
| S01 | Story | Versioned mission schema and supported actions | Implemented bounded experience schema; native route selection, briefing/presentation/radio text; general mission scripting remains future work |
| S02 | Story | Real Comfy text graph/model | One Gemini 3.1 Flash-Lite -> SaveText pilot completed after explicit approval; actual output preserved and reviewed |
| S03 | Story | Validate generated mission against native route catalog | Strict validator/tests pass; unsupported vehicles/maps/physics rejected; language still needs host review |
| S04 | Story | Freeze approved mission/version across all racers | Implemented shared immutable hash/configuration until reset; native route selection tested through contract fixture |
| S05 | Story | Voice/cues/chapter progression during play | Radio text follows native events; generated audio and general chapter logic remain pending |
| C01 | Cloud setup | Private API key configuration and read-only authentication | Verified locally: GET /api/user returned HTTP 200; no generation submitted |
| A01 | Live AI | Configure ComfyStream GPU/models/network | Waiting for configured service |
| A02 | Live AI | Capture native canvas, signaling, returned video | Implemented; GPU unverified |
| A03 | Live AI | Clean conditioning and two-view separation | Open test gate: native HUD, identity and road continuity |
| A04 | Live AI | Delivered FPS, input-to-screen delay, stalls | Unverified; humans must finish using generated views |
| A05 | Live AI | Explicit engine view on AI loss | Implemented; actual GPU failure test pending |
| P01 | Polish | Native audio playback/mix | Not integrated |
| P02 | Polish | Five humans / higher native resolution | Deferred until measured; 4K canvas is not 4K source |
| P03 | Release | Venue rehearsal, authentic demo, licenses/submission | Pending |
| AD01 | Campaigns | Playable advertising preset | Optional after shared multiplayer/story core |
| F01 | Driving classes | Actual open-wheel proxy and Formula-inspired arcade handling | Native work required; current road car and 80 km/h cap remain |
| F02 | Cities | Geographic roads, collision and lane graph | Native asset/map engineering required; city prompts alone cannot provide it |
| F03 | Broadcast | Accurate continuous intervals, tyres/pits/multi-lap circuits | Current tower shows checkpoint progress and native finishes; extra mechanics/instrumentation not implemented |

## Work backward from the UI

**Two-phone flow:** phone one hosts -> phone two joins QR -> laptop opens projector spectator link/code -> host applies reviewed experience -> both phones ready -> phone host starts -> two native camera views -> native results/rematch. The projector consumes no driver slot.

**Phone:** nickname/accent -> ready -> steering/throttle/brake + objective/position -> reconnect/ready after interruption -> results. No per-phone video stream.

**Authority:** Matrix RaceSession/World own physics, checkpoint order, collisions and results. Node owns identity and permissions. Clients cannot submit positions or finishing times.

~~~mermaid
flowchart LR
    Controls[Phone and keyboard controls] --> Gateway[Room gateway]
    Gateway --> IPC[Native framed IPC]
    IPC --> Matrix[Actual Matrix C++ world]
    Matrix --> State[Native telemetry and results]
    State --> HUD[Host and phone HUD]
    Matrix --> Cameras[Native camera JPEGs]
    Cameras --> Projector[Projector canvas]
    Projector -. optional .-> Comfy[ComfyStream and ComfyUI]
    Comfy -. unverified generated view .-> AI[AI view]
~~~

## Storyline value

Starter chapter names select authored narrative presets. A tested Cloud workflow now produces a bounded experience manifest that the host can load; it changes a supported native route and shared briefing/presentation/radio text. This is not arbitrary generated rules or geography.

The tested path is city brief -> Comfy text model -> validated manifest -> supported native route and shared presentation/radio text. General objective/scoring changes require additional native mission adapters. A generated paragraph or cosmetic city label alone does not establish generated gameplay.

The [official TextGenerate docs](https://github.com/Comfy-Org/docs/blob/main/built-in-nodes/TextGenerate.mdx) describe text output. [ComfyUI Ollama](https://github.com/stavsap/comfyui-ollama) is a local-model integration candidate. Neither is installed or benchmarked for this app. A paid API is not inherently required for local text inference.

Freeze the approved mission before countdown. Accurate Nairobi/Tokyo roads need new native geometry; a prompt does not create them.

## Story racing and playable advertising

| Option | Value | Recommendation |
|---|---|---|
| Multiplayer city stories | Friends compete in short courier/checkpoint missions | Primary product; prove one Nairobi-inspired chapter |
| Branded playable campaign | Same game with sponsor-linked objective/reward | Mission-schema extension after the core works |

Place exact logos, brand spelling and offer text deterministically. Measure completion before claiming campaign performance. No second physics engine is needed.

## Plan correction

The uploaded nine-page plan excluded multi-human V1 and put E25 in P2. Confirmed scope now makes two humans mandatory and allows native rendering before GPU access. Retain its live-AI fidelity/latency gates for the later AI path. PDF/repo E11/E12 identifiers had drifted; new work uses the identifiers above.

## Demo target

Two people scan/join, ready, steer independently and finish. Then show a Comfy graph generating an approved mission that changes the next heat. Add live generated imagery after its fidelity and control latency pass. Demonstrate the workflow's actual in-game effect.
