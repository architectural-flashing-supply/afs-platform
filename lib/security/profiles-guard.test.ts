import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..', 'supabase', 'migrations');
const sql = readFileSync(join(root, '039_profiles_privileged_column_guard.sql'), 'utf8');

const PROTECTED = ['role', 'pricing_tier', 'net_terms', 'credit_limit', 'tax_exempt', 'company_id', 'company_role'];

describe('profiles privileged-column guard (migration 039)', () => {
  it('adds WITH CHECK to the self-service policy', () => {
    expect(sql).toMatch(/CREATE POLICY "users_own_profile"[\s\S]*WITH CHECK \(auth\.uid\(\) = id\)/);
  });

  it('installs a BEFORE INSERT OR UPDATE trigger', () => {
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE ON profiles/);
  });

  it('exempts only service/migration (auth.uid() IS NULL) and admins', () => {
    expect(sql).toMatch(/auth\.uid\(\) IS NULL/);
    expect(sql).toMatch(/is_admin\(\)/);
  });

  it('guards every privileged column on UPDATE and raises 42501', () => {
    for (const c of PROTECTED) {
      expect(sql).toContain(`NEW.${c} IS DISTINCT FROM OLD.${c}`);
    }
    expect(sql).toMatch(/ERRCODE = '42501'/);
  });
});
