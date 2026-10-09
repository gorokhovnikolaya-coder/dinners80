/** Base URL of the backend API: `/api` on our own domain (nginx proxies it to the Node server). */
export const API_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');
