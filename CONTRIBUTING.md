# Contributing to Comfy Race

Comfy Race is documentation-first. Start with [the roadmap](docs/ROADMAP.md) and [the build epic](docs/BUILD_PLAN.md). Architecture and application implementation follow this repository foundation.

## First implementation milestones

1. Pin the native racing source/assets and verify the toolchain and license requirements.
2. Build the native racer and the separate race-server target.
3. Prove two human input sources operate separate cars in one simulation.
4. Add controller-only phones and a readable shared projector output.
5. Add clean clip capture and a real, bounded Comfy workflow integration.

Do not treat AI opponents, isolated time trials, mock jobs, or upstream demo footage as proof of completed Comfy Race functionality.

## Changes and evidence

- Keep implementation changes small and tie them to a task ID in the epic.
- Update the task state only with concrete evidence: source review, build log, test, measured runtime, or recorded demonstration.
- Include a clear problem, resulting behavior, relevant validation, and known limits in pull requests.
- Run checks appropriate to the change. Native gameplay rules, input isolation, recovery, and job retry/billing behavior need meaningful tests when implemented.
- Preserve upstream notices and document what was reused versus written here.
- Attribute source media and distinguish planned, live, recorded, generated, and cached outputs.

## Secrets, assets, and costs

Never commit API keys, tokens, environment files, private participant data, model weights, native asset bundles, or unreviewed recordings. Use placeholder configuration examples when implementation needs them. Generation must have explicit job/cost limits before public entry can trigger it.

Do not copy third-party images, video, audio, models, or code into the repository without checking their terms. The remotely linked research media is not covered by this repository's Apache-2.0 license.

## Before a public release

Verify setup from a fresh checkout, include a small appropriately licensed source fixture, list supported devices and tested player capacity, retain notices, demonstrate a real workflow run, and document shutdown/storage costs. Follow the competition's current submission requirements rather than assuming a README alone completes entry.
