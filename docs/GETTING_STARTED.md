# Initial setup: accounts, keys and first tasks

The initial route uses Comfy Cloud for generation and local native gameplay. Local ComfyUI Desktop, a custom deployment and Matrix neural weights are not prerequisites for the first proof. Application implementation has not started; the environment files below prepare its configuration contract.

## What the maintainer needs to do

1. Sign into [Comfy Cloud](https://cloud.comfy.org) with the intended hackathon account.
2. Confirm the account has paid workflow API access and available credits. A free browser trial is not sufficient for the workflow API. Check any event-credit entitlement before purchasing; do not assume promotional credits also grant API access. [Official Cloud setup](https://docs.comfy.org/development/deploy/cloud)
3. In [Comfy Platform](https://platform.comfy.org), use the intended workspace/account and open **API Keys → + New**. Name the key `comfy-race-dev`, click **Generate**, and save it immediately; it is shown only once. [Official key instructions](https://docs.comfy.org/development/api-development/getting-an-api-key)
4. Save the key locally in the repository's ignored `.env.local`, never in chat, an issue, README, or a screenshot. If that file has not been prepared already, copy `.env.example` to `.env.local` first.

```dotenv
COMFY_API_KEY=your-key-here
COMFY_BASE_URL=https://cloud.comfy.org
```

5. Confirm only **“key saved”**, whether API access/credits are available, and the authorized initial generation-usage budget or job allowance. Subscription fees are separate from a generation test allowance. No paid generation is authorized merely by storing a key.

The development setup creates the local file with owner-only permissions and checks that Git ignores it. It must never be staged. Backend integration will explicitly load the key and pass it to the Cloud workflow client; the SDK should not be assumed to discover `.env.local` automatically. [SDK documentation](https://docs.comfy.org/development/api-development/sdks)

## Accounts and keys we do not need initially

| Service/tool | Initial requirement |
|---|---|
| GitHub | Already configured for this repository; no new key needed. |
| MiniMax/LTX/provider accounts | No separate key requested until a chosen workflow establishes a need. |
| Hugging Face | No token needed for the first native game proof; gated model access may matter later. |
| GPU rental | Not needed for the initial local native gameplay proof; evaluate after workflow selection. |
| Local ComfyUI Desktop | Optional when using managed Cloud workflows. |
| Comfy MCP/CLI | Optional development conveniences; not required for the first SDK integration. |

## First implementation sequence

| Order | Epic tasks | Outcome | Waiting on a key? |
|---|---|---|---|
| 1 | A09–A12 | Verify toolchain, download pinned game assets, build racer and finish one local race | No |
| 2 | B01–B07 | Add race-server target, IPC lifecycle and rule tests; prove two independent human inputs | No |
| 3 | C01–C07 | Versioned contracts, controller-only phones and two-view projector proof | No |
| 4 | E01–E03 | Mocked generation adapter, persistent request/job records and bounded queue/spend controls | No |
| 5 | E04–E08 | Validate account access and execute one minimal real image job, then a short video-conditioning benchmark | Yes, plus explicit budget/access |
| 6 | D04–D06, E11–E12 | Clean recording → selected moment → actual Director output | Yes for real hosted generation |

Key setup and native preparation can happen in parallel. Source inspection is not a successful build; a configured key is not a successful API job. Record each proof before marking the corresponding epic task complete.
