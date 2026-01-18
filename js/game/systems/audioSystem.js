// audioSystem.js
// Extracted from gameOrchestrator.js - Audio System Module
// Manages game audio including music tracks, SFX, volume control, and Web Audio routing

import { scheduleAfter } from '../utils/timing.js'
import { getTimeInfo } from './timeSystem.js'

// =============================================================================
// AUDIO STATE
// =============================================================================
// Audio system state manages Web Audio routing (AudioContext + GainNodes) when 
// available, and falls back to element.volume otherwise.

const audioState = {
    initialized: false,
    currentTrack: null,

    // Master volume is controlled by state.settingsVolume (0-100)
    masterVolume: 1, // 0..1

    // Channel toggles (persisted in state/localStorage)
    musicEnabled: true,
    sfxEnabled: true,

    // Per-sound "base" levels (ambience quieter than SFX, etc.)
    baseVolumes: new WeakMap(), // HTMLAudioElement -> baseVol (0..1)

    // Web Audio routing (preferred when available)
    ctx: null,
    masterGain: null,
    musicBusGain: null,
    sfxBusGain: null,
    categories: new WeakMap(), // HTMLAudioElement -> 'music' | 'sfx'
    gains: new WeakMap(), // HTMLAudioElement -> GainNode (base gain)

    interiorOpen: false, // true while inside bank/tavern

    tracks: {},
    sfx: {}
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function clamp01(n) {
    return Math.max(0, Math.min(1, n))
}

function getMasterVolume01(state) {
    const v =
        state && typeof state.settingsVolume === 'number'
            ? state.settingsVolume
            : 100
    return clamp01(Number(v) / 100)
}

function ensureAudioContext() {
    if (audioState.ctx) return

    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return

    try {
        const ctx = new Ctx()
        audioState.ctx = ctx

        const masterGain = ctx.createGain()
        masterGain.gain.value = audioState.masterVolume
        masterGain.connect(ctx.destination)
        audioState.masterGain = masterGain

        // Channel buses so we can mute/unmute music and SFX without restarting tracks.
        const musicBusGain = ctx.createGain()
        musicBusGain.gain.value = audioState.musicEnabled ? 1 : 0
        musicBusGain.connect(masterGain)
        audioState.musicBusGain = musicBusGain

        const sfxBusGain = ctx.createGain()
        sfxBusGain.gain.value = audioState.sfxEnabled ? 1 : 0
        sfxBusGain.connect(masterGain)
        audioState.sfxBusGain = sfxBusGain

        // Most browsers start the context suspended until a user gesture.
        // We'll attempt to resume on the next interaction.
        const unlock = () => {
            tryResumeAudioContext()
        }
        window.addEventListener('pointerdown', unlock, {
            once: true,
            capture: true
                })
        window.addEventListener('touchend', unlock, {
            once: true,
            capture: true
        })
        window.addEventListener('keydown', unlock, {
            once: true,
            capture: true
        })
    } catch (e) {
        console.warn(
            'Web Audio init failed; falling back to HTMLAudioElement.volume:',
            e
        )
        audioState.ctx = null
        audioState.masterGain = null
        audioState.musicBusGain = null
        audioState.sfxBusGain = null
    }
}

function tryResumeAudioContext() {
    const ctx = audioState.ctx
    if (!ctx) return

    if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
    }
}

function registerAudio(el, baseVol, category = 'music') {
    const base = clamp01(Number(baseVol))
    audioState.baseVolumes.set(el, base)

    const cat = category === 'sfx' ? 'sfx' : 'music'
    audioState.categories.set(el, cat)

    // Prefer Web Audio routing so the master volume slider works everywhere.
    ensureAudioContext()

    if (audioState.ctx && audioState.masterGain) {
        try {
            // Each <audio> element can only be wrapped once.
            if (!audioState.gains.has(el)) {
                const src = audioState.ctx.createMediaElementSource(el)
                const gain = audioState.ctx.createGain()
                gain.gain.value = base

                src.connect(gain)
                const bus =
                    cat === 'sfx'
                        ? audioState.sfxBusGain || audioState.masterGain
                        : audioState.musicBusGain || audioState.masterGain
                gain.connect(bus)

                audioState.gains.set(el, gain)
                    } else {
                // Keep base volume synced if we ever re-register.
                const g = audioState.gains.get(el)
                if (g) g.gain.value = base
            }

            // Let Web Audio handle loudness.
            el.volume = 1
        } catch (e) {
            // Fallback: element volume (may be ignored on iOS)
            el.volume =
                base *
                audioState.masterVolume *
                (cat === 'sfx'
                    ? audioState.sfxEnabled
                        ? 1
                        : 0
                    : audioState.musicEnabled
                    ? 1
                    : 0)
        }
    } else {
        // Fallback: element volume
        el.volume =
            base *
            audioState.masterVolume *
            (cat === 'sfx'
                ? audioState.sfxEnabled
                    ? 1
                    : 0
                : audioState.musicEnabled
                ? 1
                : 0)
    }

    return el
}

