import Constants from "expo-constants";
import { Platform } from "react-native";

const REMOTE_API_URL = "http://159.65.8.220/api-proxy";
const LOCAL_FALLBACK_API_URL = "http://127.0.0.1:4000";

const getDevHost = (): string | null => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.hostUri ||
    Constants.manifest?.debuggerHost ||
    (Constants as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } })
      .manifest2?.extra?.expoGo?.debuggerHost;

  if (!hostUri) return null;
  const withoutScheme = hostUri.replace(/^[^/]+:\/\//, "");
  return withoutScheme.split(":")[0] || null;
};

const getDefaultApiUrl = () => {
  // Use local backend by default. Set EXPO_PUBLIC_USE_LOCAL_API=false to force remote.
  if (process.env.EXPO_PUBLIC_USE_LOCAL_API === "false") {
    return REMOTE_API_URL;
  }

  const devHost = getDevHost();
  if (devHost) {
    return `http://${devHost}:4000`;
  }

  if (__DEV__ && Platform.OS === "android") {
    return "http://10.0.2.2:4000";
  }

  return LOCAL_FALLBACK_API_URL;
};

export const API_URL =
  (process.env.EXPO_PUBLIC_API_URL?.trim() || getDefaultApiUrl()).replace(
    /\/$/,
    ""
  );
