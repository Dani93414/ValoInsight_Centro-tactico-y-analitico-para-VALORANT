import { useEffect } from "react";

const ROW_SELECTORS = [".dashboard-row-top", ".dashboard-row-bottom"];
const STANDALONE_SELECTORS = [
  ".stats-header",
  ".no-stats-screen",
  ".match-history-inline",
  ".heatmap-entry-section",
];

/**
 * Applies a scroll-reveal animation to dashboard blocks inside `.stats-container`.
 * Re-runs whenever any dependency value changes.
 */
export function useScrollReveal(deps: readonly unknown[]) {
  useEffect(() => {
    const container = document.querySelector(".stats-container");
    if (!container) return;

    const revealTargets: HTMLElement[] = [];

    STANDALONE_SELECTORS.forEach((sel) => {
      container.querySelectorAll<HTMLElement>(sel).forEach((el) => {
        revealTargets.push(el);
      });
    });

    ROW_SELECTORS.forEach((sel) => {
      container.querySelectorAll<HTMLElement>(sel).forEach((row) => {
        const children = Array.from(row.children) as HTMLElement[];
        children.forEach((child) => revealTargets.push(child));
      });
    });

    if (revealTargets.length === 0) return;

    revealTargets.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const dy = ra.top - rb.top;
      if (Math.abs(dy) > 20) return dy;
      return ra.left - rb.left;
    });

    const viewportMidpoint = window.innerWidth / 2;
    revealTargets.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      const fromLeftColumn = rect.left < viewportMidpoint;
      const depth = Math.min(index, 6);
      const delay = Math.min(depth * 55, 260);
      const shiftX = fromLeftColumn ? -20 : 20;
      const shiftY = 20 + depth * 2;

      el.classList.add("reveal-on-scroll");
      el.style.setProperty("--reveal-delay", `${delay}ms`);
      el.style.setProperty("--reveal-shift-x", `${shiftX}px`);
      el.style.setProperty("--reveal-shift-y", `${shiftY}px`);
    });

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion) {
      revealTargets.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const target = entry.target as HTMLElement;
          target.classList.add("is-visible");
          observer.unobserve(target);
        });
      },
      {
        threshold: 0.08,
        rootMargin: "0px 0px 10% 0px",
      },
    );

    revealTargets.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