function applyMasterVolumeTo(el) {
    if (!el) return

    const base = audioState.baseVolumes.get(el)
    const gain = audioState.gains.get(el)

    const cat =
        audioState.categories.get(el) ||
        (Object.values(audioState.sfx).includes(el) ? 'sfx' : 'music')
    const chanEnabled =
        cat === 'sfx'
            ? audioState.sfxEnabled
                ? 1
                : 0
            : audioState.musicEnabled
            ? 1
            : 0

    // Web Audio path:
    if (gain && typeof base === 'number') {
        gain.gain.value = clamp01(base) // per-sound base
        el.volume = 1 // keep media element at unity
        return
    }

    // Fallback path:
    if (typeof base === 'number') {
        el.volume = clamp01(base) * audioState.masterVolume * chanEnabled
    }
}

function applyMasterVolumeAll() {
    // Web Audio master:
    if (audioState.masterGain) {
        audioState.masterGain.gain.value = audioState.masterVolume
    }

    // Keep fallback volumes in sync too:
    Object.values(audioState.tracks).forEach(applyMasterVolumeTo)
    Object.values(audioState.sfx).forEach(applyMasterVolumeTo)
}

function applyChannelMuteGains() {
    // Web Audio path
    if (audioState.musicBusGain)
        audioState.musicBusGain.gain.value = audioState.musicEnabled ? 1 : 0
    if (audioState.sfxBusGain)
        audioState.sfxBusGain.gain.value = audioState.sfxEnabled ? 1 : 0

    // Fallback path
    Object.values(audioState.tracks).forEach(applyMasterVolumeTo)
    Object.values(audioState.sfx).forEach(applyMasterVolumeTo)
}

// =============================================================================
// PUBLIC API
// =============================================================================

export function setMasterVolumePercent(vPercent) {
    const v = Number(vPercent)
    audioState.masterVolume = clamp01((Number.isFinite(v) ? v : 100) / 100)
    applyMasterVolumeAll()
}

export function setMusicEnabled(engine, state, enabled, { persist = true } = {}) {
    const on = !!enabled
    if (typeof state !== 'undefined' && state) state.musicEnabled = on
    audioState.musicEnabled = on
    if (persist) {
        try {
            // Use engine settings service (locus_settings)
            const settings = engine && engine.getService ? engine.getService('settings') : null
            if (settings && settings.set) {
                settings.set('audio.musicEnabled', on)
            }
        } catch (e) {}
    }
    initAudio(engine, state)
    ensureAudioContext()
    applyChannelMuteGains()
    updateAreaMusic(state)
}

export function setSfxEnabled(engine, state, enabled, { persist = true } = {}) {
    const on = !!enabled
    if (typeof state !== 'undefined' && state) state.sfxEnabled = on
    audioState.sfxEnabled = on
    if (persist) {
        try {
            // Use engine settings service (locus_settings)
            const settings = engine && engine.getService ? engine.getService('settings') : null
            if (settings && settings.set) {
                settings.set('audio.sfxEnabled', on)
            }
        } catch (e) {}
    }
    initAudio(engine, state)
    ensureAudioContext()
    applyChannelMuteGains()
}

// Mute/unmute ambient audio while the player is "inside" a building modal
export function setInteriorOpen(state, open) {
    initAudio(null, state)
    audioState.interiorOpen = !!open
    if (audioState.interiorOpen) {
        playMusicTrack(null)
    } else {
        updateAreaMusic(state)
    }
}

