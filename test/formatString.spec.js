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

  // A timestamp names an instant rather than a day, so it is converted -- and
  // the day it converts to is the reader's, not UTC's. Asserted against the
  // same local getters the implementation uses, so the expectation holds
  // wherever the suite runs; a literal would only be right in some zones.
  it('renders a timestamp as the local day of that instant', () => {
    const instant = '2026-08-13T23:00:00Z';
    const local = new Date(instant);
    const expected = `${local.getFullYear()}-` +
      `${String(local.getMonth() + 1).padStart(2, '0')}-` +
      `${String(local.getDate()).padStart(2, '0')}`;
    expect(formatString(instant, 'date')).toBe(expected);
  });

  it('returns a value it cannot parse as it came', () => {
    expect(formatString('not a date', 'date')).toBe('not a date');
  });
});
