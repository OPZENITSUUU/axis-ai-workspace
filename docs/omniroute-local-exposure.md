# Connecting a Local OmniRoute Gateway to AXIS

AXIS is cloud-hosted, so it cannot call `localhost` or `127.0.0.1` on the owner’s computer. Those addresses work only within the computer running OmniRoute.

## Recommended path: a named HTTPS tunnel

Run a persistent, owner-controlled tunnel from the same computer that runs OmniRoute. A named Cloudflare Tunnel maps a public hostname, such as `https://omni.example.com`, to the local service `http://localhost:20128`.

1. Confirm OmniRoute is responding locally:

   ```bash
   curl http://localhost:20128/v1/models
   ```

2. Install and configure a named Cloudflare Tunnel in the Cloudflare dashboard. Create a published hostname and route it to:

   ```text
   http://localhost:20128
   ```

3. Keep the tunnel process running on the same computer as OmniRoute. The computer and OmniRoute process must remain online for AXIS chat to work.

4. Confirm the gateway is publicly reachable from a different network:

   ```bash
   curl https://omni.example.com/v1/models \
     -H "Authorization: Bearer YOUR_GATEWAY_TOKEN"
   ```

5. Configure AXIS with the base path only:

   ```text
   OMNIROUTE_BASE_URL=https://omni.example.com/v1
   OMNIROUTE_API_KEY=YOUR_GATEWAY_TOKEN
   ```

AXIS adds `/chat/completions` itself and sends the token as a server-side Bearer credential.

## Do not use a Quick Tunnel for AXIS chat

Cloudflare Quick Tunnels are for development testing and do not support Server-Sent Events. AXIS consumes streaming chat responses, so use a named tunnel with a stable HTTPS hostname instead.

## Security checklist

- Require the gateway token for both `/v1/models` and `/v1/chat/completions`.
- Do not expose the gateway without authentication.
- Rotate any gateway token that was pasted into a public or shared conversation.
- Keep `ALLOW_PAID_PROVIDERS` disabled in AXIS unless the owner deliberately changes the no-billing policy.
