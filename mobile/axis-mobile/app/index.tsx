import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import * as Updates from "expo-updates";
import * as WebBrowser from "expo-web-browser";
import { type ComponentProps, useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView, { type WebViewNavigation } from "react-native-webview";
import { AXIS_WEB_URL } from "../src/config";
import { axisMobileTheme, editorialTokens } from "../src/theme";

const ANDROID_AUDIO_CAPTURE = "android.webkit.resource.AUDIO_CAPTURE";
const SESSION_STORAGE_KEY = "manus-cookie";
const SESSION_COOKIE_NAME = "app_session_id";

WebBrowser.maybeCompleteAuthSession();

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

type AndroidPermissionRequest = {
  resources: string[];
  grant: (resources: string[]) => void;
};

export default function AxisMobileHome() {
  const webViewRef = useRef<WebView<{}>>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [mobileSession, setMobileSession] = useState<string | null>(null);
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [updateState, setUpdateState] = useState<"idle" | "downloading" | "restarting">("idle");
  const pendingNotificationUrlRef = useRef<string | null>(null);
  const { isUpdateAvailable, isUpdatePending } = Updates.useUpdates();

  useEffect(() => {
    if (!Updates.isEnabled) return;

    if (isUpdatePending) {
      setUpdateState("restarting");
      void Updates.reloadAsync().catch(() => setUpdateState("idle"));
      return;
    }

    if (!isUpdateAvailable) return;

    let active = true;
    setUpdateState("downloading");
    void Updates.fetchUpdateAsync()
      .then(() => {
        if (active) setUpdateState("restarting");
      })
      .catch(() => {
        if (active) setUpdateState("idle");
      });

    return () => {
      active = false;
    };
  }, [isUpdateAvailable, isUpdatePending]);

  useEffect(() => {
    if (updateState !== "restarting" || !Updates.isEnabled) return;
    const reloadTimer = setTimeout(() => {
      void Updates.reloadAsync().catch(() => setUpdateState("idle"));
    }, 650);
    return () => clearTimeout(reloadTimer);
  }, [updateState]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack) return false;
      webViewRef.current?.goBack();
      return true;
    });

    return () => subscription.remove();
  }, [canGoBack]);

  const postToWorkspace = useCallback((payload: Record<string, unknown>) => {
    webViewRef.current?.postMessage(JSON.stringify(payload));
  }, []);

  const forwardNotificationUrl = useCallback((url: unknown) => {
    if (typeof url !== "string" || !url.startsWith("/")) return;
    pendingNotificationUrlRef.current = url;
    postToWorkspace({ type: "axis-notification-open", url });
  }, [postToWorkspace]);

  useEffect(() => {
    const initial = Notifications.getLastNotificationResponse();
    forwardNotificationUrl(initial?.notification.request.content.data?.url);
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      forwardNotificationUrl(response.notification.request.content.data?.url);
    });
    return () => responseListener.remove();
  }, [forwardNotificationUrl]);

  const requestPushPermission = useCallback(async () => {
    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("axis-tasks", {
          name: "AXIS task updates",
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 180, 90, 180],
          lightColor: "#85dfb9",
        });
      }
      const current = await Notifications.getPermissionsAsync();
      const permission = current.status === "granted" ? current : await Notifications.requestPermissionsAsync();
      if (permission.status !== "granted") {
        postToWorkspace({ type: "axis-expo-push-error", message: "Notification permission was not granted." });
        return;
      }
      const configuredProjectId = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;
      const projectId = configuredProjectId ?? Constants.easConfig?.projectId;
      if (!projectId) throw new Error("AXIS notification project is unavailable.");
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      postToWorkspace({ type: "axis-expo-push-token", token });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Android notifications could not be enabled.";
      postToWorkspace({ type: "axis-expo-push-error", message });
      Alert.alert("AXIS notifications", "Notifications could not be enabled on this device yet.");
    }
  }, [postToWorkspace]);

  const retryWorkspace = () => {
    setLoadError(false);
    setIsLoading(true);
    setReloadKey((value) => value + 1);
  };

  const beginSecureSignIn = useCallback(async () => {
    if (signInBusy) return;
    setSignInBusy(true);
    setSignInError(null);
    try {
      const result = await WebBrowser.openAuthSessionAsync(`${AXIS_WEB_URL}/api/mobile/oauth/start`, Linking.createURL("oauth"));
      if (result.type !== "success") throw new Error("Sign-in was cancelled before it could finish.");
      const handoff = new URL(result.url).searchParams.get("handoff");
      if (!handoff) throw new Error("AXIS did not receive a secure sign-in handoff.");
      const response = await fetch(`${AXIS_WEB_URL}/api/mobile/oauth/exchange`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handoff }),
      });
      const payload = await response.json() as { sessionToken?: string; error?: string };
      if (!response.ok || !payload.sessionToken) throw new Error(payload.error || "AXIS could not finish secure sign-in.");
      setMobileSession(payload.sessionToken);
      setLoadError(false);
      setIsLoading(true);
      setReloadKey(value => value + 1);
    } catch (error) {
      setSignInError(error instanceof Error ? error.message : "AXIS sign-in could not be completed.");
      setLoadError(true);
    } finally {
      setSignInBusy(false);
    }
  }, [signInBusy]);

  const handleWorkspaceMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type?: string };
      if (message.type === "axis-request-expo-push") void requestPushPermission();
      if (message.type === "axis-mobile-login") void beginSecureSignIn();
    } catch {
      // Ignore malformed messages from the hosted workspace.
    }
  }, [beginSecureSignIn, requestPushPermission]);

  const handleNavigationChange = (navigation: WebViewNavigation) => {
    setCanGoBack(navigation.canGoBack);
  };

  const grantPrivateVoicePermission = (request: AndroidPermissionRequest) => {
    const audioResources = request.resources.filter((resource) => resource === ANDROID_AUDIO_CAPTURE);
    request.grant(audioResources);
  };

  // `onPermissionRequest` is available in Android's runtime WebView but absent
  // from the installed package's cross-platform declaration. Keep the narrow
  // cast isolated so all other WebView props remain type-checked.
  const androidPermissionProps = {
    onPermissionRequest: grantPrivateVoicePermission,
  } as unknown as ComponentProps<typeof WebView<{}>>;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar style="light" />
      {updateState !== "idle" ? <UpdateBanner state={updateState} /> : null}
      {loadError ? (
        <ErrorState
          onRetry={signInError ? beginSecureSignIn : retryWorkspace}
          title={signInError ? "Sign in to AXIS" : undefined}
          detail={signInError ?? undefined}
          retryLabel={signInError ? (signInBusy ? "Opening secure sign-in…" : "Continue securely") : undefined}
        />
      ) : (
        <WebView<{}>
          ref={webViewRef}
          key={reloadKey}
          source={{ uri: AXIS_WEB_URL }}
          originWhitelist={["https://*"]}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          injectedJavaScriptBeforeContentLoaded={mobileSession ? `try { sessionStorage.setItem(${JSON.stringify(SESSION_STORAGE_KEY)}, ${JSON.stringify(`${SESSION_COOKIE_NAME}=${mobileSession}`)}); } catch {} true;` : undefined}
          onNavigationStateChange={handleNavigationChange}
          onMessage={handleWorkspaceMessage}
          {...androidPermissionProps}
          onLoadStart={() => {
            setIsLoading(true);
            setLoadError(false);
          }}
          onLoadEnd={() => {
            setIsLoading(false);
            if (pendingNotificationUrlRef.current) postToWorkspace({ type: "axis-notification-open", url: pendingNotificationUrlRef.current });
          }}
          onError={() => {
            setIsLoading(false);
            setLoadError(true);
          }}
          onHttpError={() => {
            setIsLoading(false);
            setLoadError(true);
          }}
          startInLoadingState
          renderLoading={() => <LoadingState />}
        />
      )}
      {isLoading && !loadError ? <LoadingState /> : null}
    </SafeAreaView>
  );
}

