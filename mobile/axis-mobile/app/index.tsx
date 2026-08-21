import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView, { type WebViewNavigation } from "react-native-webview";
import { AXIS_WEB_URL } from "../src/config";

const ANDROID_AUDIO_CAPTURE = "android.webkit.resource.AUDIO_CAPTURE";

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
  const [updateState, setUpdateState] = useState<"idle" | "downloading" | "restarting">("idle");
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

  const retryWorkspace = () => {
    setLoadError(false);
    setIsLoading(true);
    setReloadKey((value) => value + 1);
  };

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
        <ErrorState onRetry={retryWorkspace} />
      ) : (
        <WebView<{}>
          ref={webViewRef}
          key={reloadKey}
          source={{ uri: AXIS_WEB_URL }}
          originWhitelist={["https://*"]}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          onNavigationStateChange={handleNavigationChange}
          {...androidPermissionProps}
          onLoadStart={() => {
            setIsLoading(true);
            setLoadError(false);
          }}
          onLoadEnd={() => setIsLoading(false)}
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

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.state}>
      <Text style={styles.title}>AXIS needs a connection</Text>
      <Text style={styles.detail}>The private workspace could not be reached. Check your internet connection, then try again.</Text>
      <Text style={styles.caption}>Nothing is stored in this app while it reconnects.</Text>
      <Pressable onPress={onRetry} style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}>
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#060914" },
  updateBanner: { position: "absolute", zIndex: 2, top: 12, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, backgroundColor: "#85dfb9", paddingHorizontal: 14, paddingVertical: 9, shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  updateText: { color: "#060914", fontSize: 12, fontWeight: "700" },
  state: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: "#060914" },
  mark: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#85dfb9" },
  markText: { color: "#060914", fontSize: 21, fontWeight: "700" },
  title: { marginTop: 18, color: "#f5f7fb", fontSize: 20, fontWeight: "700", letterSpacing: 2 },
  spinner: { marginTop: 18 },
  detail: { marginTop: 14, color: "#c7d0dd", fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 300 },
  caption: { marginTop: 8, color: "#8290a4", fontSize: 12, lineHeight: 18, textAlign: "center", maxWidth: 292 },
  retry: { marginTop: 24, borderRadius: 12, backgroundColor: "#85dfb9", paddingHorizontal: 18, paddingVertical: 12 },
  retryPressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  retryText: { color: "#060914", fontSize: 14, fontWeight: "700" }
});
