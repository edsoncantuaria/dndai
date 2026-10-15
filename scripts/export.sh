#!/usr/bin/env bash
# Exporta o cliente: web, android (APK debug-assinado, cleartext liberado p/ Tailscale/LAN) e linux.
#   scripts/export.sh [web|android|linux|all]
# Requer os export templates 4.7.2 em ~/.local/share/godot/export_templates e o Android SDK (~/Android/Sdk) + JDK 17.
set -euo pipefail
cd "$(dirname "$0")/../game"
GODOT="${GODOT:-/home/edson/Game/Godot/Godot_v4.7.2-stable_linux.x86_64}"
TEMPLATES="$HOME/.local/share/godot/export_templates/4.7.2.stable"
what="${1:-all}"

web() { mkdir -p build/web && "$GODOT" --headless --path . --export-release Web build/web/index.html; }
linux() { mkdir -p build/linux && "$GODOT" --headless --path . --export-release Linux build/linux/dndai.x86_64; }

android() {
  # Template Gradle (só para liberar HTTP em texto claro: o app fala com o servidor pela rede privada).
  if [ ! -f android/build/gradlew ]; then
    mkdir -p android/build
    python3 -I -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall('android/build')" "$TEMPLATES/android_source.zip"
    echo -n "4.7.2.stable" > android/.build_version
    touch android/build/.gdignore
    chmod +x android/build/gradlew
    sed -i "s/buildTools         : '[0-9.]*'/buildTools         : '36.0.0'/; s/ndkVersion         : '[0-9.]*'/ndkVersion         : '28.2.13676358'/" android/build/config.gradle
    sed -i 's#        android:appCategory="game"#        android:appCategory="game"\n        android:usesCleartextTraffic="true"#' android/build/src/main/AndroidManifest.xml
  fi
  "$GODOT" --headless --path . --export-debug Android build/dndai.apk
}

case "$what" in
  web) web ;; android) android ;; linux) linux ;; all) web; android; linux ;;
  *) echo "uso: $0 [web|android|linux|all]"; exit 1 ;;
esac