function UpdateBanner({ state }: { state: "downloading" | "restarting" }) {
  const message = state === "downloading" ? "Updating AXIS to the latest version…" : "Latest AXIS version ready. Restarting…";
  return (
    <View pointerEvents="none" style={styles.updateBanner}>
      <ActivityIndicator color="#060914" size="small" />
      <Text style={styles.updateText}>{message}</Text>
    </View>
  );
}

function LoadingState() {
  return (
    <View style={styles.state}>
      <View style={styles.mark}><Text style={styles.markText}>✦</Text></View>
      <Text style={styles.title}>AXIS</Text>
      <ActivityIndicator color="#d7fa8a" style={styles.spinner} />
      <Text style={styles.detail}>Opening your private workspace…</Text>
      <Text style={styles.caption}>Your chats, files, and provider keys stay in your AXIS account.</Text>
    </View>
  );
}

function ErrorState({ onRetry, title = "AXIS needs a connection", detail = "The private workspace could not be reached. Check your internet connection, then try again.", retryLabel = "Try again" }: { onRetry: () => void; title?: string; detail?: string; retryLabel?: string }) {
  return (
    <View style={styles.state}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.detail}>{detail}</Text>
      <Text style={styles.caption}>AXIS opens your normal sign-in page in the browser, then returns here automatically.</Text>
      <Pressable onPress={onRetry} style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}>
        <Text style={styles.retryText}>{retryLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: axisMobileTheme.canvas },
  updateBanner: { position: "absolute", zIndex: 2, top: 12, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, backgroundColor: "#85dfb9", paddingHorizontal: 14, paddingVertical: 9, shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  updateText: { color: "#060914", fontSize: 12, fontWeight: "700" },
  state: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: editorialTokens.spacingCard, backgroundColor: axisMobileTheme.canvas },
  mark: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: editorialTokens.radiusInteractive, backgroundColor: axisMobileTheme.accent },
  markText: { color: axisMobileTheme.accentInk, fontSize: 21, fontWeight: "700" },
  title: { marginTop: editorialTokens.spacingElement, color: axisMobileTheme.text, fontSize: editorialTokens.bodySize, fontWeight: "400", letterSpacing: 0.6 },
  spinner: { marginTop: editorialTokens.spacingElement },
  detail: { marginTop: 14, color: "#c7d0dd", fontSize: editorialTokens.bodySmallSize, lineHeight: 21, textAlign: "center", maxWidth: 300 },
  caption: { marginTop: 8, color: axisMobileTheme.muted, fontSize: editorialTokens.captionSize, lineHeight: 16, letterSpacing: 0.55, textAlign: "center", maxWidth: 292 },
  retry: { marginTop: 24, borderRadius: editorialTokens.radiusInteractive, borderColor: axisMobileTheme.outline, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 12 },
  retryPressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  retryText: { color: axisMobileTheme.accent, fontSize: editorialTokens.bodySmallSize, fontWeight: "700" }
});
