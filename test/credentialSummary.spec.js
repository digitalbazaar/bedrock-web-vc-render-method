/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */
import {describe, expect, it} from 'vitest';
import {getCredentialSummary} from '../lib/index.js';

const design = {
  matches: {'/type': 'ReceiptCredential'},
  highlights: [
    {field: 'amount', pointer: '/credentialSubject/amount'},
    {field: 'verified', pointer: '/credentialSubject/verified'},
    {field: 'seat', pointer: '/credentialSubject/seat'}
  ]
};

const credential = {
  type: ['VerifiableCredential', 'ReceiptCredential'],
  credentialSubject: {amount: 100, verified: true, seat: 'A1'}
};

describe('a configured highlight resolving to a non-string', () => {
  // Collapsing these to `''` hands them to the emptiness filter, so the
  // configured field disappears with nothing logged.
  it.each([
    ['a number', 'amount', '100'],
    ['a boolean', 'verified', 'true'],
    ['a string', 'seat', 'A1']
  ])('keeps %s', (_label, field, expected) => {
    const {fields} = getCredentialSummary({
      credential, cardDesigns: [design]
    });
    expect(fields.find(f => f.label.toLowerCase().includes(field.slice(0, 4))))
      .toMatchObject({value: expected});
  });
});
