"""Build the release website and its original-quality local assets."""
from pathlib import Path
import base64, hashlib, html, json, re, shutil, subprocess, sys

R = Path(__file__).resolve().parent
sys.path.insert(0, str(R.parent / 'scripts'))
from scene_codec_assets import codec_assets
from scene_startup_packs import build_startup_packs, approved_startup_codecs
from publish import copy_artifact
MAP_LINKS = {
    'satellite': ('卫星地图 ↗', 'https://www.arcgis.com/apps/mapviewer/index.html?basemapUrl=https%3A%2F%2Fservices.arcgisonline.com%2FArcGIS%2Frest%2Fservices%2FWorld_Imagery%2FMapServer&center=116.304%2C39.992&level=17'),
    'standard': ('标准地图 ↗', 'https://www.openstreetmap.org/#map=17/39.992/116.304'),
}

def runtime_scene_package(source, transport=None):
    """Keep recovery metadata; omit only unused per-bucket audit hashes."""
    prefix = 'YY.SCENE_PACKAGE46='
    text = source.strip()
    if not text.startswith(prefix) or not text.endswith(';'):
        raise ValueError('Unexpected scene package wrapper')
    package = json.loads(text[len(prefix):-1],
                         parse_int=lambda value: -0.0 if value == '-0' else int(value))
    projected = {**package, 'buckets': [
        {key: value for key, value in bucket.items()
         if key not in ('dataHash', 'spatialHash')}
        for bucket in package['buckets']
    ]}
    if transport is not None:
        projected['transport'] = transport
    return prefix + json.dumps(projected, ensure_ascii=False, separators=(',', ':')) + ';'

def runtime_builder_data(file, source):
    """Separate only eager build-source data; retain all adapter ordering."""
    if file == 'src/westgate-lions318.js':
        match = re.search(r'const data=(\{.*?\}),G=Y.Geo;\n', source)
        if not match or source.count('const d=data[side]') != 1:
            raise ValueError('Unexpected westgate data wrapper')
        payload = 'YY.WestGateLionSource318=' + match.group(1) + ';'
        lean = source[:match.start()] + 'const G=Y.Geo;\n' + source[match.end():]
        lean = lean.replace('const d=data[side]', 'const d=Y.WestGateLionSource318[side]')
        return lean, ('WestGateLionSource318', payload)
    if file == 'src/office105-dragons318-data.js':
        if not source.strip().endswith(';') or source.count('YY.Office105Dragons318=') != 1:
            raise ValueError('Unexpected office data wrapper')
        return '', ('Office105Dragons318', source)
    if file == 'src/willow1119-carving315v3.js':
        match = re.search(r',parts=(\[.*?\]),recess=', source, re.S)
        hook = 'P.willowArch33=function(...args){const box='
        if not match or source.count(',parts=') != 1 or source.count(',recess=') != 1 or source.count(hook) != 1 or source.count('for(const part of parts)') != 1:
            raise ValueError('Unexpected willow carving data wrapper')
        payload = 'YY.WillowCarvingSource315=' + match.group(1) + ';'
        lean = source[:match.start()] + ',recess=' + source[match.end():]
        lean = lean.replace(hook, 'P.willowArch33=function(...args){const parts=Y.WillowCarvingSource315;const box=')
        return lean, ('WillowCarvingSource315', payload)
    if file == 'src/gutters1121-carving315.js':
        match = re.search(r',data=(\{.*?\}),body=(\{.*?\}),expected=', source, re.S)
        if not match or source.count(',data=') != 1 or source.count(',body=') != 1 or source.count(',expected=') != 1 or source.count('for(const v of body[tag])') != 1 or source.count('v=data[tag+side]') != 1:
            raise ValueError('Unexpected gutter carving data wrapper')
        payload = 'YY.HaiyantangCarvingSource315={data:' + match.group(1) + ',body:' + match.group(2) + '};'
        lean = source[:match.start()] + ',expected=' + source[match.end():]
        lean = lean.replace('for(const v of body[tag])', 'for(const v of Y.HaiyantangCarvingSource315.body[tag])').replace('v=data[tag+side]', 'v=Y.HaiyantangCarvingSource315.data[tag+side]')
        return lean, ('HaiyantangCarvingSource315', payload)
    return source, None

