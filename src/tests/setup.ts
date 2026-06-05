// Global test setup
// Set required env vars so routes don't throw on missing config
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.RAZORPAY_KEY_SECRET = 'test-razorpay-secret';
process.env.CRON_SECRET = 'test-cron-secret';
