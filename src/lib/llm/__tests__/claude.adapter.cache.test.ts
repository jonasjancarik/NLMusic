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