def runtime_data_assignment(source, name, emit):
    """Retain executable suffixes after a leading, validated JSON assignment."""
    prefix = name + '='
    if not source.startswith(prefix):
        raise ValueError('Unexpected runtime data wrapper: ' + name)
    payload = source[len(prefix):]
    _, end = json.JSONDecoder().raw_decode(payload)
    if payload[end:end + 1] != ';':
        raise ValueError('Unterminated runtime data assignment: ' + name)
    return emit(name, payload[:end]) + payload[end + 1:]

subprocess.run([sys.executable, str(R / 'tools/build-water-detail.py')], check=True)

if '--cached' not in sys.argv:
    subprocess.run(['node', str(R / 'tools/bake-scene46.cjs')], check=True)
if '--cached' in sys.argv:
    index = (R / 'index.html').read_text()
    scripts = [p for p in re.findall(r'<script src="([^"]+)"></script>', index)
               if not re.search(r'(?:assets|reference-gallery|engine|app-v29|materials|material-detail|water-detail|quality-lod|pedestrians-v46|scene-cache46|scene-package46)\.js$', p)]
    digest = hashlib.sha256()
    for file in scripts + ['tools/scene-collector46.js', 'tools/bake-scene46.cjs', 'tools/atlas-input879.cjs']:
        digest.update(file.encode()); digest.update((R / file).read_bytes())
    baseline = R / 'data/scene-atlas-baseline46.json'
    digest.update(baseline.read_bytes()); digest.update((R / json.loads(baseline.read_text())['path']).read_bytes())
    derived = R / 'data/scene-atlas-derived879.json'
    if derived.exists():
        digest.update(derived.read_bytes()); digest.update((R / json.loads(derived.read_text())['path']).read_bytes())
    cached = json.loads((R / 'assets/runtime-v46/scene/manifest.json').read_text())
    if cached['sourceHash'] != digest.hexdigest():
        raise SystemExit('Scene inputs changed. Run a complete build before publishing.')

# Explicit transport-only import: no codec resources are inferred from stale files.
codec_args = [v for v in sys.argv if v.startswith('--codec-sidecar=')]
codec_shas = [v for v in sys.argv if v.startswith('--codec-sidecar-sha256=')]
if codec_args or codec_shas:
    if len(codec_args) != 1 or len(codec_shas) != 1:
        raise SystemExit('Codec import requires exactly one sidecar and approved SHA256')
    subprocess.run([sys.executable, str(R.parent / 'scripts/import-scene-codec.py'),
                    '--sidecar', codec_args[0].split('=', 1)[1],
                    '--sha256', codec_shas[0].split('=', 1)[1]], check=True)
# Detect an interrupted import before generating or copying any release outputs.
scene_manifest = json.loads((R / 'assets/runtime-v46/scene/manifest.json').read_text())
package_text = (R / 'src/scene-package46.js').read_text().strip()
if not package_text.startswith('YY.SCENE_PACKAGE46=') or not package_text.endswith(';'):
    raise SystemExit('Unexpected scene package wrapper')
if json.loads(package_text[len('YY.SCENE_PACKAGE46='):-1]) != {'base': 'assets/runtime-v46/scene/', **scene_manifest}:
    raise SystemExit('Scene package/manifest mismatch; incomplete codec import or bake')
codec_files = codec_assets(scene_manifest, R / 'assets/runtime-v46/scene')
# Audit existing range bytes at build time; no browser or scene regeneration.
pick_cull = subprocess.run(['node', str(R / 'tools/build-pick-cull.cjs'), str(R)],
                           check=True, capture_output=True, text=True).stdout.strip()
json.loads(pick_cull)


