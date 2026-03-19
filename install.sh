#!/bin/bash
set -e

INSTALL_DIR="${HOME}/.codle"
REPO_URL="https://github.com/team-monolith-product/tmn-codle-mcp.git"
MIN_NODE_VERSION=22

info() { printf '\033[1;34m%s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m%s\033[0m\n' "$*"; }
error() { printf '\033[1;31mError: %s\033[0m\n' "$*" >&2; exit 1; }

# --- 플랫폼 확인 ---
case "$(uname -s)" in
  Darwin) ;;
  Linux) ;;
  *) error "지원하지 않는 OS입니다: $(uname -s)" ;;
esac

# --- git 확인 ---
command -v git >/dev/null 2>&1 || error "git이 필요합니다."

# --- Node.js 확인 및 설치 ---
if ! command -v node >/dev/null 2>&1; then
  if [[ "$(uname -s)" == "Darwin" ]]; then
    if command -v brew >/dev/null 2>&1; then
      info "Node.js를 설치합니다..."
      brew install node
    else
      info "Homebrew를 먼저 설치합니다..."
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv 2>/dev/null)"
      brew install node
    fi
  else
    error "Node.js ${MIN_NODE_VERSION}+가 필요합니다. https://nodejs.org 에서 설치 후 다시 시도하세요."
  fi
fi

node_major=$(node -v | sed 's/^v//' | cut -d. -f1)
if [ "$node_major" -lt "$MIN_NODE_VERSION" ]; then
  error "Node.js ${MIN_NODE_VERSION}+ 필요 (현재: $(node -v)). brew upgrade node 실행 후 다시 시도하세요."
fi

# --- 설치 / 업데이트 ---
if [ -d "$INSTALL_DIR/.git" ]; then
  info "기존 설치를 업데이트합니다..."
  cd "$INSTALL_DIR"
  git pull --ff-only
else
  if [ -d "$INSTALL_DIR" ]; then
    warn "${INSTALL_DIR} 디렉토리를 초기화합니다..."
    rm -rf "$INSTALL_DIR"
  fi
  info "Codle CLI를 설치합니다..."
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

npm ci --ignore-scripts --no-audit --no-fund --silent
npm run build --silent

# --- PATH 등록 ---
BIN_DIR="$INSTALL_DIR/bin"

add_to_path() {
  local rc_file="$1"
  if [ -f "$rc_file" ] && grep -q '# Codle CLI' "$rc_file" 2>/dev/null; then
    return
  fi
  printf '\n# Codle CLI\nexport PATH="%s:$PATH"\n' "$BIN_DIR" >> "$rc_file"
}

if ! echo "$PATH" | tr ':' '\n' | grep -qx "$BIN_DIR"; then
  case "$SHELL" in
    */zsh)  add_to_path "$HOME/.zshrc" ;;
    */bash) add_to_path "$HOME/.bashrc" ;;
  esac
  export PATH="$BIN_DIR:$PATH"
fi

# --- 완료 ---
echo ""
printf '\033[1;32m%s\033[0m\n' "설치 완료!"
echo ""
echo "  codle --help    사용 가능한 명령어 확인"
echo ""
echo "  새 터미널을 열거나 source ~/.zshrc 실행 후 사용하세요."
