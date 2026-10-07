import { lazy, Suspense, useMemo, useState } from 'react'
import { CircularProgress, CssBaseline, Snackbar, ThemeProvider } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { BottomNav, type TabView } from './components/BottomNav'
import { ConfirmDialog } from './components/ConfirmDialog'
import { Icon } from './components/Icon'
import { AuthScreen } from './features/auth/components/AuthScreen'
import { useAuthSession } from './features/auth/useAuthSession'
import { useProfileForm } from './features/profile/useProfileForm'
import { useBackgroundSettings } from './features/settings/useBackgroundSettings'
import { usePreferences } from './features/settings/usePreferences'
import { listLoggedExerciseNames } from './features/workouts/api'
import { RestClock } from './features/workouts/components/RestClock'
import { WorkoutTab } from './features/workouts/components/WorkoutTab'
import { recentWorkoutsQuery } from './features/workouts/exerciseQueries'
import type { SettingsView } from './features/workouts/localTypes'
import { useActiveWorkout } from './features/workouts/useActiveWorkout'
import { useExerciseLibrary } from './features/workouts/useExerciseLibrary'
import { useWorkoutHistory } from './features/workouts/useWorkoutHistory'
import { getErrorMessage } from './lib/errors'
import { supabase } from './lib/supabase'
import { useSnackbar } from './lib/useSnackbar'
import { buildTheme } from './theme'
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

function App() {
  const preferences = usePreferences()
  const theme = useMemo(() => buildTheme(preferences.accentColor), [preferences.accentColor])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppContent preferences={preferences} />
    </ThemeProvider>
  )
}

function AppContent({ preferences }: { preferences: ReturnType<typeof usePreferences> }) {
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
    exerciseNames: library.exerciseNames,
    createExerciseAsync: library.createExerciseAsync,
    showError,
  })
  const history = useWorkoutHistory({
    user,
    isHistoryTabActive: activeTab === 'history',
    exerciseNames: library.exerciseNames,
    createExerciseAsync: library.createExerciseAsync,
    showError,
    showSuccess,
    onWorkoutSaved: (workoutId) => void workout.reloadFromServer(workoutId),
    onWorkoutDeleted: workout.forgetWorkout,
  })

  const recentWorkouts = useQuery({ ...recentWorkoutsQuery(user?.id), enabled: Boolean(user?.id) && activeTab === 'workout' })
  const loggedExerciseNamesQuery = useQuery({
    queryKey: ['logged-exercise-names', user?.id],
    queryFn: () => listLoggedExerciseNames(),
    enabled: Boolean(user?.id) && activeTab === 'progress',
  })
  const loggedExerciseNamesErrorMessage = loggedExerciseNamesQuery.isError
    ? getErrorMessage(loggedExerciseNamesQuery.error, 'Could not load logged exercises.')
    : null

  function changeTab(tab: TabView) {
    setActiveTab(tab)
    if (tab !== 'settings') setSettingsView('menu')
    window.scrollTo(0, 0)
  }

  function openPastWorkout(workoutId: string) {
    changeTab('history')
    history.openDetail(workoutId)
  }

  async function handleGoogleSignIn() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) showError(error.message)
  }

  async function confirmSignOut() {
    setSignOutConfirmOpen(false)
    const { error } = await supabase.auth.signOut()
    if (error) {
      showError(error.message)
      return
    }
    workout.resetActiveWorkout()
    profile.resetProfileForm()
    history.closeDetail()
    changeTab('workout')
    showSuccess('Signed out.')
  }

  const toast = (
    <Snackbar
      open={snackbar.open}
      autoHideDuration={3000}
      onClose={closeSnackbar}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ top: 'calc(env(safe-area-inset-top, 0px) + 10px) !important' }}
    >
      <div className={snackbar.severity === 'error' ? 'toast error' : 'toast'} role="status" onClick={closeSnackbar}>
        <Icon name={snackbar.severity === 'error' ? 'alert' : 'check'} />
        <span>{snackbar.message}</span>
      </div>
    </Snackbar>
  )

  if (authLoading) {
    return (
      <div className="center-screen">
        <CircularProgress size={28} aria-label="Loading" />
      </div>
    )
  }

  if (!session || !user) {
    return (
      <>
        <AuthScreen onGoogleSignIn={handleGoogleSignIn} />
        {toast}
      </>
    )
  }

  const tiledBackground = background.kind === 'kees'

  return (
    <>
      {background.backgroundImage !== 'none' ? (
        <div
          className="bg-layer"
          style={{
            backgroundImage: background.backgroundImage,
            backgroundSize: tiledBackground ? 'auto' : 'cover',
            backgroundRepeat: tiledBackground ? 'repeat' : 'no-repeat',
          }}
        />
      ) : null}

      <main className="app">
        <Suspense
          fallback={
            <div className="spinner-row">
              <CircularProgress size={26} aria-label="Loading" />
            </div>
          }
        >
          {activeTab === 'workout' ? (
            <WorkoutTab
              userId={user.id}
              workout={workout.workout}
              resumePending={workout.resumePending}
              syncError={workout.syncError}
              recentWorkouts={recentWorkouts.data ?? []}
              exerciseNames={library.exerciseNames}
              startPending={workout.startWorkoutPending}
              finishPending={workout.finishWorkoutPending}
              deletePending={workout.deleteWorkoutPending}
              onStart={(title) => void workout.startWorkout(title)}
              onRename={(title) => void workout.renameWorkout(title)}
              onAddExercise={(name) => void workout.addExercise(name)}
              onSwapExercise={workout.swapExercise}
              onRemoveExercise={workout.removeExercise}
              onUpdateSet={workout.updateSet}
              onDeleteSet={workout.deleteSet}
              onSaveNow={workout.saveNow}
              onFinish={workout.finishWorkout}
              onDelete={workout.deleteActiveWorkout}
              onOpenPastWorkout={openPastWorkout}
            />
          ) : activeTab === 'progress' ? (
            <ProgressTab
              exerciseNames={loggedExerciseNamesQuery.data ?? []}
              exerciseNamesLoading={loggedExerciseNamesQuery.isLoading}
              exerciseNamesErrorMessage={loggedExerciseNamesErrorMessage}
              userId={user.id}
            />
          ) : activeTab === 'history' ? (
            <HistoryTab history={history} exerciseNames={library.exerciseNames} />
          ) : (
            <SettingsTab
              view={settingsView}
              onViewChange={(view) => {
                setSettingsView(view)
                window.scrollTo(0, 0)
              }}
              appVersion={__APP_VERSION__}
              user={user}
              profile={profile}
              library={library}
              background={background}
              preferences={preferences}
              onRequestSignOut={() => setSignOutConfirmOpen(true)}
            />
          )}
        </Suspense>
      </main>

      {preferences.restClockEnabled && workout.workout && workout.restSince ? (
        <RestClock since={workout.restSince} onDismiss={workout.dismissRestClock} />
      ) : null}

      <BottomNav value={activeTab} onChange={changeTab} workoutInProgress={workout.workout !== null} />

      <ConfirmDialog
        open={signOutConfirmOpen}
        title="Sign out?"
        confirmLabel="Sign out"
        destructive
        onCancel={() => setSignOutConfirmOpen(false)}
        onConfirm={() => void confirmSignOut()}
      >
        You’ll need to sign in with Google again.
      </ConfirmDialog>

      {toast}
    </>
  )
}

export default App
