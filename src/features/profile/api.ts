import { supabase } from '../../lib/supabase'
import type { ProfileRow } from '../../types/db'

function throwSupabaseError(error: { message: string; code?: string | null }) {
  const enriched = new Error(error.message) as Error & { code?: string | null }
  enriched.code = error.code
  throw enriched
}

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,display_name,avatar_url,is_progress_public,created_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) throwSupabaseError(error)
  return (data as ProfileRow | null) ?? null
}

export async function upsertProfile(
  userId: string,
  displayName: string | null,
  avatarUrl: string | null,
  isProgressPublic: boolean,
): Promise<ProfileRow> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        display_name: displayName,
        avatar_url: avatarUrl,
        is_progress_public: isProgressPublic,
      },
      { onConflict: 'id' },
    )
    .select('id,display_name,avatar_url,is_progress_public,created_at')
    .single()

  if (error) throwSupabaseError(error)
  return data as ProfileRow
}
