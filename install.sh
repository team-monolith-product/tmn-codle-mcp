#!/usr/bin/env bash
set -euo pipefail

REPO="team-monolith-product/tmn-codle-cli"
BRANCH="${1:-main}"
INSTALL_DIR="${HOME}/.codle-cli"

echo "Installing codle-cli..."

# Clone or update
if [ -d "$INSTALL_DIR" ]; then
  echo "Updating existing installation..."
  cd "$INSTALL_DIR"
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
else
  echo "Cloning repository..."
  git clone --depth 1 --branch "$BRANCH" "https://github.com/${REPO}.git" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# Install dependencies and build
echo "Installing dependencies..."
npm ci --ignore-scripts
echo "Building..."
npm run build

# Create symlink
LINK_DIR="${HOME}/.local/bin"
mkdir -p "$LINK_DIR"
ln -sf "${INSTALL_DIR}/bin/run.js" "${LINK_DIR}/codle"

echo ""
echo "codle-cli installed successfully!"
echo "Binary: ${LINK_DIR}/codle"
echo ""

# Check PATH
if [[ ":$PATH:" != *":${LINK_DIR}:"* ]]; then
  echo "⚠️  ${LINK_DIR} is not in your PATH. Add it:"
  echo "  export PATH=\"${LINK_DIR}:\$PATH\""
fi
