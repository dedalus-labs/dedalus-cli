import assert from 'node:assert/strict'
import test from 'node:test'

import { CredentialStorageError } from '../dist/esm/custom/auth/credentials.js'

test('credential errors retain stable machine-readable codes', () => {
  const error = new CredentialStorageError('invalid_credential')

  assert.equal(error.name, 'CredentialStorageError')
  assert.equal(error.code, 'invalid_credential')
})
