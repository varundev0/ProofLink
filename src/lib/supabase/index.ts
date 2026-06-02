/**
 * Supabase exports for ProofLink.
 *
 * Clients are created per-request (not as singletons) so they always
 * carry the correct session context:
 *
 *   import { createSupabaseServerClient } from '@/lib/supabase/server'
 *   → user-authenticated client for routes that need to know who is signed in
 *
 *   import { createSupabaseServiceClient } from '@/lib/supabase/service'
 *   → service-role client for payment / webhook routes (bypasses RLS)
 */

export type { Project, Profile, ProjectStatus, DownloadToken } from './database.types';
