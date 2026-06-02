/**
 * GET /api/files/finals/:payload
 *
 * Serves private final files from the mock storage bucket.
 * The :payload parameter is a base64url-encoded JSON object containing:
 *   { path: string, exp: number (Unix ms timestamp) }
 *
 * This route is only called when a real file was uploaded (i.e. the
 * finalFileUrl starts with "finals://"). Mock/legacy projects that
 * never uploaded a file will never hit this route.
 *
 * When connected to real Supabase Storage, this entire route is replaced
 * by the Supabase-generated signed URL — no equivalent route is needed.
 */

import path from 'path';
import fs from 'fs';
import mime from 'mime';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ payload: string }> }
) {
  const { payload } = await params;

  // ── Decode and validate the signed payload ────────────────────────────────
  let decoded: { path: string; exp: number };
  try {
    decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      path: string;
      exp: number;
    };
  } catch {
    return new Response('Invalid download link.', { status: 400 });
  }

  if (!decoded?.path || !decoded?.exp) {
    return new Response('Malformed download link.', { status: 400 });
  }

  if (decoded.exp < Date.now()) {
    return new Response('Download link has expired.', { status: 403 });
  }

  // Prevent path traversal
  const filename = path.basename(decoded.path);
  const filePath = path.join(process.cwd(), 'storage', 'finals', filename);

  if (!fs.existsSync(filePath)) {
    return new Response('File not found.', { status: 404 });
  }

  // ── Stream the file ───────────────────────────────────────────────────────
  const buffer = fs.readFileSync(filePath);
  const contentType =
    (mime as unknown as { getType: (f: string) => string | null }).getType(filename) ??
    'application/octet-stream';

  return new Response(buffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
