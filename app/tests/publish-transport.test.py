"""Run the real publisher against a tiny local partial-clone remote."""
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class PublishTransport(unittest.TestCase):
    def test_complete_tree_fast_forward_and_unchanged_repeat(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            seed, source, remote = base / 'seed', base / 'source', base / 'remote.git'
            def run(*args, cwd=base):
                return subprocess.check_output(args, cwd=cwd, stderr=subprocess.STDOUT, text=True).strip()
            for folder in (seed, source):
                folder.mkdir()
                run('git', 'init', '-q', cwd=folder)
                run('git', 'config', 'user.name', 'Publisher fixture', cwd=folder)
                run('git', 'config', 'user.email', 'fixture@example.invalid', cwd=folder)
            for name, content in [('keep.txt', 'same'), ('update.txt', 'old'), ('remove.txt', 'delete')]:
                (seed / name).write_text(content)
            run('git', 'add', '.', cwd=seed)
            run('git', 'commit', '-qm', 'Original site', cwd=seed)
            run('git', 'branch', '-M', 'gh-pages', cwd=seed)
            original = run('git', 'rev-parse', 'HEAD', cwd=seed)
            run('git', 'clone', '--bare', str(seed), str(remote))
            run('git', '--git-dir', str(remote), 'config', 'uploadpack.allowFilter', 'true')
            (source / 'app').mkdir()
            (source / 'app/build.py').write_text('print("fixture cached build")\n')
            (source / 'dist').mkdir()
            for name, content in [('keep.txt', 'same'), ('update.txt', 'new'), ('added.txt', 'added')]:
                (source / 'dist' / name).write_text(content)
            run('git', 'add', '.', cwd=source)
            run('git', 'commit', '-qm', 'Source fixture', cwd=source)
            code = (ROOT / 'scripts/publish.py').read_text()
            anchor = 'ROOT = Path(__file__).resolve().parents[1]'
            self.assertEqual(code.count(anchor), 1)
            scope = {'__name__': 'publisher_fixture', '__file__': str(ROOT / 'scripts/publish.py')}
            exec(compile(code.replace(anchor, 'ROOT = Path(' + repr(str(source)) + ')'), 'publisher_fixture', 'exec'), scope)
            scope['REPOSITORY'] = remote.as_uri()
            scope['publish']()
            current = run('git', '--git-dir', str(remote), 'rev-parse', 'gh-pages')
            self.assertNotEqual(current, original)
            self.assertEqual(run('git', '--git-dir', str(remote), 'rev-parse', 'gh-pages^'), original)
            self.assertEqual(run('git', '--git-dir', str(remote), 'ls-tree', '-r', '--name-only', 'gh-pages').splitlines(), ['added.txt', 'keep.txt', 'update.txt'])
            for name in ['added.txt', 'keep.txt', 'update.txt']:
                self.assertEqual(run('git', '--git-dir', str(remote), 'show', 'gh-pages:' + name), (source / 'dist' / name).read_text())
            scope['publish']()
            self.assertEqual(run('git', '--git-dir', str(remote), 'rev-parse', 'gh-pages'), current)


if __name__ == '__main__':
    unittest.main()
