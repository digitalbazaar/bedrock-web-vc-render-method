/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */
import {
  getCredentialConfig, getCredentialTypeLabel
} from './useCredentialCardConfig.js';
import {formatString} from './formatString.js';
import {getValueFromPointer} from './jsonPointer.js';

// What a credential is called when nothing else names it. Every surface has
// to answer the same way, or the same credential is titled differently
// depending on where it appears.
const UNTITLED = 'Verifiable Credential';

/**
 * Applies a configured format, tolerating a pointer that resolved to nothing.
 *
 * @param {*} value - The resolved pointer value.
 * @param {string} [format] - The configured format name.
 *
 * @returns {string} The formatted value, or `''`.
 */
function _format(value, format) {
  return typeof value === 'string' && value.length > 0 ?
    formatString(value, format) : '';
}

/**
 * The first candidate that carries text, trimmed.
 *
 * @param {Array} candidates - Candidates, best first.
 *
 * @returns {string|undefined} The winner, or undefined when none has text.
 */
function _firstText(candidates) {
  return candidates
    .find(c => typeof c === 'string' && c.trim().length > 0)?.trim();
}

/**
 * How a credential presents itself when it is *not* drawing itself: the title,
 * subtitle, description, logo and fields a surface shows for a credential that
 * declares no render method, or alongside one that does.
 *
 * This exists because every surface was resolving the same card design by
 * hand and disagreeing about the answer. `CredentialListRow` did not apply the
 * configured `title.format` while `CredentialDetailsMobile` and
 * `CredentialCardBundle` did, so a title configured as a date rendered
 * formatted in two places and raw in the third -- the same defect the
 * highlights formatter had.
 *
 * Deliberately a plain function over plain values, not a composable: it is
 * the seed of the auto-computed "summary render method" a credential without
 * a real one should get, so it has to be callable from wherever that is
 * assembled, not only from inside a component's `setup`.
 *
 * @param {object} options - The options to use.
 * @param {object} [options.credential] - The credential to summarise.
 * @param {Array} [options.cardDesigns] - Configured card designs.
 *
 * @returns {object} The `title`, `subtitle`, `description`, `image` and
 *   `fields`. Every member is always present; nothing is undefined.
 */
export function getCredentialSummary({credential, cardDesigns} = {}) {
  if(!credential) {
    return {title: '', subtitle: '', description: '', image: '', fields: []};
  }
  const design = getCredentialConfig({credential, cardDesigns});
  return {
    title: _title({credential, cardDesigns, design}),
    subtitle: _subtitle({credential, design}),
    description: _description({credential, design}),
    image: _image({credential, design}),
    fields: _fields({credential, design})
  };
}

function _title({credential, cardDesigns, design}) {
  const override = design?.overrides?.title;
  // `getCredentialTypeLabel` already answers with the design's own `title`
  // when it has one, so naming it separately here would only decide whether
  // it beats `credential.name` -- and it should not: a credential that names
  // itself is more specific than the kind of thing it is.
  const candidates = [
    override ? _format(
      getValueFromPointer(credential, override.pointer), override.format) : '',
    credential.name,
    getCredentialTypeLabel({credential, cardDesigns})
  ];
  return _firstText(candidates) ?? UNTITLED;
}

// An optional second line, so a design can tell otherwise-identical rows apart
// (the date on a receipt, say).
//
// Reads `overrides.rowSubtitle`, not `overrides.subtitle`: a design's
// `subtitle` feeds the description slot, so the two are different configured
// fields that happen to share a word.
function _subtitle({credential, design}) {
  const subtitle = design?.overrides?.rowSubtitle;
  if(!subtitle?.pointer) {
    return '';
  }
  return _format(
    getValueFromPointer(credential, subtitle.pointer), subtitle.format);
}

function _description({credential, design}) {
  const pointer = design?.overrides?.descriptionPointer;
  const fromPointer = pointer ? getValueFromPointer(credential, pointer) : '';
  return _firstText([fromPointer, credential.description]) ?? '';
}

function _image({credential, design}) {
  const {image, issuer} = credential;
  const imagePointer = design?.overrides?.imagePointer;
  const candidates = [
    // a literal logo hardcoded on the matched design (a url or a data: URI);
    // wins over credential-derived images so an issuer carrying no
    // `image`/`logo` can still show a logo through config alone
    design?.logo,
    imagePointer ? getValueFromPointer(credential, imagePointer) : '',
    // the same chain the card view resolves through `useCredentialCommon`,
    // so a row shows the logo its card shows
    image, issuer?.image, issuer?.logo
  ];
  for(const value of candidates) {
    // an image is sometimes an object (`{id, type}`) rather than a string;
    // binding that to `src` renders "[object Object]", so use its `id`
    const src = typeof value === 'string' ? value : value?.id;
    if(typeof src === 'string' && src.length > 0) {
      return src;
    }
  }
  return '';
}

// Configured `highlights` win: they name and order what matters about this
// kind of credential. A credential with no design falls back to its own
// subject fields, which is better than showing nothing.
function _fields({credential, design}) {
  const highlights = design?.highlights;
  if(Array.isArray(highlights) && highlights.length > 0) {
    return highlights
      .map(({field, pointer, format, joinWith}) => ({
        label: field,
        value: _format(
          getValueFromPointer(credential, pointer, joinWith), format)
      }))
      .filter(({label, value}) => value.length > 0 && _isShowableField(
        {label, value}));
  }
  const subject = credential.credentialSubject ?? {};
  return Object.entries(subject)
    .filter(([label, value]) => typeof value === 'string' &&
      value.length > 0 && _isShowableField({label, value}))
    .map(([label, value]) => ({
      label: formatString(label, 'capitalizeAndSeparate'), value
    }));
}

// the description has its own line above the fields, and artwork is a
// rendering rather than a fact about the subject
function _isShowableField({label, value}) {
  const lower = String(label ?? '').toLowerCase();
  return lower !== 'description' && !lower.includes('image') &&
    !value.startsWith('data:');
}
