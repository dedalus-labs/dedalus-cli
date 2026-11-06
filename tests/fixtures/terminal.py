"""Run a command with piped stdin and a separate controlling terminal."""

import errno
import fcntl
import os
import pty
import selectors
import signal
import subprocess
import sys
import termios

master, slave = pty.openpty()


def attach():
    os.setsid()
    fcntl.ioctl(slave, termios.TIOCSCTTY, 0)


child = subprocess.Popen(sys.argv[1:], stdin=sys.stdin, stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, preexec_fn=attach, pass_fds=(slave,))
os.close(slave)
signal.signal(signal.SIGTERM, lambda *_: os.killpg(child.pid, signal.SIGTERM))
selector = selectors.DefaultSelector()
selector.register(child.stdout, selectors.EVENT_READ, 1)
selector.register(child.stderr, selectors.EVENT_READ, 2)
selector.register(master, selectors.EVENT_READ, None)
pending = b''
try:
    while selector.get_map():
        for key, _ in selector.select():
            try:
                data = os.read(key.fd, 65536)
            except OSError as error:
                if error.errno != errno.EIO:
                    raise
                data = b''
            if not data:
                selector.unregister(key.fileobj)
                continue
            if key.data is None:
                continue
            os.write(key.data, data)
            pending += data
            if b'INPUT_READY' in pending and os.environ.get('TEST_TTY_INPUT'):
                data = os.environ.pop('TEST_TTY_INPUT').encode()
                os.write(master, data)
    sys.exit(child.wait())
finally:
    if child.poll() is None:
        child.terminate()
        child.wait()
    os.close(master)
