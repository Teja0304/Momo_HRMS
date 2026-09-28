/** Base URL of the auth-service (see .env.example). */
const rawUrl = import.meta.env.VITE_API_URL as string | undefined;

export const API_URL: string = (rawUrl ?? 'http://localhost:3001/api/v1').replace(/\/+$/, '');

const rawEmployeeUrl = import.meta.env.VITE_EMPLOYEE_API_URL as string | undefined;
export const EMPLOYEE_API_URL: string = (rawEmployeeUrl ?? 'http://localhost:5000/api/v1').replace(/\/+$/, '');

/** Primary API Gateway entry point for microservices (port 8000). */
const rawGatewayUrl = import.meta.env.VITE_GATEWAY_URL as string | undefined;
export const GATEWAY_API_URL: string = (rawGatewayUrl ?? 'http://localhost:8000/api/v1').replace(/\/+$/, '');

export const ATTENDANCE_API_URL = `${GATEWAY_API_URL}/attendance`;
export const GEOFENCE_API_URL = `${GATEWAY_API_URL}`;
export const NOTIFICATION_API_URL = `${GATEWAY_API_URL}/notifications`;

export const COMPANY_NAME = 'Momo HRMS';

