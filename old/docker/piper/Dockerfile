# Piper TTS (pt-BR) + API HTTP para o backend — 4 vozes
FROM node:20-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    ARCH="$(uname -m)"; \
    case "$ARCH" in \
      x86_64) ARCH=amd64 ;; \
      aarch64|arm64) ARCH=arm64 ;; \
      *) ARCH=amd64 ;; \
    esac; \
    wget -q "https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_${ARCH}.tar.gz" -O /tmp/piper.tar.gz; \
    mkdir -p /opt/piper; \
    tar -xzf /tmp/piper.tar.gz -C /opt/piper; \
    rm /tmp/piper.tar.gz; \
    chmod +x /opt/piper/piper/piper

RUN mkdir -p /models \
    && wget -q -O /models/pt_BR-faber-medium.onnx.json \
      "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx.json" \
    && wget -q -O /models/pt_BR-faber-medium.onnx \
      "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx" \
    && wget -q -O /models/pt-BR-razo-medium.onnx \
      "https://huggingface.co/Lucasllfs/Razo-piper-voice/resolve/main/pt-BR-razo-medium.onnx" \
    && wget -q -O /models/pt-BR-razo-medium.onnx.json \
      "https://huggingface.co/Lucasllfs/Razo-piper-voice/resolve/main/config.json" \
    && wget -q -O /models/miro_pt-BR.onnx \
      "https://huggingface.co/OpenVoiceOS/pipertts_pt-BR_miro/resolve/main/miro_pt-BR.onnx" \
    && wget -q -O /models/miro_pt-BR.onnx.json \
      "https://huggingface.co/OpenVoiceOS/pipertts_pt-BR_miro/resolve/main/miro_pt-BR.onnx.json" \
    && wget -q -O /models/dii_pt-BR.onnx \
      "https://huggingface.co/OpenVoiceOS/pipertts_pt-BR_dii/resolve/main/dii_pt-BR.onnx" \
    && wget -q -O /models/dii_pt-BR.onnx.json \
      "https://huggingface.co/OpenVoiceOS/pipertts_pt-BR_dii/resolve/main/dii_pt-BR.onnx.json"

WORKDIR /app
COPY server.mjs ./server.mjs

ENV PIPER_BIN=/opt/piper/piper/piper
ENV PIPER_DEFAULT_VOICE=faber
ENV PIPER_LENGTH_SCALE=1.0
ENV PORT=5500

EXPOSE 5500

HEALTHCHECK --interval=15s --timeout=10s --retries=8 --start-period=120s \
  CMD node -e "fetch('http://127.0.0.1:5500/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
