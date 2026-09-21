/** Base URL of the auth-service (see .env.example). */
export const API_URL: string = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1').replace(/\/+$/, '');

export const COMPANY_NAME = 'Momo HRMS';
