# Authentication foundations

The session validators accept public OAuth endpoint metadata and one
organization-bound token pair. They reject malformed or cross-origin values
before those values can enter storage or provider operations.

```text
Untrusted metadata/session -> schema validation -> typed auth values
```

| Module | Contract |
| --- | --- |
| `schema.ts` | Validated public origins, opaque tokens, identity and native-record shape. |
| `types.ts` | Provider operations and safe session metadata. |
| `errors.ts` | Distinct local, network and provider failures. |
| `dfa.ts` | Allowed observations for the authentication lifecycle. |
| `credential-contract.ts` | Decode one bounded native record into a validated session. |
| `credentials.ts` | Select one credential and provide native storage with a lifecycle lock. |
| `workflow.ts` | Serialize login, status, refresh and logout against one stored identity. |

Workload flags take priority over workload environment variables, then the
stored session. Credentials at the same priority cannot be combined.
Credential-bearing custom headers are rejected.

Native sessions use Keychain, Credential Manager, or Secret Service. A missing
entry differs from an unreadable entry. The lifecycle lock preserves both an
operation failure and any lock-release failure.

Login keeps a usable stored grant and refreshes an expiring grant under the
lifecycle lock. A provider result becomes usable after its native write succeeds.
A failed write revokes the new grant. Refresh cannot change the user, organization,
issuer, client or resource. The caller supplies the provider implementation.

Offline status reads stored identity without provider calls. Logout requires
provider revocation before removing the native entry, then verifies local absence.
A failed revocation retains the entry for another attempt.

Run `pnpm run build`, `pnpm run typecheck`, and
`node --import tsx --test tests/auth/*.test.ts`.
Run `CLI_NATIVE_KEYRING_TEST=1 pnpm run test:native` with an available native
credential store. It creates and removes a separate disposable entry.
