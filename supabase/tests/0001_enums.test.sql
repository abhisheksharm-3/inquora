begin;
select plan(8);

select has_type('public', 'document_kind', 'document_kind enum exists');
select is(
  enum_range(null::public.message_part_kind)::text,
  '{text,reasoning,tool_call,tool_result,source}',
  'message_part_kind covers every part a tool-calling turn produces'
);
select has_type('public', 'processing_status', 'processing_status enum exists');
select has_type('public', 'message_role', 'message_role enum exists');

select is(
  enum_range(null::public.document_kind)::text,
  '{pdf,doc,sheet,slides,image,video,github,web}',
  'document_kind covers every content type the product ingests'
);
select is(
  enum_range(null::public.processing_status)::text,
  '{pending,processing,ready,failed}',
  'processing_status covers the ingestion lifecycle'
);
select is(
  enum_range(null::public.message_role)::text,
  '{user,assistant}',
  'message_role covers both speakers'
);

select has_extension('extensions', 'vector', 'pgvector is installed');

select * from finish();
rollback;
