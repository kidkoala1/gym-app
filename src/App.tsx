import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthSession } from './features/auth/useAuthSession'
import { AuthScreen } from './features/auth/components/AuthScreen'
import { getProfile, upsertProfile } from './features/profile/api'
import { SettingsTab } from './features/settings/components/SettingsTab'
import { HistoryTab } from './features/workouts/components/HistoryTab'
import { WorkoutTab } from './features/workouts/components/WorkoutTab'
import type { ExerciseRow } from './types/db'
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
  updateExerciseName,
  updateWorkoutExerciseName,
  updateWorkoutSet,
} from './features/workouts/api'
import type {
  ActiveWorkout,
  EditableHistoryExercise,
  SetDraft,
  SettingsView,
} from './features/workouts/localTypes'
import { supabase } from './lib/supabase'
import './App.css'

type TabView = 'workout' | 'settings' | 'history'

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
  const [settingsView, setSettingsView] = useState<SettingsView>('menu')

  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null)
  const [isAddingExercise, setIsAddingExercise] = useState(false)
  const [exerciseNameInput, setExerciseNameInput] = useState('')
  const [setDrafts, setSetDrafts] = useState<SetDraft[]>(createInitialSetDraft())

  const [newExerciseInput, setNewExerciseInput] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ExerciseRow | null>(null)
  const [exerciseEditValues, setExerciseEditValues] = useState<Record<string, string>>({})

  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({})
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null)
  const [historyEdits, setHistoryEdits] = useState<Record<string, EditableHistoryExercise[]>>({})
  const [workoutMenuAnchor, setWorkoutMenuAnchor] = useState<HTMLElement | null>(null)
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null)
  const [cancelWorkoutConfirmOpen, setCancelWorkoutConfirmOpen] = useState(false)

  const [profileDisplayName, setProfileDisplayName] = useState('')
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('')

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
      if (editingWorkoutId === workoutId) setEditingWorkoutId(null)
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
        if (!cleanedName) throw new Error('Exercise title cannot be empty.')

        await updateWorkoutExerciseName(exercise.id, cleanedName)

        for (const set of exercise.sets) {
          const reps = Number(set.reps)
          const weight = Number(set.weight_kg)

          if (!Number.isFinite(reps) || reps <= 0) throw new Error('Reps must be greater than 0.')
          if (!Number.isFinite(weight) || weight < 0) throw new Error('Weight must be 0 or greater.')

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
      options: { redirectTo: window.location.origin },
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
      setActiveWorkout({ id: workout.id, startedAt: workout.started_at, exercises: [] })
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

      if (editedIsLast && lastFilled) next.push({ reps: '', weight: last.weight.trim() })
      return next
    })
  }

  async function finishExercise() {
    if (!activeWorkout || !user) return

    const cleanedName = exerciseNameInput.trim()
    if (!cleanedName) return

    const completedSets = setDrafts
      .filter((set) => set.reps.trim() !== '' && set.weight.trim() !== '')
      .map((set) => ({ reps: Number(set.reps), weightKg: Number(set.weight) }))
      .filter((set) => Number.isFinite(set.reps) && Number.isFinite(set.weightKg))
      .filter((set) => set.reps > 0 && set.weightKg >= 0)

    if (completedSets.length === 0) return

    try {
      const position = activeWorkout.exercises.length + 1
      const workoutExercise = await insertWorkoutExercise(activeWorkout.id, cleanedName, position)
      await insertWorkoutSets(workoutExercise.id, completedSets)

      setActiveWorkout((prev) =>
        prev
          ? { ...prev, exercises: [...prev.exercises, { name: cleanedName, sets: completedSets }] }
          : prev,
      )

      if (!exerciseNames.some((name) => name.toLowerCase() === cleanedName.toLowerCase())) {
        try {
          await createExerciseMutation.mutateAsync(cleanedName)
        } catch (error) {
          const maybeDuplicate = error as Error & { code?: string | null }
          if (maybeDuplicate.code !== '23505') throw error
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
      showError(error instanceof Error ? error.message : 'Could not add exercise.')
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
    return <AuthScreen onGoogleSignIn={handleGoogleSignIn} />
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
          sx={{ minHeight: 44, '& .MuiTab-root': { minHeight: 44, fontWeight: 600 } }}
        >
          <Tab value="workout" label="Workout" />
          <Tab value="history" label="History" />
          <Tab value="settings" label="Settings" />
        </Tabs>
      </Paper>

      {activeTab === 'workout' ? (
        <WorkoutTab
          activeWorkout={activeWorkout}
          isAddingExercise={isAddingExercise}
          exerciseNameInput={exerciseNameInput}
          setDrafts={setDrafts}
          exerciseNames={exerciseNames}
          exercisesLoading={exercisesQuery.isLoading}
          fieldSx={fieldSx}
          startWorkoutPending={startWorkoutMutation.isPending}
          finishWorkoutPending={finishWorkoutMutation.isPending}
          deleteWorkoutPending={deleteWorkoutMutation.isPending}
          onStartWorkout={startWorkout}
          onFinishWorkout={finishWorkout}
          onOpenCancelWorkoutConfirm={() => setCancelWorkoutConfirmOpen(true)}
          onOpenAddExercise={openAddExercise}
          onFinishExercise={finishExercise}
          onCancelAddExercise={() => {
            setIsAddingExercise(false)
            setExerciseNameInput('')
            setSetDrafts(createInitialSetDraft())
          }}
          onExerciseNameInputChange={setExerciseNameInput}
          onUpdateSetDraft={updateSetDraft}
        />
      ) : activeTab === 'history' ? (
        <HistoryTab
          isLoading={historyWorkoutsQuery.isLoading}
          workouts={historyWorkoutsQuery.data ?? []}
          expandedHistory={expandedHistory}
          editingWorkoutId={editingWorkoutId}
          historyEdits={historyEdits}
          fieldSx={fieldSx}
          onToggleExpanded={(workoutId) =>
            setExpandedHistory((prev) => ({ ...prev, [workoutId]: !prev[workoutId] }))
          }
          onOpenWorkoutMenu={openWorkoutMenu}
          onUpdateHistoryExerciseName={updateHistoryExerciseName}
          onMarkHistoryExerciseDeleted={markHistoryExerciseDeleted}
          onUpdateHistorySetField={updateHistorySetField}
          onSaveWorkoutEdit={saveWorkoutEdit}
          onCancelWorkoutEdit={cancelWorkoutEdit}
        />
      ) : (
        <SettingsTab
          settingsView={settingsView}
          exerciseLibrary={exerciseLibrary}
          exerciseEditValues={exerciseEditValues}
          profileDisplayName={profileDisplayName}
          profileAvatarUrl={profileAvatarUrl}
          fieldSx={fieldSx}
          createExercisePending={createExerciseMutation.isPending}
          deleteExercisePending={deleteExerciseMutation.isPending}
          upsertProfilePending={upsertProfileMutation.isPending}
          newExerciseInput={newExerciseInput}
          user={user}
          onSettingsViewChange={setSettingsView}
          onNewExerciseInputChange={setNewExerciseInput}
          onAddExerciseToLibrary={addExerciseToLibrary}
          onExerciseEditValueChange={(exerciseId, value) =>
            setExerciseEditValues((prev) => ({ ...prev, [exerciseId]: value }))
          }
          onExerciseEditCommit={commitExerciseNameChange}
          onExerciseDeleteRequest={setDeleteTarget}
          onProfileDisplayNameChange={setProfileDisplayName}
          onProfileAvatarUrlChange={setProfileAvatarUrl}
          onSaveProfile={saveProfile}
        />
      )}

      <Menu anchorEl={workoutMenuAnchor} open={Boolean(workoutMenuAnchor)} onClose={closeWorkoutMenu}>
        <MenuItem
          onClick={() => {
            if (selectedWorkoutId) beginWorkoutEdit(selectedWorkoutId)
          }}
        >
          Edit workout
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (selectedWorkoutId) void removeWorkoutFromHistory(selectedWorkoutId)
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
