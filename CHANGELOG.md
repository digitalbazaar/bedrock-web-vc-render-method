# @bedrock/web-vc-render-method ChangeLog

## 0.1.0 - TBD

### Added
- Initial release. `getRenderMethod()` selects a render method from a
  credential or computes one, dereferencing and preparing it, with no
  dependency on any JS frontend framework.
- `getRenderMethod()` and `getRenderedDisplays()` require a document loader.
  None is provided, because a direct fetch of an issuer-controlled url tells
  that host who opened which credential.
