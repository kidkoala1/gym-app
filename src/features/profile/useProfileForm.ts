import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getProfile, upsertProfile } from './api'

const MAX_DISPLAY_NAME_LENGTH = 50

type Notify = {
  showError: (message: string) => void
  showSuccess: (message: string) => void
}

/** The editable profile form (display name, picture, public-progress switch) and its save action. */
export function useProfileForm(user: User | null, { showError, showSuccess }: Notify) {
  const queryClient = useQueryClient()

  const [profileDisplayName, setProfileDisplayName] = useState('')
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('')
  const [isProgressPublic, setIsProgressPublic] = useState(false)

  const profileQuery = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: Boolean(user?.id),
  })

  // Fill the profile form from the saved profile (falling back to the Google account's details).
  // This runs during render, guarded by what it last synced from, instead of in an effect, so a
  // changed profile does not cost an extra render pass. Unsaved edits are only replaced when the
  // saved profile or the signed-in user actually changes.
  const [syncedProfileSource, setSyncedProfileSource] = useState<{
    userId: string | undefined
    profile: unknown
    metadata: unknown
  } | null>(null)
  if (
    !syncedProfileSource ||
    syncedProfileSource.userId !== user?.id ||
    syncedProfileSource.profile !== profileQuery.data ||
    syncedProfileSource.metadata !== user?.user_metadata
  ) {
    setSyncedProfileSource({ userId: user?.id, profile: profileQuery.data, metadata: user?.user_metadata })

    const metadataDisplay =
      (user?.user_metadata?.full_name as string | undefined) ??
      (user?.user_metadata?.name as string | undefined) ??
      ''
    const metadataAvatar = (user?.user_metadata?.avatar_url as string | undefined) ?? ''

    setProfileDisplayName(profileQuery.data?.display_name ?? metadataDisplay)
    setProfileAvatarUrl(profileQuery.data?.avatar_url ?? metadataAvatar)
    setIsProgressPublic(Boolean(profileQuery.data?.is_progress_public))
  }

  const upsertProfileMutation = useMutation({
    mutationFn: async (payload: { displayName: string; avatarUrl: string; isProgressPublic: boolean }) => {
      if (!user) throw new Error('You need to be signed in.')
      return upsertProfile(
        user.id,
        payload.displayName.trim() || null,
        payload.avatarUrl.trim() || null,
        payload.isProgressPublic,
      )
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
    },
  })

  async function saveProfile() {
    if (profileDisplayName.trim().length > MAX_DISPLAY_NAME_LENGTH) {
      showError(`Display name must be at most ${MAX_DISPLAY_NAME_LENGTH} characters.`)
      return
    }
    if (profileAvatarUrl.trim() && !/^https:\/\//i.test(profileAvatarUrl.trim())) {
      showError('Profile picture URL must start with https://')
      return
    }

    try {
      await upsertProfileMutation.mutateAsync({
        displayName: profileDisplayName,
        avatarUrl: profileAvatarUrl,
        isProgressPublic,
      })
      showSuccess('Profile updated.')
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not update profile.')
    }
  }

  function resetProfileForm() {
    setProfileDisplayName('')
    setProfileAvatarUrl('')
    setIsProgressPublic(false)
  }

  return {
    profileDisplayName,
    profileAvatarUrl,
    isProgressPublic,
    setProfileDisplayName,
    setProfileAvatarUrl,
    setIsProgressPublic,
    saveProfile,
    isSavingProfile: upsertProfileMutation.isPending,
    resetProfileForm,
  }
}
