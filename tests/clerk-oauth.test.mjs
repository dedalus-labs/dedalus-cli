import assert from 'node:assert/strict'
import { createServer, request as httpRequest } from 'node:http'
import { connect } from 'node:net'
import { once } from 'node:events'
import test from 'node:test'

import {
  beginClerkOAuth,
  clerkPKCEChallenge,
  ClerkOAuthError,
  createClerkAuthProvider,
} from '../dist/esm/custom/auth/oauth.js'

const tokenResponse = (overrides = {}) => ({
  access_token: 'oauth-access-token',
  refresh_token: 'oauth-refresh-token',
  expires_in: 86_400,
  scope: 'offline_access user:org:read',
  token_type: 'Bearer',
  ...overrides,
})

const userInfo = (overrides = {}) => ({
  sub: 'user_cli',
  org_id: 'org_cli',
  org_name: 'Dedalus Labs',
  ...overrides,
})

const finishAuthorization = async (attempt, authorization) => {
  const callback = new URL(attempt.redirectURI)
  callback.searchParams.set('code', 'authorization-code')
  callback.searchParams.set('iss', authorization.origin)
  callback.searchParams.set('state', authorization.searchParams.get('state'))
  const response = await fetch(callback)
  assert.equal(response.status, 200)
  assert.match(await response.text(), /close this window/u)
}

test('invariant PKCE uses the RFC 7636 S256 transform', () => {
  assert.equal(
    clerkPKCEChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  )
})

