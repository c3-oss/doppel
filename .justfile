# <https://cheatography.com/linux-china/cheat-sheets/justfile/>
# <https://just.systems/man/en/chapter_1.html>


set shell := ["/bin/bash", "-c"]

set fallback

# --------------------------------------------------------------------------------------------------

_help:
  @pnpm exec fim --font Cricket --text 'C3-OSS' --style dim.white --indent 5
  @just --list

# --------------------------------------------------------------------------------------------------

# run a turbo command inside a package -- e.g. "just turbo build auth"
[group('ALIASES')]
turbo cmd pkg-name *cmd-args:
  @pnpm turbo run {{ cmd }} {{ cmd-args }} --filter="@c3-oss/{{ pkg-name }}"

# run a turbo command on all packages
[group('ALIASES')]
turbo-all cmd:
  @pnpm turbo run {{ cmd }} --log-order=grouped

# run commitizen, a CLI tool for generating conventional commits (interactive)
[group('ALIASES')]
commit:
  @pnpm cz

# --------------------------------------------------------------------------------------------------

# build the package with the given name -- e.g. "just build auth"
[group('BUILD')]
build pkg-name:
  @just turbo build {{ pkg-name }}

# build all packages
[group('BUILD')]
build-all:
  @just turbo-all build

# --------------------------------------------------------------------------------------------------

# upgrade all dependencies of all packages (MINOR and PATCH versions only)
[group('PROJECT MAINTENANCE')]
bump-all-deps:
  @pnpm turbo bump:all

# remove all build artifacts, caches and turbo logs
[group('PROJECT MAINTENANCE')]
clean-all:
  @just turbo-all clean

# generate code documentation for all packages
[group('PROJECT MAINTENANCE')]
update-code-docs:
  @pnpm typedoc

# --------------------------------------------------------------------------------------------------

# run the linter on the package with the given name -- e.g. "just lint auth"
[group('CODE QUALITY')]
lint pkg-name:
  @just turbo lint {{ pkg-name }}

# run the linter on all packages
[group('CODE QUALITY')]
lint-all:
  @just turbo-all lint

# run the linter on all packages and fix all auto-fixable issues
[group('CODE QUALITY')]
lint-all-fix:
  @pnpm turbo lint:fix

# run the linter on all packages and fix all auto-fixable issues
[group('CODE QUALITY')]
lint-all-fix-unsafe:
  @pnpm turbo lint:fix-unsafe

# --------------------------------------------------------------------------------------------------

# run tests on the package with the given name -- e.g. "just test auth"
[group('TESTS')]
test pkg-name:
  @just turbo test {{ pkg-name }}

# run tests on all packages
[group('TESTS')]
test-all:
  @just turbo-all test

# run tests on all packages and generate a coverage report
[group('TESTS')]
test-all-coverage:
  @just turbo-all test:coverage

# --------------------------------------------------------------------------------------------------

# create a package release plan (interactive)
[group('PACKAGE RELEASING')]
release-plan:
  @pnpm changeset

# apply the release plan created by "release-plan"
[group('PACKAGE RELEASING')]
release-apply:
  @pnpm changeset version

# publish all packages with new versions to the registry
[group('PACKAGE RELEASING')]
release-publish:
  @just build-all
  @pnpm changeset publish --no-git-tag

# prepare to publish packages -- build, lint, test and apply remaining changesets
[group('PACKAGE RELEASING')]
release-prepare-publish:
  @pnpm turbo run build lint test
  @just release-apply

# git commit for each package that will be released
[group('PACKAGE RELEASING')]
release-commit:
  @./commit-release.sh

# --------------------------------------------------------------------------------------------------

# enter prerelase mode
[group('PACKAGE PRE-RELEASING')]
prerelease-enter:
  @pnpm changeset pre enter next

# exit prerelease mode
[group('PACKAGE PRE-RELEASING')]
prerelease-exit:
  @pnpm changeset pre exit

# publish generate and publish prerelease package
[group('PACKAGE PRE-RELEASING')]
prerelease-publish:
  @just prerelease-enter
  @just release-plan
  @just release-apply
  @just release-publish
  @just prerelease-exit