export function initAudio(engine, state) {
    if (audioState.initialized) return
    audioState.initialized = true

    // Initialize master volume from settings (if present)
    audioState.masterVolume = getMasterVolume01(state)

    // Initialize channel toggles from state (preferred) or localStorage
    try {
        if (typeof state !== 'undefined' && state) {
            audioState.musicEnabled = state.musicEnabled !== false
            audioState.sfxEnabled = state.sfxEnabled !== false
        } else {
            // Try engine settings first, then fall back to legacy storage
            // Use engine settings service (locus_settings) to initialize audio toggles
            try {
                const settings = engine && engine.getService ? engine.getService('settings') : null
                if (settings && typeof settings.get === 'function') {
                    audioState.musicEnabled = settings.get('audio.musicEnabled', true)
                    audioState.sfxEnabled = settings.get('audio.sfxEnabled', true)
                }
            } catch (e) {}
        }
    } catch (e) {}

    // Create audio routing early so volume works consistently
    ensureAudioContext()
    applyMasterVolumeAll()
    applyChannelMuteGains()

    // ---- Ambient tracks ------------------------------------------------------
    // Village daytime ambience
    const villageDay = registerAudio(
        new Audio(new URL('../../../assets/audio/village_day.wav', import.meta.url).href),
        0.4,
        'music'
    )
    villageDay.loop = true
    audioState.tracks.villageDay = villageDay

    // Global night ambience (plays anywhere at night)
    const nightAmbience = registerAudio(
        new Audio(new URL('../../../assets/audio/night-ambience.wav', import.meta.url).href),
        0.35,
        'music'
    )
    nightAmbience.loop = true
    audioState.tracks.nightAmbience = nightAmbience

    // Inside initAudio(), after other ambient/sfx tracks:
    const tavernAmbience = registerAudio(
        new Audio(new URL('../../../assets/audio/Tavern.wav', import.meta.url).href),
        0.45,
        'music'
    )
    tavernAmbience.loop = true
    audioState.tracks.tavernAmbience = tavernAmbience

    // ---- SFX ----------------------------------------------------------------
    const doorOpen = registerAudio(
        new Audio(new URL('../../../assets/audio/old-wooden-door.wav', import.meta.url).href),
        0.7,
        'sfx'
    )
    doorOpen.loop = false
    audioState.sfx.doorOpen = doorOpen
}

// Play the tavern/bank door SFX (one-shot)
// - Plays twice, at 2x speed, for a punchier "double latch" effect.
// - Returns a Promise that resolves after the final play ends.
export function playDoorOpenSfx(engine, state) {
    initAudio(engine, state)
    tryResumeAudioContext()

    const door = audioState.sfx && audioState.sfx.doorOpen
    if (!door) return Promise.resolve()

    // Respect SFX toggle (don't even start muted playback)
    const sfxOn =
        typeof state !== 'undefined' && state
            ? state.sfxEnabled !== false
            : audioState.sfxEnabled
    if (!sfxOn) return Promise.resolve()

    const targetRate = 2 // 2x speed
    const playsTotal = 2 // play twice
    const originalRate =
        typeof door.playbackRate === 'number' ? door.playbackRate : 1

    let playsLeft = playsTotal

    // Prevent stacking multiple "double-play" sequences if the player spams the door.
    // We cancel any previous sequence and start fresh.
    try {
        if (door.__doublePlayCancel) {
            door.__doublePlayCancel()
            door.__doublePlayCancel = null
        }
    } catch (_) {}

    return new Promise((resolve) => {
        let resolved = false

        const finish = () => {
            if (resolved) return
            resolved = true

            try {
                door.playbackRate = originalRate
            } catch (_) {}

            door.removeEventListener('ended', onEnded)
            try {
                if (safetyTimer && typeof safetyTimer.cancel === 'function') {
                    safetyTimer.cancel()
                }
            } catch (_) {}
            door.__doublePlayCancel = null

            resolve()
        }

        const onEnded = () => {
            playsLeft -= 1

            if (playsLeft > 0) {
                // Rewind and play again immediately
                try {
                    door.currentTime = 0
                    applyMasterVolumeTo(door)
                    door.play().catch(() => finish())
                } catch (e) {
                    finish()
                }
            } else {
                finish()
            }
        }

        // If autoplay is blocked, "ended" may never fire-fallback to finishing.
        let safetyTimer = scheduleAfter(engine, 1500, finish, { owner: 'audio:doorSfx' })

        // Expose cancel so a subsequent door open can restart the sequence cleanly.
        door.__doublePlayCancel = finish

        try {
            door.removeEventListener('ended', onEnded)
            door.addEventListener('ended', onEnded)

            // Start fresh
            door.currentTime = 0
            try {
                door.playbackRate = targetRate
            } catch (_) {}
            applyMasterVolumeTo(door)

            door.play().catch((err) => {
                console.warn(
                    'Door SFX play blocked (likely due to browser autoplay rules):',
                    err
                )
                finish()
            })
        } catch (err) {
            console.warn('Door SFX error:', err)
            finish()
        }
    })
}