# File URLs cannot upload file-origin images to WebGL. Load only these two
# byte-identical texture data URLs through a classic script when opened offline.
manifest = json.loads((R / 'assets/runtime-v46/scene/manifest.json').read_text())
texture_data = {'materials': 'data:image/jpeg;base64,' + base64.b64encode((R / 'assets/materials-display.jpg').read_bytes()).decode(), 'atlas': 'data:image/png;base64,' + base64.b64encode((R / 'assets/runtime-v46/scene' / manifest['atlas']).read_bytes()).decode()}
texture_code = 'YY.LOCAL_TEXTURES46=' + json.dumps(texture_data, separators=(',', ':')) + ';'
texture_file = 'assets/runtime-v46/scene/textures-' + hashlib.sha256(texture_code.encode()).hexdigest()[:24] + '.js'
(R / texture_file).write_text(texture_code)
(R / 'src/materials.js').write_text('YY.MATERIAL_ATLAS="assets/materials-display.jpg";YY.TEXTURE_FALLBACK46=' + json.dumps(texture_file) + ';')

destination = R.parent / 'dist/assets'
if destination.parent.exists():
    shutil.rmtree(destination.parent)
destination.mkdir(parents=True, exist_ok=True)
asset_manifest = json.loads((R / 'assets-manifest.json').read_text())
scene_prefix = 'app/assets/runtime-v46/scene/'
scene_transport = build_startup_packs(
    scene_manifest, R / 'assets/runtime-v46/scene',
    destination / 'runtime/scene',
    {row['path'][len(scene_prefix):]: row['sha256']
     for row in asset_manifest['files'] if row['path'].startswith(scene_prefix)},
    derived=approved_startup_codecs(scene_manifest, R / 'assets/runtime-v46/scene',
                                  R / 'data/startup-codec-v1.json', R.parent / 'scripts/build-startup-codec.cjs'))
page = (R / 'index.html').read_text()
scripts = re.findall(r'<script src="([^"]+)"></script>', page)
code = []
builder_data = []
runtime_data = []

def emit_runtime_payload(name, payload):
    # Let the browser compile data-only scripts independently of application code.
    # Retain literal syntax: JSON.parse would add a large string allocation.
    key = json.dumps(name)
    source = '(globalThis.__PKU_RUNTIME_DATA ||= {})[' + key + ']=' + payload + ';'
    digest = hashlib.sha256(source.encode()).hexdigest()
    filename = 'data-' + digest[:16] + '.js'
    (destination / filename).write_text(source, encoding='utf-8')
    runtime_data.append({'file': filename, 'bytes': len(source.encode()), 'sha256': digest})
    access = 'globalThis.__PKU_RUNTIME_DATA[' + key + ']'
    return name + '=' + access + ';delete ' + access + ';'

asset_scripts = {'src/assets.js', 'src/materials.js', 'src/reference-gallery.js', 'src/scene-package46.js'}
for file in scripts:
    source = (R / file).read_text()
    if file in ('src/data.js', 'src/architecture-data.js'):
        source = runtime_data_assignment(source, 'YY.CAMPUS' if file == 'src/data.js' else 'YY.ARCHIVE', emit_runtime_payload)
    source, data_asset = runtime_builder_data(file, source)
    if data_asset:
        key, payload = data_asset
        name = 'builder-data-' + hashlib.sha256(payload.encode()).hexdigest()[:24] + '.js'
        (destination / name).write_text(payload)
        builder_data.append({'key': key, 'file': name})
    if file == 'src/app-v29.js':
        source = 'YY.BUILDER_DATA318=' + json.dumps(builder_data, separators=(',', ':')) + ';\n' + (R / 'src/builder-data318-loader.js').read_text() + '\n' + source
    if file == 'src/assets.js':
        source = 'YY.ASSETS=' + json.dumps({'externalMaps': True, 'periphery': {}, 'mapLinks': {mode: link[1] for mode, link in MAP_LINKS.items()}}, separators=(',', ':')) + ';'
    if file == 'src/reference-gallery.js':
        source = 'YY.REFERENCE_GALLERY={images:{},places:{}};'
    if file == 'src/scene-package46.js':
        projected = runtime_scene_package(source, scene_transport)
        # Apply the release path rewrite to the payload before emitting its file.
        payload = projected[len('YY.SCENE_PACKAGE46='):-1].replace('assets/runtime-v46/', 'assets/runtime/')
        source = emit_runtime_payload('YY.PICK_RANGE_CULL', pick_cull.replace('assets/runtime-v46/', 'assets/runtime/')) + '\n' + emit_runtime_payload('YY.SCENE_PACKAGE46', payload) + '\ndelete globalThis.__PKU_RUNTIME_DATA;'
    if file in asset_scripts:
        source = source.replace('assets/runtime-v46/', 'assets/runtime/')
    code.append('/* ' + file + ' */\n' + source)
