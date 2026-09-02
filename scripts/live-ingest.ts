/**
 * The live ingestion check: a real PDF into real storage, drained by the real
 * worker against the real Space, then searched through the real search_chunks.
 *
 * Everything it creates is deleted at the end, including the stored object.
 */
import { createClient } from "@supabase/supabase-js";
import { SQL } from "bun";
import type { Database } from "../src/core/database.types";
import { contentHash } from "../src/core/documents/content-hash";
import { extractDocument } from "../src/server/modules/ingestion/extract.source";
import { createIngestionRepository } from "../src/server/modules/ingestion/ingestion.repository";
import { createIngestionWorker } from "../src/server/modules/ingestion/ingestion.worker";
import { createEmbeddingsClient } from "../src/server/platform/embeddings/client";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const apiKey = process.env.MULTIUTILITY_API_KEY!;
const dbUrl = process.env.SUPABASE_DB_URL!;
const pdfPath = process.argv[2];

if (!url || !serviceKey || !apiKey || !dbUrl || !pdfPath) {
  console.error(
    "Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MULTIUTILITY_API_KEY, SUPABASE_DB_URL and a path to a PDF.",
  );
  process.exit(2);
}

const db = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sql = new SQL(dbUrl, { max: 1 });

const isSheet = pdfPath.endsWith(".xlsx");
const kind = isSheet ? "sheet" : "pdf";
const bytes = new Uint8Array(await Bun.file(pdfPath).arrayBuffer());
const hash = await contentHash(bytes);
const userId = "cccccccc-1111-4111-8111-cccccccccccc";
const storagePath = `${userId}/${hash}/${isSheet ? "pipeline.xlsx" : "revenue.pdf"}`;

console.log(`1. ${bytes.length} bytes, sha256 ${hash.slice(0, 16)}...`);

await sql`
  insert into auth.users (id, instance_id, aud, role, email)
  values (${userId}, '00000000-0000-0000-0000-000000000000',
          'authenticated', 'authenticated', 'live-ingest@example.com')
  on conflict (id) do nothing`;

const upload = await db.storage.from("documents").upload(storagePath, bytes, {
  contentType: isSheet
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "application/pdf",
  upsert: true,
});
if (upload.error) throw upload.error;
console.log(`2. uploaded to storage at ${storagePath}`);

const inserted = await db
  .from("documents")
  .insert({
    user_id: userId,
    kind,
    title: isSheet ? "Q3 pipeline" : "Revenue review, Q3",
    byte_size: bytes.length,
    content_hash: hash,
    storage_path: storagePath,
  })
  .select("id, status")
  .single();
if (inserted.error) throw inserted.error;

const documentId = inserted.data.id;
const [{ count: queued }] =
  await sql`select count(*)::int as count from public.ingestion_jobs where document_id = ${documentId}`;
console.log(`3. document is ${inserted.data.status}, and the trigger enqueued ${queued} job`);

const repository = createIngestionRepository(db);
const worker = createIngestionWorker({
  queue: repository,
  store: repository,
  extract: (job) => extractDocument(db, job),
  embeddings: createEmbeddingsClient({
    baseUrl: "https://abhisheksan-multiutility-server.hf.space",
    apiKey,
    timeoutMs: 120_000,
  }),
});

// The queue holds a new job back, because in production the row is created before
// the client uploads the bytes. This harness wrote the object first, so it brings
// its own job forward rather than sleeping through a delay that exists for a race
// it has already avoided.
await sql`update public.ingestion_jobs set run_after = now() - interval '1 second' where document_id = ${documentId}`;

console.log("4. running the worker");
const started = Date.now();
const outcome = await worker.runOnce();
console.log(`   ${outcome.ok ? outcome.value : "error"} in ${Date.now() - started}ms`);

const after = await db
  .from("documents")
  .select("status, chunk_count, expected_chunks, error")
  .eq("id", documentId)
  .single();
console.log(
  `5. document is ${after.data?.status} with ${after.data?.chunk_count} of ${after.data?.expected_chunks} chunks${after.data?.error ? ` (${after.data.error})` : ""}`,
);

const remaining =
  await sql`select count(*)::int as count from public.ingestion_jobs where document_id = ${documentId}`;
console.log(`   ${remaining[0].count} job(s) left in the queue`);

// A spreadsheet is stored as rows as well as chunks, so the numbers in it can be
// answered by arithmetic rather than read out of a sentence.
if (isSheet) {
  const sheets = await sql`
    select t.name, t.row_count, t.header
    from public.document_tables t where t.document_id = ${documentId} order by t.name`;

  console.log(`\n6. ${sheets.length} sheet(s) landed as rows:`);
  for (const sheet of sheets) {
    console.log(`   ${sheet.name}: ${sheet.row_count} rows, columns ${sheet.header.join(", ")}`);
  }

  const answers = [
    [
      "which accounts are over 30,000",
      'select "Account" from t where "Value"::numeric > 30000 order by "Value"::numeric desc',
    ],
    ["total pipeline value", 'select sum("Value"::numeric) as total from t'],
    [
      "won value by region",
      'select "Region", sum("Value"::numeric) as won from t where "Stage" = \'Closed won\' group by "Region" order by won desc',
    ],
  ];

  for (const [question, statement] of answers) {
    const [row] = await sql`
      select public.query_document_table(${documentId}, 'Pipeline', ${statement}) as result`;
    console.log(`\n   "${question}"`);
    console.log(`   ${statement}`);
    console.log(`   -> ${JSON.stringify(row.result)}`);
  }
} else if ((after.data?.chunk_count ?? 0) > 0) {
  const question = "how far under forecast was Q3 revenue?";
  const embeddings = createEmbeddingsClient({
    baseUrl: "https://abhisheksan-multiutility-server.hf.space",
    apiKey,
    timeoutMs: 120_000,
  });

  const queryVector = await embeddings.embed([question]);
  if (!queryVector.ok) throw queryVector.error;

  const rows = await sql`
    select chunk_index, score, left(content, 110) as preview
    from public.search_chunks(
      ${`{${documentId}}`}::uuid[],
      ${JSON.stringify(queryVector.value[0])}::extensions.vector,
      ${question},
      3)`;

  console.log(`\n6. asked: "${question}"`);
  for (const row of rows) {
    console.log(
      `   [${row.chunk_index}] score ${Number(row.score).toFixed(4)}  ${row.preview.replace(/\s+/g, " ")}...`,
    );
  }
}

await db.storage.from("documents").remove([storagePath]);
await sql`delete from auth.users where id = ${userId}`;
await sql.close();
console.log("\ncleaned up: object removed, user and document cascaded away");
