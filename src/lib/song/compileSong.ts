import type { Section, Song } from '@lib/types';
import { compileTrackStack } from '@lib/strudel/compiler';
import { findSection } from './song';

// Temporal contract (same as compileToStrudel):
// - cpm(bpm): 1 cycle = 1 beat; the trailing .slow(4) turns 1 inner cycle into 1 bar.
// - Each track packs stepsPerBar × bars steps into one cycle; .slow(bars) makes one
//   inner cycle = one bar, so arrange() can count in bars.
// - arrange([cycles, pat], ...) plays `cycles` cycles of each pattern in order and
//   loops the whole arrangement (spike TASK-24: exists in @strudel/core 1.2.6, which
//   ships with @strudel/web 1.3.0).

/**
 * Compila una canción a código Strudel.
 * - Cada sección es un `stack` de sus pistas (velocity × volumen × params vía compileTrackStack).
 * - Con un solo bloque en el arreglo se omite `arrange`: una sección de 1 compás produce
 *   exactamente el mismo código que `compileToStrudel` (el editor puede seguir parseándolo).
 * - Con varios bloques: `arrange([repeat * bars, sección], ...)`.
 *
 * Solo: si alguna pista tiene `solo`, suenan solo las pistas cuyo id está en solo en
 * alguna sección (el solo sigue a la "pista" a lo largo de la canción). Mute es por sección.
 *
 * Presupone una canción válida (`validateSong`); los bloques que apuntan a secciones
 * inexistentes se ignoran.
 *
 * @see CAP-NLM-015
 * @see BR-001 Reemplazar el código no corta el audio; el reloj de Strudel conserva la fase
 */
export function compileSong(song: Song): string {
  const soloIds = new Set(
    song.sections.flatMap((section) => section.tracks.filter((track) => track.solo).map((track) => track.id)),
  );
  const compileSection = (section: Section): string => {
    const stack = compileTrackStack(
      section.tracks,
      (track) => track.muted || (soloIds.size > 0 && !soloIds.has(track.id)),
    );
    return section.bars > 1 ? `${stack}.slow(${section.bars})` : stack;
  };

  const blocks = song.arrangement
    .map((item) => ({ item, section: findSection(song, item.sectionId) }))
    .filter((block): block is { item: Song['arrangement'][number]; section: Section } => block.section !== undefined);

  let body: string;
  if (blocks.length === 0) {
    body = 'silence';
  } else if (blocks.length === 1) {
    body = compileSection(blocks[0].section);
  } else {
    const entries = blocks.map(
      ({ item, section }) => `  [${item.repeat * section.bars}, ${compileSection(section)}]`,
    );
    body = `arrange(\n${entries.join(',\n')}\n)`;
  }

  return `${body}.slow(4).cpm(${song.bpm.toFixed(2)})`;
}
