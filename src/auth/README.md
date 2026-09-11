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

Workload flags take priority over workload environment variables, then the
stored session. Credentials at the same priority cannot be combined.
Credential-bearing custom headers are rejected.

Native sessions use Keychain, Credential Manager, or Secret Service. A missing
entry differs from an unreadable entry. The lifecycle lock preserves both an
operation failure and any lock-release failure.

Run `pnpm run build`, `pnpm run typecheck`, and
`node --import tsx --test tests/auth/*.test.ts`.
