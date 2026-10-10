"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SOUND_KEY = "thelook_sound_enabled";
const AUDIO = {
  start: "/audio/show-on-me-start.mp3",
  loop: "/audio/generating-loop.mp3",
  complete: "/audio/tryon-complete.mp3",
  error: "/audio/tryon-error.mp3",
  select: "/audio/wardrobe-select.mp3",
} as const;

function createAudio(src: string, volume: number, loop = false) {
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.volume = volume;
  audio.loop = loop;
  return audio;
}

export function useSoundEffects() {
  const [enabled, setEnabled] = useState(false);
  const enabledRef = useRef(false);
  const startRef = useRef<HTMLAudioElement | null>(null);
  const loopRef = useRef<HTMLAudioElement | null>(null);
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopGenerating = useCallback(() => {
    if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
    loopTimerRef.current = null;
    if (startRef.current) {
      startRef.current.pause();
      startRef.current.currentTime = 0;
      startRef.current = null;
    }
    if (loopRef.current) {
      loopRef.current.pause();
      loopRef.current.currentTime = 0;
      loopRef.current = null;
    }
  }, []);

  const play = useCallback((src: string, volume: number) => {
    if (!enabledRef.current) return;
    const audio = createAudio(src, volume);
    void audio.play().catch(() => undefined);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(SOUND_KEY) === "true";
    enabledRef.current = saved;
    // Browser persistence is intentionally hydrated after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabled(saved);

    const onVisibility = () => {
      if (document.hidden) stopGenerating();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopGenerating();
    };
  }, [stopGenerating]);

  const toggle = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    localStorage.setItem(SOUND_KEY, String(next));
    if (!next) {
      stopGenerating();
      return;
    }
    // The toggle click is a valid browser user gesture, so this also unlocks audio.
    const confirmation = createAudio(AUDIO.select, 0.18);
    void confirmation.play().catch(() => undefined);
  }, [stopGenerating]);

  const beginTryOn = useCallback(() => {
    if (!enabledRef.current) return;
    stopGenerating();
    const start = createAudio(AUDIO.start, 0.24);
    startRef.current = start;
    void start.play().catch(() => undefined);
    loopTimerRef.current = setTimeout(() => {
      if (!enabledRef.current) return;
      const ambience = createAudio(AUDIO.loop, 0.09, true);
      loopRef.current = ambience;
      void ambience.play().catch(() => undefined);
    }, 650);
  }, [stopGenerating]);

  const finishTryOn = useCallback((success: boolean) => {
    stopGenerating();
    play(success ? AUDIO.complete : AUDIO.error, success ? 0.22 : 0.16);
  }, [play, stopGenerating]);

  const selectWardrobeItem = useCallback(() => play(AUDIO.select, 0.13), [play]);

  return { enabled, toggle, beginTryOn, finishTryOn, selectWardrobeItem, stopGenerating };
}
