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

Run `pnpm run build`, `pnpm run typecheck`, and
`node --import tsx --test tests/auth/*.test.ts`.
