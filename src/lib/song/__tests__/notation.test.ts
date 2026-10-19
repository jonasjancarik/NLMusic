import { describe, it, expect } from 'vitest'
import { NOTATION_VELOCITY, formatStepString, parseStepString } from '@lib/song'

describe('step notation (TASK-27)', () => {
  it('parses plain hits without velocity', () => {
    expect(parseStepString('x...|x-..')).toEqual({ ok: true, steps: [1, 0, 0, 0, 1, 0, 0, 0] })
  })

  it('creates velocity when accents or ghosts appear', () => {
    expect(parseStepString('X.gx')).toEqual({
      ok: true,
      steps: [1, 0, 1, 1],
      velocity: [NOTATION_VELOCITY.X, 0, NOTATION_VELOCITY.g, NOTATION_VELOCITY.x],
    })
  })

  it('reports unknown characters with their step number', () => {
    expect(parseStepString('x..o')).toEqual({ ok: false, error: expect.stringContaining('"o" at step 4') })
  })

  it('formats steps back with bar separators and round-trips', () => {
    const parsed = parseStepString('X.g.x...|........')
    if (!parsed.ok) throw new Error('parse failed')
    const text = formatStepString(parsed.steps, parsed.velocity, 8)
    expect(text).toBe('X.g.x...|........')
  })
})
