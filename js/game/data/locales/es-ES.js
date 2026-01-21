// js/game/data/locales/es-ES.js
// Spanish (Spain) translations

export const translations = {
  // UI Common
  'ui.new_game': 'Nuevo Juego',
  'ui.continue': 'Cargar Partida',
  'ui.save': 'Guardar',
  'ui.load': 'Cargar',
  'ui.settings': 'Configuración',
  'ui.changelog': 'Registro de Cambios',
  'ui.feedback': 'Comentarios / Informe de Errores',
  'ui.close': 'Cerrar',
  'ui.cancel': 'Cancelar',
  'ui.confirm': 'Confirmar',
  'ui.back': 'Atrás',
  'ui.next': 'Siguiente',
  'ui.menu': 'Menú',
  'ui.journal': 'Diario',
  
  // Character Creation
  'char.create_hero': 'Crear Héroe',
  'char.name': 'Nombre',
  'char.name_placeholder': 'Aria, Thorne, etc.',
  'char.class': 'Clase',
  'char.difficulty': 'Dificultad',
  'char.dev_cheats': 'Trucos de Desarrollador',
  'char.enable_cheats': 'Activar trucos de desarrollador',
  'char.cheats_subtitle': 'Muestra el menú de Trucos en el juego para este personaje (solo pruebas).',
  'char.begin_adventure': 'Comenzar Aventura',
  
  // Game HUD
  'hud.hero': 'Héroe',
  'hud.level_xp': 'Nv {level} • {xp}/{nextXp} EXP',
  'hud.gold': 'Oro',
  'hud.hp': 'Vida', // Vida is more common in Spanish gaming
  'hud.resource': 'Recurso',
  'hud.enemy': 'Enemigo',
  
  // Quest Panel
  'quest.quests': 'Misiones',
  'quest.none': 'Ninguna todavía.',
  'quest.log': 'Registro',
  
  // Log Filters
  'log.all': 'Todo',
  'log.system': 'Sistema',
  'log.player': 'Jugador',
  'log.enemy': 'Enemigo',
  'log.combat': 'Combate',
  'log.damage': 'Daño',
  'log.procs': 'Procs',
  'log.status': 'Estado',
  
  // Settings Screen
  'settings.title': 'Configuración',
  'settings.subtitle': 'Personaliza gráficos, audio y accesibilidad.',
  
  // Display Settings
  'settings.display': 'Pantalla',
  'settings.theme': 'Tema',
  'settings.theme_desc': 'Cambia la paleta de colores de la interfaz.',
  'settings.theme_default': 'Predeterminado',
  'settings.theme_arcane': 'Arcano',
  'settings.theme_inferno': 'Infierno',
  'settings.theme_forest': 'Bosque',
  'settings.theme_holy': 'Sagrado',
  'settings.theme_shadow': 'Sombra',
  'settings.color_scheme': 'Esquema de color',
  'settings.color_scheme_desc': 'Modo claro u oscuro para la interfaz.',
  'settings.color_auto': 'Auto',
  'settings.color_light': 'Claro',
  'settings.color_dark': 'Oscuro',
  'settings.ui_scale': 'Escala de interfaz',
  'settings.ui_scale_desc': 'Ajusta el tamaño de todos los elementos de la interfaz.',
  'settings.size_small': 'Pequeño',
  'settings.size_default': 'Predeterminado',
  'settings.size_large': 'Grande',
  'settings.size_xlarge': 'Extra Grande',
  'settings.text_speed': 'Velocidad de texto',
  'settings.text_speed_desc': 'Qué tan rápido avanza el texto de la historia.',
  
  // Audio Settings
  'settings.audio': 'Audio',
  'settings.master_volume': 'Volumen maestro',
  'settings.master_volume_desc': 'Nivel de volumen general.',
  'settings.music': 'Música',
  'settings.music_desc': 'Música de fondo durante el juego.',
  'settings.sfx': 'Efectos de sonido',
  'settings.sfx_desc': 'Efectos de sonido de combate e interfaz.',
  
  // Gameplay Settings
  'settings.gameplay': 'Jugabilidad',
  'settings.difficulty_setting': 'Dificultad',
  'settings.difficulty_desc': 'Ajusta el desafío y el escalado de enemigos.',
  'settings.difficulty_easy': 'Fácil',
  'settings.difficulty_normal': 'Normal',
  'settings.difficulty_hard': 'Difícil',
  'settings.difficulty_dynamic': 'Dinámico',
  'settings.combat_numbers': 'Mostrar números de combate',
  'settings.combat_numbers_desc': 'Muestra números de daño y curación en combate.',
  'settings.auto_save': 'Guardado automático',
  'settings.auto_save_desc': 'Guarda automáticamente tu progreso periódicamente.',
  
  // Accessibility Settings
  'settings.accessibility': 'Accesibilidad',
  'settings.reduce_motion': 'Reducir movimiento',
  'settings.reduce_motion_desc': 'Desactiva efectos de animación del HUD.',
  'settings.text_size': 'Tamaño de texto',
  'settings.text_size_desc': 'Escala el texto de la interfaz para legibilidad.',
  'settings.high_contrast': 'Alto contraste',
  'settings.high_contrast_desc': 'Aumenta el contraste para mejorar la legibilidad.',
  'settings.high_contrast_on': 'Activado',
  'settings.high_contrast_off': 'Desactivado',
  'settings.auto_equip': 'Auto-equipar botín',
  'settings.auto_equip_desc': 'Cuando obtienes una nueva arma o pieza de armadura y la ranura está vacía, equiparla automáticamente.',
  
  // Language Settings
  'settings.language_section': 'Idioma',
  'settings.language': 'Idioma',
  'settings.language_desc': 'Elige tu idioma preferido para la interfaz del juego.',
  'settings.ai_translation': 'Traducción IA',
  'settings.ai_translation_desc': 'Activa la traducción IA para contenido dinámico del juego (requiere clave API).',
  
  // Combat
  'combat.turn': 'Turno',
  'combat.your_turn': 'Tu Turno',
  'combat.enemy_turn': 'Turno del Enemigo',
  'combat.attack': 'Atacar',
  'combat.defend': 'Defender',
  'combat.flee': 'Huir',
  'combat.abilities': 'Habilidades',
  'combat.victory': '¡Victoria!',
  'combat.defeat': 'Derrota',
  'combat.damage': 'Daño',
  'combat.healing': 'Curación',
  
  // Village
  'village.tavern': 'Taberna',
  'village.merchant': 'Mercader',
  'village.bank': 'Banco',
  'village.town_hall': 'Ayuntamiento',
  'village.adventure': 'Aventura',
  
  // Inventory
  'inv.inventory': 'Inventario',
  'inv.equipment': 'Equipamiento',
  'inv.gold': 'Oro',
  'inv.items': 'Objetos',
  'inv.equip': 'Equipar',
  'inv.unequip': 'Desequipar',
  'inv.use': 'Usar',
  'inv.sell': 'Vender',
  
  // Stats
  'stats.level': 'Nivel',
  'stats.health': 'Salud',
  'stats.mana': 'Maná',
  'stats.energy': 'Energía',
  'stats.strength': 'Fuerza',
  'stats.dexterity': 'Destreza',
  'stats.intelligence': 'Inteligencia',
  'stats.vitality': 'Vitalidad',
  'stats.defense': 'Defensa',
  'stats.attack': 'Ataque',
  
  // Classes
  'class.warrior': 'Guerrero',
  'class.mage': 'Mago',
  'class.rogue': 'Pícaro',
  'class.cleric': 'Clérigo',
  'class.ranger': 'Explorador',
  'class.paladin': 'Paladín',
  'class.necromancer': 'Nigromante',
  'class.blood_knight': 'Caballero de Sangre',
  'class.berserker': 'Berserker',
  'class.shaman': 'Chamán',
  'class.vampire': 'Vampiro',
  
  // Settings
  'settings.language': 'Idioma',
  'settings.ai_translation': 'Traducción IA',
  'settings.translation_provider': 'Proveedor de Traducción',
  'settings.enable_ai': 'Activar Traducción IA',
  'settings.api_key': 'Clave API',
  'settings.local_mode': 'Modo Local (Sin API)',
  'settings.openai': 'OpenAI',
  'settings.google': 'Google Translate',
  
  // Messages
  'msg.game_saved': 'Partida guardada correctamente',
  'msg.game_loaded': 'Partida cargada',
  'msg.item_equipped': 'Objeto equipado',
  'msg.item_sold': 'Objeto vendido',
  'msg.not_enough_gold': 'No hay suficiente oro',
  'msg.level_up': '¡Subida de Nivel!',
  'msg.translation_enabled': 'Traducción IA activada',
  'msg.translation_disabled': 'Traducción IA desactivada',
  'msg.language_changed': 'Idioma cambiado a {language}',
  
  // Toasts
  'toast.saved': 'Guardado.',
  'toast.saving': 'Guardando…',
  'toast.replay.recording': 'Grabando repetición…',
  'toast.replay.stopped': 'Repetición capturada.',
  'toast.replay.playing': 'Reproduciendo repetición…'
}
