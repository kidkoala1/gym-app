import {
  Autocomplete,
  Box,
  Button,
  Collapse,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import type { WorkoutHistoryRow } from '../../../types/db'
import type { EditableHistoryExercise, SetDraft } from '../localTypes'

type HistoryTabProps = {
  isLoading: boolean
  workouts: WorkoutHistoryRow[]
  errorMessage?: string | null
  expandedHistory: Record<string, boolean>
  editingWorkoutId: string | null
  historyEdits: Record<string, EditableHistoryExercise[]>
  exerciseNames: string[]
  editingExerciseNameInput: string
  editingSetDrafts: SetDraft[]
  fieldSx: object
  onToggleExpanded: (workoutId: string) => void
  onOpenWorkoutMenu: (event: React.MouseEvent<HTMLElement>, workoutId: string) => void
  onUpdateHistoryExerciseName: (workoutId: string, exerciseId: string, value: string) => void
  onMarkHistoryExerciseDeleted: (workoutId: string, exerciseId: string) => void
  onUpdateHistorySetField: (
    workoutId: string,
    exerciseId: string,
    setId: string,
    field: 'reps' | 'weight_kg',
    value: string,
  ) => void
  onSaveWorkoutEdit: (workoutId: string) => void
  onCancelWorkoutEdit: () => void
  onAddExerciseToHistoryEdit: (workoutId: string) => void
  onCancelAddingExerciseToHistory: () => void
  onEditingExerciseNameInputChange: (value: string) => void
  onEditingExerciseNameInputBlur: () => void
  onUpdateEditingSetDraft: (index: number, field: keyof SetDraft, value: string) => void
}

export function HistoryTab({
  isLoading,
  workouts,
  errorMessage,
  expandedHistory,
  editingWorkoutId,
  historyEdits,
  exerciseNames,
  editingExerciseNameInput,
  editingSetDrafts,
  fieldSx,
  onToggleExpanded,
  onOpenWorkoutMenu,
  onUpdateHistoryExerciseName,
  onMarkHistoryExerciseDeleted,
  onUpdateHistorySetField,
  onSaveWorkoutEdit,
  onCancelWorkoutEdit,
  onAddExerciseToHistoryEdit,
  onCancelAddingExerciseToHistory,
  onEditingExerciseNameInputChange,
  onEditingExerciseNameInputBlur,
  onUpdateEditingSetDraft,
}: HistoryTabProps) {
  return (
    <Paper className="panel" elevation={0}>
      <Stack spacing={1.25}>
        <Typography variant="h6" sx={{ fontSize: '1rem' }}>
          Workout History
        </Typography>

        {isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 2 }}>
            <CircularProgress size={26} />
          </Box>
        ) : errorMessage ? (
          <Typography className="muted">{errorMessage}</Typography>
        ) : workouts.length === 0 ? (
          <Typography className="muted">No completed workouts yet.</Typography>
        ) : (
          <List disablePadding sx={{ display: 'grid', gap: 1 }}>
            {workouts.map((workout) => {
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
                            onClick={() => onToggleExpanded(workout.id)}
                          >
                            {isExpanded ? 'Hide details' : 'Show details'}
                          </Button>
                          <IconButton
                            aria-label="Workout menu"
                            size="small"
                            onClick={(event) => onOpenWorkoutMenu(event, workout.id)}
                          >
                            <Typography sx={{ fontSize: '1.2rem', lineHeight: 1 }}>...</Typography>
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
                                          onUpdateHistoryExerciseName(
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
                                          onMarkHistoryExerciseDeleted(workout.id, exercise.id)
                                        }
                                      >
                                        Delete
                                      </Button>
                                    </Stack>
                                    {exercise.sets.map((set) => (
                                      <Stack key={set.id} direction="row" spacing={0.7}>
                                        <TextField
                                          size="small"
                                          type="text"
                                          label={`Set ${set.set_number} reps`}
                                          value={set.reps}
                                          onChange={(event) =>
                                            onUpdateHistorySetField(
                                              workout.id,
                                              exercise.id,
                                              set.id,
                                              'reps',
                                              event.target.value,
                                            )
                                          }
                                          inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                                          sx={{ ...fieldSx, flex: 1 }}
                                        />
                                        <TextField
                                          size="small"
                                          type="text"
                                          label={`Set ${set.set_number} kg`}
                                          value={set.weight_kg}
                                          onChange={(event) =>
                                            onUpdateHistorySetField(
                                              workout.id,
                                              exercise.id,
                                              set.id,
                                              'weight_kg',
                                              event.target.value,
                                            )
                                          }
                                          inputProps={{
                                            inputMode: 'decimal',
                                            pattern: '[0-9]*[.,]?[0-9]*',
                                          }}
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
                          <Stack spacing={0.7}>
                            <Paper className="card" elevation={0} sx={{ p: 0.6 }}>
                              <Typography variant="body2" sx={{ fontSize: '0.95rem', mb: 0.6, fontWeight: 700 }}>
                                Add New Exercise
                              </Typography>

                              <Autocomplete
                                freeSolo
                                options={exerciseNames}
                                inputValue={editingExerciseNameInput}
                                onInputChange={(_, value) => onEditingExerciseNameInputChange(value)}
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    size="small"
                                    label="Exercise"
                                    placeholder="Type exercise name"
                                    sx={fieldSx}
                                    onBlur={onEditingExerciseNameInputBlur}
                                  />
                                )}
                                sx={{ mb: 0.7 }}
                              />

                              <Stack direction="row" spacing={0.7} sx={{ mb: 0.6 }}>
                                <Typography sx={{ flex: 1, fontSize: '0.75rem', color: '#c7cbf7' }}>Reps</Typography>
                                <Typography sx={{ flex: 1, fontSize: '0.75rem', color: '#c7cbf7' }}>
                                  Weight (kg)
                                </Typography>
                              </Stack>

                              <Stack spacing={0.5} sx={{ mb: 0.6 }}>
                                {editingSetDrafts.map((set, idx) => (
                                  <Stack key={`set-${idx}`} direction="row" spacing={0.5}>
                                    <TextField
                                      size="small"
                                      type="text"
                                      placeholder="Reps"
                                      value={set.reps}
                                      onChange={(event) =>
                                        onUpdateEditingSetDraft(idx, 'reps', event.target.value)
                                      }
                                      inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', min: 1 }}
                                      sx={{ ...fieldSx, flex: 1 }}
                                    />
                                    <TextField
                                      size="small"
                                      type="text"
                                      placeholder="Weight (kg)"
                                      value={set.weight}
                                      onChange={(event) =>
                                        onUpdateEditingSetDraft(idx, 'weight', event.target.value)
                                      }
                                      inputProps={{
                                        inputMode: 'decimal',
                                        pattern: '[0-9]*[.,]?[0-9]*',
                                        min: 0,
                                        step: 0.5,
                                      }}
                                      sx={{ ...fieldSx, flex: 1 }}
                                    />
                                  </Stack>
                                ))}
                              </Stack>

                              <Stack direction="row" spacing={0.7}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => onAddExerciseToHistoryEdit(workout.id)}
                                  fullWidth
                                >
                                  Add Exercise
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={onCancelAddingExerciseToHistory}
                                >
                                  Clear
                                </Button>
                              </Stack>
                            </Paper>

                            <Stack direction="row" spacing={0.8}>
                              <Button size="small" variant="contained" onClick={() => onSaveWorkoutEdit(workout.id)}>
                                Save changes
                              </Button>
                              <Button size="small" variant="outlined" onClick={onCancelWorkoutEdit}>
                                Cancel
                              </Button>
                            </Stack>
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
  )
}
