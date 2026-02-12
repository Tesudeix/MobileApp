import Constants from "expo-constants";
import { Platform } from "react-native";

const DEFAULT_REMOTE_API_URL = "http://tesudeix.com/api";
const DEFAULT_REMOTE_API_FALLBACK = "http://152.42.205.184/api";
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
  // Production-safe default: remote API.
  // Set EXPO_PUBLIC_USE_LOCAL_API=true only when explicitly testing local backend.
  if (process.env.EXPO_PUBLIC_USE_LOCAL_API !== "true") {
    return DEFAULT_REMOTE_API_URL;
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

const hasScheme = (value: string) => /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(value);

const normaliseUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const withScheme = trimmed.startsWith("//")
    ? `http:${trimmed}`
    : hasScheme(trimmed)
      ? trimmed
      : `http://${trimmed.replace(/^\/+/, "")}`;

  return withScheme.replace(/\/+$/, "");
};

export const API_URL =
  normaliseUrl(process.env.EXPO_PUBLIC_API_URL?.trim() || getDefaultApiUrl());

const envFallbacks = (process.env.EXPO_PUBLIC_API_FALLBACK_URLS || "")
  .split(",")
  .map((item) => normaliseUrl(item))
  .filter(Boolean);

export const API_FALLBACK_URLS = [
  ...envFallbacks,
  DEFAULT_REMOTE_API_FALLBACK,
  DEFAULT_REMOTE_API_URL,
].filter((item, index, arr) => Boolean(item) && item !== API_URL && arr.indexOf(item) === index);
