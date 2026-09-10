// @custom start
// Enforce private configuration ownership and exact endpoint binding.
import assert from 'node:assert/strict'
import { chmod, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { cliAuthConfiguration } from '../src/auth/configuration.js'
import { cliOAuthGatewayURL } from '../src/auth/commands.js'

test('private configuration requires one complete owner-private endpoint bundle', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cli-private-config-'))
  const path = join(directory, 'auth.json')
  const bundle = {
    issuer: 'https://as.example.com',
    clientId: 'dedalus-cli',
    resource: 'https://dcs.example.com',
    gatewayURL: 'https://gateway.example.com/dcs',
    signInURL: 'https://website.example.com/cli/sign-in',
  }
  try {
    await writeFile(path, JSON.stringify(bundle), { mode: 0o600 })
    const environment = { DEDALUS_AUTH_CONFIG: path }
    assert.deepEqual(cliAuthConfiguration(environment), bundle)
    assert.equal(cliOAuthGatewayURL(environment), bundle.gatewayURL)
    assert.throws(() => cliOAuthGatewayURL(environment, 'https://admin.api.dedaluslabs.ai/dcs'), {
      code: 'environment_mismatch',
    })
    await symlink(path, join(directory, 'link.json'))
    assert.throws(() => cliAuthConfiguration({ DEDALUS_AUTH_CONFIG: join(directory, 'link.json') }))
    if (process.platform !== 'win32') {
      await chmod(path, 0o644)
      assert.throws(() => cliAuthConfiguration(environment), { code: 'invalid_configuration' })
      await chmod(path, 0o600)
    }
    for (const invalid of [
      { ...bundle, resource: undefined },
      { ...bundle, extra: true },
      { ...bundle, issuer: 'http://as.example.com' },
      { ...bundle, gatewayURL: 'https://attacker@gateway.example.com/dcs' },
      { ...bundle, clientId: 'other' },
    ]) {
      await writeFile(path, JSON.stringify(invalid))
      assert.throws(() => cliAuthConfiguration(environment), { code: 'invalid_configuration' })
    }
    await writeFile(path, '{')
    assert.throws(
      () => cliAuthConfiguration(environment),
      (error) => error instanceof Error && error.cause instanceof SyntaxError,
    )
    assert.throws(() => cliAuthConfiguration({ DEDALUS_AUTH_CONFIG: join(directory, 'missing') }), {
      code: 'configuration_unavailable',
    })
  } finally {
    await rm(directory, { recursive: true })
  }
})
// @custom end
