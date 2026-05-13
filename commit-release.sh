#!/bin/bash

set -euo pipefail

PACKAGES_DIR="./packages"
APPS_DIR="./apps"

process_directory() {
  local dir_path="$1"
  local dir_name="$2"

  for package_dir in "$dir_path"/*/; do
    local package_name
    local package_file

    package_name="$(basename "$package_dir")"
    package_file="${package_dir}package.json"

    if git status --porcelain "$package_dir" | grep -q .; then
      echo "Found changes in $package_name ($dir_name)"

      if [ -f "$package_file" ]; then
        local version
        version="$(jq -r '.version' "$package_file")"

        if [ -n "$version" ] && [ "$version" != "null" ]; then
          echo "Version found: $version"

          git add "$package_dir"
          git commit --no-verify -m "build($package_name): release \`v$version\`"
        else
          echo "ERROR: Could not extract version from $package_name"
          return 1
        fi
      else
        echo "ERROR: package.json not found in $package_name"
        return 1
      fi
    else
      echo "No changes in $package_name ($dir_name)"
    fi
  done
}

main() {
  echo "Processing packages directory..."
  process_directory "$PACKAGES_DIR" "packages"

  echo "Processing apps directory..."
  process_directory "$APPS_DIR" "apps"
}

main

echo "Process completed!"
