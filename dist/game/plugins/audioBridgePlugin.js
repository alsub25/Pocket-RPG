// js/game/plugins/audioBridgePlugin.js
// Exposes game audio helpers as an engine service so other plugins can use them.
export function createAudioBridgePlugin({ playDoorOpenSfx = null, updateAreaMusic = null, playMusicTrack = null, getAudioState = null, } = {}) {
    return {
        id: 'ew.audioBridge',
        init(engine) {
            engine.registerService('audio', {
                playDoorOpenSfx: (...a) => {
                    try {
                        return typeof playDoorOpenSfx === 'function' ? playDoorOpenSfx(...a) : null;
                    }
                    catch (_) {
                        return null;
                    }
                },
                updateAreaMusic: (...a) => {
                    try {
                        return typeof updateAreaMusic === 'function' ? updateAreaMusic(...a) : null;
                    }
                    catch (_) {
                        return null;
                    }
                },
                playMusicTrack: (...a) => {
                    try {
                        return typeof playMusicTrack === 'function' ? playMusicTrack(...a) : null;
                    }
                    catch (_) {
                        return null;
                    }
                },
                getAudioState: () => {
                    try {
                        return typeof getAudioState === 'function' ? getAudioState() : null;
                    }
                    catch (_) {
                        return null;
                    }
                },
            });
        }
    };
}
//# sourceMappingURL=audioBridgePlugin.js.map