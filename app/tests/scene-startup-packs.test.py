"""Verify derived transport against the original opaque compressed inputs."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('packs', ROOT / 'scripts/scene_startup_packs.py')
packs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packs)


class StartupPacks(unittest.TestCase):
    def fixture(self, base):
        chunks = []
        hashes = {}
        for i, data in enumerate([b'abc', b'1234', b'zy', b'99887']):
            name = f'chunk-{i}.gz'
            (base / name).write_bytes(data)
            hashes[name] = hashlib.sha256(data).hexdigest()
            chunks.append({'file': name, 'bytes': len(data), 'rawBytes': i + 1})
        return {'sourceHash': 'same-source', 'chunks': chunks,
                'buckets': [{'data': {'chunk': 3}}]}, hashes

    def test_exact_bytes_order_bounds_and_deterministic_names(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            manifest, hashes = self.fixture(base)
            a = packs.build_startup_packs(manifest, base, base / 'a', hashes, limit=8)
            b = packs.build_startup_packs(manifest, base, base / 'b', hashes, limit=8)
            self.assertEqual(a, b)
            self.assertEqual([e['index'] for p in a['parts'] for e in p['entries']], [3, 0, 1, 2])
            for part in a['parts']:
                expected = b''.join((base / manifest['chunks'][e['index']]['file']).read_bytes() for e in part['entries'])
                self.assertEqual((base / 'a' / part['file']).read_bytes(), expected)
                self.assertEqual(hashlib.sha256(expected).hexdigest(), part['sha256'])
                self.assertLessEqual(part['bytes'], 8)

    def test_changed_input_rejected_before_publishing_that_part(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            manifest, hashes = self.fixture(base)
            (base / 'chunk-3.gz').write_bytes(b'wrong')
            with self.assertRaisesRegex(ValueError, 'Unpinned'):
                packs.build_startup_packs(manifest, base, base / 'out', hashes)
            self.assertFalse((base / 'out' / '.startup-part.tmp').exists())

    def test_approval_ties_encoder_parent_input_and_encoded_file(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            original = b'original' * 16
            encoded = b'encoded'
            (base / 'chunk.gz').write_bytes(original)
            digest = hashlib.sha256(encoded).hexdigest()
            name = 'startup-delta-' + digest[:24] + '.bin.gz'
            (base / name).write_bytes(encoded)
            manifest = {'sourceHash': 'same', 'chunks': [{'kind': 'mesh', 'shuffle': 32, 'rawBytes': 64, 'sha256': 'a' * 64, 'file': 'chunk.gz', 'bytes': len(original)}]}
            (base / 'manifest.json').write_text(json.dumps(manifest))
            encoder = base / 'encoder.cjs'
            encoder.write_text('approved fixture')
            approval = {'schema': 1, 'sourceHash': 'same', 'parentManifestSHA256': hashlib.sha256((base / 'manifest.json').read_bytes()).hexdigest(), 'encoderSHA256': hashlib.sha256(encoder.read_bytes()).hexdigest(), 'chunks': [{'index': 0, 'file': name, 'codec': 'gzip-u32x8-zigzag-v1', 'bytes': len(encoded), 'sha256': digest, 'rawSHA256': 'a' * 64, 'sourceFile': 'chunk.gz', 'sourceSHA256': hashlib.sha256(original).hexdigest()}]}
            target = base / 'approval.json'
            target.write_text(json.dumps(approval))
            self.assertEqual(list(packs.approved_startup_codecs(manifest, base, target, encoder)), [0])
            (base / name).write_bytes(b'corrupt')
            with self.assertRaisesRegex(ValueError, 'asset mismatch'):
                packs.approved_startup_codecs(manifest, base, target, encoder)
            (base / name).write_bytes(encoded)
            encoder.write_text('changed encoder')
            with self.assertRaisesRegex(ValueError, 'encoder/approval'):
                packs.approved_startup_codecs(manifest, base, target, encoder)
            changed = {**manifest, 'sourceHash': 'new bake'}
            self.assertEqual(packs.approved_startup_codecs(changed, base, target, encoder), {})


if __name__ == '__main__':
    unittest.main()
