#!/usr/bin/env python3
"""Read-only Comfy Cloud authentication check. Never submits a generation job."""
import argparse
import json
import os
from pathlib import Path
import subprocess
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


def local_config(path):
    """Read literal dotenv values without executing shell commands."""
    if not path.exists():
        return {}
    values = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('export '):
            line = line[7:]
        name, separator, value = line.partition('=')
        if not separator or name.strip() not in ('COMFY_API_KEY', 'COMFY_BASE_URL'):
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
            value = value[1:-1]
        values[name.strip()] = value
    return values


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', type=Path, default=ROOT / '.env.local')
    args = parser.parse_args()
    config = local_config(args.env_file)
    key = os.environ.get('COMFY_API_KEY', config.get('COMFY_API_KEY', '')).strip()
    base = os.environ.get('COMFY_BASE_URL', config.get('COMFY_BASE_URL', 'https://cloud.comfy.org')).strip().rstrip('/')
    result = {'service': 'Comfy Cloud', 'generation_submitted': False}
    if not key:
        result.update(ok=False, error='Set COMFY_API_KEY in your environment or private .env.local file.')
        print(json.dumps(result, indent=2))
        return 2
    parsed = urlsplit(base)
    if parsed.scheme != 'https' or parsed.netloc != 'cloud.comfy.org' or parsed.path or parsed.query or parsed.fragment:
        result.update(ok=False, error='This Cloud-only check sends credentials only to https://cloud.comfy.org.')
        print(json.dumps(result, indent=2))
        return 2
    if '\r' in key or '\n' in key:
        result.update(ok=False, error='The API key contains an unexpected line break.')
        print(json.dumps(result, indent=2))
        return 2
    # Feed the header through stdin, not process arguments or a logged URL.
    escaped = key.replace('\\', '\\\\').replace('"', '\\"')
    headers = f'header = "X-API-Key: {escaped}"\nheader = "Accept: application/json"\n'
    response = subprocess.run([
        'curl', '--silent', '--show-error', '--proto', '=https',
        '--connect-timeout', '10', '--max-time', '25', '--config', '-',
        '--url', base + '/api/user', '--write-out', '\n%{http_code}',
    ], input=headers, capture_output=True, text=True, check=False)
    if response.returncode:
        result.update(ok=False, http_status=None, network_error_code=response.returncode,
                      error='The request did not reach Comfy Cloud. Check network/DNS/TLS access; key validity is unverified.')
        print(json.dumps(result, indent=2))
        return 3
    # Account response data is intentionally discarded, rather than printed.
    body, _, status_text = response.stdout.rpartition('\n')
    status = int(status_text) if status_text.isdigit() else 0
    if status == 200:
        try:
            payload = json.loads(body)
            if not isinstance(payload, dict) or not payload:
                raise ValueError('Unexpected account response')
        except (ValueError, TypeError):
            result.update(ok=False, http_status=status, error='The server returned an unexpected payload; authentication is unverified.')
            print(json.dumps(result, indent=2))
            return 1
    messages = {
        200: 'Authenticated Comfy Cloud request succeeded.',
        401: 'Comfy rejected authentication. Check that the key is current and copied correctly.',
        402: 'Comfy reports insufficient credits.',
        403: 'Comfy denied access. Check workspace/API permissions.',
        429: 'Comfy reports an inactive subscription or request limit. Check the account API entitlement.',
    }
    result.update(ok=status == 200, http_status=status,
                  message=messages.get(status, 'Comfy returned an unexpected status; no generation was submitted.'))
    print(json.dumps(result, indent=2))
    return 0 if status == 200 else 1


if __name__ == '__main__':
    raise SystemExit(main())
