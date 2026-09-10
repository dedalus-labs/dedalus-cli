// @custom start
// Bind AS sessions to their resource and preserve revocation and callback failures.
import assert from 'node:assert/strict'
import { Server } from 'node:http'
import test from 'node:test'
import { beginDedalusOAuth, createDedalusAuthProvider } from '../src/auth/oauth.js'
import { fetchUserInfo, requestTokenSet } from '../src/auth/oauth-http.js'
import { accessTokenForCommand } from '../src/auth/workflow.js'
import type { OAuthSession } from '../src/auth/types.js'

const configuration = {
  issuer: 'https://as.example.com',
  clientId: 'dedalus-cli',
  resource: 'https://dcs.example.com',
  gatewayURL: 'https://gateway.example.com/dcs',
}
const session: OAuthSession = {
  version: 1,
  ...configuration,
  accessToken: 'access',
  refreshToken: 'refresh',
  accessTokenExpiresAt: 2_000_000_000_000,
  userId: 'user_one',
  organizationId: 'org_one',
  grantedScopes: ['offline_access', 'dedalus:cli'],
}
const info = {
  iss: configuration.issuer,
  sub: session.userId,
  org_id: session.organizationId,
  client_id: configuration.clientId,
  aud: configuration.resource,
  scope: 'offline_access dedalus:cli',
  exp: 2_000_000_000,
}

test('AS identity requires the configured issuer, client, resource, scope and expiry', async () => {
  for (const replacement of [
    { iss: 'https://other.example.com' },
    { client_id: 'other' },
    { aud: 'https://other.example.com' },
    { scope: 'offline_access' },
    { exp: 1 },
  ]) {
    await assert.rejects(
      fetchUserInfo(
        new URL(configuration.issuer),
        'access',
        async () => Response.json({ ...info, ...replacement }),
        configuration.clientId,
        configuration.resource,
        Date.now,
      ),
    )
  }
  assert.deepEqual(
    await fetchUserInfo(
      new URL(configuration.issuer),
      'access',
      async () => Response.json(info),
      configuration.clientId,
      configuration.resource,
      Date.now,
    ),
    { userId: session.userId, organizationId: session.organizationId },
  )
})

test('stored tokens cannot move to another resource or gateway', async () => {
  for (const replacement of [
    { resource: 'https://other.example.com' },
    { gatewayURL: 'https://other.example.com/dcs' },
  ]) {
    let calls = 0
    const provider = createDedalusAuthProvider(
      { ...configuration, ...replacement },
      {
        fetch: async () => {
          calls++
          throw new Error('must not request')
        },
      },
    )
    await assert.rejects(
      accessTokenForCommand(
        {
          backend: 'keyring',
          read: async () => session,
          write: async () => {},
          remove: async () => false,
          withLifecycleLock: async (operation) => operation(),
        },
        provider,
      ),
      { code: 'cli_session_provider_mismatch' },
    )
    await assert.rejects(provider.revoke(session), { code: 'session_provider_mismatch' })
    assert.equal(calls, 0)
  }
})

test('AS refresh cannot silently reuse a missing rotated token or scope', async () => {
  for (const replacement of [{ refresh_token: undefined }, { scope: undefined }]) {
    await assert.rejects(
      requestTokenSet({
        issuer: new URL(configuration.issuer),
        body: new URLSearchParams(),
        now: Date.now,
        networkErrorCode: 'refresh_failed',
        request: async () =>
          Response.json({
            access_token: 'access',
            refresh_token: 'rotated',
            scope: 'offline_access dedalus:cli',
            token_type: 'Bearer',
            expires_in: 900,
            ...replacement,
          }),
      }),
    )
  }
})

test('revocation preserves the exact network failure without confirming success', async () => {
  const cause = new Error('revocation transport failed')
  for (const failAt of [1, 2]) {
    let calls = 0
    const provider = createDedalusAuthProvider(configuration, {
      fetch: async () => {
        calls++
        if (calls === failAt) throw cause
        return new Response(null, { status: 200 })
      },
    })
    await assert.rejects(
      provider.revoke(session),
      (error) => error instanceof Error && error.cause === cause,
    )
    assert.equal(calls, failAt)
  }
})

test('callback cleanup failure prevents code exchange', async (context) => {
  const cause = new Error('listener close failed')
  const close = Server.prototype.close
  context.mock.method(
    Server.prototype,
    'close',
    function (this: Server, callback?: (error?: Error) => void) {
      return close.call(this, () => callback?.(cause))
    },
  )
  let tokenCalls = 0
  const attempt = await beginDedalusOAuth(configuration, {
    fetch: async () => {
      tokenCalls++
      throw new Error('must not exchange')
    },
  })
  const authorization = new URL(attempt.authorizationURL)
  const callback = new URL(attempt.redirectURI)
  callback.search = new URLSearchParams({
    code: 'authorization-code',
    state: authorization.searchParams.get('state')!,
    iss: configuration.issuer,
  }).toString()
  const response = await fetch(callback)
  await response.text()
  await assert.rejects(
    attempt.complete(),
    (error) => error instanceof Error && error.cause === cause,
  )
  assert.equal(tokenCalls, 0)
})
// @custom end
