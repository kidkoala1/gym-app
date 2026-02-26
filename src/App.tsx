import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Collapse,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  Menu,
  MenuItem,
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
import { getProfile, upsertProfile } from './features/profile/api'
import {
  createExercise,
  createWorkout,
  deleteExercise,
  deleteWorkout,
  deleteWorkoutExercise,
  finishWorkout as finishWorkoutApi,
  insertWorkoutExercise,
  insertWorkoutSets,
  listExercises,
  listWorkoutHistory,
  updateWorkoutExerciseName,
  updateWorkoutSet,
  updateExerciseName,
} from './features/workouts/api'
import type { ExerciseRow } from './types/db'
import './App.css'

type TabView = 'workout' | 'settings' | 'history'
type SettingsView = 'menu' | 'exercise-list' | 'profile'

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

type EditableSet = {
  id: string
  set_number: number
  reps: string
  weight_kg: string
}

type EditableHistoryExercise = {
  id: string
  exercise_name: string
  sets: EditableSet[]
  deleted?: boolean
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
  const [settingsView, setSettingsView] = useState<SettingsView>('menu')
  const [profileDisplayName, setProfileDisplayName] = useState('')
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ExerciseRow | null>(null)
  const [exerciseEditValues, setExerciseEditValues] = useState<Record<string, string>>({})
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({})
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null)
  const [historyEdits, setHistoryEdits] = useState<Record<string, EditableHistoryExercise[]>>({})
  const [workoutMenuAnchor, setWorkoutMenuAnchor] = useState<HTMLElement | null>(null)
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null)
  const [cancelWorkoutConfirmOpen, setCancelWorkoutConfirmOpen] = useState(false)
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

  const historyWorkoutsQuery = useQuery({
    queryKey: ['workout-history', user?.id],
    queryFn: () => listWorkoutHistory(user!.id),
    enabled: Boolean(user?.id),
  })

  const profileQuery = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getProfile(user!.id),
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

  useEffect(() => {
    const metadataDisplay =
      (user?.user_metadata?.full_name as string | undefined) ??
      (user?.user_metadata?.name as string | undefined) ??
      ''
    const metadataAvatar = (user?.user_metadata?.avatar_url as string | undefined) ?? ''

    setProfileDisplayName(profileQuery.data?.display_name ?? metadataDisplay)
    setProfileAvatarUrl(profileQuery.data?.avatar_url ?? metadataAvatar)
  }, [profileQuery.data, user?.id, user?.user_metadata])

  useEffect(() => {
    if (activeTab !== 'settings') {
      setSettingsView('menu')
    }
  }, [activeTab])

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
      await queryClient.invalidateQueries({ queryKey: ['workout-history', user?.id] })
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

  const deleteWorkoutMutation = useMutation({
    mutationFn: async (workoutId: string) => {
      if (!user) throw new Error('You need to be signed in.')
      return deleteWorkout(workoutId, user.id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workout-history', user?.id] })
    },
  })

  const upsertProfileMutation = useMutation({
    mutationFn: async (payload: { displayName: string; avatarUrl: string }) => {
      if (!user) throw new Error('You need to be signed in.')
      return upsertProfile(
        user.id,
        payload.displayName.trim() || null,
        payload.avatarUrl.trim() || null,
      )
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
    },
  })

  function showError(message: string) {
    setSnackbar({ open: true, severity: 'error', message })
  }

  function showSuccess(message: string) {
    setSnackbar({ open: true, severity: 'success', message })
  }

  function buildEditableExercises(workoutId: string): EditableHistoryExercise[] {
    const workout = historyWorkoutsQuery.data?.find((item) => item.id === workoutId)
    if (!workout) return []

    return [...(workout.workout_exercises ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((exercise) => ({
        id: exercise.id,
        exercise_name: exercise.exercise_name,
        sets: [...(exercise.workout_sets ?? [])]
          .sort((a, b) => a.set_number - b.set_number)
          .map((set) => ({
            id: set.id,
            set_number: set.set_number,
            reps: String(set.reps),
            weight_kg: String(set.weight_kg),
          })),
      }))
  }

  function openWorkoutMenu(event: MouseEvent<HTMLElement>, workoutId: string) {
    setWorkoutMenuAnchor(event.currentTarget)
    setSelectedWorkoutId(workoutId)
  }

  function closeWorkoutMenu() {
    setWorkoutMenuAnchor(null)
    setSelectedWorkoutId(null)
  }

  function beginWorkoutEdit(workoutId: string) {
    setHistoryEdits((prev) => ({
      ...prev,
      [workoutId]: prev[workoutId] ?? buildEditableExercises(workoutId),
    }))
    setEditingWorkoutId(workoutId)
    setExpandedHistory((prev) => ({ ...prev, [workoutId]: true }))
    closeWorkoutMenu()
  }

  function cancelWorkoutEdit() {
    if (!editingWorkoutId) return
    setHistoryEdits((prev) => {
      const next = { ...prev }
      delete next[editingWorkoutId]
      return next
    })
    setEditingWorkoutId(null)
  }

  async function removeWorkoutFromHistory(workoutId: string) {
    closeWorkoutMenu()
    if (!window.confirm('Delete this entire workout? This cannot be undone.')) return

    try {
      await deleteWorkoutMutation.mutateAsync(workoutId)
      if (editingWorkoutId === workoutId) {
        setEditingWorkoutId(null)
      }
      setHistoryEdits((prev) => {
        const next = { ...prev }
        delete next[workoutId]
        return next
      })
      showSuccess('Workout deleted.')
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not delete workout.')
    }
  }

  function markHistoryExerciseDeleted(workoutId: string, exerciseId: string) {
    setHistoryEdits((prev) => ({
      ...prev,
      [workoutId]: (prev[workoutId] ?? []).map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, deleted: true } : exercise,
      ),
    }))
  }

  function updateHistoryExerciseName(workoutId: string, exerciseId: string, value: string) {
    setHistoryEdits((prev) => ({
      ...prev,
      [workoutId]: (prev[workoutId] ?? []).map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, exercise_name: value } : exercise,
      ),
    }))
  }

  function updateHistorySetField(
    workoutId: string,
    exerciseId: string,
    setId: string,
    field: 'reps' | 'weight_kg',
    value: string,
  ) {
    setHistoryEdits((prev) => ({
      ...prev,
      [workoutId]: (prev[workoutId] ?? []).map((exercise) => {
        if (exercise.id !== exerciseId) return exercise
        return {
          ...exercise,
          sets: exercise.sets.map((set) => (set.id === setId ? { ...set, [field]: value } : set)),
        }
      }),
    }))
  }

  async function saveWorkoutEdit(workoutId: string) {
    const draft = historyEdits[workoutId]
    if (!draft) return

    try {
      for (const exercise of draft) {
        if (exercise.deleted) {
          await deleteWorkoutExercise(exercise.id)
          continue
        }

        const cleanedName = exercise.exercise_name.trim()
        if (!cleanedName) {
          throw new Error('Exercise title cannot be empty.')
        }

        await updateWorkoutExerciseName(exercise.id, cleanedName)

        for (const set of exercise.sets) {
          const reps = Number(set.reps)
          const weight = Number(set.weight_kg)

          if (!Number.isFinite(reps) || reps <= 0) {
            throw new Error('Reps must be greater than 0.')
          }
          if (!Number.isFinite(weight) || weight < 0) {
            throw new Error('Weight must be 0 or greater.')
          }

          await updateWorkoutSet(set.id, reps, weight)
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['workout-history', user?.id] })
      setEditingWorkoutId(null)
      setHistoryEdits((prev) => {
        const next = { ...prev }
        delete next[workoutId]
        return next
      })
      showSuccess('Workout updated.')
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not update workout.')
    }
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
    setProfileDisplayName('')
    setProfileAvatarUrl('')
    showSuccess('Signed out.')
  }

  async function saveProfile() {
    try {
      await upsertProfileMutation.mutateAsync({
        displayName: profileDisplayName,
        avatarUrl: profileAvatarUrl,
      })
      showSuccess('Profile updated.')
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not update profile.')
    }
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

  async function cancelWorkout() {
    if (!activeWorkout || !user) return

    try {
      await deleteWorkoutMutation.mutateAsync(activeWorkout.id)
      setActiveWorkout(null)
      setIsAddingExercise(false)
      setExerciseNameInput('')
      setSetDrafts(createInitialSetDraft())
      setCancelWorkoutConfirmOpen(false)
      showSuccess('Workout canceled.')
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not cancel workout.')
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

      await queryClient.invalidateQueries({ queryKey: ['workout-history', user.id] })
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
          <Tab value="history" label="History" />
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
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => setCancelWorkoutConfirmOpen(true)}
                    disabled={deleteWorkoutMutation.isPending}
                  >
                    Cancel Workout
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    onClick={finishWorkout}
                    disabled={finishWorkoutMutation.isPending}
                  >
                    Finish Workout
                  </Button>
                </Stack>
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
      ) : activeTab === 'settings' ? (
        <Paper className="panel" elevation={0}>
          {settingsView === 'menu' ? (
            <Stack spacing={1.25}>
              <Button
                variant="outlined"
                onClick={() => setSettingsView('profile')}
                sx={{ justifyContent: 'space-between' }}
              >
                Profile
              </Button>
              <Button
                variant="outlined"
                onClick={() => setSettingsView('exercise-list')}
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
                <Button variant="outlined" size="small" onClick={() => setSettingsView('menu')}>
                  Back
                </Button>
              </Stack>

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
          ) : (
            <Stack spacing={1.25}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                  Profile
                </Typography>
                <Button variant="outlined" size="small" onClick={() => setSettingsView('menu')}>
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
                  onChange={(event) => setProfileDisplayName(event.target.value)}
                  sx={{ ...fieldSx, mt: 1 }}
                />
                <TextField
                  label="Profile picture URL"
                  placeholder="https://..."
                  value={profileAvatarUrl}
                  onChange={(event) => setProfileAvatarUrl(event.target.value)}
                  sx={fieldSx}
                />
              </Stack>
              <Typography variant="body2">
                <strong>Email:</strong> {user.email ?? 'Not available'}
              </Typography>
              <Typography variant="body2">
                <strong>Provider:</strong>{' '}
                {(user.app_metadata?.provider as string | undefined) ?? 'Not available'}
              </Typography>
              <Typography variant="body2">
                <strong>User ID:</strong> {user.id}
              </Typography>
              <Typography variant="body2">
                <strong>Created:</strong> {new Date(user.created_at).toLocaleString()}
              </Typography>
              <Button
                variant="contained"
                onClick={saveProfile}
                disabled={upsertProfileMutation.isPending}
              >
                Save profile
              </Button>
            </Stack>
          )}
        </Paper>
      ) : (
        <Paper className="panel" elevation={0}>
          <Stack spacing={1.25}>
            <Typography variant="h6" sx={{ fontSize: '1rem' }}>
              Workout History
            </Typography>

            {historyWorkoutsQuery.isLoading ? (
              <Box sx={{ display: 'grid', placeItems: 'center', py: 2 }}>
                <CircularProgress size={26} />
              </Box>
            ) : (historyWorkoutsQuery.data?.length ?? 0) === 0 ? (
              <Typography className="muted">No completed workouts yet.</Typography>
            ) : (
              <List disablePadding sx={{ display: 'grid', gap: 1 }}>
                {historyWorkoutsQuery.data!.map((workout) => {
                  const exercises = [...(workout.workout_exercises ?? [])].sort(
                    (a, b) => a.position - b.position,
                  )
                  const isExpanded = Boolean(expandedHistory[workout.id])
                  const isEditing = editingWorkoutId === workout.id
                  const editableExercises = historyEdits[workout.id] ?? []
                  const visibleEditableExercises = editableExercises.filter((exercise) => !exercise.deleted)

                  return (
                    <ListItem key={workout.id} disablePadding>
                      <Paper className="card history-workout-card" elevation={0} sx={{ width: '100%' }}>
                        <Stack spacing={0.7}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Box>
                              <Typography sx={{ fontWeight: 700 }}>
                                {new Date(workout.started_at).toLocaleString()}
                              </Typography>
                              <Typography variant="body2" className="muted">
                                {exercises.length} exercise(s)
                              </Typography>
                            </Box>
                            <Stack direction="row" spacing={0.6}>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() =>
                                  setExpandedHistory((prev) => ({
                                    ...prev,
                                    [workout.id]: !prev[workout.id],
                                  }))
                                }
                              >
                                {isExpanded ? 'Hide details' : 'Show details'}
                              </Button>
                              <IconButton
                                aria-label="Workout menu"
                                size="small"
                                onClick={(event) => openWorkoutMenu(event, workout.id)}
                              >
                                <Typography sx={{ fontSize: '1.2rem', lineHeight: 1 }}>⋯</Typography>
                              </IconButton>
                            </Stack>
                          </Stack>

                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <List disablePadding sx={{ display: 'grid', gap: 0.6, pt: 0.4 }}>
                              {isEditing
                                ? visibleEditableExercises.map((exercise) => (
                                    <ListItem
                                      key={exercise.id}
                                      disablePadding
                                      className="exercise-card history-exercise-card"
                                      sx={{ p: 0.6 }}
                                    >
                                      <Stack spacing={0.55} sx={{ width: '100%' }}>
                                        <Stack direction="row" spacing={0.7}>
                                          <TextField
                                            fullWidth
                                            size="small"
                                            value={exercise.exercise_name}
                                            onChange={(event) =>
                                              updateHistoryExerciseName(
                                                workout.id,
                                                exercise.id,
                                                event.target.value,
                                              )
                                            }
                                            sx={fieldSx}
                                          />
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            color="error"
                                            onClick={() =>
                                              markHistoryExerciseDeleted(workout.id, exercise.id)
                                            }
                                          >
                                            Delete
                                          </Button>
                                        </Stack>
                                        {exercise.sets.map((set) => (
                                          <Stack key={set.id} direction="row" spacing={0.7}>
                                            <TextField
                                              size="small"
                                              type="number"
                                              inputMode="numeric"
                                              label={`Set ${set.set_number} reps`}
                                              value={set.reps}
                                              onChange={(event) =>
                                                updateHistorySetField(
                                                  workout.id,
                                                  exercise.id,
                                                  set.id,
                                                  'reps',
                                                  event.target.value,
                                                )
                                              }
                                              sx={{ ...fieldSx, flex: 1 }}
                                            />
                                            <TextField
                                              size="small"
                                              type="number"
                                              inputMode="decimal"
                                              label={`Set ${set.set_number} kg`}
                                              value={set.weight_kg}
                                              onChange={(event) =>
                                                updateHistorySetField(
                                                  workout.id,
                                                  exercise.id,
                                                  set.id,
                                                  'weight_kg',
                                                  event.target.value,
                                                )
                                              }
                                              sx={{ ...fieldSx, flex: 1 }}
                                            />
                                          </Stack>
                                        ))}
                                      </Stack>
                                    </ListItem>
                                  ))
                                : exercises.map((exercise) => {
                                    const sets = [...(exercise.workout_sets ?? [])].sort(
                                      (a, b) => a.set_number - b.set_number,
                                    )

                                    return (
                                      <ListItem
                                        key={exercise.id}
                                        disablePadding
                                        className="exercise-card history-exercise-card"
                                        sx={{ p: 0.6 }}
                                      >
                                        <Stack spacing={0.45} sx={{ width: '100%' }}>
                                          <Typography sx={{ fontWeight: 700 }}>
                                            {exercise.exercise_name}
                                          </Typography>
                                          {sets.map((set) => (
                                            <Typography key={set.id} variant="body2" className="muted">
                                              Set {set.set_number}: {set.reps} reps x {set.weight_kg} kg
                                            </Typography>
                                          ))}
                                        </Stack>
                                      </ListItem>
                                    )
                                  })}
                            </List>
                            {isEditing && (
                              <Stack direction="row" spacing={0.8} sx={{ pt: 0.7 }}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => saveWorkoutEdit(workout.id)}
                                >
                                  Save changes
                                </Button>
                                <Button size="small" variant="outlined" onClick={cancelWorkoutEdit}>
                                  Cancel
                                </Button>
                              </Stack>
                            )}
                          </Collapse>
                        </Stack>
                      </Paper>
                    </ListItem>
                  )
                })}
              </List>
            )}
          </Stack>
        </Paper>
      )}

      <Menu
        anchorEl={workoutMenuAnchor}
        open={Boolean(workoutMenuAnchor)}
        onClose={closeWorkoutMenu}
      >
        <MenuItem
          onClick={() => {
            if (selectedWorkoutId) beginWorkoutEdit(selectedWorkoutId)
          }}
        >
          Edit workout
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (selectedWorkoutId) {
              void removeWorkoutFromHistory(selectedWorkoutId)
            }
          }}
          sx={{ color: '#ff8ea6' }}
        >
          Delete workout
        </MenuItem>
      </Menu>

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

      <Dialog
        open={cancelWorkoutConfirmOpen}
        onClose={() => setCancelWorkoutConfirmOpen(false)}
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
        <DialogTitle>Cancel workout?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This will delete the current in-progress workout and all exercises added to it.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button variant="outlined" onClick={() => setCancelWorkoutConfirmOpen(false)}>
            Keep workout
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={cancelWorkout}
            disabled={deleteWorkoutMutation.isPending}
          >
            Cancel workout
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