bundle = '\n;\n'.join(code)
bundle_name = 'app-' + hashlib.sha256(bundle.encode()).hexdigest()[:16] + '.js'
(destination / bundle_name).write_text(bundle)
style = (R / 'src/styles.css').read_bytes()
style_name = 'style-' + hashlib.sha256(style).hexdigest()[:16] + '.css'
(destination / style_name).write_bytes(style)

gallery = {'images': {}, 'places': {}}
# Provider map mosaics and development photos are not release assets.
paths = {'assets/materials-display.jpg', texture_file, 'assets/brand/ink-swallow.png'}
manifest = json.loads((R / 'assets/runtime-v46/scene/manifest.json').read_text())
scene_paths = [manifest['atlas'], 'manifest.json', 'bucket-hashes.json'] + codec_files
for chunk in manifest['chunks']:
    scene_paths.extend([chunk['file'], chunk['fallback']])
paths.update('assets/runtime-v46/scene/' + file for file in scene_paths)
for file in sorted(paths):
    assert file.startswith('assets/'), file
    target = destination / file.removeprefix('assets/').replace('runtime-v46/', 'runtime/', 1)
    target.parent.mkdir(parents=True, exist_ok=True)
    source = R / file
    if not target.exists() or target.stat().st_size != source.stat().st_size or target.stat().st_mtime_ns < source.stat().st_mtime_ns:
        copy_artifact(source, target)
page = re.sub(r'<script src="([^"]+)"></script>', '', page)
for mode, (label, href) in MAP_LINKS.items():
    page = re.sub(r'<button data-mode="' + mode + r'"[^>]*>.*?</button>', '<a href="' + html.escape(href, quote=True) + '" target="_blank" rel="noopener" title="在地图官网打开">' + label + '</a>', page)
page = page.replace('<link rel="stylesheet" href="src/styles.css">', '<link rel="stylesheet" href="assets/' + style_name + '">')
runtime_scripts = ''.join('<script defer src="assets/' + item['file'] + '"></script>' for item in runtime_data)
page = page.replace('</body>', runtime_scripts + '<script defer src="assets/' + bundle_name + '"></script></body>')
page = page.replace('src/assets/', 'assets/')
(R.parent / 'dist/index.html').write_text(page)
(R.parent / 'dist/.nojekyll').touch()
for notice in ('LICENSE', 'DATA_LICENSE.md'):
    shutil.copy2(R.parent / notice, destination.parent / notice)
summary = {'version': (R.parent / 'VERSION').read_text().strip(), 'htmlBytes': len(page.encode()), 'scriptBytes': len(bundle.encode()) + sum(item['bytes'] for item in runtime_data), 'runtimeData': runtime_data, 'sceneCompressedBytes': manifest['packedStats']['compressedBytes'], 'sceneSourceHash': manifest['sourceHash'], 'images': len(gallery['images']), 'copiedAssets': len(paths), 'bundle': bundle_name}
summary['sceneTransport'] = {'parts': len(scene_transport['parts']), 'bytes': sum(part['bytes'] for part in scene_transport['parts']), 'maxPartBytes': max(part['bytes'] for part in scene_transport['parts'])}
(destination / 'build-manifest.json').write_text(json.dumps(summary, indent=2))
print('Built fast page:', json.dumps(summary))
