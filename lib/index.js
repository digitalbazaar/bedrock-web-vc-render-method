/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */
import {
  getRenderedDisplays, rankDisplays
} from './renderMethod.js';
import {getCredentialSummary} from './credentialSummary.js';

export {formatString} from './formatString.js';
export {getCredentialSummary} from './credentialSummary.js';
export {getRenderedDisplays, rankDisplays} from './renderMethod.js';
export {getValueFromPointer} from './jsonPointer.js';
export {
  getCategoryOrder, getCredentialCategory, getCredentialConfig, getHighlights,
  UNCATEGORISED
} from './useCredentialCardConfig.js';

// A render method carrying what a credential says about itself -- a title, an
// image, and named fields -- rather than a picture of it. The frontend decides
// how to lay that out, which is what makes it usable by a card, a row or a
// list item alike.
//
// Named for what it IS, not for how it was obtained. This library computes one
// when a credential declares nothing renderable, but an issuer could author
// the same payload, and then the type is unchanged -- only `computed` differs.
// That is why provenance is a property rather than part of the type.
//
// PROVISIONAL. No such type is specified yet. It is a constant rather than a
// literal so renaming it is one edit, and it is shaped like a declared render
// method so a specified type can replace it without callers changing.
export const DATA_VIEW_RENDER_METHOD = 'DataViewRenderMethod';

/**
 * Answers a fully usable render method for a credential.
 *
 * The point of this library: a frontend asks for a render method matching
 * what it can display, and either gets one it can use straight away or is
 * told it cannot be had. It never gets something partial that it has to
 * finish, and never has to decide for itself what a credential with no
 * artwork should look like.
 *
 * Asking for the data view always succeeds: a credential that declares no
 * render method, or only part of one, still has a name and fields, so one is
 * computed from the credential and the supplied `defaults`. Asking for any
 * other type can fail, because an html rendering cannot be invented for a
 * credential whose issuer did not write one -- that case throws
 * a `NotFoundError` rather than quietly substituting something else.
 *
 * A render method may name a url rather than carry its template inline, so
 * producing a usable one can mean fetching from an issuer-controlled host.
 * That is done through `documentLoader`, never directly. There is no default:
 * a direct fetch tells that host who opened which credential, so the caller
 * has to choose how the request is made -- through a proxy or an OHTTP relay,
 * say. It is required even when nothing is fetched, so a missing loader is
 * found on the first call rather than on the first credential that needs it.
 *
 * @param {object} options - The options to use.
 * @param {object} options.credential - The credential to render.
 * @param {object} [options.selectors] - What the caller can display, as
 *   `{type, mediaTypes, accessMode}`. `type` names a required render method
 *   type -- `DATA_VIEW_RENDER_METHOD` always succeeds, others may not be
 *   available. `mediaTypes` is a preference, best first, not a filter.
 *   `accessMode` is a filter, since it decides who can perceive the
 *   rendering at all.
 * @param {Function} options.documentLoader - Loads a url, answering text.
 * @param {object} [options.defaults] - Display defaults for a computed render
 *   method, currently `{cardDesigns}`.
 *
 * @returns {Promise<object>} A usable render method.
 */
export async function getRenderMethod({
  credential, selectors = {}, documentLoader, defaults = {}
} = {}) {
  if(!credential) {
    throw new TypeError('"credential" is required.');
  }
  if(typeof documentLoader !== 'function') {
    throw new TypeError('"documentLoader" must be a function.');
  }
  const {type, mediaTypes, accessMode} = selectors;

  // asked for the data view by name: produce it and do not look further
  if(type === DATA_VIEW_RENDER_METHOD) {
    return _dataViewFor({credential, defaults});
  }

  const declared = await getRenderedDisplays({
    credential, loadDocument: documentLoader
  });
  const usable = rankDisplays({displays: declared, mediaTypes, accessMode})
    .filter(display => type === undefined || display.type === type);
  if(usable.length > 0) {
    return usable[0];
  }

  // Nothing declared fits. A caller that named a type it must have gets an
  // error, because substituting a different one silently is how a component
  // ends up rendering something it never asked for.
  if(type !== undefined) {
    const error = new Error(
      `No "${type}" render method is available for this credential and one ` +
      'cannot be computed.');
    error.name = 'NotFoundError';
    error.credentialId = credential.id;
    error.selectors = selectors;
    throw error;
  }
  // No type named, so the caller will take whatever is usable: compute one.
  return _dataViewFor({credential, defaults});
}

/**
 * Computes a data view from what the credential itself carries.
 *
 * @param {object} options - The options to use.
 * @param {object} options.credential - The credential to describe.
 * @param {object} options.defaults - Display defaults, `{cardDesigns}`.
 *
 * @returns {object} A computed data view render method.
 */
function _dataViewFor({credential, defaults}) {
  const {cardDesigns} = defaults;
  return {
    type: DATA_VIEW_RENDER_METHOD,
    kind: 'dataView',
    // We made this up rather than reading it off the credential. A caller may
    // reasonably want to know: presenting our own guess with the same
    // authority as issuer-authored artwork is a choice, not a default.
    computed: true,
    // present so that every render method this library answers with carries
    // the same members, whether it was found or computed
    mediaType: undefined,
    accessMode: [],
    style: undefined,
    name: '',
    ...getCredentialSummary({credential, cardDesigns})
  };
}
