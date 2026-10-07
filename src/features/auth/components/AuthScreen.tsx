import { Icon } from '../../../components/Icon'

type AuthScreenProps = {
  onGoogleSignIn: () => void
}

export function AuthScreen({ onGoogleSignIn }: AuthScreenProps) {
  return (
    <main className="auth">
      <div className="auth-inner">
        <div className="app-icon">
          <Icon name="dumbbell" />
        </div>
        <h1>Gym Tracker</h1>
        <p className="lead">Log every set as you go and watch your lifts climb.</p>
      </div>
      <div className="auth-inner">
        <button type="button" className="btn btn-light" onClick={onGoogleSignIn}>
          Continue with Google
        </button>
        <p className="footnote center">Invite only. Your Gmail address needs to be on the list before you sign in.</p>
      </div>
    </main>
  )
}
