/**
 * Diccionario de traducción centralizado para la UI — Español e Inglés.
 *
 * Organización:
 * - Cada namespace (transport, prompt, tracks, tabs, page, config) agrupa claves relacionadas
 * - Las claves son paths dot-notated (ej: 'config.cat.scratch.1')
 * - El diccionario es tipado: TranslationKey union valida las claves en tiempo de compilación
 *
 * Sistema de idiomas:
 * - Idioma del motor de audio (Strudel): independiente (inglés nativo)
 * - Idioma del system prompt LLM: siempre inglés (máximo rendimiento)
 * - Idioma del prompt del usuario: sin restricción — el LLM lo procesa en cualquier idioma
 * - Idioma de la UI: ES / EN — detectado desde navigator.language con fallback a ES
 *
 * Política de traducción:
 * - No traducir: código Strudel, nombres de instrumentos (kick, snare, hihat...), teclas de teclado
 * - Traducir todo: tooltips, labels, placeholders, feedback, mensajes de error
 *
 * @see TASK-13 Multiidioma UI — ES / EN con detección del navegador y selector discreto
 * @see nlmusic-spec.md Sección 10 (Adaptaciones Geográficas)
 */

export type Language = 'es' | 'en'

const translations = {
  es: {
    // Transport
    'transport.audioError': 'Motor de audio no disponible. Recarga la página o prueba otro navegador.',
    'transport.audioErrorBadge': '✕ Error',
    'transport.audioReady': '● Listo',
    'transport.audioInit': '○ Iniciando…',
    'transport.play': 'Play',
    'transport.stop': 'Stop',
    'transport.barLabel': 'Compás',

    // Prompt
    'prompt.placeholder': 'Ej: kick 909 en 4x4 techno oscuro, añade snare en los tiempos 2 y 4…',
    'prompt.audioDisabled': 'Motor de audio no disponible — recarga la página',
    'prompt.retry': 'Reintentar',
    'prompt.submit': 'Enviar prompt',
    'prompt.newLine': 'nueva línea',

    // Tracks
    'tracks.counterLabel': 'Pistas',
    'tracks.empty': 'Describe tu patrón abajo para empezar',
    'tracks.codeEditedWarning': 'Editado manualmente — el grid puede no reflejar el código actual',
    'tracks.deleteAriaLabel': 'Eliminar pista',

    // Tabs
    'tabs.sequencer': 'Secuenciador',
    'tabs.strudel': 'Código Strudel',
    'tabs.config': 'Configuración',

    // Page error banner
    'page.audioErrorTitle': 'Motor de audio no disponible',
    'page.audioErrorHint': 'Recarga la página o prueba con otro navegador.',
    'page.reload': 'Recargar',

    // Config — System Status
    'config.systemStatus': 'Estado del sistema',
    'config.audioEngine': 'Motor de audio',
    'config.audioReady': '● Listo',
    'config.audioNotStarted': '○ No iniciado',
    'config.currentBpm': 'BPM actual',
    'config.activeTracks': 'Pistas activas',

    // Config — Prompt Guide
    'config.promptGuide': 'Guía de prompts',
    'config.cat.scratch': 'Crear desde cero',
    'config.cat.scratch.1': 'Un kick 909 en 4x4 techno a 138 BPM',
    'config.cat.scratch.2': 'Drum and bass con amen break, snappy y rápido',
    'config.cat.scratch.3': 'Patrón minimalista, solo hi-hat y bombo suaves',
    'config.cat.modify': 'Modificar pistas existentes',
    'config.cat.modify.1': 'Hazlo más oscuro y lento',
    'config.cat.modify.2': 'Añade un clap en el tiempo 3',
    'config.cat.modify.3': 'En la pista 1, quita los golpes de la segunda mitad',
    'config.cat.style': 'Referencia de estilo',
    'config.cat.style.1': 'Algo entre Aphex Twin y minimal techno',
    'config.cat.style.2': 'Al estilo Burial, percusivo y atmosférico',
    'config.cat.style.3': 'Ritmo afrobeat con mucho groove',
    'config.cat.remove': 'Eliminar',
    'config.cat.remove.1': 'Elimina el hi-hat',
    'config.cat.remove.2': 'Quita todas las pistas y empieza con solo un bombo',

    // Config — Keyboard Shortcuts
    'config.shortcuts': 'Atajos de teclado',
    'config.shortcutSend': 'Enviar prompt',
    'config.shortcutNewLine': 'Nueva línea en el prompt',

    // Config — Editor Preferences
    'config.editorPrefs': 'Preferencias del editor de código',
    'config.editorLabel': 'Editor',
    'config.editorAdvanced': 'Avanzado (CodeMirror)',
    'config.editorSimple': 'Simple (textarea)',
    'config.highlighting': 'Highlighting de sintaxis',
    'config.hapVisualization': 'Visualización haps',
    'config.apiKeyPlaceholder': 'Configuración de API key — disponible en v1+',
    'step.toggleLabel': 'Alternar paso',
    'editor.syntaxError': 'Error de sintaxis',
    'editor.runtimeError': 'Error de sintaxis en el código',
    'editor.placeholder': 'Escribe código Strudel aquí...',
    'editor.editableLabel': 'Código Strudel editable',
    'track.muteLabel': 'Silenciar pista',
    'track.soloLabel': 'Solo pista',
    'bpm.incrementLabel': 'Aumentar BPM',
    'bpm.decrementLabel': 'Disminuir BPM',

    // TASK-26: exportación MIDI
    'midi.download': 'Descargar MIDI',
    'midi.downloadTitle': 'Descarga la canción como archivo .mid para abrirla en tu DAW. Las pistas silenciadas no se incluyen y, si hay alguna en solo, solo se incluyen las pistas en solo.',
    'midi.downloadEmpty': 'Genera algún ritmo antes de descargar.',

    // --- TASK-25: secciones, arreglo y velocidad por paso ---
    'song.sectionsLabel': 'Secciones',
    'song.addSection': 'Añadir sección',
    'song.defaultSectionName': 'Sección',
    'song.copySuffix': 'copia',
    'song.rename': 'Renombrar',
    'song.renameLabel': 'Nombre de la sección',
    'song.duplicate': 'Duplicar',
    'song.delete': 'Eliminar sección',
    'song.bars': 'Compases',
    'song.fewerBars': 'Menos compases',
    'song.moreBars': 'Más compases',
    'song.barLabel': 'Compás',
    'song.playingNow': 'Sonando',
    'song.arrangement': 'Arreglo',
    'song.addBlock': 'Añadir bloque',
    'song.blockSection': 'Sección del bloque',
    'song.repeat': 'Repetir',
    'song.moveEarlier': 'Mover antes',
    'song.moveLater': 'Mover después',
    'song.removeBlock': 'Quitar bloque',
    'song.total': 'Total',
    'song.barsUnit': 'compases',
    'step.label': 'Paso',
    'step.ghost': 'suave',
    'step.normal': 'normal',
    'step.accent': 'fuerte',
    'step.velocityHint': 'Flecha arriba o abajo, o Mayús+clic, para cambiar la fuerza',

    // TASK-29 — Canciones enviadas desde Claude (MCP)
    'live.connected': 'Claude conectado',
    'live.connecting': 'Conectando con Claude…',
    'live.offline': 'Claude sin conexión',
    'live.connectedHint': 'Las canciones que Claude te envíe aparecerán aquí.',
    'live.offlineHint': 'No se pueden recibir canciones de Claude ahora. Se vuelve a intentar solo.',
    'live.received': 'Claude te ha enviado una canción',
    'live.summaryBpm': 'BPM',
    'live.summarySections': 'secciones',
    'live.willStart': 'Empezará a sonar al cargarla.',
    'live.nextBar': 'Entrará en el siguiente compás, sin cortar lo que suena.',
    'live.load': 'Cargar',
    'live.dismiss': 'Descartar',
    'live.editsWarning': 'Has editado el código a mano y esos cambios no están en el grid. Si cargas la canción, se perderán.',
    'live.replace': 'Reemplazar mi código',
    'live.keep': 'Mantener mi código',
    'live.autoAccept': 'Aceptar canciones enviadas por Claude automáticamente',
    'live.autoAcceptHint': 'Si has editado el código a mano, se te preguntará igualmente.',
    // --- TASK-30: herramientas de práctica ---
    'practice.title': 'Practicar',
    'practice.loopThis': 'Repetir esta sección',
    'practice.loopStop': 'Volver a la canción completa',
    'practice.loopHint': 'Repite solo esta sección. Al volver a la canción completa, el cambio entra en el siguiente compás sin cortar el sonido.',
    'practice.loopingOther': 'Repitiendo',
    'practice.dropTitle': 'Quitar para tocarlo tú',
    'practice.dropKick': 'Bombo',
    'practice.dropSnare': 'Caja',
    'practice.dropHihat': 'Charles',
    'practice.dropKickHint': 'Silencia el bombo para que lo toques tú. Vuelve a pulsar para recuperarlo; la canción no cambia.',
    'practice.dropSnareHint': 'Silencia la caja para que la toques tú. Vuelve a pulsar para recuperarla; la canción no cambia.',
    'practice.dropHihatHint': 'Silencia el charles para que lo toques tú. Vuelve a pulsar para recuperarlo; la canción no cambia.',
    'practice.countIn': 'Cuenta atrás',
    'practice.countInOff': 'Sin cuenta atrás',
    'practice.barOne': 'compás',
    'practice.barMany': 'compases',
    'practice.metronome': 'Metrónomo',
    'practice.metronomeOff': 'Apagado',
    'practice.metronomeQuarter': 'Negras',
    'practice.metronomeEighth': 'Corcheas',
    'practice.metronomeVolume': 'Volumen del metrónomo',
    'practice.clickNote': 'La cuenta atrás y el metrónomo solo suenan al reproducir: no son pistas de la canción y no van al archivo MIDI.',
    'practice.trainer': 'Entrenador de tempo: sube la velocidad poco a poco',
    'practice.trainerStart': 'BPM inicial',
    'practice.trainerEnd': 'BPM final',
    'practice.trainerStep': 'Subir cada vez',
    'practice.trainerEvery': 'Cada (vueltas)',
    'practice.trainerPlan': 'Recorrido',
  },

  en: {
    // Transport
    'transport.audioError': 'Audio engine unavailable. Reload the page or try another browser.',
    'transport.audioErrorBadge': '✕ Error',
    'transport.audioReady': '● Ready',
    'transport.audioInit': '○ Initializing…',
    'transport.play': 'Play',
    'transport.stop': 'Stop',
    'transport.barLabel': 'Bar',

    // Prompt
    'prompt.placeholder': 'E.g.: 909 kick in 4x4 dark techno, add snare on beats 2 and 4…',
    'prompt.audioDisabled': 'Audio engine unavailable — reload the page',
    'prompt.retry': 'Retry',
    'prompt.submit': 'Send prompt',
    'prompt.newLine': 'new line',

    // Tracks
    'tracks.counterLabel': 'Tracks',
    'tracks.empty': 'Describe your pattern below to get started',
    'tracks.codeEditedWarning': 'Manually edited — the grid may not reflect the current code',
    'tracks.deleteAriaLabel': 'Delete track',

    // Tabs
    'tabs.sequencer': 'Sequencer',
    'tabs.strudel': 'Strudel Code',
    'tabs.config': 'Settings',

    // Page error banner
    'page.audioErrorTitle': 'Audio engine unavailable',
    'page.audioErrorHint': 'Reload the page or try another browser.',
    'page.reload': 'Reload',

    // Config — System Status
    'config.systemStatus': 'System status',
    'config.audioEngine': 'Audio engine',
    'config.audioReady': '● Ready',
    'config.audioNotStarted': '○ Not started',
    'config.currentBpm': 'Current BPM',
    'config.activeTracks': 'Active tracks',

    // Config — Prompt Guide
    'config.promptGuide': 'Prompt guide',
    'config.cat.scratch': 'Start from scratch',
    'config.cat.scratch.1': 'A 909 kick in 4x4 techno at 138 BPM',
    'config.cat.scratch.2': 'Drum and bass with amen break, snappy and fast',
    'config.cat.scratch.3': 'Minimalist pattern, soft hi-hat and kick only',
    'config.cat.modify': 'Modify existing tracks',
    'config.cat.modify.1': 'Make it darker and slower',
    'config.cat.modify.2': 'Add a clap on beat 3',
    'config.cat.modify.3': 'On track 1, remove hits from the second half',
    'config.cat.style': 'Style reference',
    'config.cat.style.1': 'Something between Aphex Twin and minimal techno',
    'config.cat.style.2': 'Burial style, percussive and atmospheric',
    'config.cat.style.3': 'Afrobeat rhythm with a lot of groove',
    'config.cat.remove': 'Remove',
    'config.cat.remove.1': 'Remove the hi-hat',
    'config.cat.remove.2': 'Remove all tracks and start with just a kick',

    // Config — Keyboard Shortcuts
    'config.shortcuts': 'Keyboard shortcuts',
    'config.shortcutSend': 'Send prompt',
    'config.shortcutNewLine': 'New line in prompt',

    // Config — Editor Preferences
    'config.editorPrefs': 'Code editor preferences',
    'config.editorLabel': 'Editor',
    'config.editorAdvanced': 'Advanced (CodeMirror)',
    'config.editorSimple': 'Simple (textarea)',
    'config.highlighting': 'Syntax highlighting',
    'config.hapVisualization': 'Hap visualization',
    'config.apiKeyPlaceholder': 'API key settings — available in v1+',
    'step.toggleLabel': 'Toggle step',
    'editor.syntaxError': 'Syntax error',
    'editor.runtimeError': 'Syntax error in code',
    'editor.placeholder': 'Write Strudel code here...',
    'editor.editableLabel': 'Editable Strudel code',
    'track.muteLabel': 'Mute track',
    'track.soloLabel': 'Solo track',
    'bpm.incrementLabel': 'Increase BPM',
    'bpm.decrementLabel': 'Decrease BPM',

    // TASK-26: MIDI export
    'midi.download': 'Download MIDI',
    'midi.downloadTitle': 'Download the song as a .mid file to open in your DAW. Muted tracks are left out, and if any track is soloed, only the soloed tracks are included.',
    'midi.downloadEmpty': 'Create a beat before downloading.',

    // --- TASK-25: sections, arrangement and per-step velocity ---
    'song.sectionsLabel': 'Sections',
    'song.addSection': 'Add section',
    'song.defaultSectionName': 'Section',
    'song.copySuffix': 'copy',
    'song.rename': 'Rename',
    'song.renameLabel': 'Section name',
    'song.duplicate': 'Duplicate',
    'song.delete': 'Delete section',
    'song.bars': 'Bars',
    'song.fewerBars': 'Fewer bars',
    'song.moreBars': 'More bars',
    'song.barLabel': 'Bar',
    'song.playingNow': 'Playing',
    'song.arrangement': 'Arrangement',
    'song.addBlock': 'Add block',
    'song.blockSection': 'Block section',
    'song.repeat': 'Repeat',
    'song.moveEarlier': 'Move earlier',
    'song.moveLater': 'Move later',
    'song.removeBlock': 'Remove block',
    'song.total': 'Total',
    'song.barsUnit': 'bars',
    'step.label': 'Step',
    'step.ghost': 'soft',
    'step.normal': 'normal',
    'step.accent': 'loud',
    'step.velocityHint': 'Arrow up or down, or Shift+click, to change how hard it hits',

    // TASK-29 — Songs sent from Claude (MCP)
    'live.connected': 'Claude connected',
    'live.connecting': 'Connecting to Claude…',
    'live.offline': 'Claude not connected',
    'live.connectedHint': 'Songs that Claude sends you will show up here.',
    'live.offlineHint': 'Songs from Claude can’t be received right now. Retrying automatically.',
    'live.received': 'Claude sent you a song',
    'live.summaryBpm': 'BPM',
    'live.summarySections': 'sections',
    'live.willStart': 'It will start playing when you load it.',
    'live.nextBar': 'It comes in on the next bar, without cutting what’s playing.',
    'live.load': 'Load',
    'live.dismiss': 'Dismiss',
    'live.editsWarning': 'You edited the code by hand and those changes aren’t in the grid. Loading the song will discard them.',
    'live.replace': 'Replace my code',
    'live.keep': 'Keep my code',
    'live.autoAccept': 'Accept songs sent by Claude automatically',
    'live.autoAcceptHint': 'If you edited the code by hand, you’ll still be asked first.',
    // --- TASK-30: practice tools ---
    'practice.title': 'Practice',
    'practice.loopThis': 'Loop this section',
    'practice.loopStop': 'Back to full song',
    'practice.loopHint': 'Repeats only this section. Going back to the full song happens on the next bar, without cutting the sound.',
    'practice.loopingOther': 'Looping',
    'practice.dropTitle': 'Mute so you can play it',
    'practice.dropKick': 'Kick',
    'practice.dropSnare': 'Snare',
    'practice.dropHihat': 'Hi-hat',
    'practice.dropKickHint': 'Mutes the kick so you can play it yourself. Press again to bring it back; the song itself does not change.',
    'practice.dropSnareHint': 'Mutes the snare so you can play it yourself. Press again to bring it back; the song itself does not change.',
    'practice.dropHihatHint': 'Mutes the hi-hat so you can play it yourself. Press again to bring it back; the song itself does not change.',
    'practice.countIn': 'Count-in',
    'practice.countInOff': 'No count-in',
    'practice.barOne': 'bar',
    'practice.barMany': 'bars',
    'practice.metronome': 'Metronome',
    'practice.metronomeOff': 'Off',
    'practice.metronomeQuarter': 'Quarter notes',
    'practice.metronomeEighth': 'Eighth notes',
    'practice.metronomeVolume': 'Metronome volume',
    'practice.clickNote': 'The count-in and metronome only sound during playback: they are not song tracks and are not in the MIDI file.',
    'practice.trainer': 'Tempo trainer: speed up gradually',
    'practice.trainerStart': 'Start BPM',
    'practice.trainerEnd': 'End BPM',
    'practice.trainerStep': 'Increase by',
    'practice.trainerEvery': 'Every (loops)',
    'practice.trainerPlan': 'Plan',
  },
} as const

export type TranslationKey = keyof typeof translations.es

export { translations }
