/*!
 * Copyright (c) 2026 Digital Bazaar, Inc. All rights reserved.
 */
// Base Layer code. Reading a value out of a credential by JSON pointer needs
// no frontend framework, and this module imports nothing. Kept apart from
// `helpers.js`, which also reaches for Quasar's `Notify`, the app config and
// the credential handler -- importing a pointer walk should not drag those in.

export function getValueFromPointer(jsonObject, pointer, joinWith) {
  function pointerValue(jsonObject, pointer) {
    try {
      // Return whole object
      if(pointer === '') {
        return jsonObject;
      // Return value from pointer
      } else if(pointer[0] === '/') {
        const pointerFields = pointer.slice(1).split('/').map(p => {
          // Replace json pointer special characters
          return p.replaceAll('~1', '/').replaceAll('~0', '~');
        });
        // A missing segment resolves to nothing. Re-rooting at `jsonObject`
        // when an intermediate is absent answers a different question: on a
        // credential carrying no issuer at all, `/issuer/image` came back as
        // the credential's own top-level `image`.
        const value = pointerFields.reduce(
          (value, field) => value === undefined || value === null ?
            undefined : value[field], jsonObject);
        return value ?? '';
      }
      return '';
    } catch(err) {
      console.error('Failed to get json value from pointer', err);
      return '';
    }
  }
  // Handles single values or an array of values
  if(Array.isArray(pointer)) {
    return pointer.map(p => pointerValue(jsonObject, p))
      .join(joinWith !== undefined ? joinWith : ', ');
  } else {
    return pointerValue(jsonObject, pointer);
  }
}
