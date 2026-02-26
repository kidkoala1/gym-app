import { Box, Button, Paper, Stack, Typography } from '@mui/material'

type AuthScreenProps = {
  onGoogleSignIn: () => void
}

export function AuthScreen({ onGoogleSignIn }: AuthScreenProps) {
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
          <Button variant="contained" onClick={onGoogleSignIn}>
            Sign in with Google
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