test('invariant Clerk OAuth stores the complete organization-bound token set', async () => {
  const requests = []
  const attempt = await beginClerkOAuth(
    { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
    {
      now: () => 1_000,
      randomBytes: () => Buffer.alloc(32, 7),
      fetch: async (input, init) => {
        requests.push({ input: String(input), init })
        if (String(input).endsWith('/oauth/token')) return Response.json(tokenResponse())
        return Response.json(userInfo())
      },
    },
  )
  const authorization = new URL(attempt.authorizationURL)
  const redirect = new URL(attempt.redirectURI)

  assert.equal(authorization.origin + authorization.pathname, 'https://clerk.example.com/oauth/authorize')
  assert.equal(authorization.searchParams.get('response_type'), 'code')
  assert.equal(authorization.searchParams.get('client_id'), 'client_cli')
  assert.equal(authorization.searchParams.get('redirect_uri'), attempt.redirectURI)
  assert.equal(authorization.searchParams.get('scope'), 'offline_access user:org:read')
  assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(redirect.hostname, '127.0.0.1')
  assert.notEqual(redirect.port, '')
  assert.equal(redirect.pathname, '/callback')

  await finishAuthorization(attempt, authorization)
  const result = await attempt.complete()

  assert.deepEqual(result, {
    version: 1,
    issuer: 'https://clerk.example.com',
    clientId: 'client_cli',
    accessToken: 'oauth-access-token',
    accessTokenExpiresAt: 86_401_000,
    refreshToken: 'oauth-refresh-token',
    userId: 'user_cli',
    organizationId: 'org_cli',
    organizationName: 'Dedalus Labs',
    grantedScopes: ['offline_access', 'user:org:read'],
  })
  assert.equal(requests[0].input, 'https://clerk.example.com/oauth/token')
  assert.equal(requests[0].init.redirect, 'manual')
  const body = new URLSearchParams(requests[0].init.body)
  assert.equal(body.get('grant_type'), 'authorization_code')
  assert.equal(body.get('client_secret'), null)
  assert.equal(body.get('code_verifier').length, 43)
  assert.equal(requests[1].input, 'https://clerk.example.com/oauth/userinfo')
  assert.equal(requests[1].init.headers.Authorization, 'Bearer oauth-access-token')
  assert.equal(requests[1].init.redirect, 'manual')
})

test('invariant the optional website handoff keeps OAuth state out of HTTP query logs', async () => {
  const attempt = await beginClerkOAuth({
    issuer: 'https://clerk.example.com',
    clientId: 'client_cli',
    signInURL: 'https://dev.dedaluslabs.ai/cli/sign-in',
  })
  const handoff = new URL(attempt.authorizationURL)
  const fragment = new URLSearchParams(handoff.hash.slice(1))
  const authorization = new URL(fragment.get('authorization_url'))

  assert.equal(handoff.origin + handoff.pathname, 'https://dev.dedaluslabs.ai/cli/sign-in')
  assert.equal(handoff.search, '')
  assert.equal(authorization.origin + authorization.pathname, 'https://clerk.example.com/oauth/authorize')
  assert.equal(authorization.searchParams.get('redirect_uri'), attempt.redirectURI)
  await attempt.cancel()
})

test('invariant a partial loopback request cannot stall OAuth cancellation', async () => {
  const attempt = await beginClerkOAuth({
    issuer: 'https://clerk.example.com',
    clientId: 'client_cli',
  })
  const callback = new URL(attempt.redirectURI)
  const socket = connect(Number(callback.port), callback.hostname)
  await once(socket, 'connect')
  socket.write('GET /callback HTTP/1.1\r\nHost: 127.0.0.1')
  socket.on('error', () => undefined)
  const closed = new Promise((resolve) => socket.once('close', resolve))

  await attempt.cancel()
  await closed
  await assert.rejects(
    attempt.complete(),
    (error) => error instanceof ClerkOAuthError && error.code === 'login_cancelled',
  )
})

test('invariant the CLI never opens an authorization request the website will reject', async () => {
  const issuer = `https://${'a'.repeat(3_900)}.example.com`

  await assert.rejects(
    beginClerkOAuth({
      issuer,
      clientId: 'c'.repeat(1_024),
      signInURL: 'https://dedalus.example.com/cli/sign-in',
    }),
    (error) => error instanceof ClerkOAuthError && error.code === 'invalid_configuration',
  )
})

test('invariant an invalid OAuth state cannot reach token exchange', async () => {
  let tokenRequests = 0
  const attempt = await beginClerkOAuth(
    { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
    { fetch: async (input) => {
      if (String(input).endsWith('/oauth/token')) {
        tokenRequests += 1
        return Response.json(tokenResponse())
      }
      return Response.json(userInfo())
    } },
  )
  const authorization = new URL(attempt.authorizationURL)
  const callback = new URL(attempt.redirectURI)
  callback.searchParams.set('code', 'intercepted-code')
  callback.searchParams.set('state', 'wrong-state')

  const response = await fetch(callback)
  await response.text()

  assert.equal(response.status, 400)
  assert.equal(tokenRequests, 0)

  await finishAuthorization(attempt, authorization)
  assert.equal((await attempt.complete()).organizationId, 'org_cli')
  assert.equal(tokenRequests, 1)
})

test('invariant an authorization response from another issuer cannot reach token exchange', async () => {
  let tokenRequests = 0
  const attempt = await beginClerkOAuth(
    { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
    { fetch: async () => { tokenRequests += 1; return Response.json(tokenResponse()) } },
  )
  const authorization = new URL(attempt.authorizationURL)
  const callback = new URL(attempt.redirectURI)
  callback.searchParams.set('code', 'authorization-code')
  callback.searchParams.set('iss', 'https://attacker.example.com')
  callback.searchParams.set('state', authorization.searchParams.get('state'))

  const response = await fetch(callback)
  await response.text()

  assert.equal(response.status, 400)
  await assert.rejects(attempt.complete(), (error) =>
    error instanceof ClerkOAuthError && error.code === 'issuer_mismatch')
  assert.equal(tokenRequests, 0)
})

test('invariant a malformed local request cannot terminate the OAuth callback', async () => {
  const attempt = await beginClerkOAuth(
    { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
    { fetch: async (input) => String(input).endsWith('/oauth/token')
      ? Response.json(tokenResponse())
      : Response.json(userInfo()) },
  )
  const authorization = new URL(attempt.authorizationURL)
  const redirect = new URL(attempt.redirectURI)
  const status = await new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: redirect.hostname,
      method: 'GET',
      path: 'http://[',
      port: redirect.port,
    }, (response) => {
      response.resume()
      response.once('end', () => resolve(response.statusCode))
    })
    request.once('error', reject)
    request.end()
  })

  assert.equal(status, 400)
  await finishAuthorization(attempt, authorization)
  assert.equal((await attempt.complete()).organizationId, 'org_cli')
})

