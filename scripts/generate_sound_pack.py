#!/usr/bin/env python3
"""Generate TheLook's original, license-safe digital-atelier sound pack."""
from pathlib import Path
import subprocess
import wave
import numpy as np

RATE = 44_100
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "public" / "audio"
TMP = OUT / ".wav"
RNG = np.random.default_rng(20261010)


def timeline(seconds: float) -> np.ndarray:
    return np.arange(int(RATE * seconds), dtype=np.float64) / RATE


def tone(t: np.ndarray, hz: float, decay: float = 0.0, phase: float = 0.0) -> np.ndarray:
    signal = np.sin(2 * np.pi * hz * t + phase)
    return signal * (np.exp(-decay * t) if decay else 1.0)


def smooth_noise(size: int, window: int = 80) -> np.ndarray:
    raw = RNG.normal(0, 1, size + window - 1)
    return np.convolve(raw, np.ones(window) / window, mode="valid")


def add_at(track: np.ndarray, signal: np.ndarray, at: float) -> None:
    start = int(at * RATE)
    end = min(len(track), start + len(signal))
    if end > start:
        track[start:end] += signal[: end - start]


def write_mp3(name: str, samples: np.ndarray, bitrate: str = "160k") -> None:
    samples = np.nan_to_num(samples)
    peak = np.max(np.abs(samples)) or 1.0
    samples = np.tanh(samples / peak * 1.2) * 0.78
    pcm = (samples * 32767).astype("<i2")
    TMP.mkdir(parents=True, exist_ok=True)
    wav_path = TMP / f"{name}.wav"
    with wave.open(str(wav_path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm.tobytes())
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav_path),
         "-codec:a", "libmp3lame", "-b:a", bitrate, str(OUT / f"{name}.mp3")],
        check=True,
    )


def show_on_me_start() -> np.ndarray:
    t = timeline(1.35)
    sweep_env = np.sin(np.pi * np.clip(t / 1.1, 0, 1)) ** 1.7
    cloth = smooth_noise(len(t), 34) * sweep_env * (0.24 + 0.08 * np.sin(2 * np.pi * 3 * t))
    air = tone(t, 420 + 250 * t, 2.8) * 0.10
    out = cloth + air
    click_t = timeline(0.12)
    shutter = smooth_noise(len(click_t), 3) * np.exp(-42 * click_t)
    shutter += tone(click_t, 1750, 35) * 0.7
    add_at(out, shutter * 0.42, 0.42)
    add_at(out, shutter * 0.28, 0.49)
    return out


def generating_loop() -> np.ndarray:
    seconds = 8.0
    t = timeline(seconds)
    pad = sum(tone(t, hz, phase=i * 0.8) for i, hz in enumerate((110, 165, 220))) / 3
    breathing = 0.55 + 0.25 * np.sin(2 * np.pi * t / seconds)
    texture = smooth_noise(len(t), 240) * (0.32 + 0.12 * np.sin(2 * np.pi * 2 * t / seconds))
    out = pad * breathing * 0.20 + texture * 0.18
    for at, hz in ((1.0, 880), (3.0, 990), (5.0, 825), (7.0, 1100)):
        ct = timeline(0.75)
        add_at(out, (tone(ct, hz, 5.5) + tone(ct, hz * 1.5, 7.5) * 0.25) * 0.12, at)
    return out


def tryon_complete() -> np.ndarray:
    out = np.zeros(int(RATE * 1.8))
    for at, hz, amp in ((0.00, 523.25, 0.60), (0.18, 659.25, 0.55), (0.38, 783.99, 0.48)):
        t = timeline(1.35)
        bell = tone(t, hz, 3.0) + tone(t, hz * 2.01, 5.0) * 0.22 + tone(t, hz * 3.0, 7.0) * 0.08
        add_at(out, bell * amp, at)
    return out


def tryon_error() -> np.ndarray:
    out = np.zeros(int(RATE * 1.05))
    for at, hz in ((0.00, 220.0), (0.28, 174.61)):
        t = timeline(0.72)
        muted = tone(t, hz, 4.8) + tone(t, hz * 1.5, 7.0) * 0.16
        add_at(out, muted * 0.55, at)
    return out


def wardrobe_select() -> np.ndarray:
    t = timeline(0.32)
    metal = tone(t, 1320, 19) + tone(t, 2100, 25) * 0.45 + tone(t, 360, 24) * 0.25
    transient = smooth_noise(len(t), 2) * np.exp(-48 * t) * 0.32
    return metal * 0.52 + transient


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    write_mp3("show-on-me-start", show_on_me_start())
    write_mp3("generating-loop", generating_loop(), "128k")
    write_mp3("tryon-complete", tryon_complete())
    write_mp3("tryon-error", tryon_error())
    write_mp3("wardrobe-select", wardrobe_select())
    for path in sorted(OUT.glob("*.mp3")):
        print(f"{path.relative_to(ROOT)}\t{path.stat().st_size} bytes")
