/**
 * Tests for GET /api/projects/:projectId/download
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockProjectSingle = vi.fn();
const mockTokenSingle = vi.fn();
const mockCreateSignedUrl = vi.fn();

let projectSelectChain: { eq: ReturnType<typeof vi.fn> };
let tokenSelectChain: { eq: ReturnType<typeof vi.fn> };

vi.mock('@/lib/supabase/service', () => ({
  createSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table === 'projects') {
        projectSelectChain = {
          eq: vi.fn().mockReturnValue({ single: mockProjectSingle }),
        };
        return { select: () => projectSelectChain };
      }
      if (table === 'download_tokens') {
        tokenSelectChain = {
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: mockTokenSingle }),
          }),
        };
        return { select: () => tokenSelectChain };
      }
      return {};
    },
    storage: {
      from: () => ({ createSignedUrl: mockCreateSignedUrl }),
    },
  }),
}));

const makeRequest = (projectId: string, token: string) =>
  new Request(`http://localhost/api/projects/${projectId}/download?token=${token}`);

const makeParams = (projectId: string) =>
  ({ params: Promise.resolve({ projectId }) } as { params: Promise<{ projectId: string }> });

describe('GET /api/projects/:projectId/download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no token provided', async () => {
    const { GET } = await import('@/app/api/projects/[projectId]/download/route');
    const req = new Request('http://localhost/api/projects/PRJ-TEST/download');
    const res = await GET(req, makeParams('PRJ-TEST'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for pending project', async () => {
    mockProjectSingle.mockResolvedValue({ data: { status: 'pending' }, error: null });
    const { GET } = await import('@/app/api/projects/[projectId]/download/route');
    const res = await GET(makeRequest('PRJ-TEST', 'some-token'), makeParams('PRJ-TEST'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Payment required');
  });

  it('returns 403 for disputed project', async () => {
    mockProjectSingle.mockResolvedValue({ data: { status: 'disputed' }, error: null });
    const { GET } = await import('@/app/api/projects/[projectId]/download/route');
    const res = await GET(makeRequest('PRJ-TEST', 'some-token'), makeParams('PRJ-TEST'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('dispute');
  });

  it('returns 403 for invalid token', async () => {
    mockProjectSingle.mockResolvedValue({ data: { status: 'paid' }, error: null });
    mockTokenSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });
    const { GET } = await import('@/app/api/projects/[projectId]/download/route');
    const res = await GET(makeRequest('PRJ-TEST', 'bad-token'), makeParams('PRJ-TEST'));
    expect(res.status).toBe(403);
  });

  it('returns 403 for expired token on paid project', async () => {
    mockProjectSingle.mockResolvedValue({ data: { status: 'paid' }, error: null });
    mockTokenSingle.mockResolvedValue({
      data: { expiresAt: new Date(Date.now() - 1000).toISOString() },
      error: null,
    });
    const { GET } = await import('@/app/api/projects/[projectId]/download/route');
    const res = await GET(makeRequest('PRJ-TEST', 'expired-token'), makeParams('PRJ-TEST'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('expired');
  });

  it('allows download for released project even with expired token', async () => {
    mockProjectSingle.mockResolvedValue({
      data: { status: 'released', finalFileUrl: 'finals://test-file.zip' },
      error: null,
    });
    mockTokenSingle.mockResolvedValue({
      data: { expiresAt: new Date(Date.now() - 1000).toISOString() }, // expired
      error: null,
    });
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://supabase.co/signed-url' },
      error: null,
    });
    const { GET } = await import('@/app/api/projects/[projectId]/download/route');
    const res = await GET(makeRequest('PRJ-TEST', 'old-token'), makeParams('PRJ-TEST'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.signedUrl).toBe('https://supabase.co/signed-url');
  });

  it('returns signed URL for valid paid project', async () => {
    mockProjectSingle.mockResolvedValue({
      data: { status: 'paid', finalFileUrl: 'finals://file.zip' },
      error: null,
    });
    mockTokenSingle.mockResolvedValue({
      data: { expiresAt: new Date(Date.now() + 3_600_000).toISOString() },
      error: null,
    });
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://supabase.co/signed-url' },
      error: null,
    });
    const { GET } = await import('@/app/api/projects/[projectId]/download/route');
    const res = await GET(makeRequest('PRJ-TEST', 'valid-token'), makeParams('PRJ-TEST'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.signedUrl).toContain('signed-url');
  });
});
