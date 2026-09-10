# Contribution checks

Use TypeScript for handwritten code. Put it beside the feature it implements.
Preserve generated headers. Mark custom modules, or custom sections in generated
files, with paired comments:

```ts
// @custom start
// Explain why this code is maintained separately from generation.
// ...custom code...
// @custom end
```

Mark the complete range, including its imports when appropriate. A wholly
handwritten file has one range after any shebang through the end of the file.
Generated files retain their provenance header and use smaller ranges around
modified code. Ranges may be adjacent but must not nest. Do not add names or
line numbers to markers. Git records the exact diff as the code changes.

List custom TypeScript source, tooling, and test files in `custom-code.json`.
Update that list when adding, moving, or removing a customization. The list and
checker may change in the same PR as the code. Generated output remains editable.

`npm run lint` checks each declaration for paired ranges and explanations.
`npm run typecheck` runs it first, so the existing CI job also runs it.
For local commits, run `prek install` once.
Run `prek run --all-files` to check the hook without installing it.

This is a declaration check. It does not discover undeclared custom code or
prove that generated code is unchanged. Review that distinction against the
corresponding pristine Scalar build, then test real behavior. Some generated
files have no Scalar header, so a header is not proof of provenance.

Do not require a remote fetch, moving branch, frozen patch, or hosted build for
this lint check. Test a hosted regeneration and customization removal separately
before releasing. Scalar's own region markers need separate verification and
are not installed by this check.
