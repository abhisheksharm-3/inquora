export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      chat_documents: {
        Row: {
          added_at: string
          chat_id: string
          document_id: string
          enabled: boolean
          position: number
        }
        Insert: {
          added_at?: string
          chat_id: string
          document_id: string
          enabled?: boolean
          position?: number
        }
        Update: {
          added_at?: string
          chat_id?: string
          document_id?: string
          enabled?: boolean
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "chat_documents_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
          web_search: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
          web_search?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          web_search?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "chats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string
          id: string
          metadata: Json
          token_count: number | null
          tsv: unknown
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding: string
          id?: string
          metadata?: Json
          token_count?: number | null
          tsv?: unknown
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string
          id?: string
          metadata?: Json
          token_count?: number | null
          tsv?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_files: {
        Row: {
          bytes: number
          content: string
          created_at: string
          document_id: string
          id: string
          language: string
          line_count: number
          path: string
        }
        Insert: {
          bytes: number
          content: string
          created_at?: string
          document_id: string
          id?: string
          language: string
          line_count: number
          path: string
        }
        Update: {
          bytes?: number
          content?: string
          created_at?: string
          document_id?: string
          id?: string
          language?: string
          line_count?: number
          path?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_files_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_rows: {
        Row: {
          data: Json
          id: number
          row_index: number
          table_id: string
        }
        Insert: {
          data: Json
          id?: number
          row_index: number
          table_id: string
        }
        Update: {
          data?: Json
          id?: number
          row_index?: number
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_rows_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "document_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      document_tables: {
        Row: {
          created_at: string
          document_id: string
          header: string[]
          id: string
          name: string
          row_count: number
        }
        Insert: {
          created_at?: string
          document_id: string
          header: string[]
          id?: string
          name: string
          row_count?: number
        }
        Update: {
          created_at?: string
          document_id?: string
          header?: string[]
          id?: string
          name?: string
          row_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_tables_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          byte_size: number | null
          chunk_count: number
          content_hash: string
          created_at: string
          error: string | null
          expected_chunks: number | null
          extracted_text: string | null
          id: string
          indexed_at: string | null
          kind: Database["public"]["Enums"]["document_kind"]
          outline: Json | null
          source_url: string | null
          status: Database["public"]["Enums"]["processing_status"]
          storage_path: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          byte_size?: number | null
          chunk_count?: number
          content_hash: string
          created_at?: string
          error?: string | null
          expected_chunks?: number | null
          extracted_text?: string | null
          id?: string
          indexed_at?: string | null
          kind: Database["public"]["Enums"]["document_kind"]
          outline?: Json | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["processing_status"]
          storage_path?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          byte_size?: number | null
          chunk_count?: number
          content_hash?: string
          created_at?: string
          error?: string | null
          expected_chunks?: number | null
          extracted_text?: string | null
          id?: string
          indexed_at?: string | null
          kind?: Database["public"]["Enums"]["document_kind"]
          outline?: Json | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["processing_status"]
          storage_path?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_jobs: {
        Row: {
          attempts: number
          created_at: string
          document_id: string
          id: number
          last_error: string | null
          run_after: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          document_id: string
          id?: number
          last_error?: string | null
          run_after?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          document_id?: string
          id?: number
          last_error?: string | null
          run_after?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      message_parts: {
        Row: {
          chunk_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["message_part_kind"]
          message_id: string
          position: number
          text: string | null
          tool_args: Json | null
          tool_call_id: string | null
          tool_name: string | null
          tool_result: Json | null
        }
        Insert: {
          chunk_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["message_part_kind"]
          message_id: string
          position: number
          text?: string | null
          tool_args?: Json | null
          tool_call_id?: string | null
          tool_name?: string | null
          tool_result?: Json | null
        }
        Update: {
          chunk_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["message_part_kind"]
          message_id?: string
          position?: number
          text?: string | null
          tool_args?: Json | null
          tool_call_id?: string | null
          tool_name?: string | null
          tool_result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "message_parts_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "document_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_parts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          chat_id: string
          client_message_id: string | null
          created_at: string
          id: string
          latency_ms: number | null
          model: string | null
          parent_id: string | null
          retrieval_ms: number | null
          role: Database["public"]["Enums"]["message_role"]
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          chat_id: string
          client_message_id?: string | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          parent_id?: string | null
          retrieval_ms?: number | null
          role: Database["public"]["Enums"]["message_role"]
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          chat_id?: string
          client_message_id?: string | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          parent_id?: string | null
          retrieval_ms?: number | null
          role?: Database["public"]["Enums"]["message_role"]
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_memories: {
        Row: {
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_memories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ingestion_health: {
        Row: {
          chunks_stored: number | null
          failed: number | null
          pending: number | null
          processing: number | null
          ready: number | null
        }
        Relationships: []
      }
      stuck_ingestion_jobs: {
        Row: {
          attempts: number | null
          document_id: string | null
          job_id: number | null
          last_error: string | null
          overdue_by: string | null
          run_after: string | null
          status: Database["public"]["Enums"]["processing_status"] | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      append_message: {
        Args: {
          p_chat_id: string
          p_citation_chunk_ids?: string[]
          p_client_message_id?: string
          p_content: string
          p_latency_ms?: number
          p_model?: string
          p_parent_id?: string
          p_retrieval_ms?: number
          p_role: Database["public"]["Enums"]["message_role"]
          p_tokens_in?: number
          p_tokens_out?: number
        }
        Returns: string
      }
      claim_ingestion_job: {
        Args: never
        Returns: {
          attempts: number
          document_id: string
          job_id: number
        }[]
      }
      complete_ingestion_job: { Args: { p_job_id: number }; Returns: undefined }
      create_chat_with_documents: {
        Args: { p_document_ids: string[]; p_title: string }
        Returns: string
      }
      fail_ingestion_job: {
        Args: { p_error: string; p_job_id: number }
        Returns: undefined
      }
      get_chat_context: {
        Args: { p_chat_id: string; p_history_limit?: number }
        Returns: Json
      }
      grep_document: {
        Args: { p_document_id: string; p_limit?: number; p_pattern: string }
        Returns: {
          line: string
          line_number: number
          path: string
        }[]
      }
      insert_document_chunks: {
        Args: { p_chunks: Json; p_document_id: string }
        Returns: number
      }
      insert_document_files: {
        Args: { p_document_id: string; p_files: Json }
        Returns: number
      }
      insert_document_table: {
        Args: {
          p_document_id: string
          p_header: string[]
          p_name: string
          p_rows: Json
        }
        Returns: string
      }
      poke_ingestion_worker: { Args: never; Returns: undefined }
      query_document_table: {
        Args: {
          p_document_id: string
          p_limit?: number
          p_sql: string
          p_table_name: string
        }
        Returns: Json
      }
      read_document_file: {
        Args: {
          p_document_id: string
          p_from_line?: number
          p_path: string
          p_to_line?: number
        }
        Returns: {
          content: string
          from_line: number
          line_count: number
          path: string
          to_line: number
        }[]
      }
      read_document_transcript: {
        Args: { p_document_id: string; p_end_s?: number; p_start_s?: number }
        Returns: {
          chunk_index: number
          content: string
          end_s: number
          start_s: number
        }[]
      }
      retry_ingestion: { Args: { p_document_id: string }; Returns: undefined }
      search_chunks: {
        Args: {
          p_document_ids: string[]
          p_embedding: string
          p_k?: number
          p_limit?: number
          p_query: string
        }
        Returns: {
          chunk_id: string
          chunk_index: number
          content: string
          document_id: string
          embedding: unknown
          metadata: Json
          score: number
        }[]
      }
      topic_owner_matches: { Args: { p_topic: string }; Returns: boolean }
      worker_secret: { Args: { p_name: string }; Returns: string }
    }
    Enums: {
      document_kind:
        | "pdf"
        | "doc"
        | "sheet"
        | "slides"
        | "image"
        | "video"
        | "github"
        | "web"
      message_part_kind:
        | "text"
        | "reasoning"
        | "tool_call"
        | "tool_result"
        | "source"
      message_role: "user" | "assistant"
      processing_status: "pending" | "processing" | "ready" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      document_kind: [
        "pdf",
        "doc",
        "sheet",
        "slides",
        "image",
        "video",
        "github",
        "web",
      ],
      message_part_kind: [
        "text",
        "reasoning",
        "tool_call",
        "tool_result",
        "source",
      ],
      message_role: ["user", "assistant"],
      processing_status: ["pending", "processing", "ready", "failed"],
    },
  },
} as const
