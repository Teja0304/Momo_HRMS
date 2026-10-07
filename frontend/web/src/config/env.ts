/** Base URL of the auth-service (see .env.example). */
const rawUrl = import.meta.env.VITE_API_URL as string | undefined;
export const API_URL: string = (rawUrl ?? 'http://localhost:3001/api/v1').replace(/\/+$/, '');

const rawEmployeeUrl = import.meta.env.VITE_EMPLOYEE_API_URL as string | undefined;
export const EMPLOYEE_API_URL: string = (rawEmployeeUrl ?? 'http://localhost:3004/api/v1').replace(/\/+$/, '');

/** Primary API Gateway entry point for microservices (port 8000). */
const rawGatewayUrl = import.meta.env.VITE_GATEWAY_URL as string | undefined;
export const GATEWAY_API_URL: string = (rawGatewayUrl ?? 'http://localhost:8000/api/v1').replace(/\/+$/, '');

const rawAttendanceUrl = import.meta.env.VITE_ATTENDANCE_API_URL as string | undefined;
export const ATTENDANCE_API_URL: string = (rawAttendanceUrl ?? `${GATEWAY_API_URL}/attendance`).replace(/\/+$/, '');

const rawGeofenceUrl = import.meta.env.VITE_GEOFENCE_API_URL as string | undefined;
export const GEOFENCE_API_URL: string = (rawGeofenceUrl ?? `${GATEWAY_API_URL}`).replace(/\/+$/, '');

const rawNotificationUrl = import.meta.env.VITE_NOTIFICATION_API_URL as string | undefined;
export const NOTIFICATION_API_URL = (rawNotificationUrl ?? `${GATEWAY_API_URL}/notifications`).replace(/\/+$/, '');

export const COMPANY_NAME = 'Momo HRMS';
export const COMPANY_DOMAIN: string = (import.meta.env.VITE_COMPANY_DOMAIN as string | undefined) || 'company.com';
export const INTERN_DOMAIN: string = (import.meta.env.VITE_INTERN_DOMAIN as string | undefined) || 'company.in';
