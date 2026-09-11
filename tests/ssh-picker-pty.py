"""Exercise the real picker against a pseudo-terminal after `npm run build`."""

import errno
import json
import os
import pty
import select
import subprocess
import time


SCRIPT = """
import { pickSSHMachine } from './dist/esm/custom/ssh-picker.js';
const mode = process.argv[1];
const api = {listMachines: (_cursor, signal) => mode === 'loading'
  ? new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason)))
  : Promise.resolve({items: [
    {machine_id: 'dm-alpha', name: 'alpha', phase: 'running'},
    {machine_id: 'dm-beta', name: 'beta', phase: 'sleeping'},
  ], next_cursor: null})};
const selected = await pickSSHMachine(api);
console.log('RESULT:' + JSON.stringify({selected: selected ?? null, raw: process.stdin.isRaw}));
"""


def scenario(name, mode, keys, expected):
    master, slave = pty.openpty()
    process = subprocess.Popen(
        ['node', '--input-type=module', '-e', SCRIPT, mode],
        stdin=slave, stdout=slave, stderr=slave,
    )
    os.close(slave)
    transcript = b''
    sent = False
    deadline = time.monotonic() + 5
    try:
        while time.monotonic() < deadline:
            if not select.select([master], [], [], 0.1)[0]:
                if process.poll() is not None:
                    break
                continue
            try:
                chunk = os.read(master, 65536)
            except OSError as error:
                if error.errno == errno.EIO:
                    break
                raise
            if not chunk:
                break
            transcript += chunk
            ready = b'Loading machines' if mode == 'loading' else b'Esc cancel'
            if not sent and ready in transcript and (mode == 'loading' or b'dm-beta' in transcript):
                os.write(master, keys)
                sent = True
        process.wait(timeout=1)
        assert process.returncode == 0, transcript.decode()
        assert sent, transcript.decode()
        result = transcript.decode().split('RESULT:', 1)[1].splitlines()[0]
        assert json.loads(result) == {'selected': expected, 'raw': False}, result
        assert b'\x1b[?25h\x1b[?1049l' in transcript, 'terminal not restored'
        print(f'{name}: passed')
        return transcript.decode()
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()
        os.close(master)


scenario('search and Enter select stable ID', 'ready', b'beta\r', 'dm-beta')
scenario('arrow keys select machine', 'ready', b'\x1b[B\x1b[A\x1b[B\r', 'dm-beta')
scenario('Escape cancels', 'ready', b'\x1b', None)
scenario('Ctrl-C cancels', 'ready', b'\x03', None)
scenario('Escape aborts pending request', 'loading', b'\x1b', None)
