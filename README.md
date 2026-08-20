# AXIS

AXIS is a private, cloud-based AI workspace for persistent conversations, documents, projects, and focused work. It is built as a React and Node.js application with strict user-scoped data access.

## Current capabilities

AXIS provides private chat history, streamed model responses, Markdown rendering, document and image attachments, private projects, account-synced preferences, command search, focus mode, mobile workspace actions, data export, and confirmation-gated deletion.

The default provider policy is **OmniRoute-only safe mode**. AXIS will not make a direct paid-provider request unless a server owner deliberately enables direct providers through server-only configuration.

## Local development

```bash
pnpm install
pnpm check
pnpm test
pnpm dev
```

Use the deployment host’s secure secret settings for the variables listed in [infrastructure responsibilities](docs/infrastructure.md). Never commit a real `.env` file or any provider key.

## Provider configuration

For the current experimental path, host OmniRoute separately, keep it behind HTTPS, and add its `/v1` URL and gateway token as server-only variables. See [the OmniRoute deployment guide](docs/omniroute-deployment-guide.md).

> **No-billing default:** If the approved OmniRoute gateway is unavailable, AXIS pauses live chat. It does not silently send a prompt to Gemini, OpenAI, or another direct provider.

OmniRoute’s upstream routes, quotas, privacy terms, and potential charges are controlled by the owner’s separate gateway configuration. Free allowances are not permanent guarantees, so review the active upstream routes before exposing the gateway. If the gateway fails before a response begins, AXIS can use only another explicitly configured owner-approved route; otherwise it reports that live chat is unavailable rather than creating an unexpected direct-provider charge.

### Local development only

When AXIS and OmniRoute run on the **same computer**, use an uncommitted server-side `.env` file:

```env
OMNIROUTE_BASE_URL=http://127.0.0.1:20128/v1
OMNIROUTE_API_KEY=your_gateway_token
OMNIROUTE_MODEL=auto
AI_PROVIDER=omniroute
ALLOW_PAID_PROVIDERS=false
```

Never put a gateway key in browser code or a `VITE_*` variable. For the deployed AXIS website, `localhost` and `127.0.0.1` do not point to the owner’s computer. Replace the local URL with an owner-controlled public HTTPS `/v1` gateway address and keep the same key server-side. See [the local exposure checklist](docs/omniroute-local-exposure.md).

## Data model and privacy

All user-owned records are filtered by the authenticated user ID. Projects, chats, messages, attachments, settings, file search, exports, and deletion routines are user-scoped. The current schema is MySQL/TiDB-oriented; see [infrastructure responsibilities](docs/infrastructure.md) for deployment details.

## Android roadmap

AXIS is currently a web app. A future Flutter or React Native client can use the existing authenticated API, user-scoped data model, and provider layer. See [the APK roadmap](docs/apk-roadmap.md).

## License

AXIS is released under the [MIT License](LICENSE).
