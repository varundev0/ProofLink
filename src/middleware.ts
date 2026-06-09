/**
 * Next.js Middleware entry point.
 * Delegates to src/proxy.ts which handles session refresh and rate limiting.
 */
export { proxy as middleware, config } from './proxy';
