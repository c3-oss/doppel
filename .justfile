# Show all available recipes.
default:
  just --list

# Install dependencies from pnpm-lock.yaml.
install:
  pnpm install

# Start all workspace dev servers in parallel.
dev:
  pnpm dev

# Build every publishable workspace into dist/.
build:
  pnpm build

# Run Vitest suites across all workspaces.
test:
  pnpm test

# Run Biome lint/format checks without writing changes.
lint:
  pnpm lint

# Run TypeScript type checking across all workspaces.
typecheck:
  pnpm typecheck

# Remove generated local outputs (dist/, coverage/, .turbo/, node_modules).
clean:
  pnpm clean

# Run the standard pre-release quality gate.
quality:
  pnpm typecheck
  pnpm test
  pnpm lint

# Create a new Changeset entry describing the next package release.
changeset:
  pnpm changeset

# Apply pending Changesets to package versions and changelog files.
version-packages:
  pnpm version-packages

# Build and publish changed packages to the official npm registry.
release:
  pnpm release
  git push
  git push --tags
