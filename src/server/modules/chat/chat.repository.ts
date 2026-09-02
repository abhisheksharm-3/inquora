import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import type { Database } from "@/core/database.types";
import { chatContext } from "./chat.schema";
import type { ChatRepository } from "./chat.types";

/**
 * Two calls, one each way. The old send path made six sequential reads before
 * any thinking started and two writes after, and it wrote failures into
 * `messages` so every error became a permanent conversation turn replayed as
 * history on the next request.
 */
export const createChatRepository = (db: SupabaseClient<Database>): ChatRepository => ({
  async context(chatId) {
    const { data, error } = await db.rpc("get_chat_context", { p_chat_id: chatId });

    if (error) return err(AppError.badGateway(`get_chat_context failed: ${error.message}`));
    if (!data) return err(AppError.notFound("no such chat"));

    // The database is trusted but its shape is still checked: a migration that
    // renames a field should fail here, loudly, rather than reaching the model
    // as a missing document list.
    const parsed = chatContext.safeParse(data);

    if (!parsed.success) {
      return err(
        AppError.badGateway(
          `get_chat_context returned an unexpected shape: ${parsed.error.message}`,
        ),
      );
    }

    return ok(parsed.data);
  },

  async alreadySent(chatId, clientMessageId) {
    const { data, error } = await db
      .from("messages")
      .select("id")
      .eq("chat_id", chatId)
      .eq("client_message_id", clientMessageId)
      .maybeSingle();

    if (error) {
      return err(AppError.badGateway(`could not check for a repeat: ${error.message}`));
    }

    return ok(data?.id ?? null);
  },

  async append(args) {
    const { data, error } = await db.rpc("append_message", {
      p_chat_id: args.chatId,
      p_role: args.role,
      p_content: args.content,
      p_parent_id: args.parentId ?? undefined,
      p_citation_chunk_ids: args.citationChunkIds,
      p_tokens_in: args.tokensIn,
      p_tokens_out: args.tokensOut,
      p_latency_ms: args.latencyMs,
      p_retrieval_ms: args.retrievalMs,
      p_model: args.model,
      p_client_message_id: args.clientMessageId,
    });

    // A parent from another conversation is refused by the function, which is the
    // caller's mistake rather than a fault on our side.
    if (error?.code === "23503") return err(AppError.unprocessable(error.message));
    if (error) return err(AppError.badGateway(`append_message failed: ${error.message}`));
    if (!data) return err(AppError.badGateway("append_message returned no id"));

    return ok(data);
  },
});
