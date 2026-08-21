# @bedrock/web-vc-render-method

Select or generate a fully usable render method for a Verifiable Credential.

A frontend asks for a render method matching what it can display, and either
gets one it can use straight away or is told it cannot be had. It never gets
something partial that it has to finish, and never has to decide for itself
what a credential with no artwork should look like.

No JS frontend framework is involved. A Vue wallet, a React Native wallet, an
issuer UI or a verifier UI all call the same function and differ only in how
they mount the result.

## Why

Picking a render method off a credential, computing one when it declares none,
dereferencing a template it names by url, and preparing it are all jobs that
need no frontend framework. Doing them inside a frontend package means the
next frontend does them again — and that has already happened more than once
across our repos, with no two implementations covering the same ground.

## Usage

```js
import {getRenderMethod} from '@bedrock/web-vc-render-method';

// whatever the credential offers, or one computed from it
const renderMethod = await getRenderMethod({credential});

// something this caller can actually mount
const renderMethod = await getRenderMethod({
  credential,
  selectors: {mediaTypes: ['text/html', 'image/svg+xml']}
});

// a type this caller must have -- throws if it cannot be had
const renderMethod = await getRenderMethod({
  credential,
  selectors: {type: 'TemplateRenderMethod'}
});
```

### Selectors

| selector | behaviour |
|---|---|
| `type` | **Required if given.** A named type is answered or `RenderMethodNotFoundError` is thrown. Nothing else is substituted. |
| `mediaTypes` | A **preference**, best first. A caller offered only SVG when it asked for HTML is better served the SVG than nothing. |
| `accessMode` | A **filter**. It decides who can perceive the rendering at all, so a caller needing `auditory` cannot use a visual one. A rendering declaring no access mode is not excluded by one. |

### Always available, and not

Asking for `SUMMARY_RENDER_METHOD` always succeeds. A credential that declares
no render method still has a name, an issuer and fields worth showing, so one
is computed from the credential and the `defaults` passed in.

Asking for any other type can fail. An html rendering cannot be invented for a
credential whose issuer did not write one, so that throws
`RenderMethodNotFoundError` rather than quietly returning something else.

> `SUMMARY_RENDER_METHOD` is **provisional**. No such type is specified yet and
> the name is an open question. It is shaped like a declared render method so
> that a specified type can replace it without callers changing.

### Loading templates

A render method may name a url rather than carry its template inline, so
producing a usable one can mean fetching from an issuer-controlled host. That
goes through `documentLoader`, never a direct call, so a deployment can route
it through a proxy or an OHTTP relay by passing its own.

The default caps the response at 512KB — refusing on a declared
`content-length` over the limit before reading a byte, and metering the stream
otherwise — sends no referrer, and omits credentials.

### Defaults

`defaults` carries display hints a deployment configures, currently
`{cardDesigns}`. The library owns how a card design is *interpreted*; which
credentials a deployment recognises is the deployment's own vocabulary and is
passed in rather than shipped here.

## API

| export | |
|---|---|
| `getRenderMethod({credential, selectors, documentLoader, defaults})` | the entry point |
| `RenderMethodNotFoundError` | carries `credentialId` and `selectors` |
| `SUMMARY_RENDER_METHOD` | the computed type's name |
| `getRenderedDisplays`, `rankDisplays` | the pieces, for callers that need them |
| `getCredentialSummary` | what a credential looks like when it draws nothing |
| `getValueFromPointer`, `formatString` | pointer and display-format primitives |
| `fetchText` | the default document loader |

## License

See [LICENSE.md](./LICENSE.md).
