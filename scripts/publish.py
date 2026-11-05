#!/usr/bin/env python3
"""Build the website and publish its generated files to the Pages branch."""
from pathlib import Path
import ctypes
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = 'https://github.com/sldyns/PKU-3D.git'


def run(*args, cwd=ROOT):
    return subprocess.run(args, cwd=cwd, check=True)


def read(*args):
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()


def copy_artifact(source, destination):
    """Share unchanged bytes where supported; keep the portable copy fallback."""
    if sys.platform == 'darwin':
        library = ctypes.CDLL(None, use_errno=True)
        if library.clonefile(os.fsencode(source), os.fsencode(destination), 0) == 0:
            return destination
    return shutil.copy2(source, destination)


def publish():
    run('python3', 'app/build.py', '--cached')
    revision = read('git', 'rev-parse', '--short', 'HEAD')
    with tempfile.TemporaryDirectory(prefix='pku-3d-pages-') as folder:
        destination = Path(folder) / 'site'
        run('git', 'clone', '--depth', '1', '--single-branch', '--branch', 'gh-pages', '--no-checkout', REPOSITORY, str(destination))
        for item in destination.iterdir():
            if item.name == '.git':
                continue
            if item.is_dir() and not item.is_symlink():
                shutil.rmtree(item)
            else:
                item.unlink()
        for item in (ROOT / 'dist').iterdir():
            if item.is_dir():
                shutil.copytree(item, destination / item.name, copy_function=copy_artifact)
            else:
                copy_artifact(item, destination / item.name)
        run('git', 'add', '--all', cwd=destination)
        result = subprocess.run(['git', 'diff', '--cached', '--quiet'], cwd=destination)
        if result.returncode == 0:
            print('The published files already match this build.')
            return
        if result.returncode != 1:
            raise SystemExit(result.returncode)
        for key in ('user.name', 'user.email'):
            run('git', 'config', key, read('git', 'config', '--get', key), cwd=destination)
        run('git', 'commit', '-m', 'Publish PKU-3D from ' + revision, cwd=destination)
        run('git', 'push', 'origin', 'gh-pages', cwd=destination)
    print('Pages will publish this build at https://sldyns.github.io/PKU-3D/')


if __name__ == '__main__':
    publish()
