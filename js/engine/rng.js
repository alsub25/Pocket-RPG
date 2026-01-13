// js/engine/rng.js
// Seeded RNG service with named streams (engine-agnostic).

function _hash32(str) {
  // FNV-1a 32-bit
  let h = 0x811c9dc5
  const s = String(str ?? '')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  return h >>> 0
}

function _mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function _coerceSeed(seed) {
  if (seed == null) return _hash32(String(Date.now()))
  if (Number.isFinite(seed)) return (seed >>> 0)
  return _hash32(String(seed))
}

export function createRngService({ seed = null } = {}) {
  let _rootSeed = _coerceSeed(seed)
  const streams = new Map()

  function _getStream(name) {
    const key = String(name || 'default')
    if (streams.has(key)) return streams.get(key)

    const s = _hash32(_rootSeed + '::' + key)
    const next = _mulberry32(s)

    const stream = {
      seed: s >>> 0,
      float() { return next() },
      int(minInclusive, maxInclusive) {
        const min = Number(minInclusive) || 0
        const max = Number(maxInclusive) || 0
        if (max < min) return min
        return min + Math.floor(next() * (max - min + 1))
      },
      pick(arr) {
        if (!Array.isArray(arr) || arr.length === 0) return null
        return arr[Math.floor(next() * arr.length)]
      }
    }

    streams.set(key, stream)
    return stream
  }

  function setSeed(nextSeed) {
    _rootSeed = _coerceSeed(nextSeed)
    streams.clear()
    return _rootSeed
  }

  return {
    get rootSeed() { return _rootSeed },
    setSeed,

    stream: _getStream,

    float() { return _getStream('default').float() },
    int(min, max) { return _getStream('default').int(min, max) },
    pick(arr) { return _getStream('default').pick(arr) },

    reset() { streams.clear() }
  }
}
