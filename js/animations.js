/**
 * animations.js — Smooth KPI Counter Engine (requestAnimationFrame + easeOutCubic)
 * & UI Micro-interaction Helpers
 * Highland Climate & Hotspot Dashboard (2022–2023)
 */

import { formatNum, formatInt } from './calculations.js';

// Map<HTMLElement, { rafId: number, currentValue: number, targetValue: number, finalText: string, onFinish: Function }>
const activeKpiAnimations = new Map();

/**
 * Cubic ease-out function: fast start, smooth deceleration to target
 * @param {number} t Progress in [0, 1]
 * @returns {number}
 */
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Check if the user has requested reduced motion at OS/Browser level
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Format a numeric value with exact decimals, thousands separators, and optional prefix/suffix
 */
function formatAnimatedValue(val, decimals = 0, prefix = '', suffix = '') {
  const formattedNum = decimals <= 0
    ? formatInt(Math.round(val))
    : formatNum(val, decimals);
  return `${prefix}${formattedNum}${suffix}`;
}

/**
 * Animate a KPI DOM element's numeric value using requestAnimationFrame + easeOutCubic.
 *
 * Rules enforced:
 * 1. First load: counts up from 0 to true JSON value.
 * 2. Filter change: counts smoothly from previous value (or in-flight value) to new value.
 * 3. Uses requestAnimationFrame() + easeOutCubic over 850–1,000 ms.
 * 4. Preserves exact decimal places and thousands separators.
 * 5. Preserves units/suffixes if passed.
 * 6. Target === 0 animates cleanly to 0 / 0.0.
 * 7. Null / undefined / NaN displays fallback ('ไม่มีข้อมูล' or 'N/A') immediately with no count-up.
 * 8. If previous target === new target, does NOT replay animation.
 * 9. Rapid filter changes cancel in-flight animation before starting the new one.
 *
 * @param {HTMLElement|string} elOrId Element or element ID
 * @param {number|null|undefined} targetValue Raw numeric target from real JSON calculation
 * @param {Object} options { decimals = 0, duration = 920, fallback = 'N/A', prefix = '', suffix = '' }
 */
export function animateKpiValue(elOrId, targetValue, options = {}) {
  const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
  if (!el) return;

  const {
    decimals = 0,
    duration = 920,
    fallback = 'N/A',
    prefix = '',
    suffix = ''
  } = options;

  // Ensure tabular numerals to prevent horizontal layout jitter during count-up
  el.classList.add('kpi-tabular-num');

  // Case 1: Null / undefined / NaN -> show fallback immediately, never count-up
  if (targetValue === null || targetValue === undefined || Number.isNaN(Number(targetValue))) {
    if (activeKpiAnimations.has(el)) {
      cancelAnimationFrame(activeKpiAnimations.get(el).rafId);
      activeKpiAnimations.delete(el);
    }
    el.classList.remove('kpi-animating');
    el.dataset.targetValue = 'null';
    el.dataset.currentValue = 'null';
    el.dataset.suffix = suffix;
    el.textContent = fallback;
    return;
  }

  const numericTarget = Number(targetValue);
  const finalFormatted = formatAnimatedValue(numericTarget, decimals, prefix, suffix);
  const isInitialized = el.dataset.kpiInitialized === 'true';
  const prevTargetRaw = el.dataset.targetValue;
  const prevSuffix = el.dataset.suffix || '';

  // Case 2: Already initialized and target value + suffix haven't changed -> do not replay animation
  if (
    isInitialized &&
    prevTargetRaw !== undefined &&
    prevTargetRaw !== 'null' &&
    Math.abs(Number(prevTargetRaw) - numericTarget) < 1e-6 &&
    prevSuffix === suffix
  ) {
    if (!activeKpiAnimations.has(el)) {
      el.textContent = finalFormatted;
    }
    return;
  }

  // Determine starting value:
  // - If first load (!isInitialized): start from 0
  // - If an animation is currently in-flight: cancel it and start from its live currentValue
  // - Otherwise: start from the previous targetValue (or 0 if previous was null)
  let startValue = 0;
  if (activeKpiAnimations.has(el)) {
    const running = activeKpiAnimations.get(el);
    cancelAnimationFrame(running.rafId);
    startValue = Number.isFinite(running.currentValue) ? running.currentValue : 0;
    activeKpiAnimations.delete(el);
  } else if (isInitialized && prevTargetRaw !== undefined && prevTargetRaw !== 'null') {
    const parsedPrev = Number(prevTargetRaw);
    startValue = Number.isFinite(parsedPrev) ? parsedPrev : 0;
  } else {
    startValue = 0;
  }

  el.dataset.kpiInitialized = 'true';
  el.dataset.targetValue = String(numericTarget);
  el.dataset.targetFormatted = finalFormatted;
  el.dataset.suffix = suffix;

  // Respect prefers-reduced-motion or identical start/target on initial zero
  if (prefersReducedMotion() || (Math.abs(startValue - numericTarget) < 1e-6 && isInitialized)) {
    el.dataset.currentValue = String(numericTarget);
    el.classList.remove('kpi-animating');
    el.textContent = finalFormatted;
    return;
  }

  const effectiveDuration = Math.max(800, Math.min(1100, duration));
  const startTime = performance.now();

  // Set initial frame immediately so first render shows startValue cleanly
  el.dataset.currentValue = String(startValue);
  el.textContent = formatAnimatedValue(startValue, decimals, prefix, suffix);
  el.classList.add('kpi-animating');

  const finishImmediately = () => {
    if (activeKpiAnimations.has(el)) {
      cancelAnimationFrame(activeKpiAnimations.get(el).rafId);
      activeKpiAnimations.delete(el);
    }
    el.dataset.currentValue = String(numericTarget);
    el.classList.remove('kpi-animating');
    el.textContent = finalFormatted;
  };

  const step = (now) => {
    const elapsed = Math.max(0, now - startTime);
    const progress = Math.min(1, elapsed / effectiveDuration);
    const eased = easeOutCubic(progress);
    const currentVal = startValue + (numericTarget - startValue) * eased;

    const entry = activeKpiAnimations.get(el);
    if (entry) {
      entry.currentValue = currentVal;
    }
    el.dataset.currentValue = String(currentVal);

    if (progress < 1) {
      el.textContent = formatAnimatedValue(currentVal, decimals, prefix, suffix);
      const nextRafId = requestAnimationFrame(step);
      if (entry) {
        entry.rafId = nextRafId;
      }
    } else {
      finishImmediately();
    }
  };

  const rafId = requestAnimationFrame(step);
  activeKpiAnimations.set(el, {
    rafId,
    currentValue: startValue,
    targetValue: numericTarget,
    finalText: finalFormatted,
    onFinish: finishImmediately
  });
}

/**
 * Finish all active KPI count-up animations immediately (useful for deterministic test assertions)
 */
export function finishAllKpiAnimations() {
  for (const [, entry] of Array.from(activeKpiAnimations.entries())) {
    if (entry && typeof entry.onFinish === 'function') {
      entry.onFinish();
    }
  }
  activeKpiAnimations.clear();
}

/**
 * Return count of currently running KPI animations
 */
export function getActiveKpiAnimationCount() {
  return activeKpiAnimations.size;
}

if (typeof window !== 'undefined') {
  window.finishAllKpiAnimations = finishAllKpiAnimations;
  window.getActiveKpiAnimationCount = getActiveKpiAnimationCount;
}
