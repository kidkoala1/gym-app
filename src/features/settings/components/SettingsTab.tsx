import { Avatar, Button, List, ListItem, Paper, Stack, TextField, Typography } from '@mui/material'
import type { User } from '@supabase/supabase-js'
import type { ExerciseRow } from '../../../types/db'
import type { SettingsView } from '../../workouts/localTypes'

type SettingsTabProps = {
  settingsView: SettingsView
  exerciseLibrary: ExerciseRow[]
  exerciseEditValues: Record<string, string>
  profileDisplayName: string
  profileAvatarUrl: string
  fieldSx: object
  createExercisePending: boolean
  deleteExercisePending: boolean
  upsertProfilePending: boolean
  newExerciseInput: string
  user: User
  onSettingsViewChange: (view: SettingsView) => void
  onNewExerciseInputChange: (value: string) => void
  onAddExerciseToLibrary: () => void
  onExerciseEditValueChange: (exerciseId: string, value: string) => void
  onExerciseEditCommit: (exerciseId: string, originalName: string) => void
  onExerciseDeleteRequest: (exercise: ExerciseRow) => void
  onProfileDisplayNameChange: (value: string) => void
  onProfileAvatarUrlChange: (value: string) => void
  onSaveProfile: () => void
}

export function SettingsTab({
  settingsView,
  exerciseLibrary,
  exerciseEditValues,
  profileDisplayName,
  profileAvatarUrl,
  fieldSx,
  createExercisePending,
  deleteExercisePending,
  upsertProfilePending,
  newExerciseInput,
  user,
  onSettingsViewChange,
  onNewExerciseInputChange,
  onAddExerciseToLibrary,
  onExerciseEditValueChange,
  onExerciseEditCommit,
  onExerciseDeleteRequest,
  onProfileDisplayNameChange,
  onProfileAvatarUrlChange,
  onSaveProfile,
}: SettingsTabProps) {
  return (
    <Paper className="panel" elevation={0}>
      {settingsView === 'menu' ? (
        <Stack spacing={1.25}>
          <Button
            variant="outlined"
            onClick={() => onSettingsViewChange('profile')}
            sx={{ justifyContent: 'space-between' }}
          >
            Profile
          </Button>
          <Button
            variant="outlined"
            onClick={() => onSettingsViewChange('exercise-list')}
            sx={{ justifyContent: 'space-between' }}
          >
            Exercise list
          </Button>
        </Stack>
      ) : settingsView === 'exercise-list' ? (
        <Stack spacing={1.25}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" sx={{ fontSize: '1rem' }}>
              Exercise List
            </Typography>
            <Button variant="outlined" size="small" onClick={() => onSettingsViewChange('menu')}>
              Back
            </Button>
          </Stack>

          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth
              placeholder="Add new exercise"
              value={newExerciseInput}
              onChange={(event) => onNewExerciseInputChange(event.target.value)}
              sx={fieldSx}
            />
            <Button variant="contained" onClick={onAddExerciseToLibrary} disabled={createExercisePending}>
              Add
            </Button>
          </Stack>

          <List disablePadding sx={{ display: 'grid', gap: 0.7 }}>
            {exerciseLibrary.map((exercise) => (
              <ListItem key={exercise.id} disablePadding>
                <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
                  <TextField
                    fullWidth
                    value={exerciseEditValues[exercise.id] ?? ''}
                    onChange={(event) => onExerciseEditValueChange(exercise.id, event.target.value)}
                    onBlur={() => onExerciseEditCommit(exercise.id, exercise.name)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        ;(event.target as HTMLInputElement).blur()
                      }
                    }}
                    sx={fieldSx}
                  />
                  <Button
                    variant="contained"
                    color="error"
                    onClick={() => onExerciseDeleteRequest(exercise)}
                    disabled={deleteExercisePending}
                  >
                    Delete
                  </Button>
                </Stack>
              </ListItem>
            ))}
          </List>
        </Stack>
      ) : (
        <Stack spacing={1.25}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" sx={{ fontSize: '1rem' }}>
              Profile
            </Typography>
            <Button variant="outlined" size="small" onClick={() => onSettingsViewChange('menu')}>
              Back
            </Button>
          </Stack>
          <Stack spacing={1.35} sx={{ py: 0.5 }}>
            <Stack direction="row" spacing={1.2} alignItems="center">
              <Avatar
                src={profileAvatarUrl.trim() || undefined}
                alt={profileDisplayName || user.email || 'Profile avatar'}
                sx={{ width: 56, height: 56 }}
              >
                {(profileDisplayName || user.email || '?').charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="body2" className="muted">
                {profileDisplayName}
              </Typography>
            </Stack>
            <TextField
              label="Display name"
              value={profileDisplayName}
              onChange={(event) => onProfileDisplayNameChange(event.target.value)}
              sx={{ ...fieldSx, mt: 1 }}
            />
            <TextField
              label="Profile picture URL"
              placeholder="https://..."
              value={profileAvatarUrl}
              onChange={(event) => onProfileAvatarUrlChange(event.target.value)}
              sx={fieldSx}
            />
          </Stack>
          <Typography variant="body2">
            <strong>Email:</strong> {user.email ?? 'Not available'}
          </Typography>
          <Typography variant="body2">
            <strong>Provider:</strong> {(user.app_metadata?.provider as string | undefined) ?? 'Not available'}
          </Typography>
          <Typography variant="body2">
            <strong>User ID:</strong> {user.id}
          </Typography>
          <Typography variant="body2">
            <strong>Created:</strong> {new Date(user.created_at).toLocaleString()}
          </Typography>
          <Button variant="contained" onClick={onSaveProfile} disabled={upsertProfilePending}>
            Save profile
          </Button>
        </Stack>
      )}
    </Paper>
  )
}
