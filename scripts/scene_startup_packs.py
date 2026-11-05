"""Group existing, checksum-pinned compressed chunks without changing a byte."""
import hashlib
from pathlib import Path
import re
import json

MAX_PART_BYTES = 32 * 1024 * 1024
CODEC = 'gzip-meshopt-attributes-v1'
DELTA_CODECS = {'gzip-u32x8-zigzag-v1': (4, 8), 'gzip-u32-zigzag-v1': (4, 1), 'gzip-u16-zigzag-v1': (2, 1)}


def approved_startup_codecs(manifest, source, approval, encoder):
    """Admit only reviewed outputs for this exact original scene and encoder."""
    source, approval, encoder = Path(source), Path(approval), Path(encoder)
    if not approval.exists():
        return {}
    doc = json.loads(approval.read_text())
    parent = hashlib.sha256((source / 'manifest.json').read_bytes()).hexdigest()
    if doc.get('sourceHash') != manifest['sourceHash'] or doc.get('parentManifestSHA256') != parent:
        return {}  # A new bake cannot inherit an old optional codec approval.
    if doc.get('schema') != 1 or doc.get('encoderSHA256') != hashlib.sha256(encoder.read_bytes()).hexdigest():
        raise ValueError('Startup codec encoder/approval mismatch')
    result = {}
    for row in doc['chunks']:
        index = row['index']
        if type(index) is not int or not 0 <= index < len(manifest['chunks']) or index in result:
            raise ValueError('Invalid startup codec chunk index')
        c = manifest['chunks'][index]
        unit, lanes = DELTA_CODECS.get(row['codec'], (0, 0))
        compatible = (c['kind'] == 'mesh' and unit and c['rawBytes'] > 0 and c['rawBytes'] % (unit * lanes) == 0
                      and ((lanes == 8 and c['shuffle'] in (0, 32)) or (lanes == 1 and c['shuffle'] == unit)))
        selected = min(c['bytes'], c.get('alternative', {}).get('bytes', c['bytes']))
        if (not compatible or row['rawSHA256'] != c['sha256'] or row['sourceFile'] != c['file']
                or type(row['bytes']) is not int or not 0 < row['bytes'] <= selected * .95
                or row['file'] != 'startup-delta-' + row['sha256'][:24] + '.bin.gz'
                or not re.fullmatch('[a-f0-9]{64}', row['sha256'])):
            raise ValueError('Invalid startup codec descriptor')
        for name, digest in [(c['file'], row['sourceSHA256']), (row['file'], row['sha256'])]:
            if not (source / name).is_file() or hashlib.sha256((source / name).read_bytes()).hexdigest() != digest:
                raise ValueError('Startup codec asset mismatch: ' + name)
        if (source / row['file']).stat().st_size != row['bytes']:
            raise ValueError('Startup codec asset length mismatch')
        result[index] = row
    return result


def decode_order(manifest):
    instances = {bucket['data']['chunk'] for bucket in manifest['buckets']}
    first = sorted(instances, key=lambda i: (-manifest['chunks'][i]['rawBytes'], i))
    meshes = [i for i in range(len(manifest['chunks'])) if i not in instances]
    return [items[n] for n in range(max(len(first), len(meshes)))
            for items in (first, meshes) if n < len(items)]


def build_startup_packs(manifest, source, destination, pinned_hashes,
                        limit=MAX_PART_BYTES, derived=None):
    """Keep legacy/offline assets; generate only derived website transport."""
    source, destination = Path(source), Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    parts, entries, size = [], [], 0
    temporary = destination / '.startup-part.tmp'
    output = None

    def close_part():
        nonlocal output, entries, size
        if output is None:
            return
        output.close()
        output = None
        digest = hashlib.sha256(temporary.read_bytes()).hexdigest()
        name = 'startup-' + digest[:24] + '.bin'
        temporary.replace(destination / name)
        parts.append({'file': name, 'bytes': size, 'sha256': digest,
                      'entries': entries})
        entries, size = [], 0

    try:
        for index in decode_order(manifest):
            chunk = manifest['chunks'][index]
            alternative = chunk.get('alternative', {})
            modern = (alternative.get('codec') == CODEC
                      and alternative.get('bytes', chunk['bytes']) < chunk['bytes'])
            selected = (derived or {}).get(index) or (alternative if modern else chunk)
            name = selected['file']
            if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*', name):
                raise ValueError('Invalid startup chunk path')
            data = (source / name).read_bytes()
            if (len(data) != selected['bytes'] or not 0 < len(data) <= limit
                    or hashlib.sha256(data).hexdigest() != pinned_hashes.get(name)):
                raise ValueError('Unpinned or oversized startup chunk: ' + name)
            if output is not None and size + len(data) > limit:
                close_part()
            if output is None:
                output = temporary.open('wb')
            output.write(data)
            entries.append({'index': index, 'bytes': len(data),
                            'codec': selected['codec'] if index in (derived or {}) else CODEC if modern else 'legacy'})
            size += len(data)
        close_part()
    finally:
        if output is not None:
            output.close()
        temporary.unlink(missing_ok=True)
    return {'version': 1, 'sourceHash': manifest['sourceHash'], 'parts': parts}
