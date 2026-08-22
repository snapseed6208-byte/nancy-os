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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_feedback: {
        Row: {
          agent_type: string
          created_at: string
          id: string
          rating: string | null
          reason: string | null
          reference_id: string | null
          user_id: string
        }
        Insert: {
          agent_type: string
          created_at?: string
          id?: string
          rating?: string | null
          reason?: string | null
          reference_id?: string | null
          user_id: string
        }
        Update: {
          agent_type?: string
          created_at?: string
          id?: string
          rating?: string | null
          reason?: string | null
          reference_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      agent_logs: {
        Row: {
          action: string | null
          agent_type: string
          created_at: string
          id: string
          input_data: Json | null
          model: string | null
          model_version: string | null
          output_data: Json | null
          related_goal_id: string | null
          related_task_id: string | null
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          action?: string | null
          agent_type: string
          created_at?: string
          id?: string
          input_data?: Json | null
          model?: string | null
          model_version?: string | null
          output_data?: Json | null
          related_goal_id?: string | null
          related_task_id?: string | null
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          action?: string | null
          agent_type?: string
          created_at?: string
          id?: string
          input_data?: Json | null
          model?: string | null
          model_version?: string | null
          output_data?: Json | null
          related_goal_id?: string | null
          related_task_id?: string | null
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: []
      }
      ai_daily_briefs: {
        Row: {
          created_at: string
          date: string
          focus: string | null
          id: string
          memory_refs: Json | null
          motivation: string | null
          suggestions: Json | null
          summary: string | null
          tokens_used: number | null
          user_id: string
          warnings: Json | null
        }
        Insert: {
          created_at?: string
          date: string
          focus?: string | null
          id?: string
          memory_refs?: Json | null
          motivation?: string | null
          suggestions?: Json | null
          summary?: string | null
          tokens_used?: number | null
          user_id: string
          warnings?: Json | null
        }
        Update: {
          created_at?: string
          date?: string
          focus?: string | null
          id?: string
          memory_refs?: Json | null
          motivation?: string | null
          suggestions?: Json | null
          summary?: string | null
          tokens_used?: number | null
          user_id?: string
          warnings?: Json | null
        }
        Relationships: []
      }
      ai_feedback: {
        Row: {
          action: string
          agent_type: string
          context: Json
          created_at: string
          feedback: string
          id: string
          suggestion_id: string | null
          suggestion_type: string | null
          user_comment: string | null
          user_id: string
        }
        Insert: {
          action: string
          agent_type: string
          context?: Json
          created_at?: string
          feedback: string
          id?: string
          suggestion_id?: string | null
          suggestion_type?: string | null
          user_comment?: string | null
          user_id: string
        }
        Update: {
          action?: string
          agent_type?: string
          context?: Json
          created_at?: string
          feedback?: string
          id?: string
          suggestion_id?: string | null
          suggestion_type?: string | null
          user_comment?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_insights: {
        Row: {
          agent_type: string
          content: string | null
          created_at: string
          data: Json | null
          generated_at: string
          id: string
          insight_type: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          agent_type: string
          content?: string | null
          created_at?: string
          data?: Json | null
          generated_at?: string
          id?: string
          insight_type?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          agent_type?: string
          content?: string | null
          created_at?: string
          data?: Json | null
          generated_at?: string
          id?: string
          insight_type?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_memories: {
        Row: {
          category: string | null
          confidence: number | null
          content: string
          created_at: string
          evidence: Json | null
          id: string
          importance: string | null
          is_active: boolean | null
          last_reinforced_at: string | null
          memory_type: string | null
          reinforcement_count: number | null
          related_event_id: string | null
          source: string | null
          source_date: string | null
          source_ids: Json | null
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          confidence?: number | null
          content: string
          created_at?: string
          evidence?: Json | null
          id?: string
          importance?: string | null
          is_active?: boolean | null
          last_reinforced_at?: string | null
          memory_type?: string | null
          reinforcement_count?: number | null
          related_event_id?: string | null
          source?: string | null
          source_date?: string | null
          source_ids?: Json | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          confidence?: number | null
          content?: string
          created_at?: string
          evidence?: Json | null
          id?: string
          importance?: string | null
          is_active?: boolean | null
          last_reinforced_at?: string | null
          memory_type?: string | null
          reinforcement_count?: number | null
          related_event_id?: string | null
          source?: string | null
          source_date?: string | null
          source_ids?: Json | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_memories_related_event_id_fkey"
            columns: ["related_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      body_profiles: {
        Row: {
          body_fat_percentage: number | null
          created_at: string
          fitness_goal: string | null
          focus_areas: Json | null
          height: number | null
          id: string
          notes: string | null
          target_body_fat: number | null
          target_weight: number | null
          updated_at: string
          user_id: string
          weight: number | null
        }
        Insert: {
          body_fat_percentage?: number | null
          created_at?: string
          fitness_goal?: string | null
          focus_areas?: Json | null
          height?: number | null
          id?: string
          notes?: string | null
          target_body_fat?: number | null
          target_weight?: number | null
          updated_at?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          body_fat_percentage?: number | null
          created_at?: string
          fitness_goal?: string | null
          focus_areas?: Json | null
          height?: number | null
          id?: string
          notes?: string | null
          target_body_fat?: number | null
          target_weight?: number | null
          updated_at?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          scope: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          scope?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          scope?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chinese_speaking_attempts: {
        Row: {
          ai_model: string | null
          ai_prompt_version: string | null
          answer_outline: Json | null
          asset_candidates: Json
          attempt_round: number
          audio_duration: number | null
          audio_url: string | null
          created_at: string
          deleted_at: string | null
          delivery_metrics: Json | null
          diagnosis: Json | null
          edited_transcript: string | null
          fallback_used: boolean | null
          final_improved_speech: string | null
          id: string
          is_retry: boolean
          key_improvements: Json | null
          material_understanding: Json | null
          reference_viewed_before_retry: boolean
          retry_of_attempt_id: string | null
          scores: Json | null
          session_id: string
          stt_mode: string | null
          stt_provider: string | null
          stt_success: boolean | null
          transcript: string | null
          transcript_source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_model?: string | null
          ai_prompt_version?: string | null
          answer_outline?: Json | null
          asset_candidates?: Json
          attempt_round?: number
          audio_duration?: number | null
          audio_url?: string | null
          created_at?: string
          deleted_at?: string | null
          delivery_metrics?: Json | null
          diagnosis?: Json | null
          edited_transcript?: string | null
          fallback_used?: boolean | null
          final_improved_speech?: string | null
          id?: string
          is_retry?: boolean
          key_improvements?: Json | null
          material_understanding?: Json | null
          reference_viewed_before_retry?: boolean
          retry_of_attempt_id?: string | null
          scores?: Json | null
          session_id: string
          stt_mode?: string | null
          stt_provider?: string | null
          stt_success?: boolean | null
          transcript?: string | null
          transcript_source?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_model?: string | null
          ai_prompt_version?: string | null
          answer_outline?: Json | null
          asset_candidates?: Json
          attempt_round?: number
          audio_duration?: number | null
          audio_url?: string | null
          created_at?: string
          deleted_at?: string | null
          delivery_metrics?: Json | null
          diagnosis?: Json | null
          edited_transcript?: string | null
          fallback_used?: boolean | null
          final_improved_speech?: string | null
          id?: string
          is_retry?: boolean
          key_improvements?: Json | null
          material_understanding?: Json | null
          reference_viewed_before_retry?: boolean
          retry_of_attempt_id?: string | null
          scores?: Json | null
          session_id?: string
          stt_mode?: string | null
          stt_provider?: string | null
          stt_success?: boolean | null
          transcript?: string | null
          transcript_source?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chinese_speaking_attempts_retry_of_attempt_id_fkey"
            columns: ["retry_of_attempt_id"]
            isOneToOne: false
            referencedRelation: "chinese_speaking_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chinese_speaking_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chinese_speaking_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chinese_speaking_sessions: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          material_resource_id: string | null
          mode: string
          prompt: string | null
          recommended_framework: string | null
          source_text: string | null
          source_title: string | null
          source_url: string | null
          time_limit_seconds: number
          topic: string
          topic_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          material_resource_id?: string | null
          mode?: string
          prompt?: string | null
          recommended_framework?: string | null
          source_text?: string | null
          source_title?: string | null
          source_url?: string | null
          time_limit_seconds?: number
          topic: string
          topic_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          material_resource_id?: string | null
          mode?: string
          prompt?: string | null
          recommended_framework?: string | null
          source_text?: string | null
          source_title?: string | null
          source_url?: string | null
          time_limit_seconds?: number
          topic?: string
          topic_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chinese_speaking_sessions_material_resource_id_fkey"
            columns: ["material_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_health_checklists: {
        Row: {
          ai_context: Json | null
          created_at: string
          date: string
          generated_by: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_context?: Json | null
          created_at?: string
          date: string
          generated_by?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_context?: Json | null
          created_at?: string
          date?: string
          generated_by?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_health_items: {
        Row: {
          category: string
          checklist_id: string
          completed_at: string | null
          created_at: string
          id: string
          is_completed: boolean | null
          item_type: string
          linked_goal_id: string | null
          sort_order: number | null
          title: string
          user_id: string
        }
        Insert: {
          category: string
          checklist_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean | null
          item_type?: string
          linked_goal_id?: string | null
          sort_order?: number | null
          title: string
          user_id: string
        }
        Update: {
          category?: string
          checklist_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean | null
          item_type?: string
          linked_goal_id?: string | null
          sort_order?: number | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_health_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "daily_health_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_health_items_linked_goal_id_fkey"
            columns: ["linked_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reviews: {
        Row: {
          ai_growth_insight: string | null
          ai_tomorrow_suggestion: string | null
          created_at: string
          daily_log: string | null
          date: string
          focus_minutes: number | null
          goal_progress: Json | null
          habits_completed_count: number | null
          habits_total_count: number | null
          id: string
          mood: string | null
          mood_avg: number | null
          mood_intensity: number | null
          q1_what_done: string | null
          q2_best_thing: string | null
          q3_what_chaos: string | null
          q4_tomorrow_first: string | null
          q5_spending: string | null
          tasks_completed_count: number | null
          tasks_total_count: number | null
          tomorrow_plan: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_growth_insight?: string | null
          ai_tomorrow_suggestion?: string | null
          created_at?: string
          daily_log?: string | null
          date: string
          focus_minutes?: number | null
          goal_progress?: Json | null
          habits_completed_count?: number | null
          habits_total_count?: number | null
          id?: string
          mood?: string | null
          mood_avg?: number | null
          mood_intensity?: number | null
          q1_what_done?: string | null
          q2_best_thing?: string | null
          q3_what_chaos?: string | null
          q4_tomorrow_first?: string | null
          q5_spending?: string | null
          tasks_completed_count?: number | null
          tasks_total_count?: number | null
          tomorrow_plan?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_growth_insight?: string | null
          ai_tomorrow_suggestion?: string | null
          created_at?: string
          daily_log?: string | null
          date?: string
          focus_minutes?: number | null
          goal_progress?: Json | null
          habits_completed_count?: number | null
          habits_total_count?: number | null
          id?: string
          mood?: string | null
          mood_avg?: number | null
          mood_intensity?: number | null
          q1_what_done?: string | null
          q2_best_thing?: string | null
          q3_what_chaos?: string | null
          q4_tomorrow_first?: string | null
          q5_spending?: string | null
          tasks_completed_count?: number | null
          tasks_total_count?: number | null
          tomorrow_plan?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          category: string | null
          created_at: string
          date: string
          description: string | null
          emotion: string | null
          id: string
          reflection: string | null
          related_goal_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          date: string
          description?: string | null
          emotion?: string | null
          id?: string
          reflection?: string | null
          related_goal_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          date?: string
          description?: string | null
          emotion?: string | null
          id?: string
          reflection?: string | null
          related_goal_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_related_goal_id_fkey"
            columns: ["related_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          category: string
          created_at: string
          exam_date: string | null
          id: string
          name: string
          notes: string | null
          status: string
          target_score: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          exam_date?: string | null
          id?: string
          name: string
          notes?: string | null
          status?: string
          target_score?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          exam_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          status?: string
          target_score?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exercise_library: {
        Row: {
          category: string
          created_at: string
          equipment: string | null
          id: string
          instruction: string | null
          movement_pattern: string | null
          name: string
          target_muscles: Json | null
        }
        Insert: {
          category: string
          created_at?: string
          equipment?: string | null
          id?: string
          instruction?: string | null
          movement_pattern?: string | null
          name: string
          target_muscles?: Json | null
        }
        Update: {
          category?: string
          created_at?: string
          equipment?: string | null
          id?: string
          instruction?: string | null
          movement_pattern?: string | null
          name?: string
          target_muscles?: Json | null
        }
        Relationships: []
      }
      expression_assets: {
        Row: {
          asset_data: Json
          asset_type: string
          confidence: string
          created_at: string
          evidence_quote: string
          extracted_from_transcript: string
          fact_status: string
          id: string
          quality_score: Json
          source_attempt_id: string | null
          source_ref_id: string | null
          source_session_id: string | null
          source_type: string
          status: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_data: Json
          asset_type: string
          confidence: string
          created_at?: string
          evidence_quote: string
          extracted_from_transcript: string
          fact_status?: string
          id?: string
          quality_score?: Json
          source_attempt_id?: string | null
          source_ref_id?: string | null
          source_session_id?: string | null
          source_type?: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_data?: Json
          asset_type?: string
          confidence?: string
          created_at?: string
          evidence_quote?: string
          extracted_from_transcript?: string
          fact_status?: string
          id?: string
          quality_score?: Json
          source_attempt_id?: string | null
          source_ref_id?: string | null
          source_session_id?: string | null
          source_type?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expression_assets_source_attempt_id_fkey"
            columns: ["source_attempt_id"]
            isOneToOne: false
            referencedRelation: "chinese_speaking_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expression_assets_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "chinese_speaking_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      expression_imports: {
        Row: {
          created_at: string
          id: string
          source_hash: string | null
          source_name: string | null
          source_type: string
          stats: Json | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          source_hash?: string | null
          source_name?: string | null
          source_type: string
          stats?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          source_hash?: string | null
          source_name?: string | null
          source_type?: string
          stats?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      expression_practice_logs: {
        Row: {
          answer: string | null
          created_at: string
          expression_id: string
          feedback: string | null
          id: string
          metadata: Json | null
          mode: string
          score: number | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          answer?: string | null
          created_at?: string
          expression_id: string
          feedback?: string | null
          id?: string
          metadata?: Json | null
          mode: string
          score?: number | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          answer?: string | null
          created_at?: string
          expression_id?: string
          feedback?: string | null
          id?: string
          metadata?: Json | null
          mode?: string
          score?: number | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expression_practice_logs_expression_id_fkey"
            columns: ["expression_id"]
            isOneToOne: false
            referencedRelation: "expressions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expression_practice_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "review_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      expression_profiles: {
        Row: {
          asset_stats: Json
          created_at: string
          id: string
          improvement_history: Json
          knowledge_transfer_profile: Json
          patterns: Json
          raw_signal_snapshot: Json
          strengths: Json
          updated_at: string
          user_id: string
          weaknesses: Json
        }
        Insert: {
          asset_stats?: Json
          created_at?: string
          id?: string
          improvement_history?: Json
          knowledge_transfer_profile?: Json
          patterns?: Json
          raw_signal_snapshot?: Json
          strengths?: Json
          updated_at?: string
          user_id: string
          weaknesses?: Json
        }
        Update: {
          asset_stats?: Json
          created_at?: string
          id?: string
          improvement_history?: Json
          knowledge_transfer_profile?: Json
          patterns?: Json
          raw_signal_snapshot?: Json
          strengths?: Json
          updated_at?: string
          user_id?: string
          weaknesses?: Json
        }
        Relationships: []
      }
      expression_reviews: {
        Row: {
          expression_id: string
          id: string
          new_interval: number | null
          previous_interval: number | null
          production_success: boolean | null
          result: string
          review_mode: string | null
          reviewed_at: string
          user_id: string
        }
        Insert: {
          expression_id: string
          id?: string
          new_interval?: number | null
          previous_interval?: number | null
          production_success?: boolean | null
          result: string
          review_mode?: string | null
          reviewed_at?: string
          user_id: string
        }
        Update: {
          expression_id?: string
          id?: string
          new_interval?: number | null
          previous_interval?: number | null
          production_success?: boolean | null
          result?: string
          review_mode?: string | null
          reviewed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expression_reviews_expression_id_fkey"
            columns: ["expression_id"]
            isOneToOne: false
            referencedRelation: "expressions"
            referencedColumns: ["id"]
          },
        ]
      }
      expressions: {
        Row: {
          ai_model: string | null
          ai_prompt_version: string | null
          archived: boolean | null
          category_id: string | null
          chinese: string | null
          cloze_sentence: string | null
          common_mistakes: string | null
          common_patterns: string | null
          context: string | null
          created_at: string
          difficulty_level: string | null
          ease_factor: number | null
          english: string
          english_explanation: string | null
          example_sentence: string | null
          fluency_score: number | null
          formality: string | null
          grammar_score: number | null
          id: string
          import_batch_id: string | null
          imported_from: string | null
          interval_days: number
          lapse_count: number
          last_practiced_at: string | null
          last_review_result: string | null
          last_reviewed_at: string | null
          learned_at: string | null
          mastery_level: string | null
          memory_tip: string | null
          native_usage: string | null
          naturalness_score: number | null
          next_review_date: string | null
          notes: string | null
          production_count: number
          pronunciation: string | null
          repetitions: number | null
          review_count: number | null
          review_status: string | null
          scene: string | null
          situation: string | null
          source: string | null
          source_text: string | null
          status: string | null
          streak: number | null
          synonyms: string | null
          topic: string | null
          type: string | null
          updated_at: string
          usage_note: string | null
          usefulness_level: number
          user_id: string
          vocabulary_score: number | null
        }
        Insert: {
          ai_model?: string | null
          ai_prompt_version?: string | null
          archived?: boolean | null
          category_id?: string | null
          chinese?: string | null
          cloze_sentence?: string | null
          common_mistakes?: string | null
          common_patterns?: string | null
          context?: string | null
          created_at?: string
          difficulty_level?: string | null
          ease_factor?: number | null
          english: string
          english_explanation?: string | null
          example_sentence?: string | null
          fluency_score?: number | null
          formality?: string | null
          grammar_score?: number | null
          id?: string
          import_batch_id?: string | null
          imported_from?: string | null
          interval_days?: number
          lapse_count?: number
          last_practiced_at?: string | null
          last_review_result?: string | null
          last_reviewed_at?: string | null
          learned_at?: string | null
          mastery_level?: string | null
          memory_tip?: string | null
          native_usage?: string | null
          naturalness_score?: number | null
          next_review_date?: string | null
          notes?: string | null
          production_count?: number
          pronunciation?: string | null
          repetitions?: number | null
          review_count?: number | null
          review_status?: string | null
          scene?: string | null
          situation?: string | null
          source?: string | null
          source_text?: string | null
          status?: string | null
          streak?: number | null
          synonyms?: string | null
          topic?: string | null
          type?: string | null
          updated_at?: string
          usage_note?: string | null
          usefulness_level?: number
          user_id: string
          vocabulary_score?: number | null
        }
        Update: {
          ai_model?: string | null
          ai_prompt_version?: string | null
          archived?: boolean | null
          category_id?: string | null
          chinese?: string | null
          cloze_sentence?: string | null
          common_mistakes?: string | null
          common_patterns?: string | null
          context?: string | null
          created_at?: string
          difficulty_level?: string | null
          ease_factor?: number | null
          english?: string
          english_explanation?: string | null
          example_sentence?: string | null
          fluency_score?: number | null
          formality?: string | null
          grammar_score?: number | null
          id?: string
          import_batch_id?: string | null
          imported_from?: string | null
          interval_days?: number
          lapse_count?: number
          last_practiced_at?: string | null
          last_review_result?: string | null
          last_reviewed_at?: string | null
          learned_at?: string | null
          mastery_level?: string | null
          memory_tip?: string | null
          native_usage?: string | null
          naturalness_score?: number | null
          next_review_date?: string | null
          notes?: string | null
          production_count?: number
          pronunciation?: string | null
          repetitions?: number | null
          review_count?: number | null
          review_status?: string | null
          scene?: string | null
          situation?: string | null
          source?: string | null
          source_text?: string | null
          status?: string | null
          streak?: number | null
          synonyms?: string | null
          topic?: string | null
          type?: string | null
          updated_at?: string
          usage_note?: string | null
          usefulness_level?: number
          user_id?: string
          vocabulary_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expressions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      food_records: {
        Row: {
          carb: string | null
          checklist: Json | null
          created_at: string
          date: string
          drink: string | null
          feeling: string | null
          food_name: string
          fullness: number | null
          health_feeling: string | null
          id: string
          image_urls: Json | null
          meal_type: string
          notes: string | null
          portion: string | null
          protein: string | null
          recipe_id: string | null
          record_time: string | null
          user_id: string
          vegetables: string | null
        }
        Insert: {
          carb?: string | null
          checklist?: Json | null
          created_at?: string
          date: string
          drink?: string | null
          feeling?: string | null
          food_name: string
          fullness?: number | null
          health_feeling?: string | null
          id?: string
          image_urls?: Json | null
          meal_type: string
          notes?: string | null
          portion?: string | null
          protein?: string | null
          recipe_id?: string | null
          record_time?: string | null
          user_id: string
          vegetables?: string | null
        }
        Update: {
          carb?: string | null
          checklist?: Json | null
          created_at?: string
          date?: string
          drink?: string | null
          feeling?: string | null
          food_name?: string
          fullness?: number | null
          health_feeling?: string | null
          id?: string
          image_urls?: Json | null
          meal_type?: string
          notes?: string | null
          portion?: string | null
          protein?: string | null
          recipe_id?: string | null
          record_time?: string | null
          user_id?: string
          vegetables?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_records_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          category: string
          color: string | null
          created_at: string
          current_metric: string | null
          description: string | null
          goal_category: string | null
          goal_level: string | null
          icon: string | null
          id: string
          module: string | null
          parent_goal_id: string | null
          progress: number | null
          sort_order: number | null
          start_date: string | null
          status: string
          target_date: string | null
          target_metric: string | null
          title: string
          updated_at: string
          user_id: string
          why: string | null
        }
        Insert: {
          category: string
          color?: string | null
          created_at?: string
          current_metric?: string | null
          description?: string | null
          goal_category?: string | null
          goal_level?: string | null
          icon?: string | null
          id?: string
          module?: string | null
          parent_goal_id?: string | null
          progress?: number | null
          sort_order?: number | null
          start_date?: string | null
          status?: string
          target_date?: string | null
          target_metric?: string | null
          title: string
          updated_at?: string
          user_id: string
          why?: string | null
        }
        Update: {
          category?: string
          color?: string | null
          created_at?: string
          current_metric?: string | null
          description?: string | null
          goal_category?: string | null
          goal_level?: string | null
          icon?: string | null
          id?: string
          module?: string | null
          parent_goal_id?: string | null
          progress?: number | null
          sort_order?: number | null
          start_date?: string | null
          status?: string
          target_date?: string | null
          target_metric?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_parent_goal_id_fkey"
            columns: ["parent_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_analyses: {
        Row: {
          analysis_type: string
          created_at: string
          habit_id: string | null
          id: string
          motivation: string | null
          period_end: string
          period_start: string
          stats: Json | null
          strengths: string[] | null
          suggestions: string[] | null
          summary: string | null
          user_id: string
        }
        Insert: {
          analysis_type?: string
          created_at?: string
          habit_id?: string | null
          id?: string
          motivation?: string | null
          period_end: string
          period_start: string
          stats?: Json | null
          strengths?: string[] | null
          suggestions?: string[] | null
          summary?: string | null
          user_id: string
        }
        Update: {
          analysis_type?: string
          created_at?: string
          habit_id?: string | null
          id?: string
          motivation?: string | null
          period_end?: string
          period_start?: string
          stats?: Json | null
          strengths?: string[] | null
          suggestions?: string[] | null
          summary?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_analyses_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_records: {
        Row: {
          created_at: string
          date: string
          energy_level: string | null
          habit_id: string
          id: string
          note: string | null
          status: string
          user_id: string
          value: number | null
        }
        Insert: {
          created_at?: string
          date: string
          energy_level?: string | null
          habit_id: string
          id?: string
          note?: string | null
          status?: string
          user_id: string
          value?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          energy_level?: string | null
          habit_id?: string
          id?: string
          note?: string | null
          status?: string
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "habit_records_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          category: string | null
          color: string | null
          created_at: string
          frequency_type: string
          frequency_value: number
          icon: string | null
          id: string
          is_active: boolean | null
          module: string | null
          reminder_time: string | null
          streak_best: number | null
          title: string
          user_id: string
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string
          frequency_type?: string
          frequency_value?: number
          icon?: string | null
          id?: string
          is_active?: boolean | null
          module?: string | null
          reminder_time?: string | null
          streak_best?: number | null
          title: string
          user_id: string
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string
          frequency_type?: string
          frequency_value?: number
          icon?: string | null
          id?: string
          is_active?: boolean | null
          module?: string | null
          reminder_time?: string | null
          streak_best?: number | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      ideas: {
        Row: {
          ai_category: string | null
          category: string | null
          content: string
          content_type: string
          created_at: string
          id: string
          media_urls: Json | null
          related_goal_id: string | null
          related_task_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_category?: string | null
          category?: string | null
          content: string
          content_type?: string
          created_at?: string
          id?: string
          media_urls?: Json | null
          related_goal_id?: string | null
          related_task_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_category?: string | null
          category?: string | null
          content?: string
          content_type?: string
          created_at?: string
          id?: string
          media_urls?: Json | null
          related_goal_id?: string | null
          related_task_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ideas_related_goal_id_fkey"
            columns: ["related_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideas_related_task_id_fkey"
            columns: ["related_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      important_events: {
        Row: {
          created_at: string
          description: string | null
          event_date: string
          event_time: string | null
          event_type: string
          id: string
          is_completed: boolean
          priority: string
          related_task_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_date: string
          event_time?: string | null
          event_type?: string
          id?: string
          is_completed?: boolean
          priority?: string
          related_task_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_date?: string
          event_time?: string | null
          event_type?: string
          id?: string
          is_completed?: boolean
          priority?: string
          related_task_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      interviews: {
        Row: {
          ai_feedback: string | null
          created_at: string
          format: string | null
          id: string
          interview_date: string | null
          interviewer: string | null
          job_id: string | null
          notes: string | null
          questions_asked: string | null
          result: string | null
          round_number: number | null
          self_assessment: string | null
          user_id: string
        }
        Insert: {
          ai_feedback?: string | null
          created_at?: string
          format?: string | null
          id?: string
          interview_date?: string | null
          interviewer?: string | null
          job_id?: string | null
          notes?: string | null
          questions_asked?: string | null
          result?: string | null
          round_number?: number | null
          self_assessment?: string | null
          user_id: string
        }
        Update: {
          ai_feedback?: string | null
          created_at?: string
          format?: string | null
          id?: string
          interview_date?: string | null
          interviewer?: string | null
          job_id?: string | null
          notes?: string | null
          questions_asked?: string | null
          result?: string | null
          round_number?: number | null
          self_assessment?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          applied_date: string | null
          company_name: string
          created_at: string
          id: string
          industry: string | null
          jd_text: string | null
          jd_url: string | null
          location: string | null
          notes: string | null
          position: string
          salary_range: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_date?: string | null
          company_name: string
          created_at?: string
          id?: string
          industry?: string | null
          jd_text?: string | null
          jd_url?: string | null
          location?: string | null
          notes?: string | null
          position: string
          salary_range?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_date?: string | null
          company_name?: string
          created_at?: string
          id?: string
          industry?: string | null
          jd_text?: string | null
          jd_url?: string | null
          location?: string | null
          notes?: string | null
          position?: string
          salary_range?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          ai_actions: Json | null
          ai_analysis_version: string | null
          ai_emotion_analysis: string | null
          ai_events: string[] | null
          ai_insights: Json | null
          ai_keywords: string[] | null
          ai_patterns: Json | null
          ai_suggestions: Json | null
          ai_summary: string | null
          ai_themes: string[] | null
          ai_thoughts: Json | null
          content: string | null
          created_at: string
          date: string
          energy_level: string | null
          id: string
          location: string | null
          mood: string | null
          title: string | null
          todos: Json | null
          top_three: Json | null
          updated_at: string | null
          user_id: string
          weather: string | null
        }
        Insert: {
          ai_actions?: Json | null
          ai_analysis_version?: string | null
          ai_emotion_analysis?: string | null
          ai_events?: string[] | null
          ai_insights?: Json | null
          ai_keywords?: string[] | null
          ai_patterns?: Json | null
          ai_suggestions?: Json | null
          ai_summary?: string | null
          ai_themes?: string[] | null
          ai_thoughts?: Json | null
          content?: string | null
          created_at?: string
          date: string
          energy_level?: string | null
          id?: string
          location?: string | null
          mood?: string | null
          title?: string | null
          todos?: Json | null
          top_three?: Json | null
          updated_at?: string | null
          user_id: string
          weather?: string | null
        }
        Update: {
          ai_actions?: Json | null
          ai_analysis_version?: string | null
          ai_emotion_analysis?: string | null
          ai_events?: string[] | null
          ai_insights?: Json | null
          ai_keywords?: string[] | null
          ai_patterns?: Json | null
          ai_suggestions?: Json | null
          ai_summary?: string | null
          ai_themes?: string[] | null
          ai_thoughts?: Json | null
          content?: string | null
          created_at?: string
          date?: string
          energy_level?: string | null
          id?: string
          location?: string | null
          mood?: string | null
          title?: string | null
          todos?: Json | null
          top_three?: Json | null
          updated_at?: string | null
          user_id?: string
          weather?: string | null
        }
        Relationships: []
      }
      meal_plans: {
        Row: {
          created_at: string
          custom_meal: string | null
          day_of_week: number
          id: string
          meal_type: string
          notes: string | null
          recipe_id: string | null
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          custom_meal?: string | null
          day_of_week: number
          id?: string
          meal_type: string
          notes?: string | null
          recipe_id?: string | null
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          custom_meal?: string | null
          day_of_week?: number
          id?: string
          meal_type?: string
          notes?: string | null
          recipe_id?: string | null
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_feedback: {
        Row: {
          action: string
          created_at: string
          id: string
          memory_id: string | null
          modified_content: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          memory_id?: string | null
          modified_content?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          memory_id?: string | null
          modified_content?: string | null
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_feedback_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "ai_memories"
            referencedColumns: ["id"]
          },
        ]
      }
      money_records: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          date: string
          id: string
          necessity: string | null
          note: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          date: string
          id?: string
          necessity?: string | null
          note?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          date?: string
          id?: string
          necessity?: string | null
          note?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      mood_records: {
        Row: {
          ai_analysis: string | null
          created_at: string
          date: string
          energy_level: string | null
          id: string
          intensity: number | null
          mood: string
          notes: string | null
          related_factors: Json | null
          time_of_day: string | null
          trigger_event: string | null
          user_id: string
        }
        Insert: {
          ai_analysis?: string | null
          created_at?: string
          date: string
          energy_level?: string | null
          id?: string
          intensity?: number | null
          mood: string
          notes?: string | null
          related_factors?: Json | null
          time_of_day?: string | null
          trigger_event?: string | null
          user_id: string
        }
        Update: {
          ai_analysis?: string | null
          created_at?: string
          date?: string
          energy_level?: string | null
          id?: string
          intensity?: number | null
          mood?: string
          notes?: string | null
          related_factors?: Json | null
          time_of_day?: string | null
          trigger_event?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          career_field: string | null
          created_at: string
          current_milestone: string | null
          display_name: string | null
          energy_pattern: Json | null
          id: string
          industry: string | null
          language_preference: string | null
          life_theme: string | null
          onboarding_completed: boolean | null
          phone: string | null
          preferences: Json | null
          social_links: Json | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          career_field?: string | null
          created_at?: string
          current_milestone?: string | null
          display_name?: string | null
          energy_pattern?: Json | null
          id: string
          industry?: string | null
          language_preference?: string | null
          life_theme?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          preferences?: Json | null
          social_links?: Json | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          career_field?: string | null
          created_at?: string
          current_milestone?: string | null
          display_name?: string | null
          energy_pattern?: Json | null
          id?: string
          industry?: string | null
          language_preference?: string | null
          life_theme?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          preferences?: Json | null
          social_links?: Json | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recipe_extraction_logs: {
        Row: {
          created_at: string
          error_message: string | null
          extractor: string
          id: string
          recipe_id: string | null
          source_type: string | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          extractor?: string
          id?: string
          recipe_id?: string | null
          source_type?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          extractor?: string
          id?: string
          recipe_id?: string | null
          source_type?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_extraction_logs_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          ai_analysis_status: string | null
          ai_analyzed_at: string | null
          ai_summary: string | null
          budget_level: string | null
          calories_per_serving: number | null
          carbs_grams: number | null
          category: string | null
          confidence: string | null
          cook_count: number | null
          created_at: string
          fat_grams: number | null
          goal: string[] | null
          health_level: string | null
          id: string
          image_url: string | null
          ingredients: string | null
          ingredients_json: Json | null
          is_favorite: boolean | null
          last_cooked_at: string | null
          meal_time: Json | null
          name: string
          notes: string | null
          protein_grams: number | null
          source_content: Json | null
          source_platform: string | null
          source_type: string | null
          source_url: string | null
          steps: string | null
          steps_json: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_analysis_status?: string | null
          ai_analyzed_at?: string | null
          ai_summary?: string | null
          budget_level?: string | null
          calories_per_serving?: number | null
          carbs_grams?: number | null
          category?: string | null
          confidence?: string | null
          cook_count?: number | null
          created_at?: string
          fat_grams?: number | null
          goal?: string[] | null
          health_level?: string | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          ingredients_json?: Json | null
          is_favorite?: boolean | null
          last_cooked_at?: string | null
          meal_time?: Json | null
          name?: string
          notes?: string | null
          protein_grams?: number | null
          source_content?: Json | null
          source_platform?: string | null
          source_type?: string | null
          source_url?: string | null
          steps?: string | null
          steps_json?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_analysis_status?: string | null
          ai_analyzed_at?: string | null
          ai_summary?: string | null
          budget_level?: string | null
          calories_per_serving?: number | null
          carbs_grams?: number | null
          category?: string | null
          confidence?: string | null
          cook_count?: number | null
          created_at?: string
          fat_grams?: number | null
          goal?: string[] | null
          health_level?: string | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          ingredients_json?: Json | null
          is_favorite?: boolean | null
          last_cooked_at?: string | null
          meal_time?: Json | null
          name?: string
          notes?: string | null
          protein_grams?: number | null
          source_content?: Json | null
          source_platform?: string | null
          source_type?: string | null
          source_url?: string | null
          steps?: string | null
          steps_json?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_task_templates: {
        Row: {
          created_at: string
          description: string | null
          energy_level: string | null
          estimated_minutes: number | null
          frequency_type: string
          goal_id: string | null
          id: string
          is_active: boolean
          module: string | null
          priority: string
          source_type: string | null
          target_count: number
          time_slot: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          energy_level?: string | null
          estimated_minutes?: number | null
          frequency_type: string
          goal_id?: string | null
          id?: string
          is_active?: boolean
          module?: string | null
          priority?: string
          source_type?: string | null
          target_count?: number
          time_slot?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          energy_level?: string | null
          estimated_minutes?: number | null
          frequency_type?: string
          goal_id?: string | null
          id?: string
          is_active?: boolean
          module?: string | null
          priority?: string
          source_type?: string | null
          target_count?: number
          time_slot?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_task_templates_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_tags: {
        Row: {
          resource_id: string
          tag_id: string
        }
        Insert: {
          resource_id: string
          tag_id: string
        }
        Update: {
          resource_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_tags_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          ai_action_items: Json | null
          ai_analysis: Json | null
          ai_applicable_scenarios: Json | null
          ai_category: string | null
          ai_important_quotes: Json | null
          ai_key_points: Json | null
          ai_recommended_category: Json | null
          ai_related_knowledge: Json | null
          ai_source_extracted_at: string | null
          ai_summary: string | null
          ai_tags: Json | null
          author: string | null
          category_id: string | null
          content_type: string | null
          created_at: string
          description: string | null
          id: string
          is_archived: boolean | null
          is_favorite: boolean | null
          metadata: Json | null
          module: string | null
          notes: string | null
          parse_status: string | null
          platform: string | null
          raw_content: string | null
          read_progress: number | null
          related_goal_id: string | null
          related_task_id: string | null
          resource_type: string | null
          source_author: string | null
          source_cover: string | null
          source_platform: string | null
          source_title: string | null
          source_url: string | null
          status: string | null
          tags: Json | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          url: string | null
          user_id: string
          user_notes: string | null
        }
        Insert: {
          ai_action_items?: Json | null
          ai_analysis?: Json | null
          ai_applicable_scenarios?: Json | null
          ai_category?: string | null
          ai_important_quotes?: Json | null
          ai_key_points?: Json | null
          ai_recommended_category?: Json | null
          ai_related_knowledge?: Json | null
          ai_source_extracted_at?: string | null
          ai_summary?: string | null
          ai_tags?: Json | null
          author?: string | null
          category_id?: string | null
          content_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean | null
          is_favorite?: boolean | null
          metadata?: Json | null
          module?: string | null
          notes?: string | null
          parse_status?: string | null
          platform?: string | null
          raw_content?: string | null
          read_progress?: number | null
          related_goal_id?: string | null
          related_task_id?: string | null
          resource_type?: string | null
          source_author?: string | null
          source_cover?: string | null
          source_platform?: string | null
          source_title?: string | null
          source_url?: string | null
          status?: string | null
          tags?: Json | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          url?: string | null
          user_id: string
          user_notes?: string | null
        }
        Update: {
          ai_action_items?: Json | null
          ai_analysis?: Json | null
          ai_applicable_scenarios?: Json | null
          ai_category?: string | null
          ai_important_quotes?: Json | null
          ai_key_points?: Json | null
          ai_recommended_category?: Json | null
          ai_related_knowledge?: Json | null
          ai_source_extracted_at?: string | null
          ai_summary?: string | null
          ai_tags?: Json | null
          author?: string | null
          category_id?: string | null
          content_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean | null
          is_favorite?: boolean | null
          metadata?: Json | null
          module?: string | null
          notes?: string | null
          parse_status?: string | null
          platform?: string | null
          raw_content?: string | null
          read_progress?: number | null
          related_goal_id?: string | null
          related_task_id?: string | null
          resource_type?: string | null
          source_author?: string | null
          source_cover?: string | null
          source_platform?: string | null
          source_title?: string | null
          source_url?: string | null
          status?: string | null
          tags?: Json | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
          user_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_related_goal_id_fkey"
            columns: ["related_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_related_task_id_fkey"
            columns: ["related_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      review_session_items: {
        Row: {
          ai_feedback: string | null
          application_score: number | null
          attempt_count: number
          created_at: string
          difficulty_diagnosis: Json | null
          expression_id: string
          id: string
          last_practice_at: string | null
          personal_context: Json | null
          recall_score: number | null
          reinforcement_round: number
          reinforcement_status: string | null
          result_classification: string | null
          sentence_score: number | null
          session_id: string
          status: string
          user_sentence: string | null
        }
        Insert: {
          ai_feedback?: string | null
          application_score?: number | null
          attempt_count?: number
          created_at?: string
          difficulty_diagnosis?: Json | null
          expression_id: string
          id?: string
          last_practice_at?: string | null
          personal_context?: Json | null
          recall_score?: number | null
          reinforcement_round?: number
          reinforcement_status?: string | null
          result_classification?: string | null
          sentence_score?: number | null
          session_id: string
          status?: string
          user_sentence?: string | null
        }
        Update: {
          ai_feedback?: string | null
          application_score?: number | null
          attempt_count?: number
          created_at?: string
          difficulty_diagnosis?: Json | null
          expression_id?: string
          id?: string
          last_practice_at?: string | null
          personal_context?: Json | null
          recall_score?: number | null
          reinforcement_round?: number
          reinforcement_status?: string | null
          result_classification?: string | null
          sentence_score?: number | null
          session_id?: string
          status?: string
          user_sentence?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_session_items_expression_id_fkey"
            columns: ["expression_id"]
            isOneToOne: false
            referencedRelation: "expressions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_session_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "review_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      review_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          current_stage: string
          id: string
          learn_progress: Json | null
          session_date: string
          session_type: string
          status: string
          target_count: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_stage?: string
          id?: string
          learn_progress?: Json | null
          session_date?: string
          session_type?: string
          status?: string
          target_count?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_stage?: string
          id?: string
          learn_progress?: Json | null
          session_date?: string
          session_type?: string
          status?: string
          target_count?: number
          user_id?: string
        }
        Relationships: []
      }
      speaking_attempts: {
        Row: {
          ai_model: string | null
          ai_prompt_version: string | null
          answer: string | null
          answer_structure: Json | null
          attempt_round: number
          audio_duration: number | null
          audio_url: string | null
          better_chunks: string | null
          combined_feedback: string | null
          content_analysis: Json | null
          created_at: string
          deleted_at: string | null
          diagnosis: string | null
          expression_upgrade: Json | null
          expressions_missed: Json | null
          expressions_used: Json | null
          fallback_used: boolean | null
          fluency_score: number | null
          grammar_score: number | null
          id: string
          is_retry: boolean
          key_improvements: string | null
          key_upgrades: Json | null
          main_problems: string | null
          natural_version: string | null
          naturalness_score: number | null
          one_better_example: string | null
          reference_answer: string | null
          retry_of_attempt_id: string | null
          session_id: string | null
          structured_better_answer: string | null
          stt_mode: string | null
          stt_provider: string | null
          transcribed_text: string | null
          useful_corrections: string | null
          user_id: string
          vocabulary_score: number | null
        }
        Insert: {
          ai_model?: string | null
          ai_prompt_version?: string | null
          answer?: string | null
          answer_structure?: Json | null
          attempt_round?: number
          audio_duration?: number | null
          audio_url?: string | null
          better_chunks?: string | null
          combined_feedback?: string | null
          content_analysis?: Json | null
          created_at?: string
          deleted_at?: string | null
          diagnosis?: string | null
          expression_upgrade?: Json | null
          expressions_missed?: Json | null
          expressions_used?: Json | null
          fallback_used?: boolean | null
          fluency_score?: number | null
          grammar_score?: number | null
          id?: string
          is_retry?: boolean
          key_improvements?: string | null
          key_upgrades?: Json | null
          main_problems?: string | null
          natural_version?: string | null
          naturalness_score?: number | null
          one_better_example?: string | null
          reference_answer?: string | null
          retry_of_attempt_id?: string | null
          session_id?: string | null
          structured_better_answer?: string | null
          stt_mode?: string | null
          stt_provider?: string | null
          transcribed_text?: string | null
          useful_corrections?: string | null
          user_id: string
          vocabulary_score?: number | null
        }
        Update: {
          ai_model?: string | null
          ai_prompt_version?: string | null
          answer?: string | null
          answer_structure?: Json | null
          attempt_round?: number
          audio_duration?: number | null
          audio_url?: string | null
          better_chunks?: string | null
          combined_feedback?: string | null
          content_analysis?: Json | null
          created_at?: string
          deleted_at?: string | null
          diagnosis?: string | null
          expression_upgrade?: Json | null
          expressions_missed?: Json | null
          expressions_used?: Json | null
          fallback_used?: boolean | null
          fluency_score?: number | null
          grammar_score?: number | null
          id?: string
          is_retry?: boolean
          key_improvements?: string | null
          key_upgrades?: Json | null
          main_problems?: string | null
          natural_version?: string | null
          naturalness_score?: number | null
          one_better_example?: string | null
          reference_answer?: string | null
          retry_of_attempt_id?: string | null
          session_id?: string | null
          structured_better_answer?: string | null
          stt_mode?: string | null
          stt_provider?: string | null
          transcribed_text?: string | null
          useful_corrections?: string | null
          user_id?: string
          vocabulary_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "speaking_attempts_retry_of_attempt_id_fkey"
            columns: ["retry_of_attempt_id"]
            isOneToOne: false
            referencedRelation: "speaking_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaking_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "speaking_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      speaking_import_batches: {
        Row: {
          created_at: string
          id: string
          imported_count: number
          source: string | null
          status: string
          total_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          imported_count?: number
          source?: string | null
          status?: string
          total_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          imported_count?: number
          source?: string | null
          status?: string
          total_count?: number
          user_id?: string
        }
        Relationships: []
      }
      speaking_question_history: {
        Row: {
          created_at: string
          fluency_score: number | null
          grammar_score: number | null
          id: string
          naturalness_score: number | null
          practiced_at: string
          question_id: string
          session_id: string | null
          user_id: string
          vocabulary_score: number | null
        }
        Insert: {
          created_at?: string
          fluency_score?: number | null
          grammar_score?: number | null
          id?: string
          naturalness_score?: number | null
          practiced_at?: string
          question_id: string
          session_id?: string | null
          user_id: string
          vocabulary_score?: number | null
        }
        Update: {
          created_at?: string
          fluency_score?: number | null
          grammar_score?: number | null
          id?: string
          naturalness_score?: number | null
          practiced_at?: string
          question_id?: string
          session_id?: string | null
          user_id?: string
          vocabulary_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "speaking_question_history_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "speaking_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaking_question_history_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "speaking_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      speaking_questions: {
        Row: {
          content_hash: string
          context: string | null
          created_at: string
          cue_points: Json | null
          difficulty: string
          id: string
          import_batch_id: string | null
          is_active: boolean
          last_used_at: string | null
          mode: string
          normalized_question: string
          part: string | null
          question: string
          source_ref: string | null
          source_type: string
          tags: string[] | null
          topic: string
          updated_at: string
          usage_count: number
          user_id: string
        }
        Insert: {
          content_hash: string
          context?: string | null
          created_at?: string
          cue_points?: Json | null
          difficulty?: string
          id?: string
          import_batch_id?: string | null
          is_active?: boolean
          last_used_at?: string | null
          mode: string
          normalized_question: string
          part?: string | null
          question: string
          source_ref?: string | null
          source_type?: string
          tags?: string[] | null
          topic: string
          updated_at?: string
          usage_count?: number
          user_id: string
        }
        Update: {
          content_hash?: string
          context?: string | null
          created_at?: string
          cue_points?: Json | null
          difficulty?: string
          id?: string
          import_batch_id?: string | null
          is_active?: boolean
          last_used_at?: string | null
          mode?: string
          normalized_question?: string
          part?: string | null
          question?: string
          source_ref?: string | null
          source_type?: string
          tags?: string[] | null
          topic?: string
          updated_at?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: []
      }
      speaking_sessions: {
        Row: {
          category: string | null
          context: string | null
          created_at: string
          deleted_at: string | null
          duration_seconds: number | null
          expression_ids: string[] | null
          id: string
          is_test: boolean | null
          learning_notes: string | null
          mode: string | null
          new_expressions_learned: number | null
          prompt: string | null
          question_id: string | null
          recommended_expressions: Json | null
          scenario: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          context?: string | null
          created_at?: string
          deleted_at?: string | null
          duration_seconds?: number | null
          expression_ids?: string[] | null
          id?: string
          is_test?: boolean | null
          learning_notes?: string | null
          mode?: string | null
          new_expressions_learned?: number | null
          prompt?: string | null
          question_id?: string | null
          recommended_expressions?: Json | null
          scenario?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          context?: string | null
          created_at?: string
          deleted_at?: string | null
          duration_seconds?: number | null
          expression_ids?: string[] | null
          id?: string
          is_test?: boolean | null
          learning_notes?: string | null
          mode?: string | null
          new_expressions_learned?: number | null
          prompt?: string | null
          question_id?: string | null
          recommended_expressions?: Json | null
          scenario?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "speaking_sessions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "speaking_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          created_at: string
          date: string
          duration_minutes: number
          exam_id: string | null
          id: string
          notes: string | null
          score: number | null
          topic: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          duration_minutes: number
          exam_id?: string | null
          id?: string
          notes?: string | null
          score?: number | null
          topic?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          duration_minutes?: number
          exam_id?: string | null
          id?: string
          notes?: string | null
          score?: number | null
          topic?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      task_completion_records: {
        Row: {
          completed_at: string
          completion_date: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          completion_date: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          completion_date?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completion_records_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_minutes: number | null
          ai_review_status: string | null
          approved_at: string | null
          category: string | null
          completed_at: string | null
          completed_count: number
          created_at: string
          cycle_start_date: string | null
          description: string | null
          due_date: string | null
          energy_cost: string | null
          energy_level: string | null
          estimated_minutes: number | null
          frequency_type: string | null
          goal_id: string | null
          id: string
          instance_date: string | null
          is_today_focus: boolean | null
          module: string | null
          monthly_plan_id: string | null
          priority: string
          recurring_rule: string | null
          scheduled_time_end: string | null
          scheduled_time_start: string | null
          source_id: string | null
          source_type: string | null
          start_date: string | null
          status: string
          target_count: number
          task_type: string
          template_id: string | null
          time_slot: string | null
          title: string
          updated_at: string
          user_id: string
          weekly_theme_id: string | null
        }
        Insert: {
          actual_minutes?: number | null
          ai_review_status?: string | null
          approved_at?: string | null
          category?: string | null
          completed_at?: string | null
          completed_count?: number
          created_at?: string
          cycle_start_date?: string | null
          description?: string | null
          due_date?: string | null
          energy_cost?: string | null
          energy_level?: string | null
          estimated_minutes?: number | null
          frequency_type?: string | null
          goal_id?: string | null
          id?: string
          instance_date?: string | null
          is_today_focus?: boolean | null
          module?: string | null
          monthly_plan_id?: string | null
          priority?: string
          recurring_rule?: string | null
          scheduled_time_end?: string | null
          scheduled_time_start?: string | null
          source_id?: string | null
          source_type?: string | null
          start_date?: string | null
          status?: string
          target_count?: number
          task_type?: string
          template_id?: string | null
          time_slot?: string | null
          title: string
          updated_at?: string
          user_id: string
          weekly_theme_id?: string | null
        }
        Update: {
          actual_minutes?: number | null
          ai_review_status?: string | null
          approved_at?: string | null
          category?: string | null
          completed_at?: string | null
          completed_count?: number
          created_at?: string
          cycle_start_date?: string | null
          description?: string | null
          due_date?: string | null
          energy_cost?: string | null
          energy_level?: string | null
          estimated_minutes?: number | null
          frequency_type?: string | null
          goal_id?: string | null
          id?: string
          instance_date?: string | null
          is_today_focus?: boolean | null
          module?: string | null
          monthly_plan_id?: string | null
          priority?: string
          recurring_rule?: string | null
          scheduled_time_end?: string | null
          scheduled_time_start?: string | null
          source_id?: string | null
          source_type?: string | null
          start_date?: string | null
          status?: string
          target_count?: number
          task_type?: string
          template_id?: string | null
          time_slot?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          weekly_theme_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "recurring_task_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_weekly_theme_id_fkey"
            columns: ["weekly_theme_id"]
            isOneToOne: false
            referencedRelation: "weekly_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      water_records: {
        Row: {
          amount_ml: number
          created_at: string
          id: string
          recorded_at: string
          user_id: string
        }
        Insert: {
          amount_ml: number
          created_at?: string
          id?: string
          recorded_at?: string
          user_id: string
        }
        Update: {
          amount_ml?: number
          created_at?: string
          id?: string
          recorded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_summaries: {
        Row: {
          created_at: string
          english_expressions_learned: number | null
          english_speaking_sessions: number | null
          focus_hours: number | null
          habits_streak_days: number | null
          highlights: string | null
          id: string
          lowlights: string | null
          mood_avg: number | null
          next_week_focus: string | null
          next_week_plan: Json | null
          overview: string | null
          tasks_completed: number | null
          title: string
          top_insight: string | null
          user_id: string
          week_end: string | null
          week_start: string
          workout_days: number | null
        }
        Insert: {
          created_at?: string
          english_expressions_learned?: number | null
          english_speaking_sessions?: number | null
          focus_hours?: number | null
          habits_streak_days?: number | null
          highlights?: string | null
          id?: string
          lowlights?: string | null
          mood_avg?: number | null
          next_week_focus?: string | null
          next_week_plan?: Json | null
          overview?: string | null
          tasks_completed?: number | null
          title: string
          top_insight?: string | null
          user_id: string
          week_end?: string | null
          week_start: string
          workout_days?: number | null
        }
        Update: {
          created_at?: string
          english_expressions_learned?: number | null
          english_speaking_sessions?: number | null
          focus_hours?: number | null
          habits_streak_days?: number | null
          highlights?: string | null
          id?: string
          lowlights?: string | null
          mood_avg?: number | null
          next_week_focus?: string | null
          next_week_plan?: Json | null
          overview?: string | null
          tasks_completed?: number | null
          title?: string
          top_insight?: string | null
          user_id?: string
          week_end?: string | null
          week_start?: string
          workout_days?: number | null
        }
        Relationships: []
      }
      weekly_themes: {
        Row: {
          category: string | null
          check_in_type: string | null
          check_ins: Json | null
          color: string | null
          created_at: string
          daily_action: string | null
          end_date: string
          icon: string | null
          id: string
          minimum_standard: string | null
          start_date: string
          status: string
          template_id: string | null
          title: string
          user_id: string
          weekly_goal: string | null
        }
        Insert: {
          category?: string | null
          check_in_type?: string | null
          check_ins?: Json | null
          color?: string | null
          created_at?: string
          daily_action?: string | null
          end_date: string
          icon?: string | null
          id?: string
          minimum_standard?: string | null
          start_date: string
          status?: string
          template_id?: string | null
          title: string
          user_id: string
          weekly_goal?: string | null
        }
        Update: {
          category?: string | null
          check_in_type?: string | null
          check_ins?: Json | null
          color?: string | null
          created_at?: string
          daily_action?: string | null
          end_date?: string
          icon?: string | null
          id?: string
          minimum_standard?: string | null
          start_date?: string
          status?: string
          template_id?: string | null
          title?: string
          user_id?: string
          weekly_goal?: string | null
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          category: string | null
          created_at: string
          duration_seconds: number | null
          equipment: string | null
          exercise_id: string | null
          exercise_name: string
          id: string
          is_bodyweight: boolean
          notes: string | null
          reps: Json | null
          rest_seconds: number | null
          session_id: string
          sets_completed: number | null
          sort_order: number | null
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          duration_seconds?: number | null
          equipment?: string | null
          exercise_id?: string | null
          exercise_name: string
          id?: string
          is_bodyweight?: boolean
          notes?: string | null
          reps?: Json | null
          rest_seconds?: number | null
          session_id: string
          sets_completed?: number | null
          sort_order?: number | null
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          duration_seconds?: number | null
          equipment?: string | null
          exercise_id?: string | null
          exercise_name?: string
          id?: string
          is_bodyweight?: boolean
          notes?: string | null
          reps?: Json | null
          rest_seconds?: number | null
          session_id?: string
          sets_completed?: number | null
          sort_order?: number | null
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_records: {
        Row: {
          created_at: string
          date: string
          duration_minutes: number | null
          exercise_name: string
          id: string
          notes: string | null
          perceived_effort: number | null
          plan_id: string | null
          reps_per_set: Json | null
          sets_completed: number | null
          user_id: string
          weight_used: number | null
        }
        Insert: {
          created_at?: string
          date: string
          duration_minutes?: number | null
          exercise_name: string
          id?: string
          notes?: string | null
          perceived_effort?: number | null
          plan_id?: string | null
          reps_per_set?: Json | null
          sets_completed?: number | null
          user_id: string
          weight_used?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          duration_minutes?: number | null
          exercise_name?: string
          id?: string
          notes?: string | null
          perceived_effort?: number | null
          plan_id?: string | null
          reps_per_set?: Json | null
          sets_completed?: number | null
          user_id?: string
          weight_used?: number | null
        }
        Relationships: []
      }
      workout_sessions: {
        Row: {
          ai_analyzed_at: string | null
          ai_summary: string | null
          created_at: string
          date: string
          duration_minutes: number | null
          feeling: string | null
          id: string
          location: string | null
          mode: string
          notes: string | null
          perceived_effort: number | null
          source_video_id: string | null
          title: string | null
          training_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_analyzed_at?: string | null
          ai_summary?: string | null
          created_at?: string
          date: string
          duration_minutes?: number | null
          feeling?: string | null
          id?: string
          location?: string | null
          mode: string
          notes?: string | null
          perceived_effort?: number | null
          source_video_id?: string | null
          title?: string | null
          training_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_analyzed_at?: string | null
          ai_summary?: string | null
          created_at?: string
          date?: string
          duration_minutes?: number | null
          feeling?: string | null
          id?: string
          location?: string | null
          mode?: string
          notes?: string | null
          perceived_effort?: number | null
          source_video_id?: string | null
          title?: string | null
          training_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_source_video_id_fkey"
            columns: ["source_video_id"]
            isOneToOne: false
            referencedRelation: "workout_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_videos: {
        Row: {
          ai_analysis_status: string | null
          analysis_confidence: string | null
          analysis_source: string | null
          author: string | null
          category: string | null
          created_at: string
          description: string | null
          difficulty: string | null
          embed_url: string | null
          equipment: string | null
          estimated_duration: number | null
          id: string
          is_favorite: boolean | null
          metadata: Json
          notes: string | null
          platform: string | null
          tags: string[] | null
          target_muscles: Json | null
          thumbnail_url: string | null
          title: string | null
          training_type: string | null
          url: string
          user_id: string
          video_id: string | null
        }
        Insert: {
          ai_analysis_status?: string | null
          analysis_confidence?: string | null
          analysis_source?: string | null
          author?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          difficulty?: string | null
          embed_url?: string | null
          equipment?: string | null
          estimated_duration?: number | null
          id?: string
          is_favorite?: boolean | null
          metadata?: Json
          notes?: string | null
          platform?: string | null
          tags?: string[] | null
          target_muscles?: Json | null
          thumbnail_url?: string | null
          title?: string | null
          training_type?: string | null
          url: string
          user_id: string
          video_id?: string | null
        }
        Update: {
          ai_analysis_status?: string | null
          analysis_confidence?: string | null
          analysis_source?: string | null
          author?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          difficulty?: string | null
          embed_url?: string | null
          equipment?: string | null
          estimated_duration?: number | null
          id?: string
          is_favorite?: boolean | null
          metadata?: Json
          notes?: string | null
          platform?: string | null
          tags?: string[] | null
          target_muscles?: Json | null
          thumbnail_url?: string | null
          title?: string | null
          training_type?: string | null
          url?: string
          user_id?: string
          video_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_expression_learning: {
        Args: {
          p_item_id: string
          p_recall_score: number
          p_sentence_score: number
          p_session_id: string
          p_srs: Json
        }
        Returns: {
          expression_status: string
          item_completed: boolean
          srs_initialized: boolean
        }[]
      }
      increment_question_usage: { Args: { q_id: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
