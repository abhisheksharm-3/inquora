-- Two columns the remaining tools need.
--
-- `outline` is what a document is made of: headings for prose, sheet names for a
-- workbook, the file tree for a repository. Consulting it costs one read, where
-- guessing at structure costs a search that returns the wrong region.
--
-- `extracted_text` is the document as text, kept rather than discarded after
-- chunking. Literal and regex matching beats embeddings for error codes,
-- identifiers and version strings — the things a dense vector flattens into
-- "some technical token".
alter table public.documents
  add column outline jsonb,
  add column extracted_text text;

comment on column public.documents.outline is
  'What the document is made of. Shape depends on kind: headings for prose, sheet '
  'names and columns for a workbook, a file tree for a repository.';

comment on column public.documents.extracted_text is
  'The document as text. Kept so grep_document can match literally, which is what '
  'beats a dense vector on an error code or an identifier.';

-- Trigram matching over the retained text, so a literal search does not scan.
create index documents_extracted_text_trgm_idx
  on public.documents
  using gin (extracted_text extensions.gin_trgm_ops);

/*
 * Literal and regex matching within one document, returning the matching lines
 * with their line numbers so a citation can point at one.
 *
 * security invoker, so a user can only grep a document they can already read.
 * The pattern is a POSIX regex evaluated by Postgres; a bad one raises, which is
 * reported to the model rather than swallowed, because it can then fix it.
 */
create function public.grep_document(
  p_document_id uuid,
  p_pattern     text,
  p_limit       integer default 30
)
returns table (line_number integer, line text)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.ordinality::integer as line_number, l.line
  from public.documents d
  cross join lateral unnest(string_to_array(coalesce(d.extracted_text, ''), E'\n'))
    with ordinality as l(line, ordinality)
  where d.id = p_document_id
    and l.line ~* p_pattern
  order by l.ordinality
  limit least(greatest(p_limit, 1), 200);
$$;

comment on function public.grep_document is
  'Lines of one document matching a regex, with line numbers. Case-insensitive, '
  'because an identifier in prose is not reliably cased the way it is in code.';
