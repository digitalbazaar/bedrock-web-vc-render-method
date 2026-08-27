/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */
import {
  DATA_VIEW_RENDER_METHOD, getRenderMethod, RenderMethodNotFoundError
} from '../lib/index.js';
import {describe, expect, it, vi} from 'vitest';

const SVG = '<svg></svg>';

const credential = (renderMethod, extra = {}) => ({
  id: 'urn:uuid:credential',
  type: ['VerifiableCredential', 'MovieTicketCredential'],
  name: 'Movie Ticket',
  credentialSubject: {seat: 'A1'},
  ...(renderMethod ? {renderMethod} : {}),
  ...extra
});

const svgMethod = {type: 'SvgRenderingTemplate2024', template: SVG};
const htmlMethod = {type: 'TemplateRenderMethod', renderSuite: 'html'};

describe('asking for a render method', () => {
  it('requires a credential', async () => {
    await expect(getRenderMethod({})).rejects.toThrow(TypeError);
  });

  describe('when the credential declares one', () => {
    it('answers it', async () => {
      const method = await getRenderMethod({credential: credential([
        svgMethod
      ])});
      expect(method.type).toBe('SvgRenderingTemplate2024');
    });

    it('answers the one the selectors prefer', async () => {
      const method = await getRenderMethod({
        credential: credential([svgMethod, htmlMethod]),
        selectors: {mediaTypes: ['text/html']}
      });
      expect(method.type).toBe('TemplateRenderMethod');
    });

    it('answers the exact type when one is named', async () => {
      const method = await getRenderMethod({
        credential: credential([svgMethod, htmlMethod]),
        selectors: {type: 'TemplateRenderMethod'}
      });
      expect(method.type).toBe('TemplateRenderMethod');
    });
  });

  // The contract that distinguishes this from "give me the best you have":
  // a caller that names a type it must have is told when it cannot be had,
  // rather than handed something else and left to notice.
  describe('when the named type cannot be had', () => {
    it('throws rather than substituting another type', async () => {
      await expect(getRenderMethod({
        credential: credential([svgMethod]),
        selectors: {type: 'TemplateRenderMethod'}
      })).rejects.toThrow(RenderMethodNotFoundError);
    });

    it('throws when the credential declares nothing at all', async () => {
      await expect(getRenderMethod({
        credential: credential(),
        selectors: {type: 'TemplateRenderMethod'}
      })).rejects.toThrow(RenderMethodNotFoundError);
    });

    it('names the credential and the selectors on the error', async () => {
      // a caller catching this needs to know which credential failed and
      // what it asked for, without re-deriving either
      const selectors = {type: 'TemplateRenderMethod'};
      await getRenderMethod({credential: credential(), selectors}).then(
        () => expect.unreachable('should have thrown'),
        error => {
          expect(error.credentialId).toBe('urn:uuid:credential');
          expect(error.selectors).toEqual(selectors);
        });
    });
  });

  // "we can always generate one if not present" -- so this path never fails
  describe('the data view', () => {
    it('is produced when asked for by name, declared or not', async () => {
      for(const c of [credential(), credential([svgMethod])]) {
        const method = await getRenderMethod({
          credential: c, selectors: {type: DATA_VIEW_RENDER_METHOD}
        });
        expect(method.type).toBe(DATA_VIEW_RENDER_METHOD);
      }
    });

    it('carries what the credential says about itself', async () => {
      const method = await getRenderMethod({
        credential: credential(), selectors: {type: DATA_VIEW_RENDER_METHOD}
      });
      expect(method.title).toBe('Movie Ticket');
      expect(method.fields).toEqual([{label: 'Seat', value: 'A1'}]);
    });

    it('uses the defaults it is handed', async () => {
      const cardDesigns = [{
        matches: {'/type': 'MovieTicketCredential'},
        overrides: {title: {pointer: '/credentialSubject/seat'}}
      }];
      const method = await getRenderMethod({
        credential: credential(),
        selectors: {type: DATA_VIEW_RENDER_METHOD},
        defaults: {cardDesigns}
      });
      expect(method.title).toBe('A1');
    });

    it('is what a caller naming no type gets when nothing is declared',
      async () => {
        const method = await getRenderMethod({credential: credential()});
        expect(method.type).toBe(DATA_VIEW_RENDER_METHOD);
      });
  });

  describe('every answer, found or computed', () => {
    it('carries the same members', async () => {
      // a caller reads the same shape either way rather than guarding
      const found = await getRenderMethod({credential: credential([
        svgMethod
      ])});
      const computed = await getRenderMethod({credential: credential()});
      for(const key of ['type', 'kind', 'mediaType', 'accessMode', 'name']) {
        expect(found, `found carries ${key}`).toHaveProperty(key);
        expect(computed, `computed carries ${key}`).toHaveProperty(key);
      }
    });

    it('says whether it was declared or made up', async () => {
      // a caller may decline to present our own guess with the same
      // authority as issuer-authored artwork, so it has to be able to tell
      const found = await getRenderMethod({credential: credential([
        svgMethod
      ])});
      const computed = await getRenderMethod({credential: credential()});
      expect(found.computed).toBe(false);
      expect(computed.computed).toBe(true);
    });
  });

  describe('dereferencing a template', () => {
    it('goes through the loader, never a call of its own', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
      const documentLoader = vi.fn(async () => SVG);
      await getRenderMethod({
        credential: credential([{
          type: 'SvgRenderingTemplate2024',
          url: 'https://issuer.example/t.svg'
        }]),
        documentLoader
      });
      expect(documentLoader).toHaveBeenCalledWith(
        {url: 'https://issuer.example/t.svg'});
      expect(fetchSpy).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it('computes one when the only declared template cannot be loaded',
      async () => {
        const documentLoader = vi.fn(async () => {
          throw new Error('refused');
        });
        const method = await getRenderMethod({
          credential: credential([{
            type: 'SvgRenderingTemplate2024',
            url: 'https://issuer.example/t.svg'
          }]),
          documentLoader
        });
        expect(method.type).toBe(DATA_VIEW_RENDER_METHOD);
      });
  });
});
