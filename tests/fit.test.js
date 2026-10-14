import test from 'node:test'
import assert from 'node:assert/strict'
import { fitToLimit } from '../lib/fit.js'

const text = n => 'a'.repeat(n)

test('returns the first draft untouched when it already fits', async () => {
  const calls = []
  const generate = async r => { calls.push(r); return text(250) }
  assert.equal((await fitToLimit({ generate, limit: 300 })).length, 250)
  assert.deepEqual(calls, [null])
})

test('a draft of exactly the limit is accepted, one over is not', async () => {
  assert.equal((await fitToLimit({ generate: async () => text(300), limit: 300 })).length, 300)
  await assert.rejects(
    fitToLimit({ generate: async () => text(301), limit: 300, maxAttempts: 1 }),
    e => e.status === 422)
})

test('asks for a shorter draft, passing the previous one and the limit', async () => {
  const calls = []
  const sizes = [454, 320, 280]
  const generate = async r => { calls.push(r); return text(sizes[calls.length - 1]) }
  const out = await fitToLimit({ generate, limit: 300 })
  assert.equal(out.length, 280)
  assert.equal(calls.length, 3)
  assert.equal(calls[0], null)
  assert.equal(calls[1].previous.length, 454)
  assert.equal(calls[1].limit, 300)
  assert.equal(calls[2].previous.length, 320)
})

test('gives up after maxAttempts with a client-safe 422 and never returns an over-limit draft', async () => {
  let n = 0
  const generate = async () => { n++; return text(454) }
  await assert.rejects(
    fitToLimit({ generate, limit: 300, maxAttempts: 3 }),
    e => e.status === 422 && /300 characters/.test(e.message))
  assert.equal(n, 3)
})

test('an empty draft is an internal error, not a 4xx, so it is logged and hidden from the client', async () => {
  await assert.rejects(
    fitToLimit({ generate: async () => '', limit: 300 }),
    e => e.status === undefined)
})
