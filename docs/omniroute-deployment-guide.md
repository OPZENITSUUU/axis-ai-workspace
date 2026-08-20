# OmniRoute Deployment Guide for the AI Chat App

## What you are deploying

OmniRoute must run as a **separate, persistent gateway service**. Do not put it inside the AI chat application’s process. The chat app calls the gateway through an OpenAI-compatible HTTPS endpoint, while the gateway independently manages its provider connections. OmniRoute’s own documentation describes the local API shape as `http://localhost:20128/v1` and supports Docker-based deployment. [1]

## What you need

| Requirement | Why it is needed |
|---|---|
| A machine that stays online | OmniRoute is a persistent service, not a request-only API. A VPS, home server, or always-on computer can host it. |
| Docker and a domain name | Docker isolates the gateway; a domain and TLS reverse proxy provide a secure public HTTPS endpoint. |
| One provider connection you accept | “Free” routes vary by provider, quota, region, and terms; choose and connect a provider yourself in the gateway dashboard. |
| A scoped gateway token | The AI chat app needs a token to call the OmniRoute API. It must be stored as a server secret, never in browser code. |

## Step 1 — Prepare a separate host

Use a VPS or an always-on computer with Docker installed. A local laptop is useful for testing, but the cloud chat app cannot reach `localhost` on your laptop. For a real cloud connection, the gateway needs a public HTTPS address such as `https://ai-gateway.example.com`.

## Step 2 — Start OmniRoute privately

Create persistent storage and bind the gateway only to the host’s loopback interface:

```bash
docker volume create omniroute-data

docker run -d \
  --name omniroute \
  --restart unless-stopped \
  --stop-timeout 40 \
  -p 127.0.0.1:20128:20128 \
  -v omniroute-data:/app/data \
  diegosouzapw/omniroute:latest
```

This follows OmniRoute’s published Docker pattern, retaining the important `127.0.0.1` binding so the dashboard/API are not exposed directly to the internet. [1]

## Step 3 — Add HTTPS through a reverse proxy

Use Caddy, Nginx, or another TLS reverse proxy on the same host. The proxy should forward only HTTPS traffic from `https://ai-gateway.example.com` to `http://127.0.0.1:20128`.

Do **not** open port `20128` directly to the internet. Do **not** expose the dashboard without access control. Do **not** forward browser cookies, Manus OAuth cookies, or personal account sessions from the chat app.

## Step 4 — Configure the gateway manually

Open the private dashboard through the HTTPS address. Connect only a provider whose terms you independently accept. For this experiment, avoid any web-cookie, browser-session, traffic-inspection, or credential-capture features. Create a dedicated, least-privilege API token for this chat application rather than using an administrator token.

## Step 5 — Verify the gateway

From a trusted terminal, verify that the token can access the model list:

```bash
curl https://ai-gateway.example.com/v1/models \
  -H "Authorization: Bearer YOUR_OMNIROUTE_TOKEN"
```

The route should return available models. A failure here must be resolved on the gateway host before connecting the web app.

## Step 6 — Connect the AI chat application

In the project’s secure settings, add these server-only values:

```text
OMNIROUTE_BASE_URL=https://ai-gateway.example.com/v1
OMNIROUTE_API_KEY=YOUR_OMNIROUTE_TOKEN
```

The application already uses this endpoint only from its Node.js server. The browser does not receive either value.

## Experimental limitations

Free provider availability is not a promise of unlimited, permanent, private, or reliable inference. Quotas, model access, provider terms, and region availability can change. Do not submit sensitive personal information until you have reviewed the individual upstream provider’s data terms. Keep Gemini configured as a possible fallback even if OmniRoute is selected today.

## Reference

[1]: https://github.com/diegosouzapw/OmniRoute "OmniRoute README and deployment instructions"
