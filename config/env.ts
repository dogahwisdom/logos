/**
 * Base URL for API requests. Empty string = same origin.
 * Set VITE_API_URL in production when the API is hosted elsewhere (e.g. Render).
 */
export const apiBase = (import.meta.env.VITE_API_URL as string)?.trim() || '';
