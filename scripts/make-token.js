// Generates an API token and its sha256 hash.
// Give the TOKEN to the extension; put the HASH in the TOKENS env var.
import crypto from 'node:crypto'

const token = 'ro_' + crypto.randomBytes(24).toString('hex')
const hash  = crypto.createHash('sha256').update(token, 'utf8').digest('hex')

console.log('\nToken (paste into the extension Settings):')
console.log('  ' + token)
console.log('\nHash (add to the TOKENS env var on the server):')
console.log('  ' + hash)
console.log('\nStore the token like a password. The server only ever sees the hash.\n')
