/**
 * The retrieval eval harness.
 *
 * Loads a fixture corpus into the real database with real embeddings, asks the
 * questions in `eval/corpus.json` through the real `search_chunks`, and scores
 * recall@k and MRR. Everything happens inside one transaction that is rolled
 * back, so a run leaves no rows behind.
 *
 * Without this, every future change to chunking, fusion or lambda is a guess.
 * It is deliberately not part of the pull-request gate: it spends provider calls
 * and needs credentials, so it runs nightly or on demand.
 */
import { readFileSync } from "node:fs";
import { SQL } from "bun";
import { mmr } from "../src/core/retrieval/mmr";
import { createEmbeddingsClient } from "../src/server/platform/embeddings/client";

interface Corpus {
  documents: { slug: string; kind: string; title: string; chunks: string[] }[];
  pairs: { question: string; expect: string[] }[];
}

const K = 4;
const MMR_LAMBDA = 0.3;

/**
 * Floors, so a regression fails rather than scrolling past. Set just under what
 * this corpus produces: recall@4 93.8%, MRR 0.967 on 2026-09-02.
 *
 * The earlier floors were 0.85 and 0.9, matching 87.5% and 0.933. Normalizing the
 * fused score before mixing it with the diversity term moved both — a review
 * found that the raw score, bounded by about 0.033, was being weighed against a
 * cosine in 0..1, so MMR was discarding a relevant passage per two questions.
 * Raise these when the corpus grows, never to make a bad run pass.
 */
const RECALL_FLOOR = 0.9;
const MRR_FLOOR = 0.95;

/** Thrown to roll the fixture corpus back. Declared here because a class is not hoisted. */
class Rollback extends Error {}

const dbUrl = process.env.SUPABASE_DB_URL;
const apiKey = process.env.MULTIUTILITY_API_KEY;

if (!dbUrl || !apiKey) {
  console.error("SUPABASE_DB_URL and MULTIUTILITY_API_KEY are both required.");
  process.exit(2);
}

const corpus = JSON.parse(readFileSync("eval/corpus.json", "utf8")) as Corpus;
const embeddings = createEmbeddingsClient({
  baseUrl: process.env.EMBEDDINGS_BASE_URL ?? "https://abhisheksan-multiutility-server.hf.space",
  apiKey,
  timeoutMs: 120_000,
});

const chunkKeys = corpus.documents.flatMap((doc) => doc.chunks.map((_, i) => `${doc.slug}#${i}`));
const chunkTexts = corpus.documents.flatMap((doc) => doc.chunks);

console.log(`Embedding ${chunkTexts.length} chunks and ${corpus.pairs.length} questions...`);

const [chunkVectors, questionVectors] = await Promise.all([
  embeddings.embed(chunkTexts),
  embeddings.embed(corpus.pairs.map((p) => p.question)),
]);

if (!chunkVectors.ok) throw chunkVectors.error;
if (!questionVectors.ok) throw questionVectors.error;

const sql = new SQL(dbUrl, { max: 1 });
const userId = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

let passed = false;

try {
  await sql.begin(async (tx) => {
    await tx`
      insert into auth.users (id, instance_id, aud, role, email)
      values (${userId}, '00000000-0000-0000-0000-000000000000',
              'authenticated', 'authenticated', 'eval@example.com')`;

    const documentIds: string[] = [];
    let cursor = 0;

    for (const doc of corpus.documents) {
      const [{ id }] = await tx`
        insert into public.documents (user_id, kind, title, content_hash, storage_path)
        values (${userId}, ${doc.kind}::public.document_kind, ${doc.title},
                ${`eval-${doc.slug}`}, ${`eval/${doc.slug}`})
        returning id`;

      documentIds.push(id);

      for (let i = 0; i < doc.chunks.length; i += 1) {
        await tx`
          insert into public.document_chunks (document_id, chunk_index, content, embedding)
          values (${id}, ${i}, ${doc.chunks[i]},
                  ${JSON.stringify(chunkVectors.value[cursor + i])}::extensions.vector)`;
      }

      cursor += doc.chunks.length;
    }

    let recallHits = 0;
    let recallTotal = 0;
    let mrrSum = 0;
    const failures: string[] = [];

    for (let i = 0; i < corpus.pairs.length; i += 1) {
      const pair = corpus.pairs[i];

      // A JS array reaches Postgres comma-joined rather than as an array literal,
      // so the braces are explicit.
      const rows = await tx`
        select chunk_id, document_id, chunk_index, content, score, embedding::text as embedding
        from public.search_chunks(
          ${`{${documentIds.join(",")}}`}::uuid[],
          ${JSON.stringify(questionVectors.value[i])}::extensions.vector,
          ${pair.question},
          ${K * 3})`;

      // The same ranking the service applies, so the harness scores what a caller
      // would actually receive rather than the raw fused list.
      const ranked = mmr(
        rows.map((row: Record<string, string>) => ({
          id: `${corpus.documents[documentIds.indexOf(row.document_id)].slug}#${row.chunk_index}`,
          embedding: JSON.parse(row.embedding) as number[],
          score: Number(row.score),
        })),
        { lambda: MMR_LAMBDA, limit: K },
      ).map((c) => c.id);

      const found = pair.expect.filter((key) => ranked.includes(key));
      recallHits += found.length;
      recallTotal += pair.expect.length;

      const firstRank = ranked.findIndex((key) => pair.expect.includes(key));
      if (firstRank >= 0) mrrSum += 1 / (firstRank + 1);
      else
        failures.push(
          `${pair.question}\n      expected ${pair.expect.join(", ")}\n      got      ${ranked.join(", ")}`,
        );
    }

    console.log(`\ncorpus     ${corpus.documents.length} documents, ${chunkKeys.length} chunks`);
    console.log(`questions  ${corpus.pairs.length}`);
    console.log(
      `recall@${K}   ${((recallHits / recallTotal) * 100).toFixed(1)}%  (${recallHits}/${recallTotal})`,
    );
    console.log(`MRR        ${(mrrSum / corpus.pairs.length).toFixed(3)}`);

    if (failures.length > 0) {
      console.log(`\n${failures.length} question(s) returned nothing expected:`);
      for (const failure of failures) console.log(`  - ${failure}`);
    }

    const recall = recallHits / recallTotal;
    const mrr = mrrSum / corpus.pairs.length;

    if (recall < RECALL_FLOOR || mrr < MRR_FLOOR) {
      console.log(
        `\nBelow the floor: recall@${K} must be at least ${(RECALL_FLOOR * 100).toFixed(1)}% and MRR at least ${MRR_FLOOR}.`,
      );
    } else {
      passed = true;
    }

    // Rolled back on purpose: the harness must not leave a fixture corpus behind.
    throw new Rollback();
  });
} catch (error) {
  if (!(error instanceof Rollback)) throw error;
}

await sql.close();
process.exit(passed ? 0 : 1);