test('invariant OAuth provider denial cannot reach token exchange', async () => {
  let tokenRequests = 0
  const attempt = await beginClerkOAuth(
    { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
    { fetch: async () => { tokenRequests += 1; return Response.json({}) } },
  )
  const authorization = new URL(attempt.authorizationURL)
  const callback = new URL(attempt.redirectURI)
  callback.searchParams.set('error', 'access_denied')
  callback.searchParams.set('error_description', 'raw provider detail must not escape')
  callback.searchParams.set('iss', authorization.origin)
  callback.searchParams.set('state', authorization.searchParams.get('state'))

  const response = await fetch(callback)
  await response.text()

  await assert.rejects(attempt.complete(), (error) =>
    error instanceof ClerkOAuthError &&
    error.code === 'access_denied' &&
    error.stage === 'provider' &&
    error.message === 'access_denied')
  assert.equal(tokenRequests, 0)
})

test('invariant incomplete Clerk token sets cannot authenticate', async () => {
  const attempt = await beginClerkOAuth(
    { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
    { fetch: async () => Response.json(tokenResponse({ refresh_token: undefined })) },
  )
  const authorization = new URL(attempt.authorizationURL)
  await finishAuthorization(attempt, authorization)

  await assert.rejects(attempt.complete(), (error) =>
    error instanceof ClerkOAuthError &&
    error.code === 'invalid_token_response' &&
    error.stage === 'local' &&
    error.status === 200)
})

test('invariant OAuth responses are decoded within a fixed memory bound', async () => {
  const attempt = await beginClerkOAuth(
    { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
    { fetch: async () => new Response(' '.repeat(513 * 1024)) },
  )
  const authorization = new URL(attempt.authorizationURL)
  await finishAuthorization(attempt, authorization)

  await assert.rejects(attempt.complete(), (error) =>
    error instanceof ClerkOAuthError &&
    error.code === 'invalid_token_response' &&
    error.stage === 'local' &&
    error.status === 200)
})

test('invariant Clerk cannot grant scopes outside the requested V1 bundle', async () => {
  const attempt = await beginClerkOAuth(
    { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
    { fetch: async () => Response.json(tokenResponse({
      scope: 'offline_access user:org:read admin:all',
    })) },
  )
  const authorization = new URL(attempt.authorizationURL)
  await finishAuthorization(attempt, authorization)

  await assert.rejects(attempt.complete(), (error) =>
    error instanceof ClerkOAuthError && error.code === 'invalid_scope' && error.status === 200)
})

test('invariant a present OAuth scope value must be a string', async () => {
  const attempt = await beginClerkOAuth(
    { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
    { fetch: async () => Response.json(tokenResponse({
      scope: ['offline_access', 'user:org:read'],
    })) },
  )
  const authorization = new URL(attempt.authorizationURL)
  await finishAuthorization(attempt, authorization)

  await assert.rejects(attempt.complete(), (error) =>
    error instanceof ClerkOAuthError && error.code === 'invalid_scope' && error.status === 200)
})

test('invariant OAuth credentials are never normalized or accepted with whitespace', async () => {
  const attempt = await beginClerkOAuth(
    { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
    { fetch: async () => Response.json(tokenResponse({ access_token: ' altered-token' })) },
  )
  const authorization = new URL(attempt.authorizationURL)
  await finishAuthorization(attempt, authorization)

  await assert.rejects(attempt.complete(), (error) =>
    error instanceof ClerkOAuthError && error.code === 'invalid_token_response' && error.status === 200)
})

test('invariant token endpoint errors retain the provider code and HTTP status', async () => {
  const attempt = await beginClerkOAuth(
    { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
    { fetch: async () => Response.json({ error: 'provider_specific_error' }, { status: 400 }) },
  )
  const authorization = new URL(attempt.authorizationURL)
  await finishAuthorization(attempt, authorization)

  await assert.rejects(attempt.complete(), (error) =>
    error instanceof ClerkOAuthError &&
    error.code === 'provider_specific_error' &&
    error.stage === 'provider' &&
    error.status === 400)
})

test('invariant oversized userinfo identifiers cannot enter credential storage', async () => {
  const attempt = await beginClerkOAuth(
    { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
    { fetch: async (input) => String(input).endsWith('/oauth/token')
      ? Response.json(tokenResponse())
      : Response.json(userInfo({ sub: 'u'.repeat(1025) })) },
  )
  const authorization = new URL(attempt.authorizationURL)
  await finishAuthorization(attempt, authorization)

  await assert.rejects(attempt.complete(), (error) =>
    error instanceof ClerkOAuthError &&
    error.code === 'invalid_userinfo_response' &&
    error.stage === 'local' &&
    error.status === 200)
})

test('invariant unsafe OAuth error codes cannot inject terminal control characters', async () => {
  const attempt = await beginClerkOAuth(
    { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
    { fetch: async () => Response.json({ error: '\u001b[31mprovider_error' }, { status: 400 }) },
  )
  const authorization = new URL(attempt.authorizationURL)
  await finishAuthorization(attempt, authorization)

  await assert.rejects(attempt.complete(), (error) =>
    error instanceof ClerkOAuthError && error.code === 'oauth_error' && error.status === 400)
})

test('invariant token expiry must fit in a safe timestamp', async () => {
  const attempt = await beginClerkOAuth(
    { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
    {
      now: () => Number.MAX_SAFE_INTEGER - 100,
      fetch: async () => Response.json(tokenResponse({ expires_in: 1 })),
    },
  )
  const authorization = new URL(attempt.authorizationURL)
  await finishAuthorization(attempt, authorization)

  await assert.rejects(attempt.complete(), (error) =>
    error instanceof ClerkOAuthError && error.code === 'invalid_token_response' && error.status === 200)
})

test('invariant token expiry must fit in the JavaScript date range', async () => {
  const attempt = await beginClerkOAuth(
    { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
    {
      now: () => 0,
      fetch: async () => Response.json(tokenResponse({ expires_in: 8_700_000_000_000 })),
    },
  )
  const authorization = new URL(attempt.authorizationURL)
  await finishAuthorization(attempt, authorization)

  await assert.rejects(attempt.complete(), (error) =>
    error instanceof ClerkOAuthError && error.code === 'invalid_token_response' && error.status === 200)
})

test('invariant login requires Clerk organization identity', async () => {
  const attempt = await beginClerkOAuth(
    { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
    { fetch: async (input) => String(input).endsWith('/oauth/token')
      ? Response.json(tokenResponse())
      : Response.json(userInfo({ org_id: undefined })) },
  )
  const authorization = new URL(attempt.authorizationURL)
  await finishAuthorization(attempt, authorization)

  await assert.rejects(attempt.complete(), (error) =>
    error instanceof ClerkOAuthError && error.code === 'invalid_userinfo_response' && error.status === 200)
})

test('invariant login requires Clerk userinfo sub without an alternate identity fallback', async () => {
  const attempt = await beginClerkOAuth(
    { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
    { fetch: async (input) => String(input).endsWith('/oauth/token')
      ? Response.json(tokenResponse())
      : Response.json(userInfo({ sub: undefined, user_id: 'alternate_user' })) },
  )
  const authorization = new URL(attempt.authorizationURL)
  await finishAuthorization(attempt, authorization)

  await assert.rejects(attempt.complete(), (error) =>
    error instanceof ClerkOAuthError && error.code === 'invalid_userinfo_response' && error.status === 200)
})

test('invariant opaque access tokens with dot separators remain supported', async () => {
  const attempt = await beginClerkOAuth(
    { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
    { fetch: async (input) => String(input).endsWith('/oauth/token')
      ? Response.json(tokenResponse({ access_token: 'opaque.access.token' }))
      : Response.json(userInfo()) },
  )
  const authorization = new URL(attempt.authorizationURL)
  await finishAuthorization(attempt, authorization)

  assert.equal((await attempt.complete()).accessToken, 'opaque.access.token')
})
test('invariant OAuth token exchange never follows redirects', async () => {
  let forwardedRequests = 0
  const receiver = createServer((_request, response) => {
    forwardedRequests += 1
    response.end(JSON.stringify(tokenResponse()))
  })
  await listen(receiver)
  const tokenEndpoint = createServer((_request, response) => {
    response.writeHead(307, { Location: serverURL(receiver) })
    response.end()
  })
  await listen(tokenEndpoint)

  try {
    const attempt = await beginClerkOAuth(
      { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
      { fetch: (_input, init) => fetch(serverURL(tokenEndpoint), init) },
    )
    const authorization = new URL(attempt.authorizationURL)
    await finishAuthorization(attempt, authorization)

    await assert.rejects(attempt.complete(), (error) =>
      error instanceof ClerkOAuthError && error.code === 'oauth_error' && error.status === 307)
    assert.equal(forwardedRequests, 0)
  } finally {
    await close(tokenEndpoint)
    await close(receiver)
  }
})

test('invariant OAuth userinfo requests never forward access tokens across redirects', async () => {
  let forwardedRequests = 0
  const receiver = createServer((_request, response) => {
    forwardedRequests += 1
    response.end(JSON.stringify(userInfo()))
  })
  await listen(receiver)
  const userinfoEndpoint = createServer((_request, response) => {
    response.writeHead(307, { Location: serverURL(receiver) })
    response.end()
  })
  await listen(userinfoEndpoint)

  try {
    const attempt = await beginClerkOAuth(
      { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
      { fetch: (input, init) => String(input).endsWith('/oauth/token')
        ? Promise.resolve(Response.json(tokenResponse()))
        : fetch(serverURL(userinfoEndpoint), init) },
    )
    const authorization = new URL(attempt.authorizationURL)
    await finishAuthorization(attempt, authorization)

    await assert.rejects(attempt.complete(), (error) =>
      error instanceof ClerkOAuthError && error.code === 'oauth_error' && error.status === 307)
    assert.equal(forwardedRequests, 0)
  } finally {
    await close(userinfoEndpoint)
    await close(receiver)
  }
})

test('invariant Clerk refresh preserves verified metadata without a userinfo request', async () => {
  const requests = []
  const provider = createClerkAuthProvider(
    { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
    {
      now: () => 10_000,
      fetch: async (input, init) => {
        requests.push({ input: String(input), init })
        if (String(input).endsWith('/oauth/token')) {
          return Response.json(tokenResponse({
            access_token: 'refreshed-access-token',
            refresh_token: undefined,
            expires_in: 3_600,
          }))
        }
        throw new Error('userinfo is unavailable')
      },
    },
  )
  const refreshed = await provider.refresh({
    version: 1,
    issuer: 'https://clerk.example.com',
    clientId: 'client_cli',
    accessToken: 'expired-access-token',
    accessTokenExpiresAt: 1,
    refreshToken: 'original-refresh-token',
    userId: 'user_cli',
    organizationId: 'org_cli',
    organizationName: 'Dedalus Labs',
    grantedScopes: ['offline_access', 'user:org:read'],
    providerSessionId: 'session_cli',
  })

  assert.equal(refreshed.accessToken, 'refreshed-access-token')
  assert.equal(refreshed.refreshToken, 'original-refresh-token')
  assert.equal(refreshed.accessTokenExpiresAt, 3_610_000)
  assert.equal(refreshed.organizationName, 'Dedalus Labs')
  assert.equal(refreshed.providerSessionId, 'session_cli')
  assert.equal(requests.length, 1)
  const body = new URLSearchParams(requests[0].init.body)
  assert.equal(body.get('grant_type'), 'refresh_token')
  assert.equal(body.get('refresh_token'), 'original-refresh-token')
  assert.equal(requests[0].init.redirect, 'manual')
})

test('invariant a malformed returned refresh token cannot masquerade as omission', async () => {
  const authProvider = createClerkAuthProvider(
    { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
    { fetch: async () => Response.json(tokenResponse({ refresh_token: 'malformed token' })) },
  )

  await assert.rejects(authProvider.refresh({
    version: 1,
    issuer: 'https://clerk.example.com',
    clientId: 'client_cli',
    accessToken: 'expired-access-token',
    accessTokenExpiresAt: 1,
    refreshToken: 'original-refresh-token',
    userId: 'user_cli',
    organizationId: 'org_cli',
    grantedScopes: ['offline_access', 'user:org:read'],
  }), (error) =>
    error instanceof ClerkOAuthError && error.code === 'invalid_token_response' && error.status === 200)
})

test('invariant Clerk revocation sends only the refresh token and reports confirmation', async () => {
  let request
  const provider = createClerkAuthProvider(
    { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
    { fetch: async (input, init) => {
      request = { input: String(input), init }
      return new Response(null, { status: 200 })
    } },
  )
  const confirmed = await provider.revoke({
    version: 1,
    issuer: 'https://clerk.example.com',
    clientId: 'client_cli',
    accessToken: 'access-token-must-not-be-sent',
    accessTokenExpiresAt: 2_000_000_000_000,
    refreshToken: 'refresh-token',
    userId: 'user_cli',
    organizationId: 'org_cli',
    grantedScopes: ['offline_access', 'user:org:read'],
  })

  assert.equal(confirmed, true)
  assert.equal(request.input, 'https://clerk.example.com/oauth/token/revoke')
  assert.equal(request.input.includes('refresh-token'), false)
  assert.equal(new URLSearchParams(request.init.body).get('token'), 'refresh-token')
  assert.equal(request.init.redirect, 'manual')
})

test('invariant Clerk revocation never forwards a refresh token across redirects', async () => {
  let forwardedRequests = 0
  const receiver = createServer((_request, response) => {
    forwardedRequests += 1
    response.writeHead(200)
    response.end()
  })
  await listen(receiver)
  const revocationEndpoint = createServer((_request, response) => {
    response.writeHead(307, { Location: serverURL(receiver) })
    response.end()
  })
  await listen(revocationEndpoint)

  try {
    const authProvider = createClerkAuthProvider(
      { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
      { fetch: (_input, init) => fetch(serverURL(revocationEndpoint), init) },
    )
    assert.equal(await authProvider.revoke({
      version: 1,
      issuer: 'https://clerk.example.com',
      clientId: 'client_cli',
      accessToken: 'access-token',
      accessTokenExpiresAt: 2_000_000_000_000,
      refreshToken: 'refresh-token',
      userId: 'user_cli',
      organizationId: 'org_cli',
      grantedScopes: ['offline_access', 'user:org:read'],
    }), false)
    assert.equal(forwardedRequests, 0)
  } finally {
    await close(revocationEndpoint)
    await close(receiver)
  }
})

test('invariant OAuth configuration rejects non-TLS Clerk issuers and handoffs', async () => {
  await assert.rejects(
    beginClerkOAuth({ issuer: 'http://clerk.example.com', clientId: 'client_cli' }),
    (error) => error instanceof ClerkOAuthError && error.code === 'invalid_configuration',
  )
  await assert.rejects(
    beginClerkOAuth({
      issuer: 'https://clerk.example.com',
      clientId: 'client_cli',
      signInURL: 'http://dev.dedaluslabs.ai/cli/sign-in',
    }),
    (error) => error instanceof ClerkOAuthError && error.code === 'invalid_configuration',
  )
  await assert.rejects(
    beginClerkOAuth({ issuer: ' https://clerk.example.com', clientId: 'client_cli' }),
    (error) => error instanceof ClerkOAuthError && error.code === 'invalid_configuration',
  )
  await assert.rejects(
    beginClerkOAuth({ issuer: 'https://clerk.example.com', clientId: ' client_cli' }),
    (error) => error instanceof ClerkOAuthError && error.code === 'invalid_configuration',
  )
})

test('invariant OAuth configuration permits a loopback website handoff in development', async () => {
  const attempt = await beginClerkOAuth({
    issuer: 'https://clerk.example.com',
    clientId: 'client_cli',
    signInURL: 'http://localhost:3000/cli/sign-in',
  })
  assert.equal(new URL(attempt.authorizationURL).origin, 'http://localhost:3000')
  await attempt.cancel()
})

const listen = (server) => new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})

const close = (server) => new Promise((resolve, reject) => {
  server.close((error) => error ? reject(error) : resolve())
})

const serverURL = (server) => {
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  return `http://127.0.0.1:${address.port}`
}
