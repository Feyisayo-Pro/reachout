// api/draft.js — drafts a LinkedIn outreach message.

import Anthropic from '@anthropic-ai/sdk'
import { verify, handleError, cap } from './_lib/auth.js'

const MAX_ABOUT      = 2000
const MAX_POST       = 3000
const MAX_BACKGROUND = 3000
const MAX_PROFILE    = 8000

// LinkedIn caps connection-request notes at 300 characters. Messages to
// existing connections have no practical cap, but short still wins.
const LIMITS = {
  connection: { chars: 300, guidance: 'Hard limit 300 characters including spaces. Aim for 250-290.' },
  message:    { chars: 900, guidance: 'Aim for 90-130 words. Three short paragraphs maximum.' },
}

const SYSTEM = `You write short, direct LinkedIn outreach messages to recruiters on behalf of a candidate. You write like a competent professional contacting another professional, not like a template.

WRITING RULES — follow without exception:
- NO em dashes. Use a comma, colon, or restructure the sentence instead.
- NO buzzwords or clichés. Banned: passionate, passionate about, dynamic, results-driven, self-starter, go-getter, innovative, leverage, synergy, team player, hardworking, dedicated, detail-oriented, thought leader, proactive, impactful, excited to, thrilled to, I hope this message finds you well, I came across your profile, I would be a great fit, I believe I would, reaching out to express my interest, looking forward to hearing from you, please do not hesitate, unique opportunity, fast-paced environment, hit the ground running, bring value, add value, move the needle, I'd love to pick your brain.
- NEVER invent experience, employers, dates, metrics, or skills. Use only what the candidate's background states. If the background is thin, write a shorter message rather than padding it.
- NEVER claim work authorisation, visa status, or location eligibility that was not stated. If the role's location and the candidate's location appear to conflict, acknowledge it plainly in one short clause rather than ignoring it.
- No flattery about the recruiter's profile. Reference their post or role only where genuinely specific.
- One concrete, relevant detail beats three vague ones.
- End with a low-friction ask, not a demand for their time.`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed.' })
  }

  try {
    verify(req)

    const {
      recruiterName        = '',
      recruiterHeadline    = '',
      recruiterCompany     = '',
      recruiterAbout       = '',
      postText             = '',
      recruiterProfileText = '',
      roleOfInterest       = '',
      userBackground       = '',
      messageType          = 'connection',
    } = req.body || {}

    if (!recruiterName && !postText) {
      return res.status(400).json({ message: 'Need a recruiter name or post text.' })
    }

    const limit = LIMITS[messageType] || LIMITS.connection

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system:     `${SYSTEM}\n\nLENGTH: ${limit.guidance}`,
      messages: [{
        role: 'user',
        content: `Draft a LinkedIn ${messageType === 'connection' ? 'connection request note' : 'message'} from the candidate to this recruiter.

RECRUITER
Name: ${recruiterName || 'unknown'}
Headline: ${recruiterHeadline || 'unknown'}
Company: ${recruiterCompany || 'unknown'}
${recruiterAbout ? `About:\n${cap(recruiterAbout, MAX_ABOUT)}` : ''}
${postText ? `\nTheir hiring post:\n${cap(postText, MAX_POST)}` : ''}
${recruiterProfileText ? `\nTheir full LinkedIn profile export (authoritative — prefer this where it conflicts with the fields above):\n${cap(recruiterProfileText, MAX_PROFILE)}` : ''}

${roleOfInterest ? `ROLE THE CANDIDATE WANTS: ${roleOfInterest}` : ''}

CANDIDATE BACKGROUND (the only source of truth about the candidate):
${cap(userBackground, MAX_BACKGROUND) || '(none provided)'}

Requirements:
1. Open by referencing the specific role or post, not their profile generally.
2. One or two sentences on why this candidate is relevant, using a concrete detail from their background.
3. Close with a short, low-pressure ask.
4. Plain text. No subject line, no signature, no [bracketed placeholders].

If the candidate's background does not plausibly match, say so honestly in the message rather than overstating fit.`,
      }],
    })

    const draft = msg.content.filter(b => b.type === 'text').map(b => b.text).join('').trim()

    return res.status(200).json({
      draft,
      messageType,
      charCount: draft.length,
      charLimit: limit.chars,
      overLimit: draft.length > limit.chars,
    })
  } catch (err) {
    return handleError(res, err)
  }
}
