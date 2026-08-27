/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */
import {describe, expect, it} from 'vitest';
import {getValueFromPointer} from '../lib/jsonPointer.js';

const CREDENTIAL = {
  name: 'Alex', issuer: {id: 'did:ex:1'}, image: 'TOP',
  type: ['A', 'B'], 'a/b': 'slash', 'm~n': 'tilde'
};

describe('getValueFromPointer', () => {
  it.each([
    ['a present value', '/name', 'Alex'],
    ['a nested value', '/issuer/id', 'did:ex:1'],
    ['an array index', '/type/0', 'A'],
    ['an escaped slash', '/a~1b', 'slash'],
    ['an escaped tilde', '/m~0n', 'tilde']
  ])('resolves %s', (_label, pointer, expected) => {
    expect(getValueFromPointer(CREDENTIAL, pointer)).toBe(expected);
  });

  it.each([
    ['a missing key', '/absent'],
    ['a missing parent', '/nothere/image'],
    ['an out-of-range index', '/type/9'],
    ['a string with no leading slash', 'not-a-pointer'],
    ['a value that is not a string', 42],
    ['null', null],
    // `''` is the whole document; `/` is refused rather than being a second
    // spelling of it, which would put the credential where a string goes
    ['a lone slash', '/'],
    // the walk stops at a non-object, so a pointer cannot index into a string
    ['a pointer descending into a primitive', '/name/0'],
    ['a property of a primitive', '/name/length']
  ])('gives the empty string for %s', (_label, pointer) => {
    expect(getValueFromPointer(CREDENTIAL, pointer)).toBe('');
  });

  it('gives the empty string for a lone slash even with an empty-string key',
    () => {
      expect(getValueFromPointer({'': 'under the empty key'}, '/')).toBe('');
    });

  it('gives the whole object for the empty pointer', () => {
    expect(getValueFromPointer(CREDENTIAL, '')).toEqual(CREDENTIAL);
  });

  // it used to walk the prototype chain and hand back a function. Nested
  // cases matter: a guard applied only to the first token passes the rest.
  it.each([
    '/constructor', '/toString', '/__proto__',
    '/issuer/constructor', '/issuer/toString', '/issuer/__proto__'
  ])('does not resolve %s', pointer => {
    expect(getValueFromPointer(CREDENTIAL, pointer)).toBe('');
  });

  describe('a list of pointers', () => {
    it('joins with a comma by default', () => {
      expect(getValueFromPointer(CREDENTIAL, ['/name', '/issuer/id']))
        .toBe('Alex, did:ex:1');
    });

    it('joins with what it is given', () => {
      expect(getValueFromPointer(CREDENTIAL, ['/name', '/absent'], ' | '))
        .toBe('Alex | ');
    });

    it('joins with an empty separator when given one', () => {
      expect(getValueFromPointer(CREDENTIAL, ['/name', '/issuer/id'], ''))
        .toBe('Alexdid:ex:1');
    });
  });
});
