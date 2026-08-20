# AXIS

AXIS is a private, cloud-based AI workspace for persistent conversations, projects, file context, web research, voice transcription, account-scoped settings, and a companion Android WebView shell.

## Stack

| Layer | Technology |
|---|---|
| Web client | React 19, TypeScript, Tailwind CSS |
| Server | Node.js, Express, tRPC |
| Data | Drizzle ORM with MySQL/TiDB |
| Authentication | Manus OAuth |
| Mobile companion | Expo / React Native WebView |

## Local setup

```bash
pnpm install
pnpm check
pnpm test
pnpm dev
```

The project intentionally does **not** include provider credentials, session keys, database URLs, or `.env` files. Configure required runtime settings through your deployment environment before using external AI providers.

## Provider safety

AXIS is designed for a no-billing-safe default. Its experimental OmniRoute integration is server-only and should be activated only after a public HTTPS `/v1/models` credential check succeeds. See the documentation under [`docs/`](docs/) for setup, 401 troubleshooting, and the persistent HTTPS tunnel runbook.

## Mobile companion

The Expo source is under [`mobile/axis-mobile`](mobile/axis-mobile). Run its device-independent validation with:

```bash
cd mobile/axis-mobile
pnpm typecheck
pnpm exec expo export --platform web --output-dir /tmp/axis-mobile-web-export
```

Use the Android device-validation checklist in [`docs/axis-android-device-validation.md`](docs/axis-android-device-validation.md) before releasing a companion build.

## License

MIT. See [LICENSE](LICENSE).
