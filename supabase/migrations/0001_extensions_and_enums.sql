-- Extensions live in the `extensions` schema so they are not dumped into `public`.
create schema if not exists extensions;

create extension if not exists vector       with schema extensions;
create extension if not exists pg_trgm      with schema extensions;
create extension if not exists unaccent     with schema extensions;
create extension if not exists moddatetime  with schema extensions;
create extension if not exists pgtap        with schema extensions;

-- Enums replace the free-text `type` and `processing_status` columns of the old
-- schema, where `files` said 'youtube' while `chats` said 'video' for the same
-- concept, and 'doc' and 'docs' both existed, with no constraint to stop either.
create type public.document_kind as enum
  ('pdf', 'doc', 'sheet', 'slides', 'image', 'video', 'github', 'web');

create type public.processing_status as enum
  ('pending', 'processing', 'ready', 'failed');

create type public.message_role as enum ('user', 'assistant');

-- A message is an ordered list of parts. See docs/adr/0005.
create type public.message_part_kind as enum
  ('text', 'reasoning', 'tool_call', 'tool_result', 'source');
