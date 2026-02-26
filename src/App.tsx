import { useMemo, useState } from 'react'
import './App.css'

type Tab = 'workout' | 'settings'

type SetDraft = {
  reps: string
  weight: string
}

type CompletedSet = {
  reps: number
  weightKg: number
}

type WorkoutExercise = {
  name: string
  sets: CompletedSet[]
}

type WorkoutSession = {
  id: string
  startedAt: string
  finishedAt?: string
  exercises: WorkoutExercise[]
}

const INITIAL_EXERCISES = [
  'Bench Press',
  'Squat',
  'Deadlift',
  'Overhead Press',
  'Barbell Row',
  'Pull Up',
  'Incline Dumbbell Press',
  'Lat Pulldown',
  'Leg Press',
  'Romanian Deadlift',
]

function createInitialSetDraft(): SetDraft[] {
  return [{ reps: '', weight: '' }]
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('workout')
  const [exerciseLibrary, setExerciseLibrary] = useState<string[]>(INITIAL_EXERCISES)

  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null)
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([])

  const [isAddingExercise, setIsAddingExercise] = useState(false)
  const [exerciseNameInput, setExerciseNameInput] = useState('')
  const [setDrafts, setSetDrafts] = useState<SetDraft[]>(createInitialSetDraft())

  const [newExerciseInput, setNewExerciseInput] = useState('')
  const [deleteTargetIndex, setDeleteTargetIndex] = useState<number | null>(null)

  const exerciseSuggestions = useMemo(() => {
    const term = exerciseNameInput.trim().toLowerCase()
    if (!term) return exerciseLibrary.slice(0, 8)

    return exerciseLibrary
      .filter((name) => name.toLowerCase().includes(term))
      .slice(0, 8)
  }, [exerciseLibrary, exerciseNameInput])

  const deleteTargetName =
    deleteTargetIndex === null ? '' : (exerciseLibrary[deleteTargetIndex] ?? '')

  function startWorkout() {
    setActiveWorkout({
      id: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      exercises: [],
    })
    setIsAddingExercise(false)
    setExerciseNameInput('')
    setSetDrafts(createInitialSetDraft())
  }

  function finishWorkout() {
    if (!activeWorkout) return

    const finishedWorkout: WorkoutSession = {
      ...activeWorkout,
      finishedAt: new Date().toISOString(),
    }

    setWorkoutHistory((prev) => [finishedWorkout, ...prev])
    setActiveWorkout(null)
    setIsAddingExercise(false)
    setExerciseNameInput('')
    setSetDrafts(createInitialSetDraft())
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
      const lastFilled = last.reps.trim() !== '' && last.weight.trim() !== ''

      if (lastFilled) {
        next.push({ reps: '', weight: last.weight.trim() })
      }

      return next
    })
  }

  function finishExercise() {
    if (!activeWorkout) return

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

    setActiveWorkout((prev) => {
      if (!prev) return prev

      return {
        ...prev,
        exercises: [...prev.exercises, { name: cleanedName, sets: completedSets }],
      }
    })

    if (!exerciseLibrary.some((name) => name.toLowerCase() === cleanedName.toLowerCase())) {
      setExerciseLibrary((prev) => [...prev, cleanedName])
    }

    setIsAddingExercise(false)
    setExerciseNameInput('')
    setSetDrafts(createInitialSetDraft())
  }

  function addExerciseToLibrary() {
    const value = newExerciseInput.trim()
    if (!value) return

    if (exerciseLibrary.some((name) => name.toLowerCase() === value.toLowerCase())) {
      setNewExerciseInput('')
      return
    }

    setExerciseLibrary((prev) => [...prev, value])
    setNewExerciseInput('')
  }

  function updateExerciseNameInLibrary(index: number, value: string) {
    setExerciseLibrary((prev) => prev.map((name, i) => (i === index ? value : name)))
  }

  function requestDeleteExercise(index: number) {
    setDeleteTargetIndex(index)
  }

  function confirmDeleteExercise() {
    if (deleteTargetIndex === null) return

    setExerciseLibrary((prev) => prev.filter((_, i) => i !== deleteTargetIndex))
    setDeleteTargetIndex(null)
  }

  function cancelDeleteExercise() {
    setDeleteTargetIndex(null)
  }

  return (
    <div className="app-shell">
      <header className="topbar panel">
        <h1>Gym Workout Tracker</h1>
        <nav className="tabs">
          <button
            className={activeTab === 'workout' ? 'tab is-active' : 'tab'}
            onClick={() => setActiveTab('workout')}
          >
            Workout
          </button>
          <button
            className={activeTab === 'settings' ? 'tab is-active' : 'tab'}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </nav>
      </header>

      {activeTab === 'workout' ? (
        <main className="panel">
          {!activeWorkout ? (
            <section className="stack">
              <p>No active workout session.</p>
              <button onClick={startWorkout}>Start Workout</button>
            </section>
          ) : (
            <section className="stack">
              <div className="row-between">
                <p>Started: {new Date(activeWorkout.startedAt).toLocaleString()}</p>
                <button className="danger" onClick={finishWorkout}>
                  Finish Workout
                </button>
              </div>

              <div>
                <h2>Current Exercises</h2>
                {activeWorkout.exercises.length === 0 ? (
                  <p className="muted">No exercises added yet.</p>
                ) : (
                  <ul className="exercise-list">
                    {activeWorkout.exercises.map((exercise, idx) => (
                      <li key={`${exercise.name}-${idx}`}>
                        <strong>{exercise.name}</strong>
                        <span>
                          {exercise.sets
                            .map((set) => `${set.reps} reps x ${set.weightKg} kg`)
                            .join(' | ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {!isAddingExercise ? (
                <button onClick={openAddExercise}>Add Exercise</button>
              ) : (
                <div className="card">
                  <h3>New Exercise</h3>

                  <label>
                    Exercise
                    <input
                      type="text"
                      placeholder="Type exercise name"
                      value={exerciseNameInput}
                      onChange={(e) => setExerciseNameInput(e.target.value)}
                    />
                  </label>

                  {exerciseSuggestions.length > 0 && (
                    <ul className="suggestions">
                      {exerciseSuggestions.map((name) => (
                        <li key={name}>
                          <button
                            className="linklike"
                            onClick={() => setExerciseNameInput(name)}
                          >
                            {name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="sets-grid-header">
                    <span>Reps</span>
                    <span>Weight (kg)</span>
                  </div>

                  <div className="sets-grid">
                    {setDrafts.map((set, idx) => (
                      <div className="set-row" key={`set-${idx}`}>
                        <input
                          inputMode="numeric"
                          type="number"
                          min="1"
                          placeholder="Reps"
                          value={set.reps}
                          onChange={(e) => updateSetDraft(idx, 'reps', e.target.value)}
                        />
                        <input
                          inputMode="decimal"
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="Weight (kg)"
                          value={set.weight}
                          onChange={(e) => updateSetDraft(idx, 'weight', e.target.value)}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="row-actions">
                    <button onClick={finishExercise}>Finish Exercise</button>
                    <button
                      className="ghost"
                      onClick={() => {
                        setIsAddingExercise(false)
                        setExerciseNameInput('')
                        setSetDrafts(createInitialSetDraft())
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </main>
      ) : (
        <main className="panel">
          <section className="stack">
            <h2>Exercise Settings</h2>

            <div className="row-actions">
              <input
                type="text"
                placeholder="Add new exercise"
                value={newExerciseInput}
                onChange={(e) => setNewExerciseInput(e.target.value)}
              />
              <button onClick={addExerciseToLibrary}>Add</button>
            </div>

            <ul className="settings-list">
              {exerciseLibrary.map((name, index) => (
                <li key={`${name}-${index}`} className="settings-item">
                  <input
                    className="settings-input"
                    type="text"
                    value={name}
                    onChange={(e) => updateExerciseNameInLibrary(index, e.target.value)}
                  />
                  <button
                    className="delete-inline"
                    onClick={() => requestDeleteExercise(index)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </main>
      )}

      {workoutHistory.length > 0 && (
        <footer className="panel history">
          <h3>Recent Workouts</h3>
          <ul>
            {workoutHistory.slice(0, 3).map((workout) => (
              <li key={workout.id}>
                {new Date(workout.startedAt).toLocaleDateString()} - {workout.exercises.length}{' '}
                exercise(s)
              </li>
            ))}
          </ul>
        </footer>
      )}

      {deleteTargetIndex !== null && (
        <div className="modal-backdrop" onClick={cancelDeleteExercise}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Delete exercise?</h3>
            <p>
              This will remove <strong>{deleteTargetName}</strong> from your exercise list.
            </p>
            <div className="modal-actions">
              <button className="ghost" onClick={cancelDeleteExercise}>
                Cancel
              </button>
              <button className="delete-inline" onClick={confirmDeleteExercise}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
