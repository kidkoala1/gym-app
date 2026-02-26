import { Avatar, Button, FormControlLabel, List, ListItem, Paper, Stack, Switch, TextField, Typography } from '@mui/material'
import type { User } from '@supabase/supabase-js'
import type { ExerciseRow } from '../../../types/db'
import type { SettingsView } from '../../workouts/localTypes'

type SettingsTabProps = {
  settingsView: SettingsView
  defaultExerciseNames: readonly string[]
  exerciseLibrary: ExerciseRow[]
  profileDisplayName: string
  profileAvatarUrl: string
  isProgressPublic: boolean
  fieldSx: object
  createExercisePending: boolean
  deleteExercisePending: boolean
  upsertProfilePending: boolean
  newExerciseInput: string
  user: User
  onSettingsViewChange: (view: SettingsView) => void
  onNewExerciseInputChange: (value: string) => void
  onAddExerciseToLibrary: () => void
  onExerciseDeleteRequest: (exercise: ExerciseRow) => void
  onProfileDisplayNameChange: (value: string) => void
  onProfileAvatarUrlChange: (value: string) => void
  onIsProgressPublicChange: (value: boolean) => void
  onSaveProfile: () => void
  onRequestSignOut: () => void
}

export function SettingsTab({
  settingsView,
  defaultExerciseNames,
  exerciseLibrary,
  profileDisplayName,
  profileAvatarUrl,
  isProgressPublic,
  fieldSx,
  createExercisePending,
  deleteExercisePending,
  upsertProfilePending,
  newExerciseInput,
  user,
  onSettingsViewChange,
  onNewExerciseInputChange,
  onAddExerciseToLibrary,
  onExerciseDeleteRequest,
  onProfileDisplayNameChange,
  onProfileAvatarUrlChange,
  onIsProgressPublicChange,
  onSaveProfile,
  onRequestSignOut,
}: SettingsTabProps) {
  return (
    <Paper className="panel" elevation={0}>
      <Stack spacing={1.25}>
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
                placeholder="Add custom exercise"
                value={newExerciseInput}
                onChange={(event) => onNewExerciseInputChange(event.target.value)}
                sx={fieldSx}
              />
              <Button variant="contained" onClick={onAddExerciseToLibrary} disabled={createExercisePending}>
                Add
              </Button>
            </Stack>

            <Typography variant="body2" className="muted">
              Your custom exercises
            </Typography>
            {exerciseLibrary.length === 0 ? (
              <Typography variant="body2" className="muted">
                No custom exercises yet.
              </Typography>
            ) : (
              <List disablePadding sx={{ display: 'grid', gap: 0.7 }}>
                {exerciseLibrary.map((exercise) => (
                  <ListItem key={exercise.id} disablePadding>
                    <Stack direction="row" spacing={1} sx={{ width: '100%', alignItems: 'center' }}>
                      <Typography sx={{ flex: 1, px: 0.25 }}>{exercise.name}</Typography>
                      <Button
                        variant="contained"
                        sx={{
                          bgcolor: '#d32f2f',
                          backgroundImage: 'none',
                          '&:hover': { bgcolor: '#b71c1c', backgroundImage: 'none' },
                        }}
                        onClick={() => onExerciseDeleteRequest(exercise)}
                        disabled={deleteExercisePending}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </ListItem>
                ))}
              </List>
            )}

            <Stack spacing={0.65}>
              <Typography variant="body2" className="muted">
                Built-in exercises (available to all users)
              </Typography>
              <List disablePadding sx={{ display: 'grid', gap: 0.45 }}>
                {defaultExerciseNames.map((name) => (
                  <ListItem key={name} disablePadding>
                    <Paper
                      elevation={0}
                      sx={{
                        width: '100%',
                        p: 0.8,
                        borderRadius: 1.5,
                        border: '1px solid rgba(173, 142, 255, 0.2)',
                        background: 'rgba(20, 15, 42, 0.5)',
                      }}
                    >
                      <Typography variant="body2">{name}</Typography>
                    </Paper>
                  </ListItem>
                ))}
              </List>
            </Stack>
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
              <FormControlLabel
                control={
                  <Switch
                    checked={isProgressPublic}
                    onChange={(event) => onIsProgressPublicChange(event.target.checked)}
                  />
                }
                label="Public progress (allow others to compare with you)"
                sx={{ m: 0 }}
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

        {settingsView === 'menu' && (
          <Stack sx={{ pt: 1, borderTop: '1px solid rgba(173, 142, 255, 0.22)' }}>
            <Button
              variant="contained"
              onClick={onRequestSignOut}
              sx={{
                bgcolor: '#d32f2f',
                backgroundImage: 'none',
                '&:hover': { bgcolor: '#b71c1c', backgroundImage: 'none' },
              }}
            >
              Sign out
            </Button>
          </Stack>
        )}
      </Stack>
    </Paper>
  )
}
