/*!
 * Copyright (c) 2026 Digital Bazaar, Inc. All rights reserved.
 */
import {formatString} from './formatString.js';
import {getValueFromPointer} from './jsonPointer.js';

// The bucket for a credential no configured rule claims. It lives here rather
// than in a component so every surface that groups credentials agrees on it.
export const UNCATEGORISED = 'Other';

export function getCredentialConfig({credential, cardDesigns}) {
  return cardDesigns?.find(design => {
    if(!design?.matches) {
      // a design may legitimately carry only presentation fields
      return false;
    }
    const pointers = Object.keys(design.matches);
    return pointers.every(pointer => {
      const value = getValueFromPointer(credential, pointer);
      return Array.isArray(value) ?
        value.includes(design.matches[pointer]) :
        value === design.matches[pointer];
    });
  });
}

/**
 * The category a credential belongs to, from configured rules. The rules carry
 * the vocabulary (which types count as "Retail", and so on); this only matches
 * them, so the wallet library stays free of credential-type knowledge.
 *
 * Rules are evaluated in order and the first match wins, so a narrower rule
 * must be configured before a broader one it overlaps.
 *
 * @param {object} options - The options to use.
 * @param {object} options.credential - The credential to categorise.
 * @param {Array} [options.categories] - Configured `{category, matches}` rules.
 *
 * @returns {string|undefined} The category, or undefined when no rule matches.
 */
export function getCredentialCategory({credential, categories}) {
  if(!credential || !Array.isArray(categories)) {
    return UNCATEGORISED;
  }
  const rule = categories.find(({matches}) => {
    if(!matches) {
      return false;
    }
    return Object.keys(matches).every(pointer => {
      const value = getValueFromPointer(credential, pointer);
      return Array.isArray(value) ?
        value.includes(matches[pointer]) :
        value === matches[pointer];
    });
  });
  return rule?.category ?? UNCATEGORISED;
}

/**
 * The categories present among a set of credentials, in the order the rules
 * declare them, with the catch-all last.
 *
 * Exported alongside the resolver on purpose. The chip band needs the ordered
 * list and each chip needs the membership test; deriving the order separately
 * in a component means a later change to precedence has to be made in two
 * places, and chip order stops matching what each chip filters to.
 *
 * @param {object} options - The options to use.
 * @param {Array} [options.credentials] - The credentials on screen.
 * @param {Array} [options.categories] - Configured `{category, matches}` rules.
 *
 * @returns {Array<string>} The categories to show, best order first.
 */
export function getCategoryOrder({credentials = [], categories} = {}) {
  const present = new Set(credentials.map(
    credential => getCredentialCategory({credential, categories})));
  const order = [];
  for(const {category} of (Array.isArray(categories) ? categories : [])) {
    if(!order.includes(category)) {
      order.push(category);
    }
  }
  // guarded: a deployment may configure a rule named 'Other', and pushing
  // unconditionally produced it twice, with a duplicate `v-for` key
  if(!order.includes(UNCATEGORISED)) {
    order.push(UNCATEGORISED);
  }
  return order.filter(category => present.has(category));
}

/**
 * Names the kind of credential a record holds, for grouping and filtering.
 * Deliberately ignores instance-specific fields like `name` -- a credential
 * named after its subject ('Tim Doe') must still group under its kind
 * ('Birth Certificate Credential').
 *
 * @param {object} options - The options to use.
 * @param {object} options.credential - The credential to label.
 * @param {Array} [options.cardDesigns] - Configured card designs.
 *
 * @returns {string|undefined} The label, or undefined if the credential has
 *   no matching design and no type of its own.
 */
export function getCredentialTypeLabel({credential, cardDesigns}) {
  if(!credential) {
    return undefined;
  }
  const vcConfig = getCredentialConfig({credential, cardDesigns});
  if(vcConfig?.title) {
    return vcConfig.title;
  }
  const {type} = credential;
  const granularType = Array.isArray(type) ? type[type.length - 1] : type;
  if(typeof granularType !== 'string' || granularType.length === 0) {
    return undefined;
  }
  // 'MovieTicketCredential' -> 'Movie Ticket Credential', matching how
  // `@bedrock/vue-vc` names a credential with no configured title
  return granularType.replace(/(?!^)([A-Z]|\d+)/g, ' $1');
}

export function getHighlights({credential, highlights = []}) {
  return highlights.slice(0, 2).map(({field, pointer, format, joinWith}) => {
    const raw = getValueFromPointer(credential, pointer, joinWith);
    return {field, value: formatString(raw, format)};
  });
}
