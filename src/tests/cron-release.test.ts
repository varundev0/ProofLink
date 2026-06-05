/**
 * Tests for GET /api/cron/release
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/supabase/service', () => ({
  createSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          lt: mockSelect,
        }),
      }),
      update: () => ({
        in: mockUpdate,
      }),
    }),
  }),
}));

vi.mock('@/lib/email', () => ({
  sendFundsReleasedToFreelancer: vi.fn().mockResolvedValue(undefined),
}));

const makeRequest = (secret = 'test-cron-secret') =>
  new Request('http://localhost/api/cron/release', {
    headers: { Authorization: `Bearer ${secret}` },
  });

describe('GET /api/cron/release', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 for invalid cron secret', async () => {
    const { GET } = await import('@/app/api/cron/release/route');
    const res = await GET(makeRequest('wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('returns released: 0 when no projects are ready', async () => {
    mockSelect.mockResolvedValue({ data: [], error: null });
    const { GET } = await import('@/app/api/cron/release/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.released).toBe(0);
  });

  it('releases eligible projects and returns count', async () => {
    const projects = [
      { projectId: 'PRJ-A', freelancerEmail: 'a@test.com', title: 'Project A', amount: 100 },
      { projectId: 'PRJ-B', freelancerEmail: 'b@test.com', title: 'Project B', amount: 200 },
    ];
    mockSelect.mockResolvedValue({ data: projects, error: null });
    mockUpdate.mockResolvedValue({ error: null });

    const { GET } = await import('@/app/api/cron/release/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.released).toBe(2);
    expect(body.projectIds).toEqual(['PRJ-A', 'PRJ-B']);
  });
});
