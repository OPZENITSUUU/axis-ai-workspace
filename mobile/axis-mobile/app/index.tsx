import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { AXIS_WEB_URL } from "../src/config";

type AndroidPermissionRequest = {
  resources: string[];
  grant: (resources: string[]) => void;
};

export default function AxisMobileHome() {
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar style="light" />
      <WebView
        key={reloadKey}
        source={{ uri: AXIS_WEB_URL }}
        originWhitelist={["https://*"]}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        onPermissionRequest={(request: AndroidPermissionRequest) => request.grant(request.resources)}
        startInLoadingState
        renderLoading={() => <LoadingState />}
        renderError={() => <ErrorState onRetry={() => setReloadKey((value) => value + 1)} />}
      />
    </SafeAreaView>
  );
}

function LoadingState() {
  return (
    <View style={styles.state}>
      <View style={styles.mark}><Text style={styles.markText}>✦</Text></View>
      <Text style={styles.title}>AXIS</Text>
      <ActivityIndicator color="#d7fa8a" style={styles.spinner} />
      <Text style={styles.detail}>Opening your private workspace…</Text>
    </View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.state}>
      <Text style={styles.title}>AXIS needs a connection</Text>
      <Text style={styles.detail}>Check your internet connection, then reopen the app. Your private data remains in your AXIS account.</Text>
      <Pressable onPress={onRetry} style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}>
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#20231d" },
  state: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: "#20231d" },
  mark: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#d7fa8a" },
  markText: { color: "#20231d", fontSize: 20, fontWeight: "700" },
  title: { marginTop: 18, color: "#f6f6f0", fontSize: 20, fontWeight: "700", letterSpacing: 2 },
  spinner: { marginTop: 18 },
  detail: { marginTop: 14, color: "#c7cbc2", fontSize: 14, lineHeight: 21, textAlign: "center" },
  retry: { marginTop: 24, borderRadius: 12, backgroundColor: "#d7fa8a", paddingHorizontal: 18, paddingVertical: 12 },
  retryPressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  retryText: { color: "#20231d", fontSize: 14, fontWeight: "700" }
});
