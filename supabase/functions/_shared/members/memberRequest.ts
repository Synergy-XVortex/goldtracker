/** Validation of a request to give a family member access to the portfolio. */

export interface MemberRequest {
  portfolioId: string
  email: string
  participantId: string | null
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Deliberately simple: the definitive check is the sign-in e-mail reaching the person.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parseMemberRequest(body: unknown): MemberRequest {
  if (typeof body !== 'object' || body === null) {
    throw new Error('The request body must be a JSON object')
  }
  const { portfolioId, email, participantId } = body as Record<string, unknown>

  if (typeof portfolioId !== 'string' || !UUID_PATTERN.test(portfolioId)) {
    throw new Error('portfolioId must be a UUID')
  }
  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())) {
    throw new Error('email is not a valid address')
  }
  if (participantId !== null && participantId !== undefined) {
    if (typeof participantId !== 'string' || !UUID_PATTERN.test(participantId)) {
      throw new Error('participantId must be a UUID or null')
    }
  }

  return {
    portfolioId,
    email: email.trim().toLowerCase(),
    participantId: (participantId as string | null | undefined) ?? null,
  }
}
