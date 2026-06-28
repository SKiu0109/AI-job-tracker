-- Fix Supabase linter INFO: rls_enabled_no_policy.
--
-- These hosted-version tables are intentionally server-only. RLS already blocks
-- direct access by default when no policy exists, but Supabase's linter reports
-- that as an INFO warning. These explicit deny-all policies keep the same
-- security posture while making the intent visible to the linter.

drop policy if exists product_events_no_client_access on public.product_events;
create policy product_events_no_client_access on public.product_events
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists feedback_no_client_access on public.feedback;
create policy feedback_no_client_access on public.feedback
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists guest_credits_no_client_access on public.guest_credits;
create policy guest_credits_no_client_access on public.guest_credits
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists redemption_codes_no_client_access on public.redemption_codes;
create policy redemption_codes_no_client_access on public.redemption_codes
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Verification helper: run after applying the policies.
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'feedback',
    'guest_credits',
    'product_events',
    'redemption_codes'
  )
order by tablename, policyname;
