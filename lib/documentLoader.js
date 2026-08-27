/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */
// Nothing in this module is framework-specific -- it imports nothing at all --
// and loading a resource a credential points at is not a UI concern. It sits
// beside the render-method work it serves: selecting a render method off a
// credential, computing one when it declares none, then dereferencing and
// preparing it.
//
// `documentLoader` is an overloaded name. This one dereferences a url a
// credential points at; a JSON-LD context loader is a different job with a
// different trust model, so the two are not interchangeable.

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
 * the single place to change how that is done: a size cap, a timeout, and what
 * the request discloses. Callers that load something take a loader as a
 * parameter rather than calling `fetch` themselves, so a deployment can
 * substitute its own -- routing through a proxy or a relay, or handing over to
 * an HTTP client that caps response bodies itself -- without any of that being
 * found and edited in several modules.
 *
 * Note for a deployment: fetching a url at view time tells the host that
 * serves it the holder's address and the fact that this credential was opened,
 * on every view. `credentials: 'omit'` and `referrerPolicy: 'no-referrer'`
 * limit what is sent; they do not remove the correlation. Substituting a
 * loader is what removes it.
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
    if(new TextEncoder().encode(text).byteLength > size) {
      throw new Error(`Document exceeded the ${size} byte limit.`);
    }
    return text;
  }
  const chunks = [];
  let total = 0;
  try {
    for(;;) {
      const {done, value} = await reader.read();
      if(done) {
        break;
      }
      total += value.byteLength;
      if(total > size) {
        throw new Error(`Document exceeded the ${size} byte limit.`);
      }
      chunks.push(value);
    }
  } finally {
    // Reached on the size refusal and on a mid-body failure alike -- an
    // aborted timeout, a dropped connection. Without it the transfer keeps
    // running and the body stream stays locked; there is nothing useful to do
    // about a failure to cancel, so it is swallowed rather than masking the
    // error that got us here.
    await reader.cancel().catch(() => {});
  }
  const body = new Uint8Array(total);
  let at = 0;
  for(const chunk of chunks) {
    body.set(chunk, at);
    at += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}
