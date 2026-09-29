/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */
import {fetchText} from './documentLoader.js';
import {formatString} from './formatString.js';
import Mustache from 'mustache';

const TEMPLATE_RENDER_METHOD = 'TemplateRenderMethod';
const HTML_RENDER_SUITE = 'html';

// The media type a render suite produces when the issuer states none.
// `outputPreference` is optional and nothing in circulation carries it yet, so
// without this every existing credential drops out of preference ordering and
// the choice collapses back to declaration order.
const SUITE_MEDIA_TYPE = {
  SvgRenderingTemplate2023: 'image/svg+xml',
  SvgRenderingTemplate2024: 'image/svg+xml',
  [HTML_RENDER_SUITE]: 'text/html'
};

// `application/html` is what the render-method spec's own `html` suite example
// writes, and it is not an IANA registration. Ranking a credential last for
// having followed the spec would be the wrong failure.
const MEDIA_TYPE_ALIASES = new Map([['application/html', 'text/html']]);

/*
 * Functions available to a Mustache template.
 * See: https://github.com/janl/mustache.js#functions
 */
const formattingFunctions = {
  // the same date rendering a card design gets, rather than a second one:
  // an issuer template and a card design naming the same field should not
  // disagree about what day it is
  formatDate: () => (text, render) => formatString(render(text), 'date')
};

/**
 * Produces the renderings a credential declares for itself. A credential with
 * no supported render method yields none, which is the caller's cue to fall
 * back to its own presentation.
 *
 * An image display carries its `content`, a data URI already rendered. An html
 * display carries only its `renderMethod`: the `html` suite runs issuer script
 * inside a sandboxed frame, so it can only be rendered by whoever owns a mount
 * point in the DOM.
 *
 * A render method may name a url rather than carry its template inline, so
 * rendering one can mean reaching an issuer-controlled host. This function
 * does not decide how: it is handed a loader and calls it. The default is the
 * one this package configures centrally, and a deployment routing its
 * requests through a proxy or an OHTTP relay substitutes its own without
 * anything here changing.
 *
 * @param {object} options - The options to use.
 * @param {object} options.credential - The credential to render.
 * @param {Function} [options.loadDocument] - Loads a url, answering its text.
 *
 * @returns {Promise<Array<object>>} Displays, in the order the credential
 *   declares them.
 */
export async function getRenderedDisplays({
  credential, loadDocument = fetchText
} = {}) {
  // `renderMethod` is `@container: @set`, so a single value may appear
  // unwrapped: a bare object, or a bare string. Both are normalised to an
  // array here rather than reaching the walk below, which iterates.
  const renderMethods = _toArray(credential?.renderMethod);
  if(renderMethods.length === 0) {
    return [];
  }
  // `forEach` does not await an async callback, so a fetched template could be
  // pushed after a render method declared later; resolve them all first and
  // return them in the order the credential declares them
  const resolved = await Promise.all(renderMethods.map(async renderMethod => {
    const {type} = renderMethod;
    try {
      if(type === 'SvgRenderingTemplate2023') {
        // the id is itself the image
        return renderMethod.id ? {
          kind: 'image', content: renderMethod.id,
          ..._describe(renderMethod, type)
        } : null;
      }
      if(type === 'SvgRenderingTemplate2024') {
        const content = await _renderTemplate2024({
          template: renderMethod.template, url: renderMethod.url,
          values: credential, loadDocument
        });
        return {kind: 'image', content, ..._describe(renderMethod, type)};
      }
      if(type === TEMPLATE_RENDER_METHOD &&
        renderMethod.renderSuite === HTML_RENDER_SUITE) {
        return {
          kind: 'html', renderMethod,
          ..._describe(renderMethod, HTML_RENDER_SUITE)
        };
      }
    } catch(e) {
      // one template that cannot be fetched or rendered must not take the
      // other renderings down with it
      console.error('Failed to render credential render method', type, e);
    }
    return null;
  }));
  return resolved.filter(display => display !== null);
}

