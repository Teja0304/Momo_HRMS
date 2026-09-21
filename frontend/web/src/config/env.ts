/** Base URL of the auth-service (see .env.example). */
const rawUrl = import.meta.env.VITE_API_URL as string | undefined;

export const API_URL: string = (rawUrl ?? 'http://localhost:3001/api/v1').replace(/\/+$/, '');

export const COMPANY_NAME = 'Momo HRMS';
