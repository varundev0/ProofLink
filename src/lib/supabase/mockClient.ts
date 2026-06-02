/**
 * Mock Supabase client.
 *
 * Implements the same chained query interface as the real @supabase/supabase-js SDK
 * (from(...).select(...).eq(...).single(), insert, update, upsert) but reads/writes
 * from a local JSON file so the app works without a real Supabase project.
 *
 * ─── Swapping to real Supabase ────────────────────────────────────────────────
 * 1. Run: npm install @supabase/supabase-js
 * 2. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local
 * 3. In src/lib/supabase/index.ts, replace createMockSupabaseClient() with:
 *      import { createClient } from '@supabase/supabase-js'
 *      export const supabase = createClient(
 *        process.env.NEXT_PUBLIC_SUPABASE_URL!,
 *        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
 *      )
 * ──────────────────────────────────────────────────────────────────────────────
 */

import fs from 'fs';
import path from 'path';
import { Database } from './database.types';

type TableName = keyof Database;
type Row = Record<string, unknown>;

const DB_PATH = path.join(process.cwd(), 'src/lib/mocks/data.json');

const readDb = (): Database => {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw) as Database;
  } catch {
    return { projects: {}, profiles: {}, users: {}, sessions: {}, downloadTokens: {} };
  }
};

const writeDb = (data: Database): void => {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
};

/** Mimics the Supabase PostgREST response shape: { data, error } */
type SupabaseResponse<T> = Promise<{ data: T | null; error: Error | null }>;

type Operation = 'select' | 'insert' | 'update' | 'upsert';

class QueryBuilder<T extends Row> {
  private readonly tableName: TableName;
  private op: Operation = 'select';
  private filters: { column: keyof T; value: unknown }[] = [];
  private payload: Partial<T> | null = null;
  private returnSingle = false;
  private selectCols = '*';

  constructor(table: TableName) {
    this.tableName = table;
  }

  // ── Query methods ─────────────────────────────────────────────────────────

  select(columns = '*'): this {
    this.op = 'select';
    this.selectCols = columns;
    return this;
  }

  insert(data: Partial<T>): this {
    this.op = 'insert';
    this.payload = data;
    return this;
  }

  update(data: Partial<T>): this {
    this.op = 'update';
    this.payload = data;
    return this;
  }

  upsert(data: Partial<T>): this {
    this.op = 'upsert';
    this.payload = data;
    return this;
  }

  eq(column: keyof T, value: unknown): this {
    this.filters.push({ column, value });
    return this;
  }

  /** Expect exactly one row; mirrors .single() in the real SDK */
  single(): SupabaseResponse<T> {
    this.returnSingle = true;
    return this._execute();
  }

  // Make the builder itself awaitable for multi-row results
  then<TResult>(
    resolve: (value: { data: T[] | T | null; error: Error | null }) => TResult
  ): Promise<TResult> {
    return this._execute().then(resolve);
  }

  // ── Execution ─────────────────────────────────────────────────────────────

  private _execute(): SupabaseResponse<T> {
    try {
      const db = readDb();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = db[this.tableName] as unknown as Record<string, T>;

      switch (this.op) {
        case 'select': {
          let rows = Object.values(table);
          for (const { column, value } of this.filters) {
            rows = rows.filter((row) => row[column as string] === value);
          }
          if (this.returnSingle) {
            if (rows.length === 0) {
              return Promise.resolve({ data: null, error: new Error('Row not found') });
            }
            return Promise.resolve({ data: rows[0], error: null });
          }
          return Promise.resolve({ data: rows as unknown as T, error: null });
        }

        case 'insert': {
          if (!this.payload) {
            return Promise.resolve({ data: null, error: new Error('No data to insert') });
          }
          const key = this._primaryKey(this.payload);
          if (!key) {
            return Promise.resolve({ data: null, error: new Error('Missing primary key') });
          }
          table[key] = this.payload as T;
          writeDb(db);
          return Promise.resolve({ data: this.payload as T, error: null });
        }

        case 'update': {
          if (!this.payload) {
            return Promise.resolve({ data: null, error: new Error('No data to update') });
          }
          let updated = false;
          for (const [key, row] of Object.entries(table)) {
            if (this._matchesFilters(row)) {
              table[key] = { ...row, ...this.payload };
              updated = true;
            }
          }
          writeDb(db);
          if (!updated) {
            return Promise.resolve({ data: null, error: new Error('No matching rows to update') });
          }
          return Promise.resolve({ data: null, error: null });
        }

        case 'upsert': {
          if (!this.payload) {
            return Promise.resolve({ data: null, error: new Error('No data to upsert') });
          }
          const key = this._primaryKey(this.payload);
          if (!key) {
            return Promise.resolve({ data: null, error: new Error('Missing primary key') });
          }
          table[key] = { ...(table[key] ?? {}), ...this.payload } as T;
          writeDb(db);
          return Promise.resolve({ data: table[key], error: null });
        }

        default:
          return Promise.resolve({ data: null, error: new Error('Unknown operation') });
      }
    } catch (err) {
      return Promise.resolve({ data: null, error: err as Error });
    }
  }

  /** Determine the record key from the payload (token for downloadTokens, projectId for projects, id for profiles/users/sessions) */
  private _primaryKey(payload: Partial<T>): string | null {
    return (
      (payload['token'] as string) ??
      (payload['projectId'] as string) ??
      (payload['id'] as string) ??
      null
    );
  }

  private _matchesFilters(row: T): boolean {
    return this.filters.every(({ column, value }) => row[column as string] === value);
  }
}

// ── Public factory ────────────────────────────────────────────────────────────

export const createMockSupabaseClient = () => ({
  /**
   * Entry point — mirrors supabase.from('table') in the real SDK.
   * Usage:
   *   const { data, error } = await supabase.from('projects').select('*').eq('projectId', id).single()
   *   await supabase.from('projects').insert({ ... })
   *   await supabase.from('projects').update({ status: 'paid' }).eq('projectId', id)
   */
  from: <T extends Row = Row>(table: TableName) => new QueryBuilder<T>(table),
});
