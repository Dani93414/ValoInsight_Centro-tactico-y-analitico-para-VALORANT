import { useEffect, useRef, useState, type CSSProperties } from "react";
import "./PageLoadingScreen.css";

const PAGE_LOADING_PHRASES = [
  "Preparando la siguiente ronda...",
  "Comprobando cada esquina...",
  "Coordinando la entrada al site...",
  "Ajustando la mira antes del combate...",
  "Analizando la economía del equipo...",
  "Esperando a que caiga la barrera...",
  "Recopilando información del mapa...",
  "Planeando la mejor ejecución...",
  "Wingman está revisando el site...",
  "Despejando cada esquina...",
  "Buscando la mejor entrada...",
  "Recorriendo el mapa...",
];

const MAX_SIMULATED_PROGRESS = 89;
const COMPLETION_DURATION_MS = 650;
const REDUCED_MOTION_COMPLETION_DURATION_MS = 900;
// Includes the short CSS follow-through, leaving the completed terrain fully visible for 180-240 ms.
const COMPLETION_SETTLE_MS = 360;

interface PageLoadingScreenProps {
  progress?: number;
  isCompleting?: boolean;
  minimumDuration?: number;
  onComplete?: () => void;
}

interface LoadingScreenStyle extends CSSProperties {
  "--loading-progress": number;
}

function getRandomPhrase(previous?: string) {
  const available = PAGE_LOADING_PHRASES.filter((phrase) => phrase !== previous);
  return available[Math.floor(Math.random() * available.length)] ?? PAGE_LOADING_PHRASES[0];
}

function clampProgress(progress: number, maximum = 100) {
  return Math.min(maximum, Math.max(0, progress));
}

export default function PageLoadingScreen({
  progress,
  isCompleting = false,
  minimumDuration = 0,
  onComplete,
}: PageLoadingScreenProps) {
  const mountedAt = useRef<number | null>(null);
  const progressRef = useRef(6);
  const [simulatedProgress, setSimulatedProgress] = useState(6);
  const [phrase, setPhrase] = useState(() => getRandomPhrase());

  useEffect(() => {
    mountedAt.current = performance.now();

    const intervalId = window.setInterval(() => {
      setPhrase((current) => getRandomPhrase(current));
    }, 4600);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (progress !== undefined || isCompleting) {
      return;
    }

    const simulationStartedAt = performance.now();
    const intervalId = window.setInterval(() => {
      const elapsed = performance.now() - simulationStartedAt;
      // An easing curve advances confidently at first, then approaches 89% without reaching completion.
      const nextProgress = MAX_SIMULATED_PROGRESS
        - (MAX_SIMULATED_PROGRESS - 6) * Math.exp(-elapsed / 2600);
      progressRef.current = Math.min(MAX_SIMULATED_PROGRESS, nextProgress);
      setSimulatedProgress(progressRef.current);
    }, 140);

    return () => window.clearInterval(intervalId);
  }, [isCompleting, progress]);

  useEffect(() => {
    if (!isCompleting) {
      return;
    }

    const elapsed = performance.now() - (mountedAt.current ?? performance.now());
    const minimumDelay = Math.max(0, minimumDuration - elapsed);
    let animationFrameId: number | undefined;
    let completionTimerId: number | undefined;
    const finishTimerId = window.setTimeout(() => {
      const completionStartedAt = performance.now();
      const startingProgress = progressRef.current;
      const completionDuration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? REDUCED_MOTION_COMPLETION_DURATION_MS
        : COMPLETION_DURATION_MS;

      const animateCompletion = (timestamp: number) => {
        const elapsed = timestamp - completionStartedAt;
        const ratio = Math.min(1, elapsed / completionDuration);
        const easedRatio = 1 - Math.pow(1 - ratio, 3);
        progressRef.current = startingProgress + (100 - startingProgress) * easedRatio;
        setSimulatedProgress(progressRef.current);

        if (ratio < 1) {
          animationFrameId = window.requestAnimationFrame(animateCompletion);
          return;
        }

        progressRef.current = 100;
        setSimulatedProgress(100);
        completionTimerId = window.setTimeout(() => onComplete?.(), COMPLETION_SETTLE_MS);
      };

      animationFrameId = window.requestAnimationFrame(animateCompletion);
    }, minimumDelay);

    return () => {
      window.clearTimeout(finishTimerId);
      if (animationFrameId !== undefined) {
        window.cancelAnimationFrame(animationFrameId);
      }
      if (completionTimerId !== undefined) {
        window.clearTimeout(completionTimerId);
      }
    };
  }, [isCompleting, minimumDuration, onComplete]);

  const displayedProgress = isCompleting
    ? simulatedProgress
    : progress === undefined
      ? simulatedProgress
      : clampProgress(progress, MAX_SIMULATED_PROGRESS);
  const loadingStyle: LoadingScreenStyle = {
    "--loading-progress": displayedProgress,
  };

  return (
    <main
      className="page-loading-screen"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando página"
      style={loadingStyle}
    >
      <div className="page-loading-screen__ambient" aria-hidden="true" />
      <section className="page-loading-screen__content">
        <span className="page-loading-screen__eyebrow">ValoInsight</span>

        <div className="page-loading-screen__stage" aria-hidden="true">
          <div className="page-loading-screen__track">
            <div className="page-loading-screen__track-base" />
            <div className="page-loading-screen__track-reveal">
              <div className="page-loading-screen__track-texture" />
            </div>
            <div className="page-loading-screen__runner">
              <video
                className="page-loading-screen__video"
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                aria-hidden="true"
                onLoadedMetadata={(event) => {
                  event.currentTarget.playbackRate = 1.5;
                }}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              >
                <source src="/content/loader/wingman-side-clear-loader.webm" type="video/webm" />
              </video>
            </div>
          </div>
        </div>

        <h1>Cargando</h1>
        <p key={phrase}>{phrase}</p>
      </section>
    </main>
  );
}