// Play a given HTMLAudioElement, stopping whatever was playing before
export function playMusicTrack(track) {
    if (!track) {
        // Stop current
        if (audioState.currentTrack) {
            audioState.currentTrack.pause()
            audioState.currentTrack.currentTime = 0
            audioState.currentTrack = null
        }
        return
    }

    // Already playing this one? no-op
    if (audioState.currentTrack === track) return

    // Stop the previous track
    if (audioState.currentTrack) {
        audioState.currentTrack.pause()
        audioState.currentTrack.currentTime = 0
    }

    audioState.currentTrack = track

    applyMasterVolumeTo(track)
    tryResumeAudioContext()

    // Start new one; catch autoplay blocks quietly
    track.play().catch((err) => {
        console.warn(
            'Music play blocked until user interacts with the page:',
            err
        )
    })
}

// Convenience: what counts as "daytime"?
function isMorning(info) {
    // timeSystem.js appears to provide { partLabel, partIndex }
    if (typeof info?.partIndex === 'number') return info.partIndex === 0 // Morning
    return info?.partLabel === 'Morning'
}

// Convenience: what counts as "night"?
function isNight(info) {
    // Prefer explicit name/label when available
    const lbl = String(info?.partName ?? info?.partLabel ?? '').toLowerCase()
    if (lbl && lbl.includes('night')) return true

    // Fallback by index:
    // timeSystem.js (3-part day) => 0=Morning, 1=Evening, 2=Night
    // older (4-part) conventions => 3=Night
    if (typeof info?.partIndex === 'number') {
        return info.partIndex === 2 || info.partIndex >= 3
    }
    return false
}

// Call this whenever area/time might have changed
export function updateAreaMusic(state) {
    if (!state) return

    // Never play ambience when the game screen isn't visible (main menu, settings, etc.)
    const gameScreenEl = document.getElementById('gameScreen')
    const gameVisible = !!(
        gameScreenEl && !gameScreenEl.classList.contains('hidden')
    )
    if (!gameVisible) {
        playMusicTrack(null)
        return
    }

    initAudio(null, state)
    setMasterVolumePercent(state.settingsVolume)

    const info = getTimeInfo(state)
    const area = state.area || 'village'

    // If we're inside a building modal (bank/tavern), don't let world ambience play.
    // BUT: If Tavern.wav is already playing (tavern/gambling), keep it going without restarting.
    if (audioState.interiorOpen) {
        const tavernTrack =
            audioState.tracks && audioState.tracks.tavernAmbience

        if (tavernTrack && audioState.currentTrack === tavernTrack) {
            // Keep playing through transitions (Tavern ? Gambling) and just keep volume in sync.
            applyMasterVolumeTo(tavernTrack)
            if (tavernTrack.paused && tavernTrack.currentTime > 0) {
                tryResumeAudioContext()
                tavernTrack.play().catch(() => {})
            }
            return
        }

        playMusicTrack(null)
        return
    }

    // Night ambience overrides everything, anywhere (unless inside)
    if (isNight(info)) {
        playMusicTrack(audioState.tracks.nightAmbience)
        return
    }

    if (area === 'village' && isMorning(info)) {
        playMusicTrack(audioState.tracks.villageDay)
    } else {
        playMusicTrack(null)
    }
}

// Export audio state getter for plugin
export function getAudioState() {
    return audioState
}

// Export tryResumeAudioContext for external use
export { tryResumeAudioContext }

// Export applyChannelMuteGains for external use
export { applyChannelMuteGains }
