// ============================================
// Nancy OS — useProfile hook
// Unified profile read/write backed by profiles table.
// On write, also syncs auth.users.user_metadata for
// backward compatibility with any consumer of raw JWT metadata.
// ============================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

// ── Types ──

export interface Profile {
  id: string;
  display_name?: string;
  avatar_url?: string;
  timezone?: string;
  language_preference?: string;
  career_field?: string;
  industry?: string;
  bio?: string;
  birth_date?: string;
  phone?: string;
  social_links?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  life_theme?: string;
  energy_pattern?: Record<string, unknown>;
  onboarding_completed?: boolean;
  current_milestone?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProfileUpdate {
  display_name?: string;
  avatar_url?: string;
  timezone?: string;
  language_preference?: string;
  career_field?: string;
  industry?: string;
  bio?: string;
  birth_date?: string;
  phone?: string;
  social_links?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  life_theme?: string;
  energy_pattern?: Record<string, unknown>;
  onboarding_completed?: boolean;
  current_milestone?: string;
}

// ── Query key factory ──

export const profileKeys = {
  all: ["profile"] as const,
  detail: (userId: string) => ["profile", userId] as const,
};

// ── Fetch from profiles table (source of truth) ──

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .limit(1)
    .single();

  if (data) return data as Profile;

  // Row doesn't exist yet (shouldn't happen with the signup trigger, but handle gracefully)
  return null;
}

// ── Hook ──

export function useProfile() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: profileKeys.detail(userId || ""),
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 min — profile changes infrequently
  });

  const mutation = useMutation({
    mutationFn: async (update: ProfileUpdate) => {
      if (!userId) throw new Error("Not authenticated");

      // 1. Write to profiles table (source of truth)
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({ id: userId, ...update }, { onConflict: "id" });

      if (profileError) throw profileError;

      // 2. Sync to auth.users.user_metadata (backward compatibility)
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          display_name: update.display_name,
          timezone: update.timezone,
          language: update.language_preference,
          ai_model: (query.data as Profile & { ai_model?: string })?.preferences?.ai_model,
        },
      });

      if (authError) console.warn("Failed to sync auth metadata:", authError.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.detail(userId!) });
    },
  });

  return {
    profile: query.data ?? null,
    loading: query.isLoading,
    error: query.error,
    updateProfile: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}
