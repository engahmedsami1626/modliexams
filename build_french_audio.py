#!/usr/bin/env python3
"""Generate offline French listening tracks from fr-bank.js with local Piper voices.

Requires: Node.js, piper-tts, ffmpeg, and the two model files documented in README.
"""
import audioop
import io
import json
import subprocess
import wave
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MODEL_DIR = ROOT / ".audio-model"
SPEAKER_ONE = MODEL_DIR / "fr_FR-siwis-medium.onnx"
SPEAKER_TWO = MODEL_DIR / "fr_FR-tom-medium.onnx"
TARGET_RATE = 22050
_WORKER_VOICES = None
_WORKER_OUT = None

EXPORT = r"""
const fs=require('fs'),vm=require('vm');
const c={window:{}};
vm.runInNewContext(fs.readFileSync('fr-bank.js','utf8'),c);
process.stdout.write(JSON.stringify(c.window.MODLI_FR_BANK.listening.map(q=>({id:q.id,transcript:q.transcript}))));
"""


def init_worker(out_dir):
    global _WORKER_VOICES, _WORKER_OUT
    from piper import PiperVoice
    _WORKER_VOICES = [
        PiperVoice.load(SPEAKER_ONE, config_path=str(SPEAKER_ONE) + ".json"),
        PiperVoice.load(SPEAKER_TWO, config_path=str(SPEAKER_TWO) + ".json"),
    ]
    _WORKER_OUT = Path(out_dir)


def render_turn(voice, text):
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        voice.synthesize_wav(text, wav)
    with wave.open(io.BytesIO(buffer.getvalue()), "rb") as wav:
        rate, width, channels = wav.getframerate(), wav.getsampwidth(), wav.getnchannels()
        raw = wav.readframes(wav.getnframes())
    if channels != 1 or width != 2:
        raise RuntimeError(f"Unexpected Piper audio format: {channels} channels, {width} bytes/sample")
    if rate != TARGET_RATE:
        raw, _ = audioop.ratecv(raw, width, channels, rate, TARGET_RATE, None)
    return raw


def encode_mp3(raw, destination):
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "s16le", "-ar", str(TARGET_RATE), "-ac", "1", "-i", "pipe:0",
        "-codec:a", "libmp3lame", "-b:a", "48k", "-ar", str(TARGET_RATE),
        "-ac", "1", "-f", "mp3", str(destination),
    ], input=raw, check=True)


def process_track(item):
    turns = []
    for speaker_no, line in enumerate(item["transcript"].splitlines()):
        if " : " not in line:
            continue
        spoken_text = line.split(" : ", 1)[1].strip()
        if spoken_text:
            turns.append(render_turn(_WORKER_VOICES[speaker_no % 2], spoken_text))
    if len(turns) != 3:
        raise RuntimeError(f"Expected three dialogue turns for {item['id']}, got {len(turns)}")
    silence = b"\0\0" * int(TARGET_RATE * 0.28)
    destination = _WORKER_OUT / f"{item['id']}.mp3"
    encode_mp3(silence.join(turns), destination)
    return item["id"]


def main():
    for model in (SPEAKER_ONE, SPEAKER_TWO):
        if not model.exists() or not Path(str(model) + ".json").exists():
            raise SystemExit(f"Missing Piper model or JSON config: {model}")
    data = json.loads(subprocess.check_output(["node", "-e", EXPORT], cwd=ROOT, text=True))
    if len(data) != 500:
        raise SystemExit(f"Expected exactly 500 French listening scripts, got {len(data)}")
    out_dir = ROOT / "audio" / "fr"
    out_dir.mkdir(parents=True, exist_ok=True)
    print("Generating French audio with two local neural voices (2 workers)…", flush=True)
    with ProcessPoolExecutor(max_workers=2, initializer=init_worker, initargs=(str(out_dir),)) as pool:
        futures = [pool.submit(process_track, item) for item in data]
        for i, future in enumerate(as_completed(futures), 1):
            future.result()
            if i % 25 == 0 or i == len(data):
                print(f"Generated {i}/{len(data)} French dialogue tracks", flush=True)
    print(f"Finished: 500 offline French audio tracks in {out_dir}", flush=True)


if __name__ == "__main__":
    main()
