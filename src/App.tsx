import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './lib/supabase'
import { useAuthSession } from './features/auth/useAuthSession'
import {
  createExercise,
  createWorkout,
  deleteExercise,
  finishWorkout as finishWorkoutApi,
  insertWorkoutExercise,
  insertWorkoutSets,
  listExercises,
  listRecentWorkouts,
  updateExerciseName,
} from './features/workouts/api'
import type { ExerciseRow } from './types/db'
import './App.css'

type TabView = 'workout' | 'settings'

type SetDraft = {
  reps: string
  weight: string
}

type CompletedSet = {
  reps: number
  weightKg: number
}

type LocalWorkoutExercise = {
  name: string
  sets: CompletedSet[]
}

type ActiveWorkout = {
  id: string
  startedAt: string
  exercises: LocalWorkoutExercise[]
}

type SnackbarState = {
  open: boolean
  severity: 'success' | 'error' | 'info'
  message: string
}

const fieldSx = {
  '& .MuiInputBase-root': {
    fontSize: '0.95rem',
  },
}

function createInitialSetDraft(): SetDraft[] {
  return [{ reps: '', weight: '' }]
}

function App() {
  const queryClient = useQueryClient()
  const { session, user, isLoading: authLoading } = useAuthSession()

  const [activeTab, setActiveTab] = useState<TabView>('workout')
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null)
  const [isAddingExercise, setIsAddingExercise] = useState(false)
  const [exerciseNameInput, setExerciseNameInput] = useState('')
  const [setDrafts, setSetDrafts] = useState<SetDraft[]>(createInitialSetDraft())
  const [newExerciseInput, setNewExerciseInput] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ExerciseRow | null>(null)
  const [exerciseEditValues, setExerciseEditValues] = useState<Record<string, string>>({})
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    severity: 'info',
    message: '',
  })

  const exercisesQuery = useQuery({
    queryKey: ['exercises', user?.id],
    queryFn: () => listExercises(user!.id),
    enabled: Boolean(user?.id),
  })

  const recentWorkoutsQuery = useQuery({
    queryKey: ['recent-workouts', user?.id],
    queryFn: () => listRecentWorkouts(user!.id, 5),
    enabled: Boolean(user?.id),
  })

  const exerciseLibrary = exercisesQuery.data ?? []
  const exerciseNames = useMemo(
    () => exerciseLibrary.map((exercise) => exercise.name),
    [exerciseLibrary],
  )

  useEffect(() => {
    const map: Record<string, string> = {}
    exerciseLibrary.forEach((exercise) => {
      map[exercise.id] = exercise.name
    })
    setExerciseEditValues(map)
  }, [exerciseLibrary])

  const startWorkoutMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('You need to be signed in.')
      return createWorkout(user.id, new Date().toISOString())
    },
  })

  const finishWorkoutMutation = useMutation({
    mutationFn: async (payload: { workoutId: string }) => {
      if (!user) throw new Error('You need to be signed in.')
      return finishWorkoutApi(payload.workoutId, user.id, new Date().toISOString())
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['recent-workouts', user?.id] })
    },
  })

  const createExerciseMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error('You need to be signed in.')
      return createExercise(user.id, name)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exercises', user?.id] })
    },
  })

  const renameExerciseMutation = useMutation({
    mutationFn: async (payload: { id: string; name: string }) => {
      if (!user) throw new Error('You need to be signed in.')
      return updateExerciseName(payload.id, user.id, payload.name)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exercises', user?.id] })
    },
  })

  const deleteExerciseMutation = useMutation({
    mutationFn: async (exerciseId: string) => {
      if (!user) throw new Error('You need to be signed in.')
      return deleteExercise(exerciseId, user.id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exercises', user?.id] })
    },
  })

  function showError(message: string) {
    setSnackbar({ open: true, severity: 'error', message })
  }

  function showSuccess(message: string) {
    setSnackbar({ open: true, severity: 'success', message })
  }

  async function handleGoogleSignIn() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })

    if (error) showError(error.message)
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      showError(error.message)
      return
    }

    setActiveWorkout(null)
    setIsAddingExercise(false)
    setExerciseNameInput('')
    setSetDrafts(createInitialSetDraft())
    showSuccess('Signed out.')
  }

  async function startWorkout() {
    try {
      const workout = await startWorkoutMutation.mutateAsync()
      setActiveWorkout({
        id: workout.id,
        startedAt: workout.started_at,
        exercises: [],
      })
      setIsAddingExercise(false)
      setExerciseNameInput('')
      setSetDrafts(createInitialSetDraft())
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not start workout.')
    }
  }

  async function finishWorkout() {
    if (!activeWorkout) return

    try {
      await finishWorkoutMutation.mutateAsync({ workoutId: activeWorkout.id })
      setActiveWorkout(null)
      setIsAddingExercise(false)
      setExerciseNameInput('')
      setSetDrafts(createInitialSetDraft())
      showSuccess('Workout finished and saved.')
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not finish workout.')
    }
  }

  function openAddExercise() {
    setIsAddingExercise(true)
    setExerciseNameInput('')
    setSetDrafts(createInitialSetDraft())
  }

  function updateSetDraft(index: number, field: keyof SetDraft, value: string) {
    setSetDrafts((prev) => {
      const next = prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
      const last = next[next.length - 1]
      const editedIsLast = index === next.length - 1
      const lastFilled = last.reps.trim() !== '' && last.weight.trim() !== ''

      if (editedIsLast && lastFilled) {
        next.push({ reps: '', weight: last.weight.trim() })
      }

      return next
    })
  }

  async function finishExercise() {
    if (!activeWorkout || !user) return

    const cleanedName = exerciseNameInput.trim()
    if (!cleanedName) return

    const completedSets: CompletedSet[] = setDrafts
      .filter((set) => set.reps.trim() !== '' && set.weight.trim() !== '')
      .map((set) => ({
        reps: Number(set.reps),
        weightKg: Number(set.weight),
      }))
      .filter((set) => Number.isFinite(set.reps) && Number.isFinite(set.weightKg))
      .filter((set) => set.reps > 0 && set.weightKg >= 0)

    if (completedSets.length === 0) return

    try {
      const position = activeWorkout.exercises.length + 1
      const workoutExercise = await insertWorkoutExercise(activeWorkout.id, cleanedName, position)
      await insertWorkoutSets(workoutExercise.id, completedSets)

      setActiveWorkout((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          exercises: [...prev.exercises, { name: cleanedName, sets: completedSets }],
        }
      })

      if (!exerciseNames.some((name) => name.toLowerCase() === cleanedName.toLowerCase())) {
        try {
          await createExerciseMutation.mutateAsync(cleanedName)
        } catch (error) {
          const maybeDuplicate = error as Error & { code?: string | null }
          if (maybeDuplicate.code !== '23505') {
            throw error
          }
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['recent-workouts', user.id] })
      setIsAddingExercise(false)
      setExerciseNameInput('')
      setSetDrafts(createInitialSetDraft())
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not save exercise.')
    }
  }

  async function addExerciseToLibrary() {
    const value = newExerciseInput.trim()
    if (!value) return

    try {
      await createExerciseMutation.mutateAsync(value)
      setNewExerciseInput('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not add exercise.'
      showError(message)
    }
  }

  async function commitExerciseNameChange(exerciseId: string, originalName: string) {
    const current = (exerciseEditValues[exerciseId] ?? '').trim()
    const previous = originalName.trim()

    if (!current) {
      setExerciseEditValues((prev) => ({ ...prev, [exerciseId]: previous }))
      return
    }

    if (current === previous) return

    try {
      await renameExerciseMutation.mutateAsync({ id: exerciseId, name: current })
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not update exercise name.')
      setExerciseEditValues((prev) => ({ ...prev, [exerciseId]: previous }))
    }
  }

  async function confirmDeleteExercise() {
    if (!deleteTarget) return

    try {
      await deleteExerciseMutation.mutateAsync(deleteTarget.id)
      setDeleteTarget(null)
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not delete exercise.')
    }
  }

  if (authLoading) {
    return (
      <Box className="app-shell" sx={{ display: 'grid', placeItems: 'center', minHeight: '90vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!session || !user) {
    return (
      <Box className="app-shell" sx={{ display: 'grid', placeItems: 'center', minHeight: '90vh' }}>
        <Paper className="panel" elevation={0} sx={{ width: '100%', maxWidth: 460 }}>
          <Stack spacing={1.2}>
            <Typography variant="h5" sx={{ fontSize: '1.25rem', fontWeight: 700 }}>
              Gym Workout Tracker
            </Typography>
            <Typography color="text.secondary">
              Sign in to sync your workouts and exercise settings.
            </Typography>
            <Button variant="contained" onClick={handleGoogleSignIn}>
              Sign in with Google
            </Button>
          </Stack>
        </Paper>
      </Box>
    )
  }

  return (
    <Box className="app-shell">
      <Paper className="panel" elevation={0}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h5" sx={{ fontSize: '1.25rem', fontWeight: 700 }}>
            Gym Workout Tracker
          </Typography>
          <Button variant="outlined" onClick={handleSignOut}>
            Sign out
          </Button>
        </Stack>

        <Tabs
          value={activeTab}
          onChange={(_, value: TabView) => setActiveTab(value)}
          variant="fullWidth"
          textColor="inherit"
          indicatorColor="secondary"
          sx={{
            minHeight: 44,
            '& .MuiTab-root': { minHeight: 44, fontWeight: 600 },
          }}
        >
          <Tab value="workout" label="Workout" />
          <Tab value="settings" label="Settings" />
        </Tabs>
      </Paper>

      {activeTab === 'workout' ? (
        <Paper className="panel" elevation={0}>
          {!activeWorkout ? (
            <Stack spacing={1.25}>
              <Typography>No active workout session.</Typography>
              <Button
                variant="contained"
                onClick={startWorkout}
                disabled={startWorkoutMutation.isPending}
              >
                Start Workout
              </Button>
            </Stack>
          ) : (
            <Stack spacing={1.25}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
                <Typography>Started: {new Date(activeWorkout.startedAt).toLocaleString()}</Typography>
                <Button
                  variant="contained"
                  color="error"
                  onClick={finishWorkout}
                  disabled={finishWorkoutMutation.isPending}
                >
                  Finish Workout
                </Button>
              </Stack>

              <Stack spacing={0.75}>
                <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                  Current Exercises
                </Typography>
                {activeWorkout.exercises.length === 0 ? (
                  <Typography className="muted">No exercises added yet.</Typography>
                ) : (
                  <List disablePadding sx={{ display: 'grid', gap: 0.7 }}>
                    {activeWorkout.exercises.map((exercise, idx) => (
                      <ListItem key={`${exercise.name}-${idx}`} className="exercise-card" disablePadding>
                        <Box>
                          <Typography sx={{ fontWeight: 700 }}>{exercise.name}</Typography>
                          <Typography variant="body2" sx={{ color: '#c2c7f1' }}>
                            {exercise.sets
                              .map((set) => `${set.reps} reps x ${set.weightKg} kg`)
                              .join(' | ')}
                          </Typography>
                        </Box>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Stack>

              {!isAddingExercise ? (
                <Button variant="contained" onClick={openAddExercise}>
                  Add Exercise
                </Button>
              ) : (
                <Paper className="card" elevation={0}>
                  <Typography variant="h6" sx={{ fontSize: '1rem', mb: 0.6 }}>
                    New Exercise
                  </Typography>

                  <Autocomplete
                    freeSolo
                    options={exerciseNames}
                    loading={exercisesQuery.isLoading}
                    inputValue={exerciseNameInput}
                    onInputChange={(_, value) => setExerciseNameInput(value)}
                    renderInput={(params) => (
                      <TextField {...params} label="Exercise" placeholder="Type exercise name" sx={fieldSx} />
                    )}
                    sx={{ mb: 0.7 }}
                  />

                  <Stack direction="row" spacing={1}>
                    <Typography sx={{ flex: 1, fontSize: '0.8rem', color: '#c7cbf7' }}>Reps</Typography>
                    <Typography sx={{ flex: 1, fontSize: '0.8rem', color: '#c7cbf7' }}>
                      Weight (kg)
                    </Typography>
                  </Stack>

                  <Stack spacing={0.7} sx={{ mb: 0.75 }}>
                    {setDrafts.map((set, idx) => (
                      <Stack key={`set-${idx}`} direction="row" spacing={1}>
                        <TextField
                          type="number"
                          inputMode="numeric"
                          placeholder="Reps"
                          value={set.reps}
                          onChange={(e) => updateSetDraft(idx, 'reps', e.target.value)}
                          inputProps={{ min: 1 }}
                          sx={{ ...fieldSx, flex: 1 }}
                        />
                        <TextField
                          type="number"
                          inputMode="decimal"
                          placeholder="Weight (kg)"
                          value={set.weight}
                          onChange={(e) => updateSetDraft(idx, 'weight', e.target.value)}
                          inputProps={{ min: 0, step: 0.5 }}
                          sx={{ ...fieldSx, flex: 1 }}
                        />
                      </Stack>
                    ))}
                  </Stack>

                  <Stack direction="row" spacing={1}>
                    <Button variant="contained" onClick={finishExercise} fullWidth>
                      Finish Exercise
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setIsAddingExercise(false)
                        setExerciseNameInput('')
                        setSetDrafts(createInitialSetDraft())
                      }}
                    >
                      Cancel
                    </Button>
                  </Stack>
                </Paper>
              )}
            </Stack>
          )}
        </Paper>
      ) : (
        <Paper className="panel" elevation={0}>
          <Stack spacing={1.25}>
            <Typography variant="h6" sx={{ fontSize: '1rem' }}>
              Exercise Settings
            </Typography>

            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                placeholder="Add new exercise"
                value={newExerciseInput}
                onChange={(e) => setNewExerciseInput(e.target.value)}
                sx={fieldSx}
              />
              <Button
                variant="contained"
                onClick={addExerciseToLibrary}
                disabled={createExerciseMutation.isPending}
              >
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
                      onChange={(e) =>
                        setExerciseEditValues((prev) => ({
                          ...prev,
                          [exercise.id]: e.target.value,
                        }))
                      }
                      onBlur={() => commitExerciseNameChange(exercise.id, exercise.name)}
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
                      onClick={() => setDeleteTarget(exercise)}
                      disabled={deleteExerciseMutation.isPending}
                    >
                      Delete
                    </Button>
                  </Stack>
                </ListItem>
              ))}
            </List>
          </Stack>
        </Paper>
      )}

      {(recentWorkoutsQuery.data?.length ?? 0) > 0 && (
        <Paper className="panel history" elevation={0}>
          <Typography variant="h6" sx={{ fontSize: '1rem' }}>
            Recent Workouts
          </Typography>
          <List sx={{ pt: 0.75, pb: 0, pl: 1.5 }}>
            {recentWorkoutsQuery.data!.map((workout) => (
              <ListItem key={workout.id} sx={{ display: 'list-item', py: 0.3 }}>
                <Typography variant="body2">
                  {new Date(workout.started_at).toLocaleDateString()} -{' '}
                  {workout.workout_exercises?.length ?? 0} exercise(s)
                </Typography>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            border: '1px solid rgba(179, 149, 255, 0.4)',
            borderRadius: 2,
            background: 'linear-gradient(180deg, rgba(29, 21, 58, 0.96), rgba(20, 15, 43, 0.96))',
            color: '#eef0ff',
          },
        }}
      >
        <DialogTitle>Delete exercise?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This will remove <strong>{deleteTarget?.name}</strong> from your exercise list.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDeleteExercise}
            disabled={deleteExerciseMutation.isPending}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default App
