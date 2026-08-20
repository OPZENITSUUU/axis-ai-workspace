# OmniRoute Experimental Provider Assessment

## Decision

OmniRoute will be supported as an **optional, external OpenAI-compatible provider gateway**. The chat application will not embed, install, start, or manage the OmniRoute server process itself.

## Evidence reviewed

The project’s published documentation describes a gateway process that serves an OpenAI-compatible API at a local endpoint such as `http://localhost:20128/v1`. It supports a large catalog of provider pools and documented free tiers, but availability, quota, model access, region eligibility, and terms are provider-dependent. The project is MIT licensed. [1]

## Cloud compatibility

The current chat application runs as a managed, request-oriented Node.js web service. OmniRoute is a separate, stateful gateway with its own service process, dashboard, local persistence, provider connections, and optional Docker deployment. Running it inside this web application would be unsuitable for the initial cloud deployment because it requires a separate persistent runtime and maintenance boundary.

The application will instead accept a server-only `OMNIROUTE_BASE_URL` and optional `OMNIROUTE_API_KEY` for a separately deployed OmniRoute instance. No OmniRoute credential, provider session, or user browser cookie will be exposed to the client.

## Safety boundaries

The repository documents integrations involving web-cookie providers, browser-like access paths, stealth guidance, and transparent inspection features. These features will **not** be configured or used by this application. The experimental adapter will only make a standard, server-to-server request to an explicitly configured OpenAI-compatible endpoint. The app will not forward Manus OAuth sessions, user cookies, or browser credentials upstream.

## Data and availability caution

The app will label OmniRoute as experimental. A free route must not be represented as permanent, unlimited, private, or guaranteed. Users should not send sensitive personal data while the experimental provider is active unless its individual upstream provider data terms have been reviewed.

## References

[1]: https://github.com/diegosouzapw/OmniRoute "OmniRoute repository and documentation"
