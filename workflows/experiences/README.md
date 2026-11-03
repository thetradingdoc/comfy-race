# Comfy Race experience workflow

The [saved Cloud workflow](https://cloud.comfy.org/#e34071ee-1a6d-4c8b-8783-3646d19db617) uses Gemini 3.1 Flash-Lite -> SaveText(JSON). One explicitly approved text job completed successfully, capped at 1,024 output tokens.

- nairobi-director-api.json: executable API-format graph; import/run in Comfy, not in the game.
- nairobi-director.editor.json: actual editable two-node workflow exported from the saved Cloud record; import this into the active Comfy canvas if the direct workspace link does not open the expected graph.
- native-capabilities.json: supported native route, vehicle, rule and presentation choices.
- examples/nairobi-pilot.generated.json: original downloaded model output.
- examples/nairobi-pilot.reviewed.json: approved example with penalty wording and finish radio corrected.
- pilot-evidence.json: job/workflow IDs and precise verification limits; no credentials or signed download URLs.

The game's host can load the reviewed pilot with one button or import a valid manifest JSON. The gateway selects the actual native route and freezes the same configuration/hash for both players. Loading saved output makes no new Cloud generation request.

The current vehicle is the standard native road car. Motorsport presentation does not create Formula physics or geographic Nairobi roads. Radio fields are text cues until an audio playback branch is integrated.

The model output passes structural validation, but needed wording review. SaveText JSON mode is not a semantic/schema validator; the game validates supported fields and the host must review generated claims.

See [the feasibility review](../../docs/F1_EXPERIENCE_FEASIBILITY.md) for prompts, API roles and remaining engine work.
