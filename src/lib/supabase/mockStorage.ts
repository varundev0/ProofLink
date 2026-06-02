/**
 * Mock Supabase Storage.
 *
 * Mirrors the @supabase/supabase-js storage API:
 *   storage.from('proofs').upload(path, buffer)
 *   storage.from('proofs').getPublicUrl(path)
 *   storage.from('finals').upload(path, buffer)
 *   storage.from('finals').download(path)
 *
 * Proof files  → public/uploads/proofs/   (served at /uploads/proofs/<file>)
 * Final files  → storage/finals/          (private; served through the download API)
 *
 * ─── To connect real Supabase Storage ─────────────────────────────────────
 * Replace `storage.from(...)` calls in the API routes with:
 *   supabase.storage.from('proofs').upload(path, file)
 *   supabase.storage.from('finals').createSignedUrl(path, 3600)
 * ─────────────────────────────────────────────────────────────────────────
 */

import fs from 'fs';
import path from 'path';

const BUCKETS: Record<string, string> = {
  proofs: path.join(process.cwd(), 'public', 'uploads', 'proofs'),
  finals: path.join(process.cwd(), 'storage', 'finals'),
};

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

type StorageError = { message: string };
type UploadResult = { data: { path: string } | null; error: StorageError | null };
type DownloadResult = { data: Buffer | null; error: StorageError | null };
type PublicUrlResult = { data: { publicUrl: string } };
type SignedUrlResult = { data: { signedUrl: string } | null; error: StorageError | null };

class BucketClient {
  constructor(private readonly bucket: string) {}

  private get dir(): string {
    const dir = BUCKETS[this.bucket];
    if (!dir) throw new Error(`Unknown bucket: ${this.bucket}`);
    return dir;
  }

  /**
   * Save a file buffer to the bucket.
   * Mirrors: supabase.storage.from(bucket).upload(path, file)
   */
  async upload(filePath: string, buffer: Buffer): Promise<UploadResult> {
    try {
      ensureDir(this.dir);
      fs.writeFileSync(path.join(this.dir, filePath), buffer);
      return { data: { path: filePath }, error: null };
    } catch (err) {
      return { data: null, error: { message: (err as Error).message } };
    }
  }

  /**
   * Get the public URL for a file (proofs only).
   * Mirrors: supabase.storage.from('proofs').getPublicUrl(path)
   */
  getPublicUrl(filePath: string): PublicUrlResult {
    return {
      data: { publicUrl: `/uploads/proofs/${filePath}` },
    };
  }

  /**
   * Create a time-limited signed URL for private files (finals).
   * The expiry and file path are embedded in the URL as a base64url payload
   * so the file-serving route can validate them without a DB lookup.
   * Mirrors: supabase.storage.from('finals').createSignedUrl(path, expiresIn)
   */
  createSignedUrl(filePath: string, expiresIn: number): SignedUrlResult {
    const payload = Buffer.from(
      JSON.stringify({ path: filePath, exp: Date.now() + expiresIn * 1000 })
    ).toString('base64url');
    return {
      data: { signedUrl: `/api/files/finals/${payload}` },
      error: null,
    };
  }

  /**
   * Read a file from the bucket (used server-side to serve final files).
   * Mirrors: supabase.storage.from('finals').download(path)
   */
  async download(filePath: string): Promise<DownloadResult> {
    try {
      const fullPath = path.join(this.dir, filePath);
      if (!fs.existsSync(fullPath)) {
        return { data: null, error: { message: 'File not found' } };
      }
      const buffer = fs.readFileSync(fullPath);
      return { data: buffer, error: null };
    } catch (err) {
      return { data: null, error: { message: (err as Error).message } };
    }
  }
}

export const createMockStorageClient = () => ({
  from: (bucket: string) => new BucketClient(bucket),
});
