-- The queue's functions were callable by anyone with the publishable key.
--
-- Postgres grants EXECUTE to PUBLIC on `create function` by default, and Supabase
-- exposes the public schema through PostgREST, so `claim_ingestion_job`,
-- `complete_ingestion_job`, `fail_ingestion_job` and `poke_ingestion_worker` were
-- reachable over RPC by `anon`. Verified against the deployed project before
-- writing this: the claim returned 200 and the poke returned 204 to a caller
-- holding nothing but the anon key.
--
-- Each is `security definer`, which is what makes it serious: they were written
-- that way deliberately so the worker could bypass the policy-less RLS on
-- `ingestion_jobs`, and that same bypass was handed to the internet. An anonymous
-- caller could claim another tenant's job — learning their document id and setting
-- their document to `processing` — and five calls exhausted `attempts`, leaving
-- that document permanently unclaimable. `fail_ingestion_job` could write
-- attacker-chosen text into another tenant's `documents.error`.
--
-- This also closes a second path. `query_document_table` runs model-written SQL
-- as the caller, and its keyword deny list cannot see a verb hidden inside a
-- function name: `select public.fail_ingestion_job(...)` contains none of the
-- forbidden substrings. With EXECUTE revoked from `authenticated`, that call now
-- fails on privilege regardless of what the deny list missed.

revoke all on function public.claim_ingestion_job() from public, anon, authenticated;
revoke all on function public.complete_ingestion_job(bigint) from public, anon, authenticated;
revoke all on function public.fail_ingestion_job(bigint, text) from public, anon, authenticated;
revoke all on function public.poke_ingestion_worker() from public, anon, authenticated;

-- The worker runs as the service role, which bypasses grants, so it is unaffected.
-- Granting explicitly anyway, so the intent is readable rather than inferred.
grant execute on function public.claim_ingestion_job() to service_role;
grant execute on function public.complete_ingestion_job(bigint) to service_role;
grant execute on function public.fail_ingestion_job(bigint, text) to service_role;
grant execute on function public.poke_ingestion_worker() to service_role;

-- Everything else callable over RPC is `security invoker`, so row-level security
-- decides what it may touch. Stated here because the next person to add a
-- definer function needs to know the rule, and the test below is what enforces it.
