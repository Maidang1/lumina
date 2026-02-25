#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/release-desktop.sh <version> [--push]

Examples:
  scripts/release-desktop.sh 0.1.1
  scripts/release-desktop.sh 0.1.1 --push

Behavior:
  1) Update apps/desktop/src-tauri/tauri.conf.json version
  2) Create commit: chore(desktop): release v<version>
  3) Create annotated tag: desktop-v<version>
  4) Optional: push commit and tag when --push is provided
EOF
}

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
  exit 1
fi

VERSION="$1"
PUSH="false"

if [[ $# -eq 2 ]]; then
  if [[ "$2" == "--push" ]]; then
    PUSH="true"
  else
    echo "Unknown option: $2"
    usage
    exit 1
  fi
fi

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid version: $VERSION (expected X.Y.Z)"
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Current directory is not inside a git repository."
  exit 1
fi

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

CONFIG_PATH="apps/desktop/src-tauri/tauri.conf.json"
TAG="desktop-v$VERSION"

if [[ ! -f "$CONFIG_PATH" ]]; then
  echo "File not found: $CONFIG_PATH"
  exit 1
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag already exists: $TAG"
  exit 1
fi

CURRENT_VERSION="$(node -p "require('./$CONFIG_PATH').version")"
if [[ "$CURRENT_VERSION" == "$VERSION" ]]; then
  echo "tauri.conf.json version is already $VERSION. Nothing to bump."
  exit 1
fi

node -e '
const fs = require("fs");
const file = process.argv[1];
const version = process.argv[2];
const config = JSON.parse(fs.readFileSync(file, "utf8"));
config.version = version;
fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
' "$CONFIG_PATH" "$VERSION"

git add "$CONFIG_PATH"
git commit -m "chore(desktop): release v$VERSION" -- "$CONFIG_PATH"
git tag -a "$TAG" -m "Lumina Desktop v$VERSION"

if [[ "$PUSH" == "true" ]]; then
  git push origin HEAD
  git push origin "$TAG"
fi

echo "Done."
echo "Version: $CURRENT_VERSION -> $VERSION"
echo "Commit: $(git rev-parse --short HEAD)"
echo "Tag: $TAG"
if [[ "$PUSH" == "true" ]]; then
  echo "Pushed commit and tag to origin."
else
  echo "Not pushed. Run: git push origin HEAD && git push origin $TAG"
fi
