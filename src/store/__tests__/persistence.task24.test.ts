import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from '@store/sessionStore'
import { migratePersistedState, PERSIST_VERSION } from '@store/persistence'
import { compileToStrudel } from '@lib/strudel/compiler'
import { compileSong } from '@lib/song'
import { initialSong } from '@store/slices/tracksSlice'
import type { Song, Track } from '@lib/types'

/** localStorage as written by the app before TASK-24 (zustand persist, no version → 0). */
const V0_TRACKS: Track[] = [
  {
    id: 'kick-1',
    name: 'Kick 909',
    tag: 'kick',
    steps: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    volume: 0.9,
    muted: false,
    solo: false,
  },
  {
    id: 'snare-1',
    name: 'Snare',
    sample: 'sd',
    steps: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    volume: 0.8,
    muted: false,
    solo: false,
    params: { room: 0.5, pan: 0.3 },
  },
  {
    id: 'hihat-1',
    name: 'Hi-Hat',
    sample: 'hh',
    steps: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    volume: 0.6,
    muted: true,
    solo: false,
  },
]

const V0_FIXTURE = {
  state: {
    bpm: 124,
    tracks: V0_TRACKS,
    turns: [
      { role: 'user', content: 'techno beat' },
      { role: 'assistant', content: 'Generado: 3 pistas a 124 BPM' },
    ],
    editorMode: 'advanced',
    highlightingEnabled: true,
    hapVisualizationEnabled: false,
    language: 'en',
    delayTimeMode: 'seconds',
  },
  version: 0,
}

function resetStore() {
  useSessionStore.setState({
    bpm: initialSong.bpm,
    tracks: initialSong.sections[0].tracks,
    stepsPerBar: initialSong.stepsPerBar,
    sections: initialSong.sections,
    arrangement: initialSong.arrangement,
    activeSectionId: 'main',
    currentCode: compileSong(initialSong),
    isPlaying: false,
    isCodeManuallyEdited: false,
    turns: [],
  })
}

describe('TASK-24 AC-2 — migration of persisted state', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  it('migratePersistedState turns a v0 pattern into a one-section song', () => {
    const migrated = migratePersistedState(V0_FIXTURE.state, 0)
    expect(migrated.song).toEqual({
      bpm: 124,
      stepsPerBar: 16,
      sections: [{ id: 'main', name: 'Main', bars: 1, tracks: V0_TRACKS }],
      arrangement: [{ sectionId: 'main', repeat: 1 }],
    })
    expect(migrated.activeSectionId).toBe('main')
    expect(migrated).not.toHaveProperty('bpm')
    expect(migrated).not.toHaveProperty('tracks')
    expect(migrated.turns).toEqual(V0_FIXTURE.state.turns)
    expect(migrated.language).toBe('en')
  })

  it('a v0 session rehydrates as an equivalent song that compiles to the same Strudel code', async () => {
    localStorage.setItem('nlmusic-session', JSON.stringify(V0_FIXTURE))
    await useSessionStore.persist.rehydrate()

    const state = useSessionStore.getState()
    expect(state.bpm).toBe(124)
    expect(state.tracks).toEqual(V0_TRACKS)
    expect(state.sections).toHaveLength(1)
    expect(state.sections[0].tracks).toEqual(V0_TRACKS)
    expect(state.activeSectionId).toBe('main')
    expect(state.language).toBe('en')
    // "sounds the same": identical code to what the old compiler produced, params included
    expect(state.currentCode).toBe(compileToStrudel({ bpm: 124, tracks: V0_TRACKS }))
    expect(state.currentCode).toContain('.room(0.5).pan(0.3)')
  })

  it('writes the migrated state back as the current version', async () => {
    localStorage.setItem('nlmusic-session', JSON.stringify(V0_FIXTURE))
    await useSessionStore.persist.rehydrate()
    useSessionStore.getState().setBpm(126)

    const stored = JSON.parse(localStorage.getItem('nlmusic-session') ?? '{}')
    expect(stored.version).toBe(PERSIST_VERSION)
    expect(stored.state.song.bpm).toBe(126)
    expect(stored.state.song.sections[0].tracks).toEqual(V0_TRACKS)
    expect(stored.state).not.toHaveProperty('tracks')
  })

  it('a v0 entry without tracks keeps the default song and the other preferences', async () => {
    localStorage.setItem(
      'nlmusic-session',
      JSON.stringify({ state: { language: 'en', editorMode: 'simple' }, version: 0 }),
    )
    await useSessionStore.persist.rehydrate()
    const state = useSessionStore.getState()
    expect(state.sections).toEqual(initialSong.sections)
    expect(state.language).toBe('en')
    expect(state.editorMode).toBe('simple')
  })

  it('a v1 multi-section song round-trips and restores the active section', async () => {
    const song: Song = {
      bpm: 100,
      stepsPerBar: 16,
      sections: [
        { id: 'verse', name: 'Verse', bars: 1, tracks: [V0_TRACKS[0]] },
        { id: 'chorus', name: 'Chorus', bars: 1, tracks: [V0_TRACKS[1], V0_TRACKS[2]] },
      ],
      arrangement: [
        { sectionId: 'verse', repeat: 2 },
        { sectionId: 'chorus', repeat: 2 },
      ],
    }
    localStorage.setItem(
      'nlmusic-session',
      JSON.stringify({ state: { song, activeSectionId: 'chorus', turns: [] }, version: PERSIST_VERSION }),
    )
    await useSessionStore.persist.rehydrate()

    const state = useSessionStore.getState()
    expect(state.activeSectionId).toBe('chorus')
    expect(state.tracks).toEqual(song.sections[1].tracks)
    expect(state.currentCode).toBe(compileSong(song))
    expect(state.currentCode).toContain('arrange(')
  })
})

describe('TASK-24 — store keeps the song and the grid in sync', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  it('grid edits on the active section update that section and recompile the whole song', () => {
    const song: Song = {
      bpm: 110,
      stepsPerBar: 16,
      sections: [
        { id: 'verse', name: 'Verse', bars: 1, tracks: [V0_TRACKS[0]] },
        { id: 'chorus', name: 'Chorus', bars: 1, tracks: [V0_TRACKS[1]] },
      ],
      arrangement: [
        { sectionId: 'verse', repeat: 1 },
        { sectionId: 'chorus', repeat: 1 },
      ],
    }
    useSessionStore.getState().loadSong(song)
    expect(useSessionStore.getState().activeSectionId).toBe('verse')

    useSessionStore.getState().setActiveSection('chorus')
    useSessionStore.getState().toggleStep('snare-1', 0)

    const state = useSessionStore.getState()
    expect(state.sections[1].tracks[0].steps[0]).toBe(1)
    expect(state.sections[0].tracks).toEqual([V0_TRACKS[0]])
    expect(state.currentCode).toBe(
      compileSong({ ...song, sections: [song.sections[0], { ...song.sections[1], tracks: state.tracks }] }),
    )
  })

  it('toggling a step on with a residual velocity of 0 makes it audible', () => {
    useSessionStore.getState().setTracks([
      { ...V0_TRACKS[0], velocity: [1, 0, 0, 0, 0.4, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] },
    ])
    useSessionStore.getState().toggleStep('kick-1', 2)
    const track = useSessionStore.getState().tracks[0]
    expect(track.velocity?.[2]).toBe(1)
    expect(track.velocity?.[4]).toBe(0.4)
  })

  it('setActiveSection ignores unknown ids', () => {
    useSessionStore.getState().setActiveSection('nope')
    expect(useSessionStore.getState().activeSectionId).toBe('main')
  })
})
