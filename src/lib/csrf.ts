/**
 * CSRF protection — origin check for cookie-authenticated routes.
 *
 * Browsers always send an Origin header on cross-site requests. Checking it
 * against NEXT_PUBLIC_APP_URL blocks cross-site form submissions and XHR
 * from attacker-controlled pages, while still allowing same-origin fetches.
 */

export function verifySameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  // If APP_URL is not set (local dev without the var), allow through.
  // In production NEXT_PUBLIC_APP_URL must be set.
  if (!appUrl) return true;

  // Requests without an Origin header come from same-origin navigation or
  // server-to-server calls — allow them.
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}
