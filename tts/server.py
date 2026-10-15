"""Voz da narração do dndai: Kokoro-82M (ONNX) em pt-BR, local, em streaming MP3.

O narrador fala com uma voz; falas de personagem marcadas pelo Mestre com `{m}`/`{f}` logo após o
travessão ou a aspa de abertura usam a voz masculina/feminina. Fala sem marca fica com o narrador.

    POST /speak {"text": "..."} -> audio/mpeg (frase a frase; cache em disco por texto+vozes)
    GET  /health

Só escuta em 127.0.0.1: quem expõe a voz para a mesa é o `dnd serve` (GET /api/tts).
"""

import ctypes.util
import hashlib
import json
import os
import re
import subprocess
import sys
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np
from kokoro_onnx import EspeakConfig, Kokoro

HERE = Path(__file__).resolve().parent
MODELS = HERE / "models"
CACHE = Path(os.environ.get("DNDAI_TTS_CACHE", HERE / "cache"))
PORT = int(os.environ.get("DNDAI_TTS_PORT", "8795"))
MODEL_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
MODEL_FILES = ("kokoro-v1.0.onnx", "voices-v1.0.bin")
SAMPLE_RATE = 24000
MAX_CHARS = 20000

# Mudou voz, velocidade ou pausa? Troque VERSION para não servir áudio antigo do cache.
NARRATOR = "pm_santa"
SPEAKERS = {"m": "pm_alex", "f": "pf_dora", None: NARRATOR}
SPEED = 0.84
PAUSE_SAME, PAUSE_SWITCH = 0.18, 0.45
VERSION = "kokoro-v1.0/santa-alex-dora/0.84/1"

DASH = re.compile(r"^\s*[—–]\s*")
TAG = re.compile(r"^\{([mf])\}\s*")
QUOTED = re.compile(r"[“\"]([^”\"]+)[”\"]")
SENTENCE = re.compile(r"(?<=[.!?…])\s+")


def clean(text: str) -> str:
    text = re.sub(r"\*\*|__|(?<!\w)[*_]|[*_](?!\w)", "", text)
    text = re.sub(r"[\U0001F000-\U0001FAFF☀-➿️]", "", text)
    return re.sub(r"[ \t]+", " ", text).strip()


def segments(text: str):
    """Quebra a narração em (voz, frase). A linha discreta de dados (🎲) não é lida."""
    for line in text.replace("\r\n", "\n").split("\n"):
        if not line.strip() or line.lstrip().startswith("🎲"):
            continue
        parts: list[tuple[bool, str]] = []
        if DASH.match(line):
            # — fala — narração — fala
            for i, chunk in enumerate(re.split(r"\s+[—–]\s+", DASH.sub("", line))):
                parts.append((i % 2 == 0, chunk))
        else:
            for i, chunk in enumerate(QUOTED.split(line)):
                parts.append((i % 2 == 1, chunk))
        gender = None
        for is_speech, chunk in parts:
            m = TAG.match(chunk.strip())
            if m:
                gender = m.group(1)
            chunk = clean(re.sub(r"\{[mf]\}\s*", "", chunk))
            if not chunk:
                continue
            voice = SPEAKERS[gender] if is_speech else NARRATOR
            for sentence in SENTENCE.split(chunk):
                if sentence.strip():
                    yield voice, sentence.strip()


def ensure_models():
    MODELS.mkdir(exist_ok=True)
    for name in MODEL_FILES:
        target = MODELS / name
        if target.exists():
            continue
        print(f"[tts] baixando {name}…", file=sys.stderr, flush=True)
        tmp = target.with_suffix(".part")
        urllib.request.urlretrieve(MODEL_URL + name, tmp)
        tmp.rename(target)


def load_engine():
    lib = os.environ.get("DNDAI_ESPEAK_LIB") or ctypes.util.find_library("espeak-ng")
    if not lib:
        sys.exit("[tts] espeak-ng não encontrado: rode `sudo apt install espeak-ng` (ou defina DNDAI_ESPEAK_LIB).")
    data = os.environ.get("DNDAI_ESPEAK_DATA")
    ensure_models()
    kokoro = Kokoro(str(MODELS / MODEL_FILES[0]), str(MODELS / MODEL_FILES[1]), espeak_config=EspeakConfig(lib_path=lib, data_path=data))
    # O misaki gera os fonemas no formato em que o Kokoro foi treinado (o tokenizer do kokoro-onnx não).
    # Configurado depois do Kokoro: os dois mexem no EspeakWrapper global, e o pacote espeakng-loader
    # aponta para dados que não existem.
    import misaki.espeak
    from phonemizer.backend.espeak.wrapper import EspeakWrapper

    EspeakWrapper.set_library(lib)
    EspeakWrapper.set_data_path(data)
    return kokoro, misaki.espeak.EspeakG2P(language="pt-br")


