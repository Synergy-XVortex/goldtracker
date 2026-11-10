import { describe, expect, it } from 'vitest'
import { parseMemberRequest } from './memberRequest.ts'

const portfolioId = '10000000-0000-0000-0000-000000000001'
const participantId = '20000000-0000-0000-0000-000000000001'

describe('parseMemberRequest', () => {
  it('normalises the e-mail and accepts an optional participant', () => {
    expect(parseMemberRequest({ portfolioId, email: ' Papa@Example.FR ', participantId })).toEqual({
      portfolioId,
      email: 'papa@example.fr',
      participantId,
    })
    expect(parseMemberRequest({ portfolioId, email: 'a@b.fr' }).participantId).toBeNull()
  })

  it('rejects malformed input', () => {
    expect(() => parseMemberRequest(null)).toThrow(/JSON object/)
    expect(() => parseMemberRequest({ portfolioId: 'x', email: 'a@b.fr' })).toThrow(/portfolioId/)
    expect(() => parseMemberRequest({ portfolioId, email: 'not-an-address' })).toThrow(/email/)
    expect(() => parseMemberRequest({ portfolioId, email: 'a@b.fr', participantId: 42 })).toThrow(
      /participantId/,
    )
  })
})
