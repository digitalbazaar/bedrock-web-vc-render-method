/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */
import {describe, expect, it} from 'vitest';
import {formatString} from '../lib/index.js';

describe('capitalize', () => {
  // `split(' ')` yields an empty segment for each of these, and reading
  // `[0]` off one is `undefined`
  it.each([
    ['a doubled space', 'JOHN  DOE', 'John  Doe'],
    ['a leading space', ' alex', ' Alex'],
    ['a trailing space', 'alex ', 'Alex '],
    ['a single space', 'JOHN DOE', 'John Doe']
  ])('capitalizes a value with %s', (_label, value, expected) => {
    expect(formatString(value, 'capitalize')).toBe(expected);
  });
});

describe('date', () => {
  // A value naming a day carries no timezone. Parsing it through `new Date`
  // reads as UTC midnight, so re-reading it through local getters moves it a
  // day west of UTC -- these must not be round-tripped at all.
  it.each([
    ['a year', '2026'],
    ['a year and month', '2026-08'],
    ['a full date', '2026-08-13']
  ])('returns %s untouched', (_label, value) => {
    expect(formatString(value, 'date')).toBe(value);
  });

  it('renders a timestamp as its UTC day', () => {
    expect(formatString('2026-08-13T10:00:00Z', 'date')).toBe('2026-08-13');
  });

  it('returns a value it cannot parse as it came', () => {
    expect(formatString('not a date', 'date')).toBe('not a date');
  });
});
