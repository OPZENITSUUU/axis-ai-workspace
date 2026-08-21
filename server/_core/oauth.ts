import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE, decodeOAuthState } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import { createHash, randomBytes, randomUUID } from "crypto";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

const MOBILE_CALLBACK_PATH = "/api/mobile/oauth/callback";
const MOBILE_EXCHANGE_PATH = "/api/mobile/oauth/exchange";
const MOBILE_RETURN_URL = "axis://oauth";
const MOBILE_HANDOFF_TTL_MS = 5 * 60 * 1000;

const handoffHash = (value: string) => createHash("sha256").update(value).digest("hex");

function publicOrigin(req: Request) {
  return `${req.protocol}://${req.get("host")}`;
}

function setOAuthNonce(res: Response, nonce: string) {
  res.cookie(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    path: "/",
    secure: true,
    sameSite: "none",
    maxAge: 10 * 60 * 1000,
  });
}

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/mobile/oauth/start", (req: Request, res: Response) => {
    const callbackUri = `${publicOrigin(req)}${MOBILE_CALLBACK_PATH}`;
    const nonce = randomUUID();
    const state = Buffer.from(JSON.stringify({ redirectUri: callbackUri, nonce })).toString("base64");
    const portal = new URL(`${ENV.oAuthPortalUrl}/app-auth`);
    portal.searchParams.set("appId", ENV.appId);
    portal.searchParams.set("redirectUri", callbackUri);
    portal.searchParams.set("state", state);
    portal.searchParams.set("type", "signIn");
    setOAuthNonce(res, nonce);
    res.redirect(302, portal.toString());
  });

  app.get(MOBILE_CALLBACK_PATH, async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const callbackUri = `${publicOrigin(req)}${MOBILE_CALLBACK_PATH}`;
    if (!code || !state) return res.status(400).send("AXIS sign-in could not be completed.");

    const decoded = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (decoded.redirectUri !== callbackUri || !decoded.nonce || decoded.nonce !== expectedNonce) {
      return res.status(403).send("AXIS sign-in could not be verified. Please return to AXIS and try again.");
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) return res.status(400).send("AXIS account information is unavailable.");
      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });
      const user = await db.getUserByOpenId(userInfo.openId);
      if (!user) return res.status(500).send("AXIS could not create your private workspace.");

      const handoff = randomBytes(32).toString("base64url");
      await db.createMobileAuthHandoff(user.id, handoffHash(handoff), new Date(Date.now() + MOBILE_HANDOFF_TTL_MS));
      res.redirect(302, `${MOBILE_RETURN_URL}?handoff=${encodeURIComponent(handoff)}`);
    } catch (error) {
      console.error("[OAuth] Mobile callback failed", error);
      res.status(500).send("AXIS sign-in could not be completed. Return to the app and try again.");
    }
  });

  app.post(MOBILE_EXCHANGE_PATH, async (req: Request, res: Response) => {
    const handoff = typeof req.body?.handoff === "string" ? req.body.handoff : "";
    if (!/^[A-Za-z0-9_-]{32,}$/.test(handoff)) return res.status(400).json({ error: "invalid mobile handoff" });
    const consumed = await db.consumeMobileAuthHandoff(handoffHash(handoff));
    if (!consumed) return res.status(401).json({ error: "expired or consumed mobile handoff" });
    const user = await db.getUserById(consumed.userId);
    if (!user) return res.status(401).json({ error: "mobile user unavailable" });
    const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || "", expiresInMs: ONE_YEAR_MS });
    res.json({ sessionToken });
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // CSRF guard: the nonce in `state` must match the one-time cookie that
    // startLogin set in the browser that began this login. An attacker can
    // forge `state`, but cannot plant this cookie in the victim's browser.
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
