// @custom start
/** One-use OAuth callback listener. A result is usable only after response and listener cleanup. */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { DedalusOAuthError, oauthErrorCode, opaqueValue } from './oauth-http.js'
import {
  closeServer,
  deferred,
  equalSecret,
  listenOnLoopback,
  type Deferred,
} from './oauth-loopback.js'
import { oauthCallbackPage } from './oauth-page.js'

const callbackPath = '/callback'
const maxAuthorizationCodeLength = 8 * 1024

type CallbackState = {
  readonly result: Deferred<CallbackOutcome>
  readonly issuer: string
  readonly state: string
  settled: boolean
  timer?: ReturnType<typeof setTimeout>
}

type CallbackOutcome = { readonly code: string } | { readonly error: unknown }

export type OAuthCallbackListener = {
  readonly redirectURI: string
  readonly result: Promise<CallbackOutcome>
  readonly cancel: () => Promise<void>
  readonly startTimeout: (timeoutMs: number) => void
}

export const listenForOAuthCallback = async (
  issuer: string,
  expectedState: string,
): Promise<OAuthCallbackListener> => {
  const result = deferred<CallbackOutcome>()
  const state: CallbackState = { result, issuer, state: expectedState, settled: false }
  const server = createServer()
  server.on('error', (cause) => {
    settleCallback(state)
    completeCallback(server, state, {
      error: new DedalusOAuthError('callback_unavailable', { cause }),
    })
  })
  server.on('request', (request, response) => handleOAuthCallback(server, state, request, response))
  await listenOnLoopback(server)
  const address = server.address()
  if (!address || typeof address === 'string') {
    const failure = new DedalusOAuthError('callback_unavailable')
    try {
      await closeServer(server)
    } catch (cleanup) {
      throw new AggregateError([failure, cleanup], 'Callback address and cleanup failed')
    }
    throw failure
  }
  return {
    redirectURI: `http://127.0.0.1:${address.port}${callbackPath}`,
    result: result.promise,
    cancel: async () => {
      const cancelling = !state.settled
      state.settled = true
      if (state.timer !== undefined) clearTimeout(state.timer)
      try {
        await closeServer(server)
      } catch (cause) {
        const error = new DedalusOAuthError('callback_cleanup_failed', { cause })
        if (cancelling) result.resolve({ error })
        throw error
      }
      if (cancelling) result.resolve({ error: new DedalusOAuthError('login_cancelled') })
    },
    startTimeout: (timeoutMs) => startLoginTimeout(server, state, timeoutMs),
  }
}

const handleOAuthCallback = (
  server: Server,
  state: CallbackState,
  request: IncomingMessage,
  response: ServerResponse,
): void => {
  response.once('error', (cause) => {
    if (state.settled) return
    settleCallback(state)
    completeCallback(server, state, {
      error: new DedalusOAuthError('callback_response_failed', { cause }),
    })
  })
  const url = callbackURL(request, response)
  if (!url) return
  if (request.method !== 'GET' || url.pathname !== callbackPath) {
    writeCallbackResponse(response, 404, 'Not found')
    return
  }
  if (state.settled) {
    writeCallbackResponse(response, 410, 'Login attempt is already complete')
    return
  }
  const returnedStates = url.searchParams.getAll('state')
  if (returnedStates.length !== 1 || !equalSecret(returnedStates[0] ?? '', state.state)) {
    writeCallbackResponse(response, 400, 'Login response could not be verified')
    return
  }
  const returnedIssuers = url.searchParams.getAll('iss')
  if (returnedIssuers.length !== 1 || returnedIssuers[0] !== state.issuer) {
    settleCallback(state)
    finishOAuthCallback(
      server,
      state,
      response,
      'Login response could not be verified',
      new DedalusOAuthError('issuer_mismatch'),
    )
    return
  }
  settleCallback(state)
  const providerErrors = url.searchParams.getAll('error')
  const codes = url.searchParams.getAll('code')
  if (providerErrors.length > 0 && codes.length > 0) {
    finishOAuthCallback(
      server,
      state,
      response,
      'Login response was incomplete',
      new DedalusOAuthError('invalid_callback'),
    )
    return
  }
  if (providerErrors.length === 1) {
    const error = new DedalusOAuthError(oauthErrorCode(providerErrors[0] ?? ''), {
      stage: 'provider',
    })
    finishOAuthCallback(server, state, response, 'Login was not completed', error)
    return
  }
  const code = opaqueValue(codes[0], maxAuthorizationCodeLength)
  if (providerErrors.length > 1 || codes.length !== 1 || !code) {
    finishOAuthCallback(
      server,
      state,
      response,
      'Login response was incomplete',
      new DedalusOAuthError('invalid_callback'),
    )
    return
  }
  finishOAuthCallback(server, state, response, 'Authorization received.', code)
}

const finishOAuthCallback = (
  server: Server,
  state: CallbackState,
  response: ServerResponse,
  message: string,
  result: string | DedalusOAuthError,
): void => {
  let complete = false
  const settleResponse = (error?: Error): void => {
    if (complete) return
    complete = true
    response.off('finish', onFinish)
    response.off('close', onClose)
    response.off('error', onError)
    if (error && result instanceof DedalusOAuthError) {
      completeCallback(server, state, {
        error: new AggregateError([result, error], 'OAuth callback and response failed'),
      })
    } else if (error) completeCallback(server, state, { error })
    else if (result instanceof DedalusOAuthError) completeCallback(server, state, { error: result })
    else completeCallback(server, state, { code: result })
  }
  const onFinish = (): void => settleResponse()
  const onClose = (): void => settleResponse(new DedalusOAuthError('callback_response_failed'))
  const onError = (cause: Error): void =>
    settleResponse(new DedalusOAuthError('callback_response_failed', { cause }))
  response.once('finish', onFinish)
  response.once('close', onClose)
  response.once('error', onError)
  writeCallbackResponse(response, result instanceof DedalusOAuthError ? 400 : 200, message)
}

const callbackURL = (request: IncomingMessage, response: ServerResponse): URL | undefined => {
  const raw = request.url ?? '/'
  if (!URL.canParse(raw, 'http://127.0.0.1')) {
    writeCallbackResponse(response, 400, 'Invalid request')
    return undefined
  }
  return new URL(raw, 'http://127.0.0.1')
}

const completeCallback = (server: Server, state: CallbackState, outcome: CallbackOutcome): void => {
  void closeServer(server).then(
    () => state.result.resolve(outcome),
    (cause: unknown) => {
      const cleanup = new DedalusOAuthError('callback_cleanup_failed', { cause })
      state.result.resolve({
        error:
          'error' in outcome
            ? new AggregateError([outcome.error, cleanup], 'OAuth callback and cleanup failed')
            : cleanup,
      })
    },
  )
}

const writeCallbackResponse = (response: ServerResponse, status: number, message: string): void => {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy':
      "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(oauthCallbackPage(message))
}

const settleCallback = (state: CallbackState): void => {
  state.settled = true
  if (state.timer !== undefined) clearTimeout(state.timer)
}

const startLoginTimeout = (server: Server, state: CallbackState, timeoutMs: number): void => {
  state.timer = setTimeout(() => {
    if (state.settled) return
    state.settled = true
    completeCallback(server, state, { error: new DedalusOAuthError('login_timeout') })
  }, timeoutMs)
  state.timer.unref()
}

// @custom end
