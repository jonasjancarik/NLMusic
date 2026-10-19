// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSessionStore } from '@store/sessionStore'
import type { Track } from '@lib/types'

const play = vi.fn().mockResolvedValue(undefined)
let isReady = true

vi.mock('@features/audio', () => ({
  useStrudelContext: () => ({ play, stop: vi.fn(), isReady, initError: null, getHapState: vi.fn() }),
}))

import { useUpdateTrackParams } from '../useUpdateTrackParams'

const track: Track = {
  id: 'kick-1',
  name: 'Kick',
  tag: 'kick',
  steps: Array(16).fill(1) as (0 | 1)[],
  volume: 0.8,
  muted: false,
  solo: false,
}

describe('TASK-20: useUpdateTrackParams (AC-15)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isReady = true
    useSessionStore.setState({ tracks: [track], bpm: 138, isPlaying: false })
  })

  it('actualiza el store pero no llama a play() si está parado (BR-001)', () => {
    const { result } = renderHook(() => useUpdateTrackParams())
    result.current('kick-1', { room: 0.5 })
    expect(useSessionStore.getState().tracks[0].params).toEqual({ room: 0.5 })
    expect(play).not.toHaveBeenCalled()
  })

  it('re-evalúa el código recompilado cuando está sonando', () => {
    useSessionStore.setState({ isPlaying: true })
    const { result } = renderHook(() => useUpdateTrackParams())
    result.current('kick-1', { room: 0.5 })
    expect(play).toHaveBeenCalledTimes(1)
    expect(play.mock.calls[0][0]).toContain('.room(0.5)')
  })

  it('no llama a play() si el motor no está listo', () => {
    isReady = false
    useSessionStore.setState({ isPlaying: true })
    const { result } = renderHook(() => useUpdateTrackParams())
    result.current('kick-1', { room: 0.5 })
    expect(play).not.toHaveBeenCalled()
  })
})
