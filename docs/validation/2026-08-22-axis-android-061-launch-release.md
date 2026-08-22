# AXIS Android 0.6.1 Launch Release Record

## Scope

This release addresses the owner-reported symptom that the AXIS Android APK did not open promptly. The native companion now lets the hosted private workspace receive the initial network and rendering budget before downloading a compatible over-the-air update. The app also enables normal Android WebView caching and hardware rendering, and it uses one native progress-aware loading layer instead of overlapping loading indicators.

## Build and artifact

| Item | Verified value |
|---|---|
| App version | 0.6.1 |
| Android version code | 7 |
| Internal build | `8ac61302-ad18-414a-b06e-2aa35e47e3e8` |
| Direct APK artifact | `https://expo.dev/artifacts/eas/iW1GkaK1bBhe3d6HYg1qljvzEtnX24PQnYTBWA7nDZc.apk` |
| Artifact response | HTTP 200, `application/octet-stream` |

## Automated validation

The AXIS web suite passed with 25 test files, 60 passing tests, and one intentional external-provider skip. The Expo companion TypeScript check passed. The public entry page was reachable through the initial browser extraction; a subsequent browser inspection was unavailable in the sandbox, so physical-device timing and interaction validation remains an owner-controlled follow-up.

## User test requested

Install AXIS 0.6.1 over the older APK, open it on a normal network, and report whether the loading screen moves into the workspace promptly. If it still stalls, capture the exact loading text or error message and the approximate elapsed time before it appears.
