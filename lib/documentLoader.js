/*!
 * Copyright (c) 2026 Digital Bazaar, Inc. All rights reserved.
 */
// This module is Base Layer code sitting in a Framework Layer package.
// Nothing in it is Vue- or Quasar-specific -- it imports nothing at all --
// and loading a resource a credential points at is not a Vue concern. It
// belongs beside the render-method work it serves: selecting a render method
// off a credential, or computing one when it has none, then dereferencing and
// preparing it, none of which needs a frontend framework.
//
// It stays here only until there is somewhere to put it. Note when moving it
// that `@bedrock/web-wallet` already exports a `documentLoader`, and that one
// is a JSON-LD context loader -- a different job with a different trust model,
// so the two need distinct names or a deliberate merge.

// A fetched document is issuer-controlled input read into memory, so it is
// metered rather than trusted. Generous next to a real SVG template, which
// runs to kilobytes.
const MAX_DOCUMENT_BYTES = 512 * 1024;

// a host that accepts the connection and never answers would otherwise leave
// a caller awaiting it forever
const FETCH_TIMEOUT_MS = 8000;

/**
 * Fetches a text document a credential points at.
 *
 * The single place this package reaches an issuer-controlled host, so it is
 * the single place to change how that is done: a size cap, a timeout, what
 * the request discloses, and later a proxy or OHTTP relay for the fact that a
 * holder viewed a particular credential at all. Callers that load something
 * take this as a parameter rather than calling `fetch` themselves, so a
 * deployment can substitute one and nothing has to be found and edited in
 * several modules.
 *
 * INTERIM. Capping a response body belongs in the shared HTTP client rather
 * than in each caller that needs one, so this module owns it only until that
 * lands. When it does, this becomes a thin call into it and the metering
 * below goes away. Tracked separately.
 *
 * @param {object} options - The options to use.
 * @param {string} options.url - The `https` url to fetch.
 * @param {number} [options.size] - Maximum bytes to accept.
 * @param {number} [options.timeout] - Milliseconds before giving up.
 *
 * @returns {Promise<string>} The document text.
 */
export async function fetchText({
  url, size = MAX_DOCUMENT_BYTES, timeout = FETCH_TIMEOUT_MS
} = {}) {
  if(!url?.startsWith?.('https://')) {
    // `fetch(undefined)` requests the wallet's own origin, and the wallet's
    // own markup then becomes whatever the caller was loading
    throw new Error(`Unusable document url "${url}".`);
  }
  const response = await fetch(url, {
    credentials: 'omit',
    // which wallet the holder uses is not the host's business, and the
    // default `Referer` on a cross-origin request tells it
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.timeout(timeout)
  });
  if(!response.ok) {
    // an error page would otherwise be handed back as the document
    throw new Error(`Document fetch failed with ${response.status}.`);
  }
  return _readCapped({response, size});
}

/**
 * Reads a response body, refusing one over `size`.
 *
 * @param {object} options - The options to use.
 * @param {Response} options.response - The response to read.
 * @param {number} options.size - Maximum bytes to accept.
 *
 * @returns {Promise<string>} The decoded body.
 */
async function _readCapped({response, size}) {
  const declared = Number(response.headers?.get?.('content-length'));
  if(Number.isFinite(declared) && declared > size) {
    // refused before the body is read at all
    throw new Error(
      `Document declares ${declared} bytes, over the ${size} byte limit.`);
  }
  const reader = response.body?.getReader?.();
  if(!reader) {
    // nothing to meter as it arrives, but the cap still has to hold
    const text = await response.text();
    if(text.length > size) {
      throw new Error(`Document exceeded the ${size} byte limit.`);
    }
    return text;
  }
  const chunks = [];
  let total = 0;
  for(;;) {
    const {done, value} = await reader.read();
    if(done) {
      break;
    }
    total += value.byteLength;
    if(total > size) {
      // stop the transfer rather than finish reading a body we will not use
      await reader.cancel();
      throw new Error(`Document exceeded the ${size} byte limit.`);
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let at = 0;
  for(const chunk of chunks) {
    body.set(chunk, at);
    at += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}
