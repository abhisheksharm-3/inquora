/**
 * The live end-to-end check: a real document, real embeddings, a real model, a
 * real answer, and the citation resolving back to the passage it came from.
 *
 * A green unit suite is not evidence for an AI pipeline. This talks to every
 * provider for real and prints what it got, then rolls the fixture back.
 */
import { SQL } from "bun";
import { FakeToolCallingModel } from "langchain";
import { createAnsweringAgent } from "../src/server/modules/chat/agent";
import { createRetrievalService } from "../src/server/modules/retrieval/retrieval.service";
import { createCache } from "../src/server/platform/cache/cache";
import { createEmbeddingsClient } from "../src/server/platform/embeddings/client";
import { createChatModel } from "../src/server/platform/llm/model";
import { ok, type Result } from "../src/core/result";
import type { AppError } from "../src/core/errors";
import type {
  RetrievalRequest,
  RetrievedChunk,
} from "../src/server/modules/retrieval/retrieval.schema";

const dbUrl = process.env.SUPABASE_DB_URL!;
const apiKey = process.env.MULTIUTILITY_API_KEY!;
const geminiKey = process.env.GEMINI_API_KEY;

const QUESTION = "why did Q3 revenue come in under forecast, and by how much?";

const PASSAGES = [
  "Q3 revenue closed at 4.12 million against a forecast of 4.68 million, a shortfall of twelve percent. Pipeline coverage averaged 3.4x through the quarter, above the 3.0x target.",
  "The shortfall is concentrated in the northern region, where three deals slipped past the quarter end. Two of them closed in the first week of October.",
  "New engineers get repository and staging access in their first week. Production access follows the first completed pairing session.",
];

class Rollback extends Error {}

const embeddings = createEmbeddingsClient({
  baseUrl: "https://abhisheksan-multiutility-server.hf.space",
  apiKey,
  timeoutMs: 120_000,
});

console.log("1. embedding the fixture passages against the real Space");
const vectors = await embeddings.embed(PASSAGES);
if (!vectors.ok) throw vectors.error;
console.log(`   ${vectors.value.length} vectors, ${vectors.value[0].length} dimensions`);

const sql = new SQL(dbUrl, { max: 1 });
const userId = "dddddddd-dddd-dddd-dddd-dddddddddddd";

try {
  await sql.begin(async (tx) => {
    await tx`
      insert into auth.users (id, instance_id, aud, role, email)
      values (${userId}, '00000000-0000-0000-0000-000000000000',
              'authenticated', 'authenticated', 'live@example.com')`;

    const [{ id: documentId }] = await tx`
      insert into public.documents (user_id, kind, title, content_hash, storage_path)
      values (${userId}, 'pdf', 'Revenue review, Q3', 'live-fixture', 'live/fixture.pdf')
      returning id`;

    for (let i = 0; i < PASSAGES.length; i += 1) {
      await tx`
        insert into public.document_chunks (document_id, chunk_index, content, embedding)
        values (${documentId}, ${i}, ${PASSAGES[i]},
                ${JSON.stringify(vectors.value[i])}::extensions.vector)`;
    }

    const [{ status, chunk_count }] = await tx`
      select status::text, chunk_count from public.documents where id = ${documentId}`;
    console.log(`2. document is ${status} with ${chunk_count} chunks, maintained by the trigger`);

    // The retrieval service, wired to the same transaction rather than to
    // supabase-js, so the fixture stays inside the rollback.
    const repository = {
      async search({
        documentIds,
        embedding,
        query,
        limit,
      }: {
        documentIds: string[];
        embedding: number[];
        query: string;
        limit: number;
      }): Promise<Result<RetrievedChunk[], AppError>> {
        const rows = await tx`
          select chunk_id, document_id, chunk_index, content, metadata, score,
                 embedding::text as embedding
          from public.search_chunks(
            ${`{${documentIds.join(",")}}`}::uuid[],
            ${JSON.stringify(embedding)}::extensions.vector,
            ${query},
            ${limit * 3})`;

        return ok(
          rows.map((row: Record<string, unknown>) => ({
            chunkId: row.chunk_id as string,
            documentId: row.document_id as string,
            chunkIndex: row.chunk_index as number,
            content: row.content as string,
            metadata: {},
            score: Number(row.score),
            embedding: JSON.parse(row.embedding as string) as number[],
          })),
        );
      },
    };

    const retrieval = createRetrievalService({
      embeddings,
      repository,
      cache: createCache({}),
    });

    console.log("3. asking the real question through the real search_chunks");
    const found = await retrieval.retrieve({
      query: QUESTION,
      documentIds: [documentId],
      limit: 3,
    } as RetrievalRequest);
    if (!found.ok) throw found.error;
    console.log(`   ${found.value.length} passages, top hit is chunk ${found.value[0].chunkIndex}`);

    const model = await createChatModel({ apiKey: geminiKey });
    const usingRealModel = model.ok;

    if (!usingRealModel) {
      console.log(`4. no model: ${model.error.detail}`);
      throw new Rollback();
    }

    const agent = createAnsweringAgent({
      context: {
        chat: { id: "cccccccc-cccc-cccc-cccc-cccccccccccc", title: null },
        documents: [
          {
            id: documentId,
            kind: "pdf",
            title: "Revenue review, Q3",
            status: "ready",
            chunkCount: 3,
          },
        ],
        messages: [],
        memories: [],
        profile: { displayName: null },
      },
      model: model.value,
      retrieval,
      chunks: { range: async () => ok([]) },
      memories: { remember: async () => ok("id") },
      tables: { list: async () => ok([]), query: async () => ok([]) },
      structure: { outline: async () => ok(null), grep: async () => ok([]) },
      slices: { file: async () => ok([]), transcript: async () => ok([]) },
    });

    console.log("4. streaming an answer from the real model");
    agent.warm(QUESTION);

    let events = 0;
    const firstTokenAt = { value: 0 };
    const started = Date.now();

    for await (const event of agent.stream(QUESTION)) {
      events += 1;
      if (firstTokenAt.value === 0 && event.event === "messages/partial") {
        firstTokenAt.value = Date.now() - started;
      }
    }

    console.log(
      `   ${events} stream events, first in ${firstTokenAt.value}ms, total ${Date.now() - started}ms`,
    );
    console.log(`\n--- answer ---\n${agent.answerText()}\n--------------`);

    const cited = agent.citedChunkIds();
    console.log(`\n5. cited ${cited.length} chunk(s)`);

    for (const chunkId of cited) {
      const [row] = await tx`
        select chunk_index, left(content, 60) as preview
        from public.document_chunks where id = ${chunkId}`;
      console.log(`   ${chunkId} -> chunk ${row.chunk_index}: "${row.preview}..."`);
    }

    throw new Rollback();
  });
} catch (error) {
  if (!(error instanceof Rollback)) throw error;
}

await sql.close();
console.log("\nfixture rolled back, nothing left behind");
