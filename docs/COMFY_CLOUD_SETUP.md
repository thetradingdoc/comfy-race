# Comfy Cloud key setup

Comfy Cloud credentials belong in the server environment or the private, Git-ignored .env.local file. Use the literal base URL https://cloud.comfy.org, without Markdown link formatting.

```dotenv
COMFY_BASE_URL=https://cloud.comfy.org
COMFY_API_KEY=YOUR_KEY_VALUE
```

COMFY_API_KEY is the variable's name; the actual key is its value. Do not put the key itself inside os.environ's square brackets.

The game launcher loads .env.local through Node's environment-file support. The authentication helper also reads that file without executing it:

```bash
python3 scripts/check_comfy_cloud.py
```

This performs only GET /api/user. It prints a status summary, discards account data and submits no paid generation. Credentials are sent only to the official Cloud origin, in the X-API-Key header; redirects are not followed.

HTTP 200 verifies this authenticated request. It does not prove workflow compatibility, generation entitlement or available credits. Official docs require a paid Cloud subscription for workflow API access; a free browser trial alone is insufficient.

## Python SDK

Install the official package with pip install comfy-sdk. With COMFY_API_KEY exported in your process environment:

```python
import os
from comfy_sdk import Comfy

os.environ["COMFY_BASE_URL"] = "https://cloud.comfy.org"
key = os.environ["COMFY_API_KEY"]
client = Comfy(api_key=key)
wf = client.workflows.from_file("workflow_api.json")
job = client.run(wf, api_key=key)  # Partner nodes also need per-run authentication.
for output in job.outputs:
    output.to_file(output.name)
```

The workflow file must be exported in API format and use models/nodes available on the target Cloud service. The repository's TensorRT/depth graph is a candidate ComfyStream workflow, not a verified Cloud workflow.

The constructor authenticates the Cloud client. Per-run api_key authenticates partner nodes such as Gemini inside the graph; it is often the same workspace key. Running a workflow can consume credits. The tested text graph is in workflows/experiences.

## Screenshots and providers

The Settings / Secrets dialog shown in the screenshots holds external-provider credentials such as Hugging Face or Civitai. It is separate from this app's Comfy API authentication. Comfy workspace keys are managed at https://platform.comfy.org/profile/api-keys.

Successful Cloud authentication enables the workflow API. It does not create a persistent ComfyStream renderer. Keep COMFY_RACE_GPU_URL for that later live-video service. Cloud story-authoring jobs and live generated race imagery are separate integrations.

Sources: [official SDK guide](https://docs.comfy.org/development/api-development/sdks), [Cloud authentication](https://docs.comfy.org/development/cloud/overview), [Python SDK](https://github.com/Comfy-Org/comfy-python-sdk).
