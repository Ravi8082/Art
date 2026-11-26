import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const refreshTokenKey = 'haat-of-art.refresh-token';
let accessToken: string | null = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export async function getRefreshToken() {
  if (Platform.OS === 'web') return null;
  return SecureStore.getItemAsync(refreshTokenKey);
}

export async function setRefreshToken(token: string) {
  if (Platform.OS === 'web') return;
  await SecureStore.setItemAsync(refreshTokenKey, token);
}

export async function clearStoredTokens() {
  accessToken = null;
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(refreshTokenKey);
}
