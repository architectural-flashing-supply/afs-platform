-- 039_profiles_privileged_column_guard.sql  (SECURITY)
-- Closes a privilege-escalation hole: policy users_own_profile (001) was
-- FOR ALL USING (auth.uid() = id) with no WITH CHECK, so any signed-in user
-- could PATCH their own profiles row and set role='admin', pricing_tier,
-- net_terms, credit_limit, tax_exempt, company_id, company_role.
-- Fix: (1) explicit WITH CHECK, (2) trigger that blocks non-admin user
-- sessions from writing privileged columns. Service role / migrations
-- (auth.uid() IS NULL) and admins (is_admin()) are unaffected.
-- Rollback: DROP TRIGGER profiles_guard_privileged_columns ON profiles;
--           DROP FUNCTION profiles_guard_privileged_columns();

DROP POLICY IF EXISTS "users_own_profile" ON profiles;
CREATE POLICY "users_own_profile" ON profiles
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION profiles_guard_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Service role, migrations, and internal triggers have no end-user JWT.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS DISTINCT FROM 'customer'
       OR COALESCE(NEW.pricing_tier, 'standard') <> 'standard'
       OR COALESCE(NEW.net_terms, 0) <> 0
       OR COALESCE(NEW.credit_limit, 0) <> 0
       OR COALESCE(NEW.tax_exempt, false) <> false
       OR NEW.company_id IS NOT NULL
       OR NEW.company_role IS NOT NULL THEN
      RAISE EXCEPTION 'profiles: privileged columns cannot be set by this user'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.pricing_tier IS DISTINCT FROM OLD.pricing_tier
     OR NEW.net_terms IS DISTINCT FROM OLD.net_terms
     OR NEW.credit_limit IS DISTINCT FROM OLD.credit_limit
     OR NEW.tax_exempt IS DISTINCT FROM OLD.tax_exempt
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.company_role IS DISTINCT FROM OLD.company_role THEN
    RAISE EXCEPTION 'profiles: privileged columns cannot be changed by this user'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_privileged_columns ON profiles;
CREATE TRIGGER profiles_guard_privileged_columns
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_guard_privileged_columns();
