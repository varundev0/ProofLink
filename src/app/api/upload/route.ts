/**
 * POST /api/upload
 *
 * Accepts a multipart/form-data body with:
 *   - file:  File
 *   - type:  'proof' | 'final'
 *
 * Proof files are validated as images, watermarked with Sharp (server-side),
 * and saved to the public proofs bucket as JPEG.
 *
 * Final files are saved as-is to the private finals bucket.
 *
 * Returns: { url: string, name: string }
 */

import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

const ALLOWED_PROOF_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
]);

const MAX_PROOF_SIZE = 20 * 1024 * 1024;  // 20 MB
const MAX_FINAL_SIZE = 100 * 1024 * 1024; // 100 MB

const buildWatermarkSvg = (width: number, height: number): Buffer => {
  const label = 'PROOF — ProofLink';
  const rows: string[] = [];
  const stepX = 340;
  const stepY = 110;
  for (let y = -stepY; y < height + stepY; y += stepY) {
    for (let x = -stepX / 2; x < width + stepX; x += stepX) {
      rows.push(
        `<text transform="rotate(-35,${x},${y})" x="${x}" y="${y}"
          font-family="sans-serif" font-size="22" font-weight="700"
          fill="white" fill-opacity="0.28" letter-spacing="2">${label}</text>`
      );
    }
  }
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${rows.join('\n')}</svg>`
  );
};

const watermarkImage = async (buffer: Buffer): Promise<Buffer> => {
  let sharp: typeof import('sharp') | null = null;
  try {
    sharp = (await import('sharp')).default as unknown as typeof import('sharp');
  } catch {
    console.warn('[upload] sharp not installed — saving proof without watermark.');
    return buffer;
  }
  const image = sharp(buffer);
  const { width = 800, height = 600 } = await image.metadata();
  const watermark = buildWatermarkSvg(width, height);
  return image.composite([{ input: watermark, top: 0, left: 0 }]).jpeg({ quality: 82 }).toBuffer();
};

export async function POST(request: Request) {
  // Auth check uses the user-session client
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const type = formData.get('type') as string | null;

  if (!file || !type || !['proof', 'final'].includes(type)) {
    return NextResponse.json(
      { error: 'Missing file or invalid type (must be "proof" or "final")' },
      { status: 400 }
    );
  }

  // Storage operations use the service client to bypass RLS
  // (the finals bucket has deny-all RLS; proofs bucket requires authenticated role
  //  which the service client satisfies since it bypasses RLS entirely)
  const storage = createSupabaseServiceClient().storage;

  if (type === 'proof') {
    if (!ALLOWED_PROOF_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Proof must be an image file (JPEG, PNG, WebP, GIF, or AVIF).' },
        { status: 415 }
      );
    }
    if (file.size > MAX_PROOF_SIZE) {
      return NextResponse.json({ error: 'Proof image must be under 20 MB.' }, { status: 413 });
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const watermarked = await watermarkImage(inputBuffer);
    const filename = `${uuidv4()}.jpg`;

    const { data, error } = await storage.from('proofs').upload(filename, watermarked, {
      contentType: 'image/jpeg',
    });
    if (error || !data) {
      console.error('[upload] proof storage error:', error);
      return NextResponse.json({ error: 'Failed to store proof file' }, { status: 500 });
    }

    const { data: { publicUrl } } = storage.from('proofs').getPublicUrl(filename);
    return NextResponse.json({ url: publicUrl, name: file.name });

  } else {
    if (file.size > MAX_FINAL_SIZE) {
      return NextResponse.json({ error: 'Final file must be under 100 MB.' }, { status: 413 });
    }

    const ext = path.extname(file.name).toLowerCase() || '.bin';
    const filename = `${uuidv4()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { data, error } = await storage.from('finals').upload(filename, buffer, {
      contentType: file.type || 'application/octet-stream',
    });
    if (error || !data) {
      console.error('[upload] finals storage error:', error);
      return NextResponse.json({ error: 'Failed to store final file' }, { status: 500 });
    }

    return NextResponse.json({ url: `finals://${filename}`, name: file.name });
  }
}