/**
 * Ranks the renderings a credential declares against what a caller can show.
 *
 * Preference, not filtering: a caller that asks for `text/html` and gets a
 * credential offering only SVG is better served the SVG than nothing. A
 * caller that must not be handed something it cannot display should read
 * `mediaType` off the result and decide for itself.
 *
 * `accessMode` is filtered rather than ranked, because it is a statement
 * about who can perceive the rendering at all -- a caller asking for
 * `auditory` cannot use a visual one.
 *
 * @param {object} options - The options to use.
 * @param {Array} options.displays - Displays, as `getRenderedDisplays` gives.
 * @param {Array<string>} [options.mediaTypes] - Preferred types, best first.
 * @param {string} [options.accessMode] - Required access mode, if any.
 *
 * @returns {Array<object>} The displays, best first.
 */
export function rankDisplays({displays = [], mediaTypes, accessMode} = {}) {
  const usable = accessMode === undefined ? displays : displays.filter(
    // a rendering that declares no access mode makes no claim, so it is not
    // excluded by one -- dropping it would hide every credential in
    // circulation, since nothing carries the term yet
    // `accessMode` is optional on a display this function did not build
    d => (d.accessMode ?? []).length === 0 ||
      d.accessMode.includes(accessMode));
  if(!Array.isArray(mediaTypes) || mediaTypes.length === 0) {
    // the order the credential declares them is the issuer's own preference
    return usable;
  }
  const rank = d => {
    const at = mediaTypes.indexOf(d.mediaType);
    return at === -1 ? mediaTypes.length : at;
  };
  // a stable sort, so equally-ranked renderings keep the issuer's order
  return usable
    .map((display, at) => ({display, at}))
    .sort((a, b) => rank(a.display) - rank(b.display) || a.at - b.at)
    .map(({display}) => display);
}

/**
 * Wraps a `@set` value that may legitimately appear unwrapped in JSON.
 *
 * @param {*} value - The value to normalize.
 *
 * @returns {Array} The value as an array; empty when absent.
 */
function _toArray(value) {
  if(Array.isArray(value)) {
    return value;
  }
  if(value === undefined || value === null) {
    return [];
  }
  return [value];
}

/**
 * Reads what a render method says a rendering IS, across two vocabulary
 * generations that disagree about where the terms live.
 *
 * @param {object} renderMethod - The render method to describe.
 * @param {string} suiteKey - Its suite, for the media-type default.
 *
 * @returns {object} The `name`, `mediaType`, `accessMode` and `style`.
 */
function _describe(renderMethod, suiteKey) {
  const {name = '', outputPreference = {}} = renderMethod;
  const {style} = outputPreference;
  // earlier render-method contexts carry `mediaType` on the render method
  // itself; later ones moved it inside `outputPreference`. Credentials in
  // circulation are written against both, so read either.
  const mediaType = outputPreference.mediaType ?? renderMethod.mediaType;
  const declared = typeof mediaType === 'string' ?
    mediaType.toLowerCase() : undefined;
  // the render-method JSON-LD context names this term `mode`; the spec prose
  // calls it `accessMode`. Reading only one silently drops the access mode of
  // every credential that used the other spelling.
  const mode = outputPreference.mode ?? outputPreference.accessMode;
  return {
    // the declared type, carried through so a caller that must have a
    // particular one can select on it rather than inspecting `kind`
    type: renderMethod.type,
    // the issuer wrote this one. Stated rather than left absent so a caller
    // reads the same field whether the render method was found or computed.
    computed: false,
    name,
    mediaType: MEDIA_TYPE_ALIASES.get(declared) ?? declared ??
      SUITE_MEDIA_TYPE[suiteKey],
    accessMode: _toArray(mode),
    style
  };
}

/**
 * Renders one `SvgRenderingTemplate2024`: the template comes inline or from a
 * url, then credential values are substituted into it.
 *
 * @param {object} options - The options to use.
 * @param {string} [options.template] - An inline SVG template.
 * @param {string} [options.url] - Where to fetch the template from.
 * @param {object} options.values - The credential supplying the values.
 * @param {Function} options.loadDocument - Loads a url, answering its text.
 *
 * @returns {Promise<string>} An SVG data URI.
 */
async function _renderTemplate2024({template, url, values, loadDocument}) {
  let svg = template;
  // the inline template travels inside the signed credential and a fetched one
  // does not, so an inline template wins when both are present
  if(!svg) {
    svg = await loadDocument({url});
  }
  const rendered = Mustache.render(
    svg, {...values, ...formattingFunctions});
  // not `btoa`: it is Latin-1 only, so any character above U+00FF -- a name
  // in Chinese, Japanese, Korean, Arabic -- throws
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rendered)}`;
}
