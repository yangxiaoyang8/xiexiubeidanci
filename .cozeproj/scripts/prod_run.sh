#!/usr/bin/env bash
# 产物部署使用
set -euo pipefail

ROOT_DIR="$(pwd)"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-5000}"

# ==================== 工具函数 ====================
info() {
  echo "[INFO] $1"
}
warn() {
  echo "[WARN] $1"
}
error() {
  echo "[ERROR] $1"
  exit 1
}
check_command() {
  if ! command -v "$1" &> /dev/null; then
    error "命令 $1 未找到，请先安装"
  fi
}

# ============== 启动服务 ======================
# 检查核心命令
check_command "pnpm"
check_command "npm"

info "==================== 启动服务 ===================="
info "端口: $PORT"
info "后端将同时托管API和前端静态文件"
info ""

cd "$ROOT_DIR/server" && PORT="$PORT" pnpm run start

info "服务启动完成！"
