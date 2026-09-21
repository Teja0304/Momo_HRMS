import * as SecureStore from 'expo-secure-store';

/**
 * Token storage for the MOBILE app.
 *  - refresh token (long lived)  -> Expo SecureStore (Keychain / Keystore, encrypted)
 *  - access token (15 minutes)   -> memory only, never written to disk
 * Passwords are never stored anywhere.
 */
const REFRESH_TOKEN_KEY = 'hrms_refresh_token';

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function saveTokens(newAccessToken: string, newRefreshToken: string): Promise<void> {
  accessToken = newAccessToken;
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, newRefreshToken);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
