// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Song } from '@lib/types';
import { DRUM_VOICES } from '../../song/drumVoices';
import { verseChorusSong, makeTrack, bar16 } from '../../song/__tests__/fixtures';
import { songToMidi, TICKS_PER_BAR, NOTE_TICKS } from '../songToMidi';

interface ParsedEvent { tick: number; type: string; channel?: number; note?: number; velocity?: number; data?: number[]; text?: string }

/** Lector SMF mínimo e independiente del escritor. */
function parse(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const str = (o: number, n: number) => String.fromCharCode(...bytes.slice(o, o + n));
  expect(str(0, 4)).toBe('MThd');
  const format = view.getUint16(8);
  const ntrks = view.getUint16(10);
  const ppq = view.getUint16(12);
  let pos = 14;
  const tracks: ParsedEvent[][] = [];
  for (let t = 0; t < ntrks; t += 1) {
    expect(str(pos, 4)).toBe('MTrk');
    const end = pos + 8 + view.getUint32(pos + 4);
    pos += 8;
    const events: ParsedEvent[] = [];
    let tick = 0;
    let status = 0;
    const vlq = () => { let v = 0; for (;;) { const b = bytes[pos++]; v = (v << 7) | (b & 0x7f); if (!(b & 0x80)) return v; } };
    while (pos < end) {
      tick += vlq();
      if (bytes[pos] & 0x80) status = bytes[pos++];
      if (status === 0xff) {
        const type = bytes[pos++];
        const len = vlq();
        const data = Array.from(bytes.slice(pos, pos + len));
        pos += len;
        events.push({ tick, type: `meta${type.toString(16)}`, data, text: String.fromCharCode(...data) });
      } else {
        const kind = status & 0xf0;
        const note = bytes[pos++];
        const velocity = bytes[pos++];
        events.push({ tick, type: kind === 0x90 && velocity > 0 ? 'on' : 'off', channel: status & 0x0f, note, velocity });
      }
    }
    expect(pos).toBe(end);
    tracks.push(events);
  }
  return { format, ppq, tracks };
}

const noteOns = (events: ParsedEvent[]) => events.filter((e) => e.type === 'on');

describe('songToMidi', () => {
  const midi = parse(songToMidi(verseChorusSong()));

  it('escribe un SMF formato 1 válido con tempo y compás 4/4', () => {
    expect(midi.format).toBe(1);
    const [conductor] = midi.tracks;
    expect(conductor.find((e) => e.type === 'meta51')!.data).toEqual([0x07, 0xa1, 0x20]); // 500000 µs = 120 bpm
    expect(conductor.find((e) => e.type === 'meta58')!.data!.slice(0, 2)).toEqual([4, 2]);
  });

  it('expande el arreglo y cuenta las notas', () => {
    // verso: kick 2+3, snare 2+2, hat 8+8 = 25 por vuelta ×3; estribillo: 4+2+8+1 = 15 ×4
    expect(noteOns(midi.tracks[1])).toHaveLength(25 * 3 + 15 * 4);
  });

  it('usa el mapa GM en el canal 10, sin notas fuera del mapa', () => {
    const allowed = new Set(DRUM_VOICES.map((v) => v.midi));
    for (const e of noteOns(midi.tracks[1])) {
      expect(e.channel).toBe(9);
      expect(allowed.has(e.note as never)).toBe(true);
    }
    const kicks = noteOns(midi.tracks[1]).filter((e) => e.note === 36 && e.tick < TICKS_PER_BAR);
    expect(kicks.map((e) => e.tick)).toEqual([0, 960]);
    expect(noteOns(midi.tracks[1]).some((e) => e.note === 51)).toBe(true); // ride
    expect(noteOns(midi.tracks[1]).some((e) => e.note === 49)).toBe(true); // crash
  });

  it('pone un marker por bloque en el compás donde empieza', () => {
    const markers = midi.tracks[0].filter((e) => e.type === 'meta6').map((e) => [e.text, e.tick]);
    expect(markers).toEqual([
      ['Verse', 0],
      ['Chorus', 4 * TICKS_PER_BAR],
      ['Verse', 8 * TICKS_PER_BAR],
    ]);
  });

  it('convierte velocity 0–1 a 1–127 y aplica 127 si no hay velocity', () => {
    const snares = noteOns(midi.tracks[1]).filter((e) => e.note === 38 && e.tick < 2 * TICKS_PER_BAR);
    expect(snares.map((e) => e.velocity)).toEqual([127, 127, 38, 38]); // 0.3 → 38
    expect(noteOns(midi.tracks[1])[0].velocity).toBe(127);
  });

  it('las notas duran un tiempo fijo corto', () => {
    const offs = midi.tracks[1].filter((e) => e.type === 'off');
    const ons = noteOns(midi.tracks[1]);
    expect(offs).toHaveLength(ons.length);
    expect(offs[0].tick - ons[0].tick).toBe(NOTE_TICKS);
  });

  it('coloca los pasos ternarios (stepsPerBar 12) en ticks exactos', () => {
    const song: Song = {
      bpm: 90,
      stepsPerBar: 12,
      sections: [{ id: 'a', name: 'Shuffle', bars: 1, tracks: [makeTrack('k', 'bd', Array.from({ length: 12 }, () => 1 as const))] }],
      arrangement: [{ sectionId: 'a', repeat: 1 }],
    };
    const ticks = noteOns(parse(songToMidi(song)).tracks[1]).map((e) => e.tick);
    expect(ticks).toEqual(Array.from({ length: 12 }, (_, i) => i * 160));
  });

  it('respeta mute (por sección) y solo (por id en toda la canción)', () => {
    const song = verseChorusSong();
    song.sections[0].tracks[0].muted = true; // kick del verso
    const noKickInVerse = noteOns(parse(songToMidi(song)).tracks[1]).filter((e) => e.note === 36 && e.tick < 4 * TICKS_PER_BAR);
    expect(noKickInVerse).toHaveLength(0);

    const soloSong = verseChorusSong();
    soloSong.sections[1].tracks[1].solo = true; // snare
    const notes = new Set(noteOns(parse(songToMidi(soloSong)).tracks[1]).map((e) => e.note));
    expect([...notes]).toEqual([38]);
  });

  it('omite pistas que no son voces de batería', () => {
    const song: Song = {
      bpm: 100, stepsPerBar: 16,
      sections: [{ id: 'a', name: 'A', bars: 1, tracks: [makeTrack('x', 'perc', bar16(0)), makeTrack('k', 'bd', bar16(0))] }],
      arrangement: [{ sectionId: 'a', repeat: 1 }],
    };
    expect(noteOns(parse(songToMidi(song)).tracks[1])).toHaveLength(1);
  });
});