KOKORO, G2P = load_engine()
MODEL_LOCK = threading.Lock()


def synthesize(voice: str, sentence: str) -> np.ndarray:
    phonemes, _ = G2P(sentence)
    with MODEL_LOCK:
        audio, _ = KOKORO.create(phonemes, voice=voice, speed=SPEED, lang="pt-br", is_phonemes=True)
    return audio


def pcm(audio: np.ndarray) -> bytes:
    return (np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def reply_json(self, status: int, body: dict):
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            return self.reply_json(200, {"ok": True, "version": VERSION})
        self.reply_json(404, {"error": "Rota inexistente."})

    def do_POST(self):
        if self.path != "/speak":
            return self.reply_json(404, {"error": "Rota inexistente."})
        try:
            size = int(self.headers.get("content-length") or 0)
            text = json.loads(self.rfile.read(size) or b"{}").get("text")
        except (ValueError, AttributeError):
            return self.reply_json(400, {"error": "JSON inválido."})
        if not isinstance(text, str) or not text.strip() or len(text) > MAX_CHARS:
            return self.reply_json(400, {"error": f"Envie {{\"text\": \"...\"}} com até {MAX_CHARS} caracteres."})
        plan = list(segments(text))
        if not plan:
            return self.reply_json(422, {"error": "Nada para ler neste texto."})

        CACHE.mkdir(parents=True, exist_ok=True)
        key = hashlib.sha256(f"{VERSION}\n{text}".encode()).hexdigest()
        cached = CACHE / f"{key}.mp3"
        self.send_response(200)
        self.send_header("content-type", "audio/mpeg")
        self.send_header("cache-control", "no-store")
        if cached.exists():
            data = cached.read_bytes()
            self.send_header("content-length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        self.end_headers()
        self.stream(plan, cached)

    def stream(self, plan, cached: Path):
        """Sintetiza frase a frase enquanto o ffmpeg codifica e o cliente já recebe o MP3."""
        ffmpeg = subprocess.Popen(
            # Formato de entrada conhecido: sem análise prévia, que seguraria ~5 s de áudio antes do 1º byte.
            ["ffmpeg", "-loglevel", "error", "-probesize", "32", "-analyzeduration", "0", "-fflags", "nobuffer", "-f", "s16le", "-ar", str(SAMPLE_RATE), "-ac", "1", "-i", "pipe:0",
             "-f", "mp3", "-b:a", "64k", "-flush_packets", "1", "pipe:1"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        )
        cancel = threading.Event()
        failure: list[BaseException] = []
        started = time.monotonic()

        def produce():
            try:
                previous = None
                for voice, sentence in plan:
                    if cancel.is_set():
                        return
                    audio = synthesize(voice, sentence)
                    if previous is not None:
                        gap = PAUSE_SWITCH if previous != voice else PAUSE_SAME
                        ffmpeg.stdin.write(b"\0\0" * int(SAMPLE_RATE * gap))
                    ffmpeg.stdin.write(pcm(audio))
                    ffmpeg.stdin.flush()
                    previous = voice
            except BrokenPipeError:
                pass
            except Exception as error:  # noqa: BLE001 — repassado ao cliente via conexão encerrada e ao log
                failure.append(error)
            finally:
                try:
                    ffmpeg.stdin.close()
                except BrokenPipeError:
                    pass

        producer = threading.Thread(target=produce, daemon=True)
        producer.start()
        tmp = cached.with_suffix(f".{threading.get_ident()}.part")
        first = None
        try:
            with tmp.open("wb") as out:
                while chunk := ffmpeg.stdout.read1(16384):
                    if first is None:
                        first = time.monotonic() - started
                    out.write(chunk)
                    self.wfile.write(chunk)
                    self.wfile.flush()
            producer.join()
            if failure or ffmpeg.wait() != 0:
                raise RuntimeError(failure[0] if failure else "ffmpeg falhou")
            tmp.rename(cached)
            print(f"[tts] {len(plan)} frases, 1º áudio em {first or 0:.2f}s, total {time.monotonic() - started:.2f}s", file=sys.stderr, flush=True)
        except (BrokenPipeError, ConnectionResetError):
            pass  # a mesa trocou de narração ou parou a voz
        except Exception as error:  # noqa: BLE001
            print(f"[tts] erro: {error}", file=sys.stderr, flush=True)
            self.close_connection = True
        finally:
            cancel.set()
            ffmpeg.kill()
            tmp.unlink(missing_ok=True)


if __name__ == "__main__":
    synthesize(NARRATOR, "Aquecendo.")
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    server.daemon_threads = True
    print(f"[tts] Kokoro pronto em http://127.0.0.1:{PORT} ({VERSION})", file=sys.stderr, flush=True)
    server.serve_forever()
