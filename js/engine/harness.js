// js/engine/harness.js
// Headless test harness helpers: deterministic stepping.

export function createHarness(engine) {
  function runSteps(n, { dtMs = 16, onStep = null } = {}) {
    const steps = Math.max(0, Number(n) || 0)
    for (let i = 0; i < steps; i++) {
      try { engine.tick(dtMs) } catch (_) {}
      try { if (typeof onStep === 'function') onStep(i) } catch (_) {}
    }
  }

  return { runSteps }
}
