// js/game/plugins/assetsManifestPlugin.js
// Registers Emberwood's asset manifest with engine.assets.

export function createAssetsManifestPlugin() {
  return {
    id: 'ew.assetsManifest',
    init(engine) {
      const assets = engine && engine.getService ? engine.getService('assets') : null
      if (!assets || typeof assets.registerManifest !== 'function') return

      // Keep this manifest small and stable. It's a foundation for future UI/content.
      assets.registerManifest({
        assets: {
          'audio:village_day': 'assets/audio/village_day.wav',
          'audio:night_ambience': 'assets/audio/night-ambience.wav',
          'audio:door': 'assets/audio/old-wooden-door.wav',
          'audio:tavern': 'assets/audio/Tavern.wav'
        },
        groups: {
          // Mirrors bootstrap prefetch list.
          criticalAudio: [
            'audio:village_day',
            'audio:night_ambience',
            'audio:door',
            'audio:tavern'
          ],

          // Screen-level groups (owner convention: screen:<name>)
          // NOTE: Emberwood's actual screens are: mainMenu, character, game, settings
          // (see uiRuntime.screens). Area ambience is handled via area:<id> groups below.
          'screen:mainMenu': [
            'audio:door'
          ],
          'screen:character': [
            'audio:door'
          ],
          'screen:settings': [
            'audio:door'
          ],
          // The game screen can enter multiple areas; preload the most commonly used ambience.
          'screen:game': [
            'audio:village_day',
            'audio:night_ambience'
          ],

          // Area-level groups (owner convention: area:<id>)
          // These are driven by area:enter events (Patch 1.2.80).
          'area:village': [
            'audio:village_day',
            'audio:night_ambience'
          ],
          'area:forest': [
            'audio:night_ambience'
          ],

          // Modal-level groups (owner convention: modal:<name>)
          'modal:tavern': [
            'audio:tavern',
            'audio:door'
          ],
          'modal:enemySheet': [
            'audio:door'
          ],
          'modal:bank': [
            'audio:door'
          ],
          'modal:merchant': [
            'audio:door'
          ],
          'modal:townHall': [
            'audio:door'
          ],
          'modal:government': [
            'audio:door'
          ]
        }
      }, { baseUrl: '' })
    }
  }
}
