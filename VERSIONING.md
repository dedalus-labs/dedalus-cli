# Versioning

This SDK is configured with the `manual` versioning policy.

- `manual`: package versions are set explicitly before release.
- `semver`: releases should follow semantic versioning based on API and SDK surface changes.
- `calendar`: releases should use a calendar-derived version chosen by the release workflow or maintainer.

## Branches and releases

This repository follows a three-branch flow, managed by the Scalar platform together
with the generated workflows (which need only the default `GITHUB_TOKEN` — no extra
token required):

- **`scalar-generated`** — pristine generator output. Pushed by the Scalar platform; do
  not commit here.
- **`scalar-next`** — generated output merged with this repository's custom code. Commit
  your customizations here (directly or via PRs). The Scalar platform merges each
  regeneration into this branch and keeps the release PR up to date; merge conflicts
  arrive as a PR from `scalar-merge-conflict` for you to resolve.
- **Default branch** — seeded from the first generated snapshot, then only ever receives
  released states, each one the merge of a release PR.

Release PRs are opened by the Scalar platform from `scalar-next` against the default
branch — so the PR diff shows the full pending release — and are versioned from
[Conventional Commits](https://www.conventionalcommits.org). Merging a release PR tags the
release, publishes it, and syncs the version bump and changelog back to `scalar-next`.
Pre-1.0, breaking changes bump the minor version.

### Choosing an exact version

To release a specific version — `1.0.0`, a hotfix number, anything the commit history would
not have picked — **edit the release PR title** to the version you want:

```text
release: 1.0.0
```

The `Release PR version` check turns red as soon as you save, because the version in the
title no longer matches the version committed in the PR. The Scalar platform then re-renders
the release PR at your version (changelog, manifest, and every version-bearing file), the
title comes back as `release: 1.0.0`, and the check turns green. **Wait for it to be green
before merging** — merging in between would tag a release whose own files still carry the
old version.

The git-native equivalent, if you would rather not touch the PR: push an empty commit with a
`Release-As` footer to `scalar-next`. This is exactly what the title edit does for you.

```sh
git commit --allow-empty -m "chore: release 1.0.0" -m "Release-As: 1.0.0"
```

### When a release PR does not merge cleanly

Nothing is ever force-pushed automatically: a release PR that conflicts with the default
branch simply cannot be merged, and GitHub disables its merge button. The two causes have
different fixes:

- **The default branch received direct commits** (for example a hotfix) that are not in
  `scalar-next`. Land those commits on `scalar-next` (merge the default branch into it, or
  cherry-pick), and the refreshed release PR merges cleanly again. Do not force-push —
  that would discard the direct commits.
- **The repository was adopted with pre-existing content**, so the default branch shares
  no history with `scalar-next`. The Scalar platform adds a checkbox to the release PR
  description offering to replace the default branch with this release; checking it
  authorizes the platform to force-push the released state over the old content. This is
  destructive for anything on the default branch that never reached `scalar-next`, which
  is why it requires that explicit opt-in.

### Repository prerequisites

- Branch protection on `scalar-next` and the default branch must allow the Scalar
  platform and the `github-actions` bot to push (or be left unprotected); the default
  branch only ever advances by merging release PRs, and `scalar-next` receives each
  released state back from the release workflow.
- No Actions settings changes are required: the generated workflows declare their own
  permissions and never create pull requests.
- If this package publishes through OIDC trusted publishing (for example PyPI or npm),
  register the trusted publisher on the registry against the **`release-please.yml`**
  workflow filename. Merging a release PR publishes from the `publish` job inside that
  same workflow run (checked out at the released tag), so the automated path's OIDC
  claims name that file — and, because nothing is dispatched, releasing works from any
  release branch, not only the repository default branch. `sdk-release.yml` exists for
  manual re-publishes at an existing tag; register it as an additional trusted publisher
  only if you use it. If the publish job is configured with a deployment environment,
  include that environment in the registration too.
