-- Fix Supabase linter warnings:
-- - anon_security_definer_function_executable
-- - authenticated_security_definer_function_executable
--
-- Cause:
-- Postgres grants EXECUTE on new functions to PUBLIC by default. Revoking only
-- anon/authenticated is not enough because those roles can still inherit PUBLIC
-- execution rights. These RPC functions are called only by the Next.js server
-- with SUPABASE_SERVICE_ROLE_KEY, so they should not be directly executable by
-- browser/API roles.

revoke execute on function public.get_or_create_guest_credit_balance(text, integer)
  from public, anon, authenticated;
revoke execute on function public.try_spend_guest_credit(text, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.refund_guest_credit(text, integer, integer)
  from public, anon, authenticated;

revoke execute on function public.get_or_create_user_monthly_credit_balance(uuid, date, integer)
  from public, anon, authenticated;
revoke execute on function public.try_spend_user_monthly_credit(uuid, date, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.refund_user_monthly_credit(uuid, date, integer, integer)
  from public, anon, authenticated;

revoke execute on function public.add_user_monthly_credits(uuid, date, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.redeem_code(text, uuid, date, integer)
  from public, anon, authenticated;

grant execute on function public.get_or_create_guest_credit_balance(text, integer)
  to service_role;
grant execute on function public.try_spend_guest_credit(text, integer, integer)
  to service_role;
grant execute on function public.refund_guest_credit(text, integer, integer)
  to service_role;

grant execute on function public.get_or_create_user_monthly_credit_balance(uuid, date, integer)
  to service_role;
grant execute on function public.try_spend_user_monthly_credit(uuid, date, integer, integer)
  to service_role;
grant execute on function public.refund_user_monthly_credit(uuid, date, integer, integer)
  to service_role;

grant execute on function public.add_user_monthly_credits(uuid, date, integer, integer)
  to service_role;
grant execute on function public.redeem_code(text, uuid, date, integer)
  to service_role;

-- Verification helper: should return no rows for PUBLIC/anon/authenticated.
select
  n.nspname as schema_name,
  p.proname as function_name,
  case
    when acl.grantee = 0 then 'PUBLIC'
    else r.rolname
  end as executable_role
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
left join pg_roles r on r.oid = acl.grantee
where n.nspname = 'public'
  and p.proname in (
    'get_or_create_guest_credit_balance',
    'try_spend_guest_credit',
    'refund_guest_credit',
    'get_or_create_user_monthly_credit_balance',
    'try_spend_user_monthly_credit',
    'refund_user_monthly_credit',
    'add_user_monthly_credits',
    'redeem_code'
  )
  and acl.privilege_type = 'EXECUTE'
  and (acl.grantee = 0 or r.rolname in ('anon', 'authenticated'))
order by p.proname, r.rolname;
