import { lazy, Suspense, useState } from 'react'
import {
  Alert,
  Box,
  CircularProgress,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { ConfirmDialog } from './components/ConfirmDialog'
import { AuthScreen } from './features/auth/components/AuthScreen'
import { useAuthSession } from './features/auth/useAuthSession'
import { useProfileForm } from './features/profile/useProfileForm'
import { useBackgroundSettings } from './features/settings/useBackgroundSettings'
import { listLoggedExerciseNames } from './features/workouts/api'
import { WorkoutTab } from './features/workouts/components/WorkoutTab'
import { WORKOUT_TITLE_SUGGESTIONS } from './features/workouts/constants'
import { DEFAULT_EXERCISE_NAMES } from './features/workouts/defaultExercises'
import type { SettingsView } from './features/workouts/localTypes'
import { useActiveWorkout } from './features/workouts/useActiveWorkout'
import { useExerciseLibrary } from './features/workouts/useExerciseLibrary'
import { useWorkoutHistory } from './features/workouts/useWorkoutHistory'
import { getErrorMessage } from './lib/errors'
import { fieldSx } from './lib/formStyles'
import { supabase } from './lib/supabase'
import { useSnackbar } from './lib/useSnackbar'
import './App.css'

// The Workout tab is what opens first, so it loads with the app. The others load on first visit.
const ProgressTab = lazy(() =>
  import('./features/workouts/components/ProgressTab').then((m) => ({ default: m.ProgressTab })),
)
const HistoryTab = lazy(() =>
  import('./features/workouts/components/HistoryTab').then((m) => ({ default: m.HistoryTab })),
)
const SettingsTab = lazy(() =>
  import('./features/settings/components/SettingsTab').then((m) => ({ default: m.SettingsTab })),
)

type TabView = 'workout' | 'progress' | 'settings' | 'history'

const destructiveButtonSx = {
  bgcolor: '#d32f2f',
  backgroundImage: 'none',
  '&:hover': { bgcolor: '#b71c1c', backgroundImage: 'none' },
}

function App() {
  const appVersion = __APP_VERSION__
  const { session, user, isLoading: authLoading } = useAuthSession()
  const { snackbar, showError, showSuccess, closeSnackbar } = useSnackbar()

  const [activeTab, setActiveTab] = useState<TabView>('workout')
  const [settingsView, setSettingsView] = useState<SettingsView>('menu')
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false)

  const background = useBackgroundSettings({ showError, showSuccess })
  const profile = useProfileForm(user, { showError, showSuccess })
  const library = useExerciseLibrary(user, showError)
  const workout = useActiveWorkout({
    user,
    isWorkoutTabActive: activeTab === 'workout',
    exerciseNames: library.exerciseNames,
    createExerciseAsync: library.createExerciseAsync,
    showError,
    showSuccess,
  })
  const history = useWorkoutHistory({
    user,
    isHistoryTabActive: activeTab === 'history',
    exerciseNames: library.exerciseNames,
    createExerciseAsync: library.createExerciseAsync,
    showError,
    showSuccess,
  })

  const loggedExerciseNamesQuery = useQuery({
    queryKey: ['logged-exercise-names', user?.id],
    queryFn: () => listLoggedExerciseNames(),
    enabled: Boolean(user?.id) && activeTab === 'progress',
  })
  const loggedExerciseNamesErrorMessage = loggedExerciseNamesQuery.isError
    ? getErrorMessage(loggedExerciseNamesQuery.error, 'Could not load logged exercises.')
    : null

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

    workout.resetActiveWorkout()
    profile.resetProfileForm()
    showSuccess('Signed out.')
  }

  async function confirmSignOut() {
    setSignOutConfirmOpen(false)
    await handleSignOut()
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
    <Box
      className="app-shell"
      sx={{
        backgroundImage: background.backgroundImage,
        backgroundSize: 'auto',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'repeat',
      }}
    >
      <Paper className="panel" elevation={0}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h5" sx={{ fontSize: '1.25rem', fontWeight: 700 }}>
            Gym Workout Tracker
          </Typography>
        </Stack>

        <Tabs
          value={activeTab}
          onChange={(_, value: TabView) => {
            setActiveTab(value)
            if (value !== 'settings') setSettingsView('menu')
          }}
          variant="fullWidth"
          textColor="inherit"
          indicatorColor="secondary"
          sx={{
            minHeight: 44,
            '& .MuiTab-root': {
              minHeight: 44,
              minWidth: 0,
              px: 0.5,
              fontWeight: 600,
              fontSize: { xs: '0.78rem', sm: '0.9rem' },
            },
          }}
        >
          <Tab value="workout" label="Workout" />
          <Tab value="progress" label="Progress" />
          <Tab value="history" label="History" />
          <Tab value="settings" label="Settings" />
        </Tabs>
      </Paper>

      <Suspense
        fallback={
          <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
            <CircularProgress size={26} />
          </Box>
        }
      >
        {activeTab === 'workout' ? (
          <WorkoutTab
            activeWorkout={workout.activeWorkout}
            isAddingExercise={workout.isAddingExercise}
            exerciseNameInput={workout.exerciseNameInput}
            setDrafts={workout.setDrafts}
            exerciseNames={library.exerciseNames}
            exercisesLoading={library.exercisesLoading}
            exerciseInsightsLoading={workout.exerciseInsightsLoading}
            exerciseInsights={workout.exerciseInsights}
            fieldSx={fieldSx}
            startWorkoutPending={workout.startWorkoutPending}
            finishWorkoutPending={workout.finishWorkoutPending}
            deleteWorkoutPending={workout.cancelWorkoutPending}
            workoutTitleInput={workout.workoutTitleInput}
            workoutTitleSuggestions={WORKOUT_TITLE_SUGGESTIONS}
            onStartWorkout={workout.startWorkout}
            onFinishWorkout={workout.finishWorkout}
            onOpenCancelWorkoutConfirm={() => workout.setCancelWorkoutConfirmOpen(true)}
            onOpenAddExercise={workout.openAddExercise}
            onFinishExercise={workout.finishExercise}
            onCancelAddExercise={workout.cancelAddExercise}
            onWorkoutTitleInputChange={workout.handleWorkoutTitleInputChange}
            onSelectWorkoutTitleSuggestion={workout.handleWorkoutTitleInputChange}
            onExerciseNameInputChange={workout.setExerciseNameInput}
            onExerciseNameInputBlur={workout.normalizeExerciseNameInput}
            onUpdateSetDraft={workout.updateSetDraft}
          />
        ) : activeTab === 'progress' ? (
          <ProgressTab
            exerciseNames={loggedExerciseNamesQuery.data ?? []}
            exerciseNamesLoading={loggedExerciseNamesQuery.isLoading}
            exerciseNamesErrorMessage={loggedExerciseNamesErrorMessage}
            userId={user.id}
          />
        ) : activeTab === 'history' ? (
          <HistoryTab
            isLoading={history.isLoading}
            workouts={history.workouts}
            hasMore={history.hasMore}
            isLoadingMore={history.isLoadingMore}
            onLoadMore={history.loadMore}
            errorMessage={history.errorMessage}
            expandedHistory={history.expandedHistory}
            editingWorkoutId={history.editingWorkoutId}
            historyEdits={history.historyEdits}
            exerciseNames={library.exerciseNames}
            editingExerciseNameInput={history.editingExerciseNameInput}
            editingSetDrafts={history.editingSetDrafts}
            fieldSx={fieldSx}
            onToggleExpanded={history.toggleExpanded}
            onOpenWorkoutMenu={history.openWorkoutMenu}
            onUpdateHistoryExerciseName={history.updateHistoryExerciseName}
            onMarkHistoryExerciseDeleted={history.markHistoryExerciseDeleted}
            onUpdateHistorySetField={history.updateHistorySetField}
            onSaveWorkoutEdit={history.saveWorkoutEdit}
            onCancelWorkoutEdit={history.cancelWorkoutEdit}
            onAddExerciseToHistoryEdit={history.addExerciseToHistoryEdit}
            onCancelAddingExerciseToHistory={history.cancelAddingExerciseToHistory}
            onEditingExerciseNameInputChange={history.setEditingExerciseNameInput}
            onEditingExerciseNameInputBlur={history.normalizeEditingExerciseName}
            onUpdateEditingSetDraft={history.updateEditingSetDraft}
          />
        ) : (
          <SettingsTab
            settingsView={settingsView}
            appVersion={appVersion}
            defaultExerciseNames={DEFAULT_EXERCISE_NAMES}
            exerciseLibrary={library.exerciseLibrary}
            profileDisplayName={profile.profileDisplayName}
            profileAvatarUrl={profile.profileAvatarUrl}
            isProgressPublic={profile.isProgressPublic}
            backgroundImageUrl={background.backgroundImageUrl}
            useCustomBackground={background.useCustomBackground}
            useMonkeyBackground={background.useMonkeyBackground}
            uploadedBackgroundData={background.uploadedBackgroundData}
            useUploadedBackground={background.useUploadedBackground}
            fieldSx={fieldSx}
            createExercisePending={library.createExercisePending}
            deleteExercisePending={library.deleteExercisePending}
            upsertProfilePending={profile.isSavingProfile}
            newExerciseInput={library.newExerciseInput}
            user={user}
            onSettingsViewChange={setSettingsView}
            onNewExerciseInputChange={library.setNewExerciseInput}
            onAddExerciseToLibrary={library.addExerciseToLibrary}
            onExerciseDeleteRequest={library.setDeleteTarget}
            onProfileDisplayNameChange={profile.setProfileDisplayName}
            onProfileAvatarUrlChange={profile.setProfileAvatarUrl}
            onIsProgressPublicChange={profile.setIsProgressPublic}
            onBackgroundImageUrlChange={background.handleBackgroundImageUrlChange}
            onUseCustomBackgroundChange={background.handleUseCustomBackgroundChange}
            onUseMonkeyBackgroundChange={background.handleUseMonkeyBackgroundChange}
            onUploadBackgroundImage={background.handleUploadBackgroundImage}
            onUseUploadedBackgroundChange={background.handleUseUploadedBackgroundChange}
            onClearUploadedBackground={background.handleClearUploadedBackground}
            onSaveProfile={profile.saveProfile}
            onRequestSignOut={() => setSignOutConfirmOpen(true)}
          />
        )}
      </Suspense>

      <Menu
        anchorEl={history.workoutMenuAnchor}
        open={Boolean(history.workoutMenuAnchor)}
        onClose={history.closeWorkoutMenu}
      >
        <MenuItem
          onClick={() => {
            if (history.selectedWorkoutId) history.beginWorkoutEdit(history.selectedWorkoutId)
          }}
        >
          Edit workout
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (history.selectedWorkoutId) void history.removeWorkoutFromHistory(history.selectedWorkoutId)
          }}
          sx={{ color: '#ff8ea6' }}
        >
          Delete workout
        </MenuItem>
      </Menu>

      <ConfirmDialog
        open={signOutConfirmOpen}
        title="Sign out?"
        confirmLabel="Sign out"
        confirmButtonProps={{ sx: destructiveButtonSx }}
        onCancel={() => setSignOutConfirmOpen(false)}
        onConfirm={confirmSignOut}
      >
        <Typography variant="body2">You will need to sign in again to continue.</Typography>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(library.deleteTarget)}
        title="Delete exercise?"
        confirmLabel="Delete"
        confirmButtonProps={{ color: 'error', disabled: library.deleteExercisePending }}
        onCancel={() => library.setDeleteTarget(null)}
        onConfirm={library.confirmDeleteExercise}
      >
        <Typography variant="body2">
          This will remove <strong>{library.deleteTarget?.name}</strong> from your exercise list.
        </Typography>
      </ConfirmDialog>

      <ConfirmDialog
        open={workout.cancelWorkoutConfirmOpen}
        title="Cancel workout?"
        cancelLabel="Keep workout"
        confirmLabel="Cancel workout"
        confirmButtonProps={{ color: 'error', disabled: workout.cancelWorkoutPending }}
        onCancel={() => workout.setCancelWorkoutConfirmOpen(false)}
        onConfirm={workout.cancelWorkout}
      >
        <Typography variant="body2">
          This will delete the current in-progress workout and all exercises added to it.
        </Typography>
      </ConfirmDialog>

      <Snackbar open={snackbar.open} autoHideDuration={3500} onClose={closeSnackbar}>
        <Alert severity={snackbar.severity} variant="filled" onClose={closeSnackbar}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default App
