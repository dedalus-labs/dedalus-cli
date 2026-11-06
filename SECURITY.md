# Security Policy

## Reporting Security Issues

This is a generated TypeScript CLI for Dedalus, produced by the Scalar SDK Generator (https://scalar.com).

If the issue is in the generated CLI itself — its runtime, authentication handling, path construction, or serialization — report it to the Scalar team at support@scalar.com. We will acknowledge the report, triage it for severity and impact, and communicate a timeline for a fix or an explanation if we decline it.

## Responsible Disclosure

Please allow us reasonable time to investigate and address the issue before disclosing it publicly. Do not include credentials, tokens, or private API payloads in a public issue.

## Reporting Non-CLI Security Issues

If the issue is in the Dedalus API or service rather than in this CLI, report it through the security process Dedalus has published.

---

Generated code validates emitted paths and escapes spec-derived strings, but OpenAPI documents should still be treated as untrusted input before generation.
