// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: createMock }
    constructor(_options: unknown) {}
  },
}))

import { ClaudeAdapter } from '@lib/llm/adapters/claude.adapter'

describe('ClaudeAdapter — prompt caching', () => {
  beforeEach(() => {
    createMock.mockReset()
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: '{"operations":[]}' }],
    })
  })

  it('sends the system prompt as a text block with ephemeral cache_control', async () => {
    const adapter = new ClaudeAdapter({ apiKey: 'test-key' })
    await adapter.generatePattern('hola', { turns: [] })

    const request = createMock.mock.calls[0][0]
    expect(Array.isArray(request.system)).toBe(true)
    expect(request.system).toHaveLength(1)
    expect(request.system[0]).toMatchObject({
      type: 'text',
      cache_control: { type: 'ephemeral' },
    })
    expect(typeof request.system[0].text).toBe('string')
    expect(request).not.toHaveProperty('temperature')
  })
})

describe('ClaudeAdapter.generateSong — TASK-27', () => {
  beforeEach(() => {
    createMock.mockReset()
    createMock.mockResolvedValue({ content: [{ type: 'text', text: '{"operations":[]}' }], stop_reason: 'end_turn' })
  })

  it('sends contract, drum guide and params as system blocks with cache_control on the last one', async () => {
    const adapter = new ClaudeAdapter({ apiKey: 'test-key' })
    const result = await adapter.generateSong('rock song', { turns: [] })

    const request = createMock.mock.calls[0][0]
    expect(request.system).toHaveLength(3)
    expect(request.system[1].text).toContain('# Drum guide')
    expect(request.system[0]).not.toHaveProperty('cache_control')
    expect(request.system[2]).toMatchObject({ type: 'text', cache_control: { type: 'ephemeral' } })
    expect(request).not.toHaveProperty('temperature')
    expect(request.messages).toHaveLength(1)
    expect(result).toEqual({ text: '{"operations":[]}', truncated: false })
  })

  it('on repair sends the rejected output as the assistant turn and the errors as a new user turn', async () => {
    const adapter = new ClaudeAdapter({ apiKey: 'test-key' })
    await adapter.generateSong('rock song', { turns: [] }, { previousOutput: '{"bad":1}', errors: ['Section "verse" › bars: too many'] })

    const { messages } = createMock.mock.calls[0][0]
    expect(messages.map((m: { role: string }) => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(messages[1].content).toBe('{"bad":1}')
    expect(messages[2].content).toContain('- Section "verse" › bars: too many')
  })

  it('flags truncated output', async () => {
    createMock.mockResolvedValueOnce({ content: [{ type: 'text', text: '{"oper' }], stop_reason: 'max_tokens' })
    const adapter = new ClaudeAdapter({ apiKey: 'test-key' })
    expect(await adapter.generateSong('x', { turns: [] })).toEqual({ text: '{"oper', truncated: true })
  })
})
