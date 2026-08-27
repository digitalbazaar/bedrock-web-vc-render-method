/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */
import {resolvePointer} from '@digitalbazaar/json-pointer-primitives';

// `''` for a value that is not there, and joining a list of pointers, are
// display conventions rather than pointer semantics. They stay here; the walk
// itself does not.
export function getValueFromPointer(jsonObject, pointer, joinWith) {
  if(Array.isArray(pointer)) {
    return pointer
      .map(p => _value(jsonObject, p))
      .join(joinWith !== undefined ? joinWith : ', ');
  }
  return _value(jsonObject, pointer);
}

function _value(jsonObject, pointer) {
  if(pointer === '') {
    return jsonObject;
  }
  // `''` is this module's whole-document spelling. The shared library also
  // treats `/` as one, which would put a whole credential where a display
  // string goes, so it is refused here rather than given two spellings.
  if(pointer === '/') {
    return '';
  }
  return resolvePointer(jsonObject, pointer) ?? '';
}
