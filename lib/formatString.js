/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */
// Formatting a credential value for display needs no frontend framework, so
// this module reaches for none and imports nothing.

/**
 * Renders a date value as `YYYY-MM-DD`.
 *
 * A date-only value names a day and carries no timezone. `new Date` parses
 * one as UTC midnight, so reading it back through local getters moves it:
 * `2026-08-20` becomes the 19th anywhere west of UTC. Such values are
 * therefore returned untouched rather than round-tripped, and a value that
 * cannot be parsed at all is returned as it came rather than as `undefined`.
 *
 * @param {string} value - The value to render.
 *
 * @returns {string} `YYYY-MM-DD`, or the value untouched if it is not a date.
 */
function _formatDate(value) {
  // A date with no time names a day, so there is nothing to convert -- and
  // converting would move it. Year and year-month are the same case: `2026`
  // parses as UTC midnight on the 1st of January and reads back locally as
  // the 31st of December.
  if(/^\d{4}(-\d{2}(-\d{2})?)?$/.test(value)) {
    return value;
  }
  const parsed = new Date(value);
  if(Number.isNaN(parsed.getTime())) {
    // not a date at all; showing it unchanged beats showing "undefined"
    return value;
  }
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${parsed.getFullYear()}-${month}-${day}`;
}

/**
 * Applies a card design's configured format to a resolved value.
 *
 * @param {*} value - The resolved value.
 * @param {string} [format] - `date`, `capitalize` or `capitalizeAndSeparate`.
 *
 * @returns {*} The formatted value.
 */
export function formatString(value, format) {
  // Nothing to format. A design naming a pointer the credential does not
  // carry is ordinary rather than exceptional -- an unresolved pointer answers
  // `''` -- so the empty string returns early instead of reaching a formatter.
  // A non-string is returned untouched: a pointer can resolve to a number, and
  // formatting is not defined for one.
  if(typeof value !== 'string') {
    return value ?? '';
  }
  if(value.length === 0) {
    return '';
  }
  if(format === 'date') {
    return _formatDate(value);
  }
  if(format === 'capitalize') {
    // a leading, trailing or doubled space yields an empty segment, and
    // `''[0]` is `undefined`
    return value.toLowerCase().split(' ')
      .map(v => v ? v[0].toUpperCase() + v.slice(1) : v).join(' ');
  }
  if(format === 'capitalizeAndSeparate') {
    const result = value.replace(/([A-Z])/g, ' $1');
    return result.charAt(0).toUpperCase() + result.slice(1);
  }
  return value;
}
