/**
 * Token storage for the WEB app.
 *
 * The backend returns tokens in the JSON body (it does not set HttpOnly cookies),
 * so the browser has to hold them:
 *  - access token (15 minutes)  -> JavaScript memory only
 *  - refresh token              -> sessionStorage (survives a page reload, cleared when the tab closes)
 * Passwords are never stored anywhere.
 *
 * If you later add HttpOnly cookie support to the backend, replace this file
 * (and the /auth/refresh call) - nothing else in the app needs to change.
 */
const REFRESH_TOKEN_KEY = 'hrms_refresh_token';

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    return window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function saveTokens(newAccessToken: string, newRefreshToken: string): Promise<void> {
  accessToken = newAccessToken;
  try {
    window.sessionStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
  } catch {
    /* storage blocked: the session will simply not survive a reload */
  }
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  try {
    window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
