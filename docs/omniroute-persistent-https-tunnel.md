# Persistent HTTPS tunnel for a local OmniRoute gateway

Use this runbook only when OmniRoute is running on **your own machine** at `http://127.0.0.1:20128`. It exposes that local service through a stable public HTTPS hostname so the cloud-hosted AXIS server can reach the gateway. The AXIS deployment cannot reach `localhost` on your computer directly.

> Keep the OmniRoute API key in the gateway and in the AXIS server secret store. Do not paste it into a tunnel configuration file, source code, URL, or browser application.

## Choose the correct tunnel mode

| Mode | Intended use | Suitability for AXIS streaming chat |
|---|---|---|
| **Quick Tunnel** | A temporary local connectivity check | **Do not use.** Quick Tunnels use a random hostname, have no uptime guarantee, and do not support Server-Sent Events (SSE), which AXIS uses for streamed chat. [1] |
| **Named Cloudflare Tunnel** | An owner-managed, stable hostname on a Cloudflare-managed domain | **Use this option.** It supports a persistent configuration, DNS route, ingress mapping, and Linux service installation. [2] [3] [4] |

## Preflight checks on the owner machine

First confirm that OmniRoute is responding locally and that its own API authentication is active. Replace the placeholder with the **newly rotated** gateway key only in your local terminal session.

```bash
curl --fail-with-body \
  -H "Authorization: Bearer <OMNIROUTE_KEY>" \
  http://127.0.0.1:20128/v1/models
```

Continue only after this command returns an authorized models response. A `401 Invalid API key format` is a gateway-key problem, not a tunnel problem; rotate or create an active key in the OmniRoute dashboard before exposing anything.

## Create a named Cloudflare Tunnel

These commands are for Ubuntu/Debian. Cloudflare publishes equivalent installation paths for macOS and Windows. [2]

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install cloudflared

cloudflared tunnel login
cloudflared tunnel create omniroute-axis
cloudflared tunnel list
```

The login opens a Cloudflare browser flow. Use a domain already managed in Cloudflare, for example `omniroute-api.example.com`. Record the tunnel UUID and the generated credentials-file path; neither is an OmniRoute API key. [2]

## Add a deliberately narrow ingress configuration

Create `~/.cloudflared/config.yml`, replacing the placeholders. Route only the dedicated gateway hostname to port `20128`; do not expose unrelated local services through this tunnel.

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /home/<YOUR_LINUX_USER>/.cloudflared/<TUNNEL_UUID>.json

ingress:
  - hostname: omniroute-api.example.com
    service: http://127.0.0.1:20128
    originRequest:
      connectTimeout: 30s
  - service: http_status:404
```

Cloudflare evaluates ingress rules in order and requires a final catch-all rule. Validate the file before exposing it. [3]

```bash
cloudflared tunnel ingress validate
cloudflared tunnel route dns omniroute-axis omniroute-api.example.com
cloudflared tunnel run omniroute-axis
```

In a separate terminal, check the **public** URL while retaining the Bearer authorization header:

```bash
curl --fail-with-body \
  -H "Authorization: Bearer <OMNIROUTE_KEY>" \
  https://omniroute-api.example.com/v1/models
```

The response must be authorized, not merely reachable. Never rely on hostname obscurity as access control.

## Make the tunnel survive reboots on Linux

After the named tunnel and `config.yml` work interactively, install the official service and verify it is running. The configuration must include the tunnel UUID and credential file. [4]

```bash
cloudflared service install
sudo systemctl start cloudflared
sudo systemctl status cloudflared --no-pager

# After a future config change:
sudo systemctl restart cloudflared
```

Keep the owner machine powered, connected to the internet, and running both OmniRoute and `cloudflared`. The machine is the origin; a tunnel does not make a stopped local gateway available.

## Connect AXIS only after public authorization succeeds

Once the public command succeeds, set the following as **server-only** AXIS configuration through the project secret prompt:

| AXIS setting | Value |
|---|---|
| `OMNIROUTE_BASE_URL` | `https://omniroute-api.example.com/v1` |
| `OMNIROUTE_API_KEY` | The valid, rotated OmniRoute Bearer key |

Then run the guarded AXIS credential probe:

```bash
RUN_OMNIROUTE_CREDENTIAL_CHECK=true \
pnpm vitest run server/omniRouteCredential.test.ts
```

Do not enable paid-provider routing while the no-billing policy is active. The tunnel only provides secure reachability; it does not change AXIS provider policy or billing safeguards.

## Troubleshooting

| Symptom | Most likely cause | Correct next step |
|---|---|---|
| Local `/v1/models` returns `401` | Invalid, inactive, or malformed OmniRoute key | Rotate the key in OmniRoute first; retest locally before changing the tunnel. |
| Public URL returns `404` | Hostname or ingress rule mismatch | Run `cloudflared tunnel ingress validate`, check the DNS route, then review the hostname in `config.yml`. |
| AXIS chat opens but streaming fails | Quick Tunnel was used or origin/tunnel is unstable | Switch to the named tunnel flow; Quick Tunnels do not support SSE. [1] |
| AXIS probe cannot connect | Owner machine, OmniRoute, or `cloudflared` is offline | Check `systemctl status cloudflared`, then repeat the local and public `/v1/models` checks. |

## References

[1]: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/ "Cloudflare Quick Tunnels"
[2]: https://developers.cloudflare.com/tunnel/advanced/local-management/create-local-tunnel/ "Cloudflare locally managed tunnel setup"
[3]: https://developers.cloudflare.com/tunnel/advanced/local-management/configuration-file/ "Cloudflare tunnel configuration file"
[4]: https://developers.cloudflare.com/tunnel/advanced/local-management/as-a-service/linux/ "Cloudflare Tunnel as a Linux service"
