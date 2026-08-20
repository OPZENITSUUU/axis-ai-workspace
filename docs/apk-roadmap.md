# AXIS Android APK Roadmap

## Current state

AXIS is a responsive React web application. It works in mobile browsers today; it is not yet packaged as an Android APK.

## Reusable backend

The existing Node.js server, private data model, provider adapter, file storage design, and user-scoped authorization remain the same for an Android application. A mobile app should call the same authenticated APIs rather than create a second database or second provider configuration.

## Recommended path

| Stage | Output | Notes |
|---|---|---|
| 1 | Stabilize the web workspace | Complete provider activation and final privacy checks. |
| 2 | Mobile API contract review | Replace browser-only assumptions such as session storage with a mobile-safe secure-token flow. |
| 3 | Flutter or React Native client | Rebuild the AXIS workspace UI with the same design system and API contract. |
| 4 | Android build and signing | Generate an APK/AAB using the owner’s Android signing credentials. |
| 5 | Device testing | Verify uploads, streaming, sign-in, exports, and data deletion on Android. |

The APK should be a separate client application, while AXIS’s existing cloud backend remains the shared source of truth.

