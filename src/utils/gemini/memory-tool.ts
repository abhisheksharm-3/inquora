import { SupabaseClient } from "@supabase/supabase-js";

export type MemoryAction = "add" | "delete";

export const manageMemory = async (
    userId: string,
    action: MemoryAction,
    content: string,
    supabase: SupabaseClient
): Promise<string> => {
    if (!userId) return "Error: No user ID provided.";

    try {
        if (action === "add") {
            const { error } = await supabase.from("user_memories").insert({
                user_id: userId,
                content: content,
            });

            if (error) throw error;
            return `Successfully stored memory: "${content}"`;
        } else if (action === "delete") {
            // Basic fuzzy delete for now, or specific if exact match
            // For safety, let's delete exact matches or matches containing the text
            const { error } = await supabase
                .from("user_memories")
                .delete()
                .eq("user_id", userId)
                .ilike("content", `%${content}%`);

            if (error) throw error;
            return `Successfully deleted memory containing: "${content}"`;
        }

        return "Error: Invalid action. Use 'add' or 'delete'.";
    } catch (error) {
        console.error("Memory management error:", error);
        return `Error managing memory: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
};

export const memoryToolDefinition = {
    name: "manage_memory",
    description: "Stores or deletes a long-term memory/fact about the user. Use this when the user explicitly asks to remember/forget something, or when you learn a significant, permanent fact about the user (e.g., their name, job, or strong preference).",
    parameters: {
        type: "OBJECT",
        properties: {
            action: {
                type: "STRING",
                enum: ["add", "delete"],
                description: "The action to perform: 'add' to store a new memory, 'delete' to remove an existing one."
            },
            content: {
                type: "STRING",
                description: "The concise fact or information to store or delete (e.g. 'User is a Python developer', 'User hates broccoli')."
            }
        },
        required: ["action", "content"]
    }
};
