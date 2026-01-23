// js/game/plugins/uiRuntimePlugin.js
// Engine plugin: UI runtime + DOM bindings
//
// The UI modules are Emberwood-specific, but plugging them into the Engine
// lifecycle keeps gameOrchestrator.js focused on gameplay orchestration.
import * as uiRuntime from '../ui/runtime/uiRuntime.js';
import { initUIBindings } from '../ui/runtime/uiBindings.js';
export function createUiRuntimePlugin(opts = {}) {
    const uiConfig = (opts && typeof opts.uiConfig === 'object') ? opts.uiConfig : {};
    const uiBindingsApi = (opts && typeof opts.uiBindingsApi === 'object') ? opts.uiBindingsApi : {};
    // Capture the Engine instance during init so start() can safely install adapters.
    // (Plugins are started without args by the Engine Core.)
    let _engine = null;
    return {
        id: 'ew.uiRuntime',
        init(engine) {
            _engine = engine || null;
            // Configure the shared UI runtime hooks (state/audio/combat accessors).
            try {
                uiRuntime.configureUI({ ...uiConfig, engine });
            }
            catch (_) { }
            // Expose the UI runtime via services so other plugins can depend on it.
            try {
                engine.registerService('ui', uiRuntime);
            }
            catch (_) { }
            try {
                engine.registerService('ui.bindings', { initUIBindings });
            }
            catch (_) { }
        },
        start() {
            // initUIBindings waits for DOMContentLoaded, so calling it from the
            // plugin lifecycle is safe.
            initUIBindings(uiBindingsApi);
            // Install the Engine UI router adapter after the DOM is ready.
            // This allows engine.ui.open/close to render through the existing modal system.
            const install = () => {
                try {
                    if (!_engine || !_engine.ui || typeof _engine.ui.setAdapter !== 'function')
                        return;
                    _engine.ui.setAdapter({
                        open: (_id, props = {}) => {
                            const title = props && typeof props.title === 'string' ? props.title : '';
                            const builderFn = props && typeof props.builderFn === 'function' ? props.builderFn : null;
                            const owner = props && typeof props.owner === 'string' ? props.owner : '';
                            // Generic modal path used by uiRuntime.openModal wrapper.
                            if (builderFn)
                                return uiRuntime.openModalDom(title, builderFn, { owner });
                            // If callers use engine.ui directly, they can pass { title, builderFn } as well.
                            return uiRuntime.openModalDom(title || String(_id || ''), () => { }, { owner });
                        },
                        close: () => uiRuntime.closeModalDom()
                    });
                }
                catch (_) { }
            };
            try {
                if (typeof document !== 'undefined' && document && document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', install, { once: true });
                }
                else {
                    install();
                }
            }
            catch (_) {
                install();
            }
        }
    };
}
//# sourceMappingURL=uiRuntimePlugin.js.map