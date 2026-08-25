# Command-line authentication

This directory owns the handwritten version 1 command-line interface (CLI)
authentication adapter. Scalar owns the software development kit (SDK) and
resource commands. Generated commands receive one selected credential without
depending on Clerk. Browser login uses OAuth 2.0 Authorization Code with S256
Proof Key for Code Exchange (PKCE). Authenticated commands send the selected
token through the Admin API gateway.

```mermaid
sequenceDiagram
    participant CLI
    participant Browser
    participant Clerk
    participant Gateway as Admin API /dcs gateway
    participant DCS as DCS API

    CLI->>Browser: Authorization Code + S256 PKCE
    Browser->>Clerk: Sign in and select an organization
    Clerk->>CLI: Code through one-shot loopback callback
    CLI->>Clerk: Exchange code; fetch user and organization
    Clerk-->>CLI: Access token + refresh token
    CLI->>CLI: Store provider-neutral OAuth session
    CLI->>Gateway: Clerk access token
    Gateway->>Clerk: Verify token and current organization membership
    Gateway->>Gateway: Resolve service account and decrypt canonical key
    Gateway->>DCS: API key plus signed human actor context
    DCS->>DCS: Verify actor context for the managed key
```

Clerk is the version 1 OAuth 2.0 issuer. `oauth.ts` requests only `offline_access` and
`user:org:read`. It verifies callback state, requires an organization-bound
userinfo response, and never embeds a client secret. Code exchange, refresh,
userinfo, and revocation requests do not follow redirects. The optional
website handoff carries the Clerk authorization uniform resource locator (URL)
in a fragment. OAuth state therefore does not enter website request or
analytics logs. The website reads that fragment in the browser and immediately
continues to Clerk.

The command sends the Clerk access token only to the Admin application
programming interface (API) `/dcs` gateway.
The gateway verifies the token and current Clerk organization membership,
resolves the organization's canonical service account, decrypts its API key on
the server, and forwards the request to Dedalus Cloud Services (DCS) with signed
human actor context. DCS accepts a managed service-account key only when that
context verifies. The raw canonical API key never enters the CLI.

The CLI stores Clerk's access and refresh tokens plus non-secret identity and
organization metadata. It does not create, retrieve, display, or store the
canonical service-account application programming interface (API) key. Token
lifetime and refresh behavior follow Clerk's response. V1 makes no Dedalus
rotation or absolute-session guarantee.

Credential selection is authoritative and stops at the first priority:

1. `--api-key` or `--x-api-key` workload key
2. `DEDALUS_API_KEY` or `DEDALUS_X_API_KEY` workload key
3. stored OAuth session
4. no credential

Sources never merge or fall back after rejection. Direct `--bearer-auth` and
`DEDALUS_BEARER_AUTH` overrides are rejected because Bearer OAuth tokens enter
only through the stored-session adapter.

The workload `--api-key` flag and stored OAuth session remain distinct during
selection, then use the same generated OpenAPI `BearerAuth` transport. The
adapter injects exactly one value only after it has selected the source.

The operating-system keyring is the default on macOS and Windows. Linux uses a
keyring when a desktop secret service is available; otherwise it uses
`$XDG_CONFIG_HOME/dedalus/credentials` (or
`~/.config/dedalus/credentials`). The file store uses a `0700` directory,
`0600` atomic files, descriptor-based validation, `O_NOFOLLOW`, and a lifecycle
lock. Windows does not silently use the weaker file path when its keyring is
unavailable.

The adapter exposes these explicit ownership boundaries:

| Boundary | Classification | Owner and guarantee |
| --- | --- | --- |
| `AuthProvider` | Provider adapter | Clerk implements login, refresh, and revocation without leaking into generated commands. |
| `CredentialStore` | Authoritative local persistence | The CLI protects and serializes the provider-neutral OAuth session. |
| `resolveCredential` | Authoritative local selection | The CLI selects exactly one workload or OAuth credential by the precedence above. |
| `login`, `status`, `logout`, `accessTokenForCommand` | Authoritative local lifecycle | The CLI locks refresh and persistence before returning a usable token. |
| `addDedalusCommands` | Generated-code integration | Handwritten code injects one selected credential into Scalar-owned commands. |
| Browser sign-in page | Neighboring surface | The website forwards the fragment payload; it does not own OAuth state or tokens. |
| Admin API gateway and DCS | Downstream enforcement | The gateway verifies membership and resolves the canonical service key; DCS verifies actor context. |

Commands:

```sh
dedalus auth login
dedalus auth status
dedalus auth status --offline
dedalus auth logout
```

`--offline` reads local metadata only. Logout attempts Clerk refresh-token
revocation, always removes local tokens when storage is available, and reports
whether provider revocation was confirmed. Every auth command accepts `--json`
and excludes access tokens, refresh tokens, authorization codes, PKCE values,
state, and API-key plaintext.

The checked-in version 1 bundle targets development:

- Clerk issuer: `https://neat-gator-21.clerk.accounts.dev`
- Browser handoff: `https://dev.dedaluslabs.ai/cli/sign-in`
- Gateway: `https://dev.admin.api.dedaluslabs.ai/dcs`

If set, `DEDALUS_CLERK_ISSUER` and `DEDALUS_CLERK_CLIENT_ID` must exactly match
the checked-in development bundle; arbitrary issuer or client overrides fail
closed. `DEDALUS_SIGN_IN_URL` may independently point at a local loopback
website. Version 1 accepts only a Clerk development issuer and sends its token only to
the checked-in development Admin API gateway. Production requires a separate
reviewed issuer, client, and gateway bundle; arbitrary gateway overrides fail
closed.

Run `npm run typecheck` and `npm test`. A real browser-to-gateway test remains a
deployment check because it requires the configured Clerk application, the
deployed Admin API gateway, and a regenerated Scalar resource-command surface.

References: [Clerk OAuth](https://clerk.com/docs/guides/configure/auth-strategies/oauth/how-clerk-implements-oauth),
[RFC 7636](https://www.rfc-editor.org/rfc/rfc7636), and
[RFC 8252](https://www.rfc-editor.org/rfc/rfc8252).
