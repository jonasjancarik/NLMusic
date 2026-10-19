import type { Song, Track } from '@lib/types';
import { voiceToMidiNote } from '../song/drumVoices';

/**
 * Exportación de una canción a Standard MIDI File (formato 1, TASK-26).
 * Módulo puro: sin React, window, Zustand ni Strudel, para poder importarlo desde Node (TASK-28).
 * El mapa voz → nota General MIDI vive en `DRUM_VOICES` (`src/lib/song/drumVoices.ts`).
 *
 * - Pista 0: tempo, compás 4/4 y un marker por bloque del arreglo (nombre de la sección).
 * - Pista 1: notas de batería en el canal 10, con el arreglo expandido.
 * - Cada paso activo es una nota con la velocity del paso (0–1 → 1–127; sin velocity = 127).
 *   El volumen de la pista no se aplica: es un ajuste de mezcla que se hace en el DAW.
 * - Mute y solo se respetan como en el audio: una pista silenciada no se exporta, y si alguna
 *   pista tiene solo, solo se exportan las pistas con ese id en solo (mute es por sección).
 * - Pistas cuyo sample no es una voz de batería no tienen nota GM y se omiten.
 */
export const MIDI_PPQ = 480;
export const TICKS_PER_BAR = MIDI_PPQ * 4;
/** Duración fija de cada nota: una fusa (1/32). */
export const NOTE_TICKS = MIDI_PPQ / 8;
const DRUM_CHANNEL = 9; // canal 10, base 0

interface MidiEvent {
  tick: number;
  /** Orden entre eventos del mismo tick: meta primero, note-off antes de note-on. */
  order: number;
  bytes: number[];
}

function vlq(value: number): number[] {
  const out = [value & 0x7f];
  let rest = value >>> 7;
  while (rest > 0) {
    out.unshift((rest & 0x7f) | 0x80);
    rest >>>= 7;
  }
  return out;
}

const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const u16 = (n: number) => [(n >>> 8) & 0xff, n & 0xff];
const ascii = (text: string) => Array.from(new TextEncoder().encode(text));

function meta(type: number, data: number[]): number[] {
  return [0xff, type, ...vlq(data.length), ...data];
}

function trackChunk(events: MidiEvent[]): number[] {
  const sorted = [...events].sort((a, b) => a.tick - b.tick || a.order - b.order);
  const body: number[] = [];
  let last = 0;
  for (const event of sorted) {
    body.push(...vlq(event.tick - last), ...event.bytes);
    last = event.tick;
  }
  body.push(...vlq(0), ...meta(0x2f, []));
  return [...ascii('MTrk'), ...u32(body.length), ...body];
}

function velocityToMidi(value: number | undefined): number {
  const v = value === undefined || Number.isNaN(value) ? 1 : value;
  return Math.min(127, Math.max(1, Math.round(v * 127)));
}

export function songToMidi(song: Song): Uint8Array {
  const sections = new Map(song.sections.map((section) => [section.id, section]));
  const soloIds = new Set(
    song.sections.flatMap((section) => section.tracks.filter((t) => t.solo).map((t) => t.id)),
  );
  const isAudible = (track: Track) => !track.muted && (soloIds.size === 0 || soloIds.has(track.id));

  const conductor: MidiEvent[] = [
    { tick: 0, order: 0, bytes: meta(0x51, u32(Math.round(60_000_000 / song.bpm)).slice(1)) },
    // 4/4: numerador 4, denominador 2^2, 24 clocks por negra, 8 fusas por negra
    { tick: 0, order: 0, bytes: meta(0x58, [4, 2, 24, 8]) },
  ];
  const drums: MidiEvent[] = [{ tick: 0, order: 0, bytes: meta(0x03, ascii('Drums')) }];

  let barOffset = 0;
  for (const item of song.arrangement) {
    const section = sections.get(item.sectionId);
    if (!section) continue;
    const stepTicks = TICKS_PER_BAR / song.stepsPerBar;
    conductor.push({ tick: barOffset * TICKS_PER_BAR, order: 1, bytes: meta(0x06, ascii(section.name)) });

    for (let repeat = 0; repeat < item.repeat; repeat += 1) {
      const start = (barOffset + repeat * section.bars) * TICKS_PER_BAR;
      for (const track of section.tracks) {
        const note = track.sample ? voiceToMidiNote(track.sample) : undefined;
        if (note === undefined || !isAudible(track)) continue;
        track.steps.forEach((on, index) => {
          if (!on) return;
          const tick = start + Math.round(index * stepTicks);
          drums.push({ tick, order: 2, bytes: [0x90 | DRUM_CHANNEL, note, velocityToMidi(track.velocity?.[index])] });
          drums.push({ tick: tick + NOTE_TICKS, order: 1, bytes: [0x80 | DRUM_CHANNEL, note, 0] });
        });
      }
    }
    barOffset += item.repeat * section.bars;
  }

  const header = [...ascii('MThd'), ...u32(6), ...u16(1), ...u16(2), ...u16(MIDI_PPQ)];
  return Uint8Array.from([...header, ...trackChunk(conductor), ...trackChunk(drums)]);
}
