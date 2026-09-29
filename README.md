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
const renderMethod = await getRenderMethod({credential, documentLoader});

// something this caller can actually mount
const renderMethod = await getRenderMethod({
  credential,
  selectors: {mediaTypes: ['text/html', 'image/svg+xml']},
  documentLoader
});

// a type this caller must have -- throws if it cannot be had
const renderMethod = await getRenderMethod({
  credential,
  selectors: {type: 'TemplateRenderMethod'},
  documentLoader
});
```

Every answer carries `type`, `computed`, `mediaType`, `accessMode` and `name`,
whether it was found on the credential or made for it, so a caller reads one
shape rather than guarding.

### Selectors

| selector | behaviour |
|---|---|
| `type` | **Required if given.** A named type is answered or a `NotFoundError` carrying `credentialId` and `selectors` is thrown. Nothing else is substituted. |
| `mediaTypes` | A **preference**, best first. A caller offered only SVG when it asked for HTML is better served the SVG than nothing. |
| `accessMode` | A **filter**. It decides who can perceive the rendering at all, so a caller needing `auditory` cannot use a visual one. A rendering declaring no access mode is not excluded by one. |

### The data view

`DataViewRenderMethod` carries what a credential says about itself — a title,
an image, and named fields — rather than a picture of it. The frontend decides
how to lay that out, which is what makes one payload serve a card, a row and a
list item alike.

Asking for it always succeeds. A credential that declares no render method
still has a name, an issuer and fields worth showing, so one is computed from
the credential and the `defaults` passed in.

Asking for any other type can fail. An html rendering cannot be invented for a
credential whose issuer did not write one, so that throws a `NotFoundError`
rather than quietly returning something else.

It is named for what it **is**, not for how it was obtained. This library
computes one when a credential declares nothing renderable, but an issuer
could author the same payload — and arguably should, since their summary beats
our guess. The type is the same either way; only `computed` differs:

```js
renderMethod.computed  // true when we made it up, false when the issuer wrote it
```

A caller may reasonably decline to present a computed data view with the same
visual authority as issuer-authored artwork. That is a choice, so the
information is there to make it.

> `DataViewRenderMethod` is **provisional**. No such type is specified yet. It
> is shaped like a declared render method so a specified type can replace it
> without callers changing.

### Loading templates

A render method may name a url rather than carry its template inline, so
producing a usable one can mean fetching from an issuer-controlled host. That
goes through `documentLoader`, never a direct call.

`documentLoader` is required, and there is no default. A direct fetch tells
the issuer's host the holder's address and that this credential was opened, so
the caller chooses how the request is made — through a proxy or an OHTTP
relay, for example. It is called as `documentLoader({url})` and answers the
document's text. It is required even when nothing needs to be fetched.

### Defaults

`defaults` carries display hints a deployment configures, currently
`{cardDesigns}`. The library owns how a card design is *interpreted*; which
credentials a deployment recognises is the deployment's own vocabulary and is
passed in rather than shipped here.

## API

| export | |
|---|---|
| `getRenderMethod({credential, selectors, documentLoader, defaults})` | the entry point |
| `DATA_VIEW_RENDER_METHOD` | the data view type's name |
| `getRenderedDisplays`, `rankDisplays` | the pieces, for callers that need them |
| `getCredentialSummary` | the title, image and fields behind a data view |
| `getValueFromPointer`, `formatString` | pointer and display-format primitives |

## License

See [LICENSE.md](./LICENSE.md).
