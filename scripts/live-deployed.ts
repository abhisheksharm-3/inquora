/**
 * Drives the deployed answer endpoint end to end.
 *
 * Creates a confirmed test user, ingests a fixture document with real
 * embeddings, opens a chat over it, signs in to get a session, and then asks a
 * question through the deployed route exactly as a browser would — including the
 * cookie the SSR client reads.
 *
 * This is the run that proves generation works, which cannot be done from a
 * network where POST to the model provider is blocked.
 */
import { createClient } from "@supabase/supabase-js";
import { SQL } from "bun";
import type { Database } from "../src/core/database.types";
import { createEmbeddingsClient } from "../src/server/platform/embeddings/client";

const site = process.env.SITE ?? "https://inquora.vercel.app";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const apiKey = process.env.MULTIUTILITY_API_KEY!;
const dbUrl = process.env.SUPABASE_DB_URL!;

const EMAIL = "inquora-live-check@example.com";
const PASSWORD = `Live-check-${process.env.RUN_TAG ?? "1"}!`;

const PASSAGES = [
  "Q3 revenue closed at 4.12 million against a forecast of 4.68 million, a shortfall of twelve percent. Pipeline coverage averaged 3.4x through the quarter, above the 3.0x target.",
  "The shortfall is concentrated in the northern region, where three deals slipped past the quarter end. Two of them closed in the first week of October.",
  "Average contract value fell from 48,000 to 41,500, which accounts for roughly two thirds of the gap against forecast.",
];

const QUESTION = "why did Q3 revenue miss the forecast, and by how much?";

const admin = createClient<Database>(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sql = new SQL(dbUrl, { max: 1 });

// 1. A confirmed user, so sign-in works without an email round trip.
const existing = await admin.auth.admin.listUsers();
for (const user of existing.data.users) {
  if (user.email === EMAIL) await admin.auth.admin.deleteUser(user.id);
}

const created = await admin.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { full_name: "Live Check" },
});
if (created.error) throw created.error;

const userId = created.data.user.id;
console.log(`1. user ${EMAIL} created, and the trigger made its profile`);

const [{ count: profiles }] =
  await sql`select count(*)::int as count from public.profiles where id = ${userId}`;
console.log(`   profiles rows for it: ${profiles}`);

// 2. A document with real vectors.
const embeddings = createEmbeddingsClient({
  baseUrl: "https://abhisheksan-multiutility-server.hf.space",
  apiKey,
  timeoutMs: 120_000,
});

const vectors = await embeddings.embed(PASSAGES);
if (!vectors.ok) throw vectors.error;

const document = await admin
  .from("documents")
  .insert({
    user_id: userId,
    kind: "pdf",
    title: "Revenue review, Q3",
    content_hash: `live-deployed-${Date.now()}`,
    storage_path: `${userId}/live/revenue.pdf`,
  })
  .select("id")
  .single();
if (document.error) throw document.error;

for (let i = 0; i < PASSAGES.length; i += 1) {
  await sql`
    insert into public.document_chunks (document_id, chunk_index, content, embedding)
    values (${document.data.id}, ${i}, ${PASSAGES[i]},
            ${JSON.stringify(vectors.value[i])}::extensions.vector)`;
}

const [{ status, chunk_count }] =
  await sql`select status::text, chunk_count from public.documents where id = ${document.data.id}`;
console.log(`2. document is ${status} with ${chunk_count} chunks`);

// 3. A chat over it.
const chat = await admin.from("chats").insert({ user_id: userId, title: "Live check" }).select("id").single();
if (chat.error) throw chat.error;

await admin.from("chat_documents").insert({ chat_id: chat.data.id, document_id: document.data.id });
console.log(`3. chat ${chat.data.id} has the document attached`);

// 4. Sign in for a session, then build the cookie the SSR client reads.
const signIn = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "content-type": "application/json", apikey: anonKey },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});

if (!signIn.ok) throw new Error(`sign-in failed: ${signIn.status} ${await signIn.text()}`);

const session = (await signIn.json()) as Record<string, unknown>;
const ref = new URL(supabaseUrl).hostname.split(".")[0];
const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`;

// @supabase/ssr splits a long cookie into numbered chunks, so this does too.
const CHUNK = 3180;
const cookies: string[] =
  cookieValue.length <= CHUNK
    ? [`sb-${ref}-auth-token=${cookieValue}`]
    : Array.from({ length: Math.ceil(cookieValue.length / CHUNK) }, (_, i) =>
        `sb-${ref}-auth-token.${i}=${cookieValue.slice(i * CHUNK, (i + 1) * CHUNK)}`,
      );

console.log(`4. signed in, session carried in ${cookies.length} cookie chunk(s)`);

// 5. Ask, through the deployed endpoint.
console.log(`5. POST ${site}/api/chats/${chat.data.id}/messages`);
const started = Date.now();

const response = await fetch(`${site}/api/chats/${chat.data.id}/messages`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    cookie: cookies.join("; "),
  },
  body: JSON.stringify({ content: QUESTION }),
});

console.log(`   ${response.status} ${response.headers.get("content-type")}`);

if (!response.ok) {
  console.log(`   ${await response.text()}`);
} else {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  let firstEventMs = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (firstEventMs === 0) firstEventMs = Date.now() - started;
    raw += decoder.decode(value);
  }

  const events = raw.split("\n\n").filter((block) => block.trim().length > 0);
  console.log(`   ${events.length} SSE events, first in ${firstEventMs}ms, total ${Date.now() - started}ms`);

  const last = events.filter((e) => e.includes("messages/complete")).at(-1);
  if (last) {
    const payload = JSON.parse(last.slice(last.indexOf("data: ") + 6)) as { content: string }[];
    console.log(`\n--- answer ---\n${payload[0]?.content}\n--------------`);
  } else {
    console.log(`\n--- raw tail ---\n${raw.slice(-600)}\n----------------`);
  }
}

// 6. What was persisted.
const persisted = await sql`
  select m.role::text, m.latency_ms, m.model,
         (select count(*)::int from public.message_parts p
          where p.message_id = m.id and p.kind = 'source') as sources
  from public.messages m
  where m.chat_id = ${chat.data.id}
  order by m.created_at`;

console.log(`\n6. persisted ${persisted.length} message(s):`);
for (const row of persisted) {
  console.log(`   ${row.role}${row.latency_ms ? ` in ${row.latency_ms}ms` : ""}${row.sources ? `, ${row.sources} source part(s)` : ""}`);
}

await admin.auth.admin.deleteUser(userId);
await sql.close();
console.log("\ntest user deleted, and everything of theirs cascaded away");
