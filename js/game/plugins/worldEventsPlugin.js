// js/game/plugins/worldEventsPlugin.js
// Lightweight helper that namespaced world/runtime events under `world:*`.

export function createWorldEventsPlugin() {
    return {
        id: 'ew.worldEvents',

        init(engine) {
            // Expose a tiny helper service so game code can emit consistently.
            engine.registerService('world', {
                emit(type, payload) {
                    const t = String(type || '')
                    if (!t) return
                    try { engine.emit(`world:${t}`, payload) } catch (_) {}
                },
                on(type, fn) {
                    const t = String(type || '')
                    if (!t) return
                    try { engine.on(`world:${t}`, fn) } catch (_) {}
                },
                off(type, fn) {
                    const t = String(type || '')
                    if (!t) return
                    try { engine.off(`world:${t}`, fn) } catch (_) {}
                }
            })
        }
    }
}
