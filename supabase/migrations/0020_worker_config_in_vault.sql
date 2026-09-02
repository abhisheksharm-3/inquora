-- Where the queue's poke gets its URL and its secret.
--
-- The first version read them from `app.settings.*`, which does not work on this
-- platform: `alter database ... set` on a custom parameter is denied to the
-- postgres role, so the poke silently did nothing and every upload waited for the
-- minute-by-minute drain. Worse, a GUC holds a secret in plain text where anyone
-- with `pg_settings` can read it.
--
-- Supabase Vault is the documented home for a secret a database function uses:
-- encrypted at rest, decrypted only for a privileged reader, and settable with
-- ordinary SQL rather than a dashboard field.

/*
 * Reads a named secret out of the vault.
 *
 * security definer because vault.decrypted_secrets is not readable by the roles a
 * trigger runs as, and search_path is pinned because a definer function that
 * resolves names loosely is how privilege escalation happens.
 */
create function public.worker_secret(p_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = p_name
  limit 1;
$$;

revoke all on function public.worker_secret(text) from public, anon, authenticated;

comment on function public.worker_secret is
  'One secret from the vault, for the queue poke. Revoked from every client role: '
  'only a security definer trigger calls it.';

create or replace function public.poke_ingestion_worker()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_url text := public.worker_secret('ingestion_worker_url');
  worker_key text := public.worker_secret('ingestion_worker_key');
begin
  if worker_url is null or worker_url = '' then
    -- Nothing configured. The scheduled drain still runs, so work is late rather
    -- than lost, and this is visible in stuck_ingestion_jobs either way.
    return;
  end if;

  perform net.http_post(
    url     := worker_url,
    headers := jsonb_build_object(
                 'content-type', 'application/json',
                 'authorization', 'Bearer ' || coalesce(worker_key, '')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
end;
$$;

comment on function public.poke_ingestion_worker is
  'Tells the worker there is work, so the common case is instant rather than '
  'waiting for the next scheduled drain. Reads its URL and key from the vault.';
