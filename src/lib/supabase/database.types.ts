/**
 * Database types for ProofLink.
 *
 * These mirror what you'd generate with `supabase gen types typescript`
 * once you connect a real Supabase project.
 */

export type ProjectStatus = 'pending' | 'paid' | 'released' | 'disputed';

export type Project = {
  projectId: string;
  freelancerEmail: string;
  freelancerId?: string; // Auth user ID — populated once auth is in place
  title: string;
  amount: number;
  status: ProjectStatus;
  paidAt?: string;       // ISO timestamp — set when status transitions to 'paid'
  proofFileUrl?: string;
  finalFileUrl?: string; // Private — never sent to the client
};

export type Profile = {
  id: string;
  deal_count: number;
};

export type User = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

export type Session = {
  token: string;
  userId: string;
  expiresAt: string; // ISO timestamp
};

export type DownloadToken = {
  token: string;
  projectId: string;
  expiresAt: string; // ISO timestamp (24h after payment)
};

export type Database = {
  projects: Record<string, Project>;
  profiles: Record<string, Profile>;
  users: Record<string, User>;           // keyed by user.id
  sessions: Record<string, Session>;     // keyed by session.token
  downloadTokens: Record<string, DownloadToken>; // keyed by token
};
