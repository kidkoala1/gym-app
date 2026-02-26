import {
  Autocomplete,
  Button,
  List,
  ListItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import type { ActiveWorkout, SetDraft } from '../localTypes'

type WorkoutTabProps = {
  activeWorkout: ActiveWorkout | null
  isAddingExercise: boolean
  exerciseNameInput: string
  setDrafts: SetDraft[]
  exerciseNames: string[]
  exercisesLoading: boolean
  fieldSx: object
  startWorkoutPending: boolean
  finishWorkoutPending: boolean
  deleteWorkoutPending: boolean
  onStartWorkout: () => void
  onFinishWorkout: () => void
  onOpenCancelWorkoutConfirm: () => void
  onOpenAddExercise: () => void
  onFinishExercise: () => void
  onCancelAddExercise: () => void
  onExerciseNameInputChange: (value: string) => void
  onUpdateSetDraft: (index: number, field: keyof SetDraft, value: string) => void
}

export function WorkoutTab({
  activeWorkout,
  isAddingExercise,
  exerciseNameInput,
  setDrafts,
  exerciseNames,
  exercisesLoading,
  fieldSx,
  startWorkoutPending,
  finishWorkoutPending,
  deleteWorkoutPending,
  onStartWorkout,
  onFinishWorkout,
  onOpenCancelWorkoutConfirm,
  onOpenAddExercise,
  onFinishExercise,
  onCancelAddExercise,
  onExerciseNameInputChange,
  onUpdateSetDraft,
}: WorkoutTabProps) {
  return (
    <Paper className="panel" elevation={0}>
      {!activeWorkout ? (
        <Stack spacing={1.25}>
          <Typography>No active workout session.</Typography>
          <Button variant="contained" onClick={onStartWorkout} disabled={startWorkoutPending}>
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
                onClick={onOpenCancelWorkoutConfirm}
                disabled={deleteWorkoutPending}
              >
                Cancel Workout
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={onFinishWorkout}
                disabled={finishWorkoutPending}
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
                    <Stack>
                      <Typography sx={{ fontWeight: 700 }}>{exercise.name}</Typography>
                      <Typography variant="body2" sx={{ color: '#c2c7f1' }}>
                        {exercise.sets.map((set) => `${set.reps} reps x ${set.weightKg} kg`).join(' | ')}
                      </Typography>
                    </Stack>
                  </ListItem>
                ))}
              </List>
            )}
          </Stack>

          {!isAddingExercise ? (
            <Button variant="contained" onClick={onOpenAddExercise}>
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
                loading={exercisesLoading}
                inputValue={exerciseNameInput}
                onInputChange={(_, value) => onExerciseNameInputChange(value)}
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
                      onChange={(event) => onUpdateSetDraft(idx, 'reps', event.target.value)}
                      inputProps={{ min: 1 }}
                      sx={{ ...fieldSx, flex: 1 }}
                    />
                    <TextField
                      type="number"
                      inputMode="decimal"
                      placeholder="Weight (kg)"
                      value={set.weight}
                      onChange={(event) => onUpdateSetDraft(idx, 'weight', event.target.value)}
                      inputProps={{ min: 0, step: 0.5 }}
                      sx={{ ...fieldSx, flex: 1 }}
                    />
                  </Stack>
                ))}
              </Stack>

              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={onFinishExercise} fullWidth>
                  Finish Exercise
                </Button>
                <Button variant="outlined" onClick={onCancelAddExercise}>
                  Cancel
                </Button>
              </Stack>
            </Paper>
          )}
        </Stack>
      )}
    </Paper>
  )
}
