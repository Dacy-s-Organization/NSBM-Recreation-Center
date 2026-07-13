"use client";

import { useEffect, useMemo } from "react";

type SportScene = {
  id: string;
  title: string;
  subtitle: string;
};

const SPORT_SCENES: SportScene[] = [
  { id: "football", title: "Goal!", subtitle: "Heading to your dashboard…" },
  { id: "basketball", title: "Swish!", subtitle: "Heading to your dashboard…" },
  { id: "badminton", title: "Smash!", subtitle: "Heading to your dashboard…" },
  { id: "athletics", title: "Finish!", subtitle: "Heading to your dashboard…" },
  { id: "volleyball", title: "Spike!", subtitle: "Heading to your dashboard…" },
  { id: "swimming", title: "Touch!", subtitle: "Heading to your dashboard…" },
];

type LoginSportsTransitionProps = {
  onFinished: () => void;
  durationMs?: number;
};

export function LoginSportsTransition({
  onFinished,
  durationMs = 2600,
}: LoginSportsTransitionProps) {
  const scene = useMemo(
    () => SPORT_SCENES[Math.floor(Math.random() * SPORT_SCENES.length)]!,
    []
  );

  const waitMs = useMemo(() => {
    if (typeof window === "undefined") return durationMs;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? Math.min(durationMs, 400)
      : durationMs;
  }, [durationMs]);

  useEffect(() => {
    const id = window.setTimeout(onFinished, waitMs);
    return () => window.clearTimeout(id);
  }, [waitMs, onFinished]);

  return (
    <div
      className={`login-sports-overlay login-sports-overlay--${scene.id}`}
      role="status"
      aria-live="polite"
      aria-label={`${scene.title} Signing you in`}
    >
      <div className="login-sports-stage" aria-hidden>
        {scene.id === "football" && <FootballScene />}
        {scene.id === "basketball" && <BasketballScene />}
        {scene.id === "badminton" && <BadmintonScene />}
        {scene.id === "athletics" && <AthleticsScene />}
        {scene.id === "volleyball" && <VolleyballScene />}
        {scene.id === "swimming" && <SwimmingScene />}
      </div>

      <p className="login-sports-title">{scene.title}</p>
      <p className="login-sports-subtitle">{scene.subtitle}</p>
      <button
        type="button"
        onClick={onFinished}
        className="mt-6 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-white/90 transition hover:bg-white/20"
      >
        Skip
      </button>
    </div>
  );
}

function FootballScene() {
  return (
    <div className="login-sports-pitch">
      <div className="login-sports-goal">
        <div className="login-sports-post login-sports-post-left" />
        <div className="login-sports-crossbar" />
        <div className="login-sports-post login-sports-post-right" />
        <div className="login-sports-net" />
      </div>
      <div className="login-sports-prop login-sports-prop--football">
        <FootballSvg />
      </div>
      <div className="login-sports-burst" />
    </div>
  );
}

function BasketballScene() {
  return (
    <div className="login-sports-pitch">
      <div className="login-sports-hoop">
        <div className="login-sports-backboard" />
        <div className="login-sports-rim" />
        <div className="login-sports-hoop-net" />
      </div>
      <div className="login-sports-prop login-sports-prop--basketball">
        <BasketballSvg />
      </div>
      <div className="login-sports-burst" />
    </div>
  );
}

function BadmintonScene() {
  return (
    <div className="login-sports-pitch">
      <div className="login-sports-racket" />
      <div className="login-sports-prop login-sports-prop--shuttle">
        <ShuttleSvg />
      </div>
      <div className="login-sports-burst" />
    </div>
  );
}

function AthleticsScene() {
  return (
    <div className="login-sports-pitch login-sports-pitch--track">
      <div className="login-sports-track-lanes" />
      <div className="login-sports-finish-line" />
      <div className="login-sports-prop login-sports-prop--runner">
        <RunnerSvg />
      </div>
      <div className="login-sports-burst" />
    </div>
  );
}

function VolleyballScene() {
  return (
    <div className="login-sports-pitch">
      <div className="login-sports-volley-net" />
      <div className="login-sports-prop login-sports-prop--volleyball">
        <VolleyballSvg />
      </div>
      <div className="login-sports-burst" />
    </div>
  );
}

function SwimmingScene() {
  return (
    <div className="login-sports-pitch login-sports-pitch--pool">
      <div className="login-sports-pool-lanes" />
      <div className="login-sports-pool-wall" />
      <div className="login-sports-prop login-sports-prop--swimmer">
        <SwimmerSvg />
      </div>
      <div className="login-sports-burst" />
    </div>
  );
}

function FootballSvg() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full">
      <circle cx="32" cy="32" r="30" fill="#f4f4f5" />
      <circle cx="32" cy="32" r="30" fill="none" stroke="#18181b" strokeWidth="2.5" />
      <path d="M32 8c6 8 6 16 0 24-6-8-6-16 0-24Z" fill="#18181b" />
      <path d="M14 22c10 2 18 8 22 18-10-4-20-8-22-18Z" fill="#18181b" />
      <path d="M50 22c-10 2-18 8-22 18 10-4 20-8 22-18Z" fill="#18181b" />
      <path d="M18 48c8-6 20-6 28 0-8 4-20 4-28 0Z" fill="#18181b" />
    </svg>
  );
}

function BasketballSvg() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full">
      <circle cx="32" cy="32" r="30" fill="#ea580c" />
      <path
        d="M32 2v60M2 32h60M12 12c12 8 28 8 40 0M12 52c12-8 28-8 40 0"
        fill="none"
        stroke="#7c2d12"
        strokeWidth="3"
      />
    </svg>
  );
}

function ShuttleSvg() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full">
      <ellipse cx="32" cy="48" rx="10" ry="8" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
      <path d="M22 44 L18 8 L32 18 L46 8 L42 44 Z" fill="#e2e8f0" stroke="#64748b" strokeWidth="2" />
      <path d="M32 18 L32 44" stroke="#94a3b8" strokeWidth="1.5" />
    </svg>
  );
}

function RunnerSvg() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full">
      <circle cx="38" cy="12" r="7" fill="#fcd34d" />
      <path
        d="M34 20 L28 34 L18 32 M28 34 L34 46 L24 58 M28 34 L42 40 L52 30 M42 40 L40 58"
        fill="none"
        stroke="#f8fafc"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VolleyballSvg() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full">
      <circle cx="32" cy="32" r="30" fill="#f8fafc" />
      <circle cx="32" cy="32" r="30" fill="none" stroke="#0f766e" strokeWidth="2.5" />
      <path
        d="M8 28c10 4 20 4 30-2 8-5 14-6 18-4M10 40c12-2 22 2 34 6M22 8c2 14 0 28-6 44M42 6c-2 14 2 30 10 46"
        fill="none"
        stroke="#0f766e"
        strokeWidth="2.5"
      />
    </svg>
  );
}

function SwimmerSvg() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full">
      <circle cx="46" cy="22" r="6" fill="#67e8f9" />
      <path
        d="M40 26 L28 32 L14 28 M28 32 L34 44 L22 50 M28 32 L44 38"
        fill="none"
        stroke="#ecfeff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 48c6-4 12-4 18 0s12 4 18 0 12-4 18 0"
        fill="none"
        stroke="#67e8f9"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
