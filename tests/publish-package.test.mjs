import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publishNpm } from '../scripts/publish-npm.mjs';

for (const [version, tag] of [['0.9.3', undefined], ['0.10.0-rc.1', 'rc'], ['0.10.0-latest.1', 'latest-prerelease']]) {
  test(`invariant_publishing_uses_the_packed_node_archive_and_preserves_release_channels (${version})`, () => {
    const calls = [];
    publishNpm((args) => {
      calls.push(args);
      return { status: args[0] === 'view' ? 1 : 0 };
    }, { name: 'dedalus-cli', version });
    assert.deepEqual(calls, [
      ['view', `dedalus-cli@${version}`, 'version'],
      ['publish', `./release-packages/dedalus-cli-${version}.tgz`, '--no-git-checks', '--access', 'public', ...(tag ? ['--tag', tag] : [])],
    ]);
  });
}

test('invariant_a_failed_publish_never_reports_success', () => {
  assert.throws(() => publishNpm(() => ({ status: 1 }), { name: 'dedalus-cli', version: '0.9.3' }), /publish failed/);
});

test('invariant_an_existing_registry_version_is_not_republished', () => {
  const calls = [];
  publishNpm((args) => { calls.push(args); return { status: 0 }; }, { name: 'dedalus-cli', version: '0.9.3' });
  assert.deepEqual(calls, [['view', 'dedalus-cli@0.9.3', 'version']]);
});
