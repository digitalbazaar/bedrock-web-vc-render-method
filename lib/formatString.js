/*!
 * Copyright (c) 2026 Digital Bazaar, Inc. All rights reserved.
 */
// Base Layer code, and imports nothing. Formatting a credential value for
// display needs no frontend framework; this previously reached into Quasar
// for one date call, which is what tied the whole render-method layer to a
// UI framework.

/**
 * Renders a date value as `YYYY-MM-DD`.
 *
 * Not Quasar's `formatDate`, which parses through `new Date` and formats in
 * local time. A date-only value names a day and carries no timezone, so
 * parsing it as UTC midnight and re-reading it locally moved it: `2026-08-20`
 * rendered as the 19th anywhere west of UTC, in every card design configured
 * with `format: 'date'`. It also answered `undefined` for a value it could
 * not parse, which reached the UI as the literal text.
 *
 * @param {string} value - The value to render.
 *
 * @returns {string} `YYYY-MM-DD`, or the value untouched if it is not a date.
 */
function _formatDate(value) {
  // already a plain date: it names a day, so there is nothing to convert
  if(/^\d{4}-\d{2}-\d{2}$/.test(value)) {
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
  // Nothing to format. `capitalize` split an empty string into `['']` and read
  // `[0]` off that, throwing out of whatever was rendering; a card design
  // naming a pointer the credential does not carry is ordinary rather than
  // exceptional, and became commonplace once pointer resolution stopped
  // re-rooting on a missing segment and started answering `''`. A non-string
  // is returned untouched: a pointer can resolve to a number, and formatting
  // is not defined for one.
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
    return value.toLowerCase().split(' ')
      .map(v => v[0].toUpperCase() + v.slice(1)).join(' ');
  }
  if(format === 'capitalizeAndSeparate') {
    const result = value.replace(/([A-Z])/g, ' $1');
    return result.charAt(0).toUpperCase() + result.slice(1);
  }
  return value;
}
