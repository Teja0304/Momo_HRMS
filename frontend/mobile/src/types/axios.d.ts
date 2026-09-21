import 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** Set on a request so the interceptor does NOT try to refresh the token on 401. */
    skipAuthRefresh?: boolean;
    /** Internal flag: this request was already retried once after a refresh. */
    _retry?: boolean;
  }
}
