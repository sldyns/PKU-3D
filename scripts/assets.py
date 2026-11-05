#!/usr/bin/env python3
"""Pack/restore checksum-pinned campus assets outside Git, without resampling.

The ZIP stores each distinct blob once. restore checks all hashes and never
overwrites a differing local file; the current local project is not a staging
directory. Archives/ and the full research/performance history stay local.
"""
import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import zipfile
# Preserve direct CLI and importlib/spec_from_file_location callers alike.
import importlib.util
_codec_spec = importlib.util.spec_from_file_location(
    '_pku_scene_codec_assets', Path(__file__).with_name('scene_codec_assets.py'))
_codec_module = importlib.util.module_from_spec(_codec_spec)
_codec_spec.loader.exec_module(_codec_module)
codec_assets = _codec_module.codec_assets
_startup_spec = importlib.util.spec_from_file_location(
    '_pku_startup_assets', Path(__file__).with_name('scene_startup_packs.py'))
_startup_module = importlib.util.module_from_spec(_startup_spec)
_startup_spec.loader.exec_module(_startup_module)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('app')
MANIFEST = ROOT / 'app/assets-manifest.json'


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda: f.read(4 * 1024 * 1024), b''):
            h.update(b)
    return h.hexdigest()


def inputs():
    base = ROOT / SOURCE / 'assets'
    # Reference photos and downloaded provider maps remain local.
    files = {base / p for p in ('materials-display.jpg', 'scene-atlas-baseline46.png')}
    # Cached builds hash the retained atlas input as well as the current scene
    # atlas. They can differ after a bake; both are needed in a fresh checkout.
    derived = ROOT / SOURCE / 'data/scene-atlas-derived879.json'
    if derived.exists():
        files.add(ROOT / SOURCE / json.loads(derived.read_text())['path'])
    # Pin the existing cache as well as its build inputs. A fresh checkout can
    # use the exact delivered scene without baking on a different GPU/font set.
    cache = base / 'runtime-v46/scene'
    meta = json.loads((cache / 'manifest.json').read_text())
    files.update(cache / name for name in codec_assets(meta, cache))
    startup = _startup_module.approved_startup_codecs(meta, cache, ROOT / SOURCE / 'data/startup-codec-v1.json', ROOT / 'scripts/build-startup-codec.cjs')
    files.update(cache / row['file'] for row in startup.values())
    files.update(cache / x for x in ('manifest.json', 'bucket-hashes.json', meta['atlas']))
    for chunk in meta['chunks']:
        files.update(cache / chunk[x] for x in ('file', 'fallback'))
    for js in ('materials.js',):
        text = (ROOT / SOURCE / 'src' / js).read_text()
        import re
        for name in re.findall(r'["\'](assets/[^"\']+)["\']', text):
            files.add(ROOT / SOURCE / name)
    return sorted(files)


def pack():
    MANIFEST.parent.mkdir(exist_ok=True)
    paths = inputs()
    rows = [{'path': str(p.relative_to(ROOT)), 'bytes': p.stat().st_size, 'sha256': sha(p)} for p in paths]
    payload = {'schema': 1, 'files': rows}
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
    folder = ROOT / '.release'
    folder.mkdir(exist_ok=True)
    target = folder / ('pku-3d-assets-' + (ROOT / 'VERSION').read_text().strip() + '.zip')
    with zipfile.ZipFile(target.with_suffix('.tmp'), 'w', compression=zipfile.ZIP_STORED, allowZip64=True) as z:
        def write_entry(name, data):
            # Stable archive metadata; same bytes/version yield the same ZIP SHA.
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_STORED
            z.writestr(info, data)
        write_entry('manifest.json', encoded)
        for notice in ('LICENSE', 'DATA_LICENSE.md'):
            write_entry(notice, (ROOT / notice).read_bytes())
        seen = set()
        for p, row in zip(paths, rows):
            if row['sha256'] not in seen:
                data = p.read_bytes()
                if len(data) != row['bytes'] or hashlib.sha256(data).hexdigest() != row['sha256']:
                    raise RuntimeError('Asset changed during pack: ' + row['path'])
                write_entry('blobs/' + row['sha256'], data)
                seen.add(row['sha256'])
    target.with_suffix('.tmp').replace(target)
    payload['archive'] = {'file': target.name, 'bytes': target.stat().st_size, 'sha256': sha(target)}
    MANIFEST.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'archive': payload['archive'], 'files': len(rows), 'distinctBlobs': len(seen)}))


