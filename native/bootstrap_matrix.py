#!/usr/bin/env python3
"""Download the pinned official racing assets and configure the native Matrix build.

No neural weights, external executables, or generated assets are downloaded.
"""
from concurrent.futures import ThreadPoolExecutor
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'resources/matrix-game'
COMMIT = '51913b2bfa78a6d54de912b8348b1d318f4d36e2'
ASSET_REV = '2c53100457da7abcf0e966f75637c644d3423a63'
RESOURCES = ROOT / 'resources'

def run(*args, cwd=ROOT, env=None):
    subprocess.run(args, cwd=cwd, env=env, check=True)


def native_environment():
    """Find existing Mac libraries; never install into the system prefix."""
    env = os.environ.copy()
    local_bin = ROOT / '.venv-native/bin'
    env['PATH'] = os.pathsep.join([str(local_bin), env.get('PATH', '')])
    cmake = shutil.which('cmake', path=env['PATH'])
    ctest = shutil.which('ctest', path=env['PATH'])
    pkg_config = shutil.which('pkg-config', path=env['PATH']) or shutil.which('pkgconf', path=env['PATH'])
    if not all((cmake, ctest, pkg_config)):
        raise RuntimeError('Missing local native build tools. Run scripts/setup_game.sh first.')
    brew = shutil.which('brew', path=env['PATH'])
    if brew:
        prefix = subprocess.check_output([brew, '--prefix'], text=True, env=env).strip()
        paths = [f'{prefix}/opt/ffmpeg/lib/pkgconfig', f'{prefix}/opt/sdl2/lib/pkgconfig', f'{prefix}/lib/pkgconfig']
        env['PKG_CONFIG_PATH'] = os.pathsep.join(paths + ([env['PKG_CONFIG_PATH']] if env.get('PKG_CONFIG_PATH') else []))
        env['CMAKE_PREFIX_PATH'] = os.pathsep.join([prefix] + ([env['CMAKE_PREFIX_PATH']] if env.get('CMAKE_PREFIX_PATH') else []))
    return env, cmake, ctest, pkg_config

def download(entry):
    target = RESOURCES / entry['path']
    target.parent.mkdir(parents=True, exist_ok=True)
    def verified(file):
        return file.is_file() and file.stat().st_size == entry['size'] and hashlib.sha256(file.read_bytes()).hexdigest() == entry['sha256']
    if verified(target):
        return f"VERIFIED {entry['path']}"
    url = f"https://huggingface.co/Skywork/Matrix-Game-4.0/resolve/{ASSET_REV}/{entry['path']}"
    temporary = target.with_suffix(target.suffix + '.part')
    try:
        # curl uses the platform's trusted CA store (including macOS Keychain).
        # Keep certificate verification enabled and verify the release digest too.
        subprocess.run(['curl', '--fail', '--location', '--silent', '--show-error', '--retry', '2',
                        '--max-time', '180', '--output', str(temporary), url], check=True)
        if not verified(temporary):
            raise RuntimeError(f"SHA256/size verification failed: {entry['path']}")
        temporary.replace(target)
        return f"DOWNLOADED + VERIFIED {entry['path']}"
    finally:
        temporary.unlink(missing_ok=True)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--assets-only', action='store_true')
    parser.add_argument('--jobs', type=int, default=4)
    args = parser.parse_args()
    if not 1 <= args.jobs <= 32:
        parser.error('--jobs must be between 1 and 32')
    RESOURCES.mkdir(parents=True, exist_ok=True)
    if not SOURCE.exists():
        run('git', 'clone', '--filter=blob:none', '--no-checkout', 'https://github.com/SkyworkAI/Matrix-Game.git', str(SOURCE))
        run('git', 'sparse-checkout', 'set', 'Matrix-Game-4', cwd=SOURCE)
        run('git', 'checkout', '--detach', COMMIT, cwd=SOURCE)
    elif not (SOURCE / '.git').exists():
        raise RuntimeError(f'Refusing to overwrite non-Git source directory: {SOURCE}')
    revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=SOURCE, text=True).strip()
    if revision != COMMIT:
        run('git', 'fetch', 'origin', COMMIT, cwd=SOURCE)
        run('git', 'checkout', '--detach', COMMIT, cwd=SOURCE)
    manifest = json.loads((SOURCE / 'Matrix-Game-4/releases/game-assets.json').read_text())
    with ThreadPoolExecutor(max_workers=min(4, args.jobs)) as pool:
        for result in pool.map(download, manifest['bundles']['racing']):
            print(result, flush=True)
    if args.assets_only:
        return
    for patch in sorted((ROOT / 'native/patches').glob('*.patch')):
        applied = subprocess.run(['git', 'apply', '--reverse', '--check', str(patch)], cwd=SOURCE, capture_output=True).returncode == 0
        if not applied:
            run('git', 'apply', str(patch), cwd=SOURCE)
    game = SOURCE / 'Matrix-Game-4/game/racing'
    build = ROOT / 'build/matrix-racing'
    env, cmake, ctest, pkg_config = native_environment()
    run(cmake, '-S', str(game), '-B', str(build), '-DCMAKE_BUILD_TYPE=Release',
        f'-DPKG_CONFIG_EXECUTABLE={pkg_config}', f'-DRACING_ASSET_ROOT={RESOURCES / "racing"}', env=env)
    run(cmake, '--build', str(build), '--target', 'CitySampleRaceServer', 'test-race',
        '--parallel', str(args.jobs), env=env)
    run(ctest, '--test-dir', str(build), '-R', '^racing-race$', '--output-on-failure', env=env)
    print(f"Matrix source {COMMIT}; native binary directory: {game / 'bin'}")

if __name__ == '__main__':
    main()
