/**
 * Tests for POST /api/razorpay/verify
 *
 * Mocks Supabase service client to test business logic in isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockProject = {
  projectId: 'PRJ-TEST',
  freelancerEmail: 'freelancer@test.com',
  freelancerId: 'user-123',
  title: 'Test Project',
  amount: 500,
  status: 'pending',
};

const mockSingle = vi.fn();
const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockRpc = vi.fn().mockResolvedValue({ error: null });
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/lib/supabase/service', () => ({
  createSupabaseServiceClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: mockSingle,
        }),
      }),
      update: mockUpdate,
      upsert: mockUpsert,
      insert: mockInsert,
    }),
    rpc: mockRpc,
  }),
}));

vi.mock('@/lib/email', () => ({
  sendPaymentReceivedToFreelancer: vi.fn().mockResolvedValue(undefined),
  sendPaymentConfirmationToBuyer: vi.fn().mockResolvedValue(undefined),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/razorpay/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: mockProject, error: null });
  });

  it('returns 400 when projectId is missing', async () => {
    const { POST } = await import('@/app/api/razorpay/verify/route');
    const req = new Request('http://localhost/api/razorpay/verify', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 409 when project is already paid', async () => {
    mockSingle.mockResolvedValueOnce({ data: { ...mockProject, status: 'paid' }, error: null });
    const { POST } = await import('@/app/api/razorpay/verify/route');
    const req = new Request('http://localhost/api/razorpay/verify', {
      method: 'POST',
      body: JSON.stringify({ projectId: 'PRJ-TEST', razorpayOrderId: 'mock_order_PRJ-TEST' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid HMAC signature', async () => {
    const { POST } = await import('@/app/api/razorpay/verify/route');
    const req = new Request('http://localhost/api/razorpay/verify', {
      method: 'POST',
      body: JSON.stringify({
        projectId: 'PRJ-TEST',
        razorpayOrderId: 'order_123',
        razorpayPaymentId: 'pay_123',
        razorpaySignature: 'bad-signature',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('signature');
  });

  it('accepts valid HMAC signature and returns success', async () => {
    const orderId = 'order_123';
    const paymentId = 'pay_123';
    const secret = 'test-razorpay-secret';
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    // Second call for fetching existing token
    mockSingle
      .mockResolvedValueOnce({ data: mockProject, error: null })
      .mockResolvedValueOnce({ data: { token: 'existing-token' }, error: null });

    const { POST } = await import('@/app/api/razorpay/verify/route');
    const req = new Request('http://localhost/api/razorpay/verify', {
      method: 'POST',
      body: JSON.stringify({
        projectId: 'PRJ-TEST',
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: validSignature,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.downloadToken).toBeDefined();
  });

  it('accepts mock order when no real keys present (dev mode)', async () => {
    const originalSecret = process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_KEY_SECRET;

    mockSingle
      .mockResolvedValueOnce({ data: mockProject, error: null })
      .mockResolvedValueOnce({ data: { token: 'mock-token' }, error: null });

    const { POST } = await import('@/app/api/razorpay/verify/route');
    const req = new Request('http://localhost/api/razorpay/verify', {
      method: 'POST',
      body: JSON.stringify({ projectId: 'PRJ-TEST', razorpayOrderId: 'mock_order_PRJ-TEST' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    process.env.RAZORPAY_KEY_SECRET = originalSecret;
  });
});
