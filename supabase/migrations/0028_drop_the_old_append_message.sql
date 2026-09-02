-- Two append_message functions were live at once.
--
-- Migration 0026 added `p_client_message_id` with `create or replace`. A
-- defaulted parameter still changes the signature, so Postgres created an
-- overload rather than replacing: the ten-argument version stayed, without the
-- idempotency check and without the parent-belongs-to-this-chat check. Any caller
-- omitting the new argument reached it and got neither guarantee, and a call with
-- five arguments became ambiguous — which is how this was found, as
-- `function public.append_message(...) is not unique`.
--
-- `create or replace` cannot replace across a signature change. The old one has
-- to be named and dropped.
drop function if exists public.append_message(
  uuid, public.message_role, text, uuid, uuid[], integer, integer, integer, integer, text
);
