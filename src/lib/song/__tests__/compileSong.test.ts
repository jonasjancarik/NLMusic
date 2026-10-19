import { describe, it, expect, beforeAll } from 'vitest'
import { compileSong, patternToSong, totalBars } from '@lib/song'
import { compileToStrudel, parseStrudelToTrackJson } from '@lib/strudel/compiler'
import type { Song } from '@lib/types'
import { bar16, makeTrack, verseChorusSong } from './fixtures'

// Real Strudel runtime (bypasses the global @strudel/web mock in src/test/setup.ts)
// so the tests check the timing of the generated code, not only its text.
type StrudelModule = Record<string, unknown> & {
  setStringParser: (parser: unknown) => void
  mini: unknown
}
interface Hap {
  whole: { begin: { valueOf(): number } }
  value: { s?: string; n?: number; velocity?: number; gain?: number; room?: number }
  hasOnset(): boolean
}
let strudel: StrudelModule

beforeAll(async () => {
  strudel = (await import('@strudel/web/dist/index.mjs')) as unknown as StrudelModule
  strudel.setStringParser(strudel.mini)
})

/**
 * Evaluates compiled code without the trailing `.slow(4).cpm(bpm)`, so that
 * 1 cycle = 1 bar, and returns the onsets in `[0, bars)`.
 */
function onsetsInBars(code: string, bars: number) {
  const body = code.replace(/\.slow\(4\)\.cpm\([^)]*\)$/, '')
  const names = Object.keys(strudel).filter((key) => /^[A-Za-z_$][\w$]*$/.test(key))
  const pattern = new Function(...names, `return ${body}`)(...names.map((key) => strudel[key])) as {
    queryArc: (begin: number, end: number) => Hap[]
  }
  return pattern
    .queryArc(0, bars)
    .filter((hap) => hap.hasOnset())
    .map((hap) => ({ bar: hap.whole.begin.valueOf(), ...hap.value }))
    .sort((a, b) => a.bar - b.bar || String(a.s).localeCompare(String(b.s)))
}

describe('compileSong — TASK-24 AC-5', () => {
  it('snapshot: verse/chorus song with repeats', () => {
    expect(compileSong(verseChorusSong())).toMatchSnapshot()
  })

  it('uses arrange with repeat × bars per block', () => {
    const code = compileSong(verseChorusSong())
    expect(code.startsWith('arrange(\n  [4, stack(')).toBe(true)
    expect(code).toContain('  [4, stack(s("bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd')
    expect(code).toMatch(/\n {2}\[2, stack\(.*\)\.slow\(2\)\]\n\)\.slow\(4\)\.cpm\(120\.00\)$/)
  })

  it('plays sections in arrangement order with the right number of bars', () => {
    const song = verseChorusSong()
    expect(totalBars(song)).toBe(10)
    const onsets = onsetsInBars(compileSong(song), 10)

    // crash (voice cr → "hh:1", i.e. s "hh" n 1) only in the chorus (bars 4–7), once per bar
    expect(onsets.filter((o) => o.s === 'hh' && o.n === 1).map((o) => o.bar)).toEqual([4, 5, 6, 7])
    // ride (voice rd → sound "cr") only in the chorus, 8 per bar
    expect(onsets.filter((o) => o.s === 'cr')).toHaveLength(4 * 8)
    // kick: verse = 2 + 3 per 2 bars (×2 and ×1 again), chorus = 4 per bar × 4
    const kicks = onsets.filter((o) => o.s === 'bd').map((o) => o.bar)
    expect(kicks).toEqual([0, 0.5, 1, 1.5, 1.625, 2, 2.5, 3, 3.5, 3.625, 4, 4.25, 4.5, 4.75, 5, 5.25, 5.5, 5.75, 6, 6.25, 6.5, 6.75, 7, 7.25, 7.5, 7.75, 8, 8.5, 9, 9.5, 9.625])
  })

  it('combines velocity with volume and keeps params inside sections', () => {
    const onsets = onsetsInBars(compileSong(verseChorusSong()), 10)
    const verseSnares = onsets.filter((o) => o.s === 'sd' && o.bar < 4)
    expect(verseSnares.map((o) => [o.bar, o.velocity, o.gain])).toEqual([
      [0.25, 1, 0.8],
      [0.75, 1, 0.8],
      [1.25, 0.3, 0.8],
      [1.75, 0.3, 0.8],
      [2.25, 1, 0.8],
      [2.75, 1, 0.8],
      [3.25, 0.3, 0.8],
      [3.75, 0.3, 0.8],
    ])
    const chorusSnare = onsets.find((o) => o.s === 'sd' && o.bar >= 4)
    expect(chorusSnare?.room).toBe(0.4)
    expect(chorusSnare?.velocity).toBeUndefined()
  })

  it('supports stepsPerBar 12 (ternary feel)', () => {
    const song: Song = {
      bpm: 100,
      stepsPerBar: 12,
      sections: [{ id: 'shuffle', name: 'Shuffle', bars: 1, tracks: [makeTrack('hat', 'hh', [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1])] }],
      arrangement: [{ sectionId: 'shuffle', repeat: 1 }],
    }
    const bars = onsetsInBars(compileSong(song), 1).map((o) => Math.round(o.bar * 12))
    expect(bars).toEqual([0, 2, 3, 5, 6, 8, 9, 11])
  })

  it('a single 1-bar section compiles exactly like compileToStrudel and stays parseable', () => {
    const tracks = [
      makeTrack('kick-1', 'bd', bar16(0, 4, 8, 12)),
      makeTrack('snare-1', 'sd', bar16(4, 12), { params: { room: 0.3 } }),
    ]
    const song = patternToSong({ bpm: 128, tracks })
    expect(compileSong(song)).toBe(compileToStrudel({ bpm: 128, tracks }))

    const plain = patternToSong({ bpm: 128, tracks: [tracks[0]] })
    expect(parseStrudelToTrackJson(compileSong(plain))).not.toBeNull()
  })

  it('a single multi-bar section loops without arrange', () => {
    const song = verseChorusSong()
    const code = compileSong({ ...song, arrangement: [{ sectionId: 'verse', repeat: 3 }] })
    expect(code).not.toContain('arrange')
    expect(code).toMatch(/^stack\(.*\)\.slow\(2\)\.slow\(4\)\.cpm\(120\.00\)$/)
  })

  it('solo follows the track id across sections; mute stays per section', () => {
    const song = verseChorusSong()
    song.sections[1].tracks[1] = { ...song.sections[1].tracks[1], solo: true } // chorus snare
    song.sections[0].tracks[0] = { ...song.sections[0].tracks[0], muted: true } // verse kick
    const onsets = onsetsInBars(compileSong(song), 10)
    const audible = new Set(onsets.filter((o) => o.gain !== 0).map((o) => o.s))
    expect([...audible]).toEqual(['sd'])
  })
})
