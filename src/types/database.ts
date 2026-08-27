export type TypeJson = string | number | boolean | null | { [key: string]: TypeJson } | TypeJson[];

export interface TypeDatabase {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name?: string | null;
          created_at?: string;
        };
        Update: Partial<TypeDatabase["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };

      files: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: string | null;
          size: number | null;
          url: string | null;
          uploaded_at: string;
          processing_status?: "idle" | "processing" | "completed" | "failed" | null;
          processing_error?: string | null;
          indexed_chunks?: number | null;
          full_text?: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type?: string | null;
          size?: number | null;
          url?: string | null;
          uploaded_at?: string;
          processing_status?: "idle" | "processing" | "completed" | "failed" | null;
          processing_error?: string | null;
          indexed_chunks?: number | null;
          full_text?: string | null;
        };
        Update: Partial<TypeDatabase["public"]["Tables"]["files"]["Insert"]>;
        Relationships: [];
      };

      chats: {
        Row: {
          id: string;
          user_id: string;
          file_id: string | null;
          title: string | null;
          created_at: string;
          type: "pdf" | "image" | "doc" | "video" | "sheet" | "slides" | "github" | "web" | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          file_id?: string | null;
          title?: string | null;
          created_at?: string;
          type?: "pdf" | "image" | "doc" | "video" | "sheet" | "slides" | "github" | "web" | null;
        };
        Update: Partial<TypeDatabase["public"]["Tables"]["chats"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "chats_file_id_fkey";
            columns: ["file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["id"];
          },
        ];
      };

      messages: {
        Row: {
          id: string;
          chat_id: string;
          role: "user" | "assistant";
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          chat_id: string;
          role: "user" | "assistant";
          content: string;
          created_at?: string;
        };
        Update: Partial<TypeDatabase["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [];
      };

      user_memories: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: Partial<TypeDatabase["public"]["Tables"]["user_memories"]["Insert"]>;
        Relationships: [];
      };
    };

    // The shape the Supabase CLI emits for an empty section. Record<string, never>
    // is not equivalent: it makes the client's relation inference collapse.
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export type TypeUser = TypeDatabase["public"]["Tables"]["users"]["Row"];
export type TypeChat = TypeDatabase["public"]["Tables"]["chats"]["Row"];
export type TypeFile = TypeDatabase["public"]["Tables"]["files"]["Row"];
export type TypeMessage = TypeDatabase["public"]["Tables"]["messages"]["Row"] & {
  isError?: boolean;
};
export type TypeUserMemory = TypeDatabase["public"]["Tables"]["user_memories"]["Row"];

// Extended type for chats with included file data
export type TypeChatWithFile = TypeChat & {
  files?: TypeFile | null;
};
