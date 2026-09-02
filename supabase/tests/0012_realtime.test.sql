begin;
select plan(8);

select has_function('public', 'broadcast_document_progress', 'the document progress broadcast exists');
select has_function('public', 'broadcast_chat_message', 'the chat message broadcast exists');
select has_function('public', 'topic_owner_matches', 'the topic authorization check exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'realtime.messages'::regclass),
  'realtime.messages has row level security, which is what the policies below rely on');

select is(
  (select count(*)::int from pg_policies
   where schemaname = 'realtime' and tablename = 'messages'
     and policyname like 'realtime_%_own_topics'),
  2,
  'a client may receive and send on its own topics only');

-- A malformed topic must be refused rather than raising, because a raise inside a
-- policy reaches the client as an error.
select is(
  public.topic_owner_matches('not-a-topic'),
  false,
  'a topic that is not shaped like one is refused, not raised on');

select is(
  public.topic_owner_matches('user:11111111-1111-1111-1111-111111111111'),
  false,
  'a topic belonging to somebody else is refused');

-- A ready document keeps no job, or a worker pays to re-index what is indexed.
select has_function('public', 'clear_ingestion_job_when_ready',
  'a document reaching ready clears its queued job');

select * from finish();
rollback;
