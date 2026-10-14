// Keeps a draft inside a hard character limit. Models cannot count characters
// reliably, so the limit is enforced here rather than trusted to the prompt.
//
// generate(null) produces the first draft. generate({ previous, limit }) is
// called when the last draft was too long and must return a shorter one.
// Attempts are bounded so a stubborn model cannot run up API cost.
export async function fitToLimit({ generate, limit, maxAttempts = 3 }) {
  let draft = await generate(null)
  for (let attempt = 1; draft.length > limit && attempt < maxAttempts; attempt++) {
    draft = await generate({ previous: draft, limit })
  }
  if (!draft) throw new Error('Model returned an empty draft.')
  if (draft.length > limit) {
    throw { status: 422, message: `Could not fit the draft within ${limit} characters. Try Regenerate.` }
  }
  return draft
}