def verify(base):
    doc = json.loads(MANIFEST.read_text())
    bad = []
    for row in doc['files']:
        p = base / row['path']
        if not p.is_file() or p.stat().st_size != row['bytes'] or sha(p) != row['sha256']:
            bad.append(row['path'])
    print(json.dumps({'checked': len(doc['files']), 'mismatches': bad}))
    if bad:
        raise SystemExit(1)


def clone_or_copy(src, dst):
    if sys.platform == 'darwin':
        lib = ctypes.CDLL(None, use_errno=True)
        if lib.clonefile(os.fsencode(src), os.fsencode(dst), 0) == 0:
            return
    shutil.copy2(src, dst)


def restore(archive, base):
    doc = json.loads(MANIFEST.read_text())
    assert sha(archive) == doc['archive']['sha256'], 'Archive checksum mismatch'
    # Validate every destination before writing any file.
    for row in doc['files']:
        p = (base / row['path']).resolve()
        assert p.is_relative_to(base.resolve()), 'Unsafe destination'
        if p.exists():
            assert p.is_file() and sha(p) == row['sha256'], 'Local changes at ' + row['path']
    with zipfile.ZipFile(archive) as z, tempfile.TemporaryDirectory(prefix='pku-3d-assets-') as tmp:
        stored = json.loads(z.read('manifest.json'))
        assert stored['files'] == doc['files'], 'Manifest mismatch'
        for row in doc['files']:
            p = base / row['path']
            if p.exists():
                continue
            blob = Path(tmp) / row['sha256']
            if not blob.exists():
                with z.open('blobs/' + row['sha256']) as stream, blob.open('wb') as f:
                    shutil.copyfileobj(stream, f)
                assert blob.stat().st_size == row['bytes'] and sha(blob) == row['sha256'], 'Blob mismatch'
            p.parent.mkdir(parents=True, exist_ok=True)
            clone_or_copy(blob, p)
    verify(base)


def setup():
    import subprocess
    from urllib.request import urlopen
    doc = json.loads(MANIFEST.read_text())
    if all((ROOT / r['path']).is_file() and sha(ROOT / r['path']) == r['sha256'] for r in doc['files']):
        verify(ROOT)
        return
    cache = ROOT / '.cache'
    cache.mkdir(exist_ok=True)
    archive = cache / doc['archive']['file']
    version = (ROOT / 'VERSION').read_text().strip()
    url = 'https://github.com/sldyns/PKU-3D/releases/download/v' + version + '/' + archive.name
    if not archive.exists() or sha(archive) != doc['archive']['sha256']:
        if shutil.which('gh') and (os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')):
            subprocess.run(['gh','release','download','v'+version,'--repo','sldyns/PKU-3D','--pattern',archive.name,'--dir',str(cache),'--clobber'],check=True)
        else:
            with urlopen(url) as stream, archive.open('wb') as out:
                shutil.copyfileobj(stream, out)
    restore(archive, ROOT)
    archive.unlink()


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('action', choices=('pack', 'verify', 'restore', 'setup'))
    ap.add_argument('--archive', type=Path)
    ap.add_argument('--root', type=Path, default=ROOT)
    args = ap.parse_args()
    if args.action == 'setup':
        setup()
    elif args.action == 'pack':
        pack()
    elif args.action == 'verify':
        verify(args.root)
    else:
        if not args.archive:
            ap.error('restore requires --archive')
        restore(args.archive, args.root)
