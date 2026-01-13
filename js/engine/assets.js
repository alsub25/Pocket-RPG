// js/engine/assets.js
// Asset registry + preload helpers (engine-agnostic).
//
// Expanded in Patch 1.2.72 (Locus) to support:
// - Manifests (assets + groups)
// - Group preloading with progress events
// - Fetch helpers for JSON

export function createAssetRegistry({ emit = null, logger = null } = {}) {
  const map = new Map()    // key -> url
  const groups = new Map() // group -> Set<key>

  const _jsonCache = new Map() // url -> parsed json

  function _log(lvl, msg, data) {
    try { if (logger && logger[lvl]) logger[lvl]('assets', msg, data) } catch (_) {}
  }

  function register(key, url) {
    const k = String(key || '').trim()
    if (!k) return
    map.set(k, String(url || ''))
  }

  function registerManifest(manifest, { baseUrl = '', overwrite = true } = {}) {
    if (!manifest || typeof manifest !== 'object') return
    const assets = manifest.assets && typeof manifest.assets === 'object' ? manifest.assets : null
    const g = manifest.groups && typeof manifest.groups === 'object' ? manifest.groups : null

    if (assets) {
      Object.keys(assets).forEach(k => {
        const v = assets[k]
        const url = String(v || '')
        const resolved = (baseUrl && url && !url.startsWith('http') && !url.startsWith('/') && !url.startsWith('data:'))
          ? String(baseUrl).replace(/\/$/, '') + '/' + url.replace(/^\./, '').replace(/^\//, '')
          : url
        if (!overwrite && map.has(String(k))) return
        register(k, resolved)
      })
    }

    if (g) {
      Object.keys(g).forEach(groupId => {
        const arr = Array.isArray(g[groupId]) ? g[groupId] : []
        const set = groups.get(groupId) || new Set()
        arr.forEach(key => {
          const k = String(key || '').trim()
          if (k) set.add(k)
        })
        groups.set(groupId, set)
      })
    }
  }

  function get(key) {
    const k = String(key || '').trim()
    if (!k) return ''
    return map.get(k) || ''
  }

  function resolve(keyOrUrl) {
    const s = String(keyOrUrl || '').trim()
    if (!s) return ''
    if (map.has(s)) return map.get(s) || ''
    return s
  }

  function has(key) { return map.has(String(key || '').trim()) }

  async function preload(keys = [], { group = null } = {}) {
    const arr = Array.isArray(keys) ? keys : []
    const urls = arr.map(resolve).filter(Boolean)
    const results = []
    const isImageUrl = (u) => {
      const s = String(u || '').toLowerCase()
      return s.endsWith('.png') || s.endsWith('.jpg') || s.endsWith('.jpeg') || s.endsWith('.gif') || s.endsWith('.webp') || s.endsWith('.svg')
    }

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]
      try {
        // Prefer image preload for image-like URLs; otherwise warm the HTTP cache via fetch.
        if (isImageUrl(url) && typeof Image !== 'undefined') {
          await new Promise((resolve, reject) => {
            const img = new Image()
            img.onload = () => resolve(true)
            img.onerror = () => reject(new Error('img_error'))
            img.src = url
          })
        } else if (typeof fetch === 'function') {
          await fetch(url, { cache: 'force-cache' }).then(r => r.arrayBuffer())
        }
        results.push({ url, ok: true })
        try { if (emit) emit('assets:loaded', { url, group }) } catch (_) {}
      } catch (e) {
        results.push({ url, ok: false, error: String(e?.message || e) })
        _log('warn', 'preload failed', { url, e })
        try { if (emit) emit('assets:error', { url, group, error: String(e?.message || e) }) } catch (_) {}
      }

      try {
        if (emit) emit('assets:progress', { group, done: i + 1, total: urls.length, url })
      } catch (_) {}
    }
    return results
  }

  async function preloadGroup(groupId, opts = {}) {
    const g = String(groupId || '').trim()
    if (!g) return []
    const set = groups.get(g)
    const keys = set ? Array.from(set) : []
    return preload(keys, { ...opts, group: g })
  }

  function listGroups() {
    return Array.from(groups.entries()).map(([k, set]) => ({ group: k, keys: Array.from(set) }))
  }

  async function fetchJson(keyOrUrl, { cache = true } = {}) {
    const url = resolve(keyOrUrl)
    if (!url) return null
    if (cache && _jsonCache.has(url)) return _jsonCache.get(url)
    try {
      if (typeof fetch !== 'function') return null
      const r = await fetch(url, { cache: 'force-cache' })
      const j = await r.json()
      if (cache) _jsonCache.set(url, j)
      try { if (emit) emit('assets:json', { url }) } catch (_) {}
      return j
    } catch (e) {
      _log('warn', 'fetchJson failed', { url, e })
      try { if (emit) emit('assets:error', { url, error: String(e?.message || e) }) } catch (_) {}
      return null
    }
  }

  function list() { return Array.from(map.entries()).map(([k, v]) => ({ key: k, url: v })) }

  return {
    register,
    registerManifest,
    get,
    resolve,
    has,
    preload,
    preloadGroup,
    fetchJson,
    list,
    listGroups
  }
}
