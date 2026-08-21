# AXIS Android Automatic Updates

The AXIS companion now uses **EAS Update** on its internal `preview` channel. Once a compatible AXIS APK is installed, the app checks for a newer compatible release every time it opens. When an update is available, it downloads in the background, shows a brief **“Updating AXIS to the latest version…”** message, and restarts into the update. This applies to the companion’s JavaScript, styling, and bundled assets; it does not transfer chat content, OAuth tokens, or provider credentials through the update mechanism.

| Change type | Delivery path | User action |
| --- | --- | --- |
| WebView-shell UI, update UI, or other compatible JavaScript changes | Publish an EAS Update to `preview` | Open AXIS; it checks and applies the update automatically. |
| New native dependency, Android permission, SDK change, or runtime-version change | Build a new signed `preview` APK | Install the newly supplied official APK once. Future compatible updates again arrive automatically. |

## First compatible release

The existing `0.1.0` APK does not contain the native update client. The next internal build is **AXIS 0.2.0 (Android version code 2)** and is the one users must install once to enable automatic updates thereafter. The app uses the `appVersion` runtime policy, so EAS only delivers updates to binaries with matching native compatibility.

## Releasing a compatible update

From `mobile/axis-mobile`, publish a reviewed companion-shell change with a clear release message:

```bash
pnpm update:preview --message "Describe the AXIS update"
```

The command sends the update to the same `preview` channel as the internal APK profile. Users receive it when they next open the app; a second launch can be required by the underlying update runtime when a background download completes after startup.

> **Safety boundary:** Do not use automatic updates to make a native compatibility, permission, or SDK change. Increase the Android `versionCode` and app version, create a new signed APK, and distribute that build through the official Expo install page instead.

## Build a new native APK when required

```bash
pnpm apk:preview
```

After the build completes, share only the build’s official Expo installation page. The update system never performs a silent APK replacement and never uses arbitrary download URLs.

## References

[1] [Expo, “EAS Update: Introduction.”](https://docs.expo.dev/eas-update/introduction/)

[2] [Expo, “Get started with EAS Update.”](https://docs.expo.dev/eas-update/getting-started/)
