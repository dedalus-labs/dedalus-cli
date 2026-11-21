"""Drive the packaged CLI at a terminal; never open a real browser or submit a key."""
import os
import pty
import re
import select
import subprocess
import sys
import tempfile
import time
from pathlib import Path

node, cli = sys.argv[1:]
with tempfile.TemporaryDirectory() as home:
    for opener in ('open', 'xdg-open'):
        script = Path(home, opener)
        script.write_text('#!/bin/sh\nexit 0\n')
        script.chmod(0o700)
    env = {'HOME': home, 'PATH': home + ':' + os.environ['PATH'], 'TERM': 'xterm'}
    menu = b'> Sign in with a browser\n  Use an API key\n  arrows to move, enter to choose'

    def check(args, keys, expected):
        master, slave = pty.openpty()
        child = subprocess.Popen([node, cli, 'login', *args], env=env, stdin=slave, stderr=slave, stdout=slave)
        os.close(slave)
        output = b''
        sent = False
        try:
            deadline = time.monotonic() + 4
            while time.monotonic() < deadline:
                if not select.select([master], [], [], 0.1)[0]:
                    continue
                output += os.read(master, 32768)
                plain = re.sub(rb'\x1b\[[0-9;?]*[A-Za-z]', b'', output).replace(b'\r', b'')
                if keys and not sent and menu in plain:
                    assert b'--flow' not in plain and b'Enter your access token' not in plain
                    os.write(master, keys)
                    sent = True
                if expected in plain:
                    assert sent if keys else b'How would you like to sign in?' not in plain
                    return
            raise AssertionError('login never reached expected prompt: ' + expected.decode())
        finally:
            if child.poll() is None:
                child.kill()
            child.wait()
            os.close(master)

    check([], b'\r', b'Opening your browser to sign in.')
    check([], b'\x1b[B\r', b'API key: ')
    check(['--flow', 'api-key'], None, b'Access token: ')
    check(['--flow', 'x-api-key'], None, b'API key: ')
    check(['--flow', 'oauth-browser'], None, b'Opening your browser to sign in.')
