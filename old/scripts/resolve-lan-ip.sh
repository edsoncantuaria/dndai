#!/usr/bin/env sh
# Imprime o primeiro IPv4 privado da máquina (LAN). Uso: LAN_IP=$(sh scripts/resolve-lan-ip.sh)
set -e

if [ -n "$LAN_IP" ]; then
  printf '%s\n' "$LAN_IP"
  exit 0
fi

if command -v ip >/dev/null 2>&1; then
  _ip=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }}')
  if [ -n "$_ip" ]; then
    printf '%s\n' "$_ip"
    exit 0
  fi
fi

if command -v hostname >/dev/null 2>&1; then
  _ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  if [ -n "$_ip" ]; then
    printf '%s\n' "$_ip"
    exit 0
  fi
fi

echo "resolve-lan-ip: não foi possível detectar o IP da LAN. Defina LAN_IP=192.168.x.x" >&2
exit 1
