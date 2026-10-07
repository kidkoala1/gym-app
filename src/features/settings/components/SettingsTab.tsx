import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { Switch } from '../../../components/Controls'
import { Icon, type IconName } from '../../../components/Icon'
import { SwipeRow } from '../../../components/SwipeRow'
import type { useProfileForm } from '../../profile/useProfileForm'
import { DEFAULT_EXERCISE_NAMES } from '../../workouts/defaultExercises'
import type { SettingsView } from '../../workouts/localTypes'
import type { useExerciseLibrary } from '../../workouts/useExerciseLibrary'
import type { BackgroundKind, useBackgroundSettings } from '../useBackgroundSettings'
import { ACCENT_PRESETS, CUSTOM_ACCENT_ID, DEFAULT_ACCENT_ID, type usePreferences } from '../usePreferences'

type SettingsTabProps = {
  view: SettingsView
  onViewChange: (view: SettingsView) => void
  appVersion: string
  user: User
  profile: ReturnType<typeof useProfileForm>
  library: ReturnType<typeof useExerciseLibrary>
  background: ReturnType<typeof useBackgroundSettings>
  preferences: ReturnType<typeof usePreferences>
  onRequestSignOut: () => void
}

function Avatar({ name, url, size }: { name: string; url: string; size: number }) {
  const showImage = /^https:\/\//i.test(url.trim())
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {showImage ? <img src={url.trim()} alt="" /> : (name.trim() || '?').charAt(0).toUpperCase()}
    </div>
  )
}

function SubPage({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <>
      <div className="navbar">
        <button type="button" className="back" onClick={onBack}>
          <Icon name="chevronLeft" />
          Settings
        </button>
      </div>
      <header className="lt sub-lt">
        <h1>{title}</h1>
      </header>
      <div className="stack">{children}</div>
    </>
  )
}

function MenuRow({ icon, color, label, value, onClick }: { icon: IconName; color: string; label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" className="row" onClick={onClick}>
      <span className="icon-tile" style={{ background: `var(${color})` }}>
        <Icon name={icon} />
      </span>
      <span className="grow">{label}</span>
      <span className="value">{value}</span>
      <Icon name="chevronRight" className="chev" />
    </button>
  )
}

export function SettingsTab(props: SettingsTabProps) {
  const { view, onViewChange } = props
  const back = () => onViewChange('menu')

  if (view === 'profile') return <ProfilePage {...props} onBack={back} />
  if (view === 'appearance') return <AppearancePage {...props} onBack={back} />
  if (view === 'exercise-list') return <ExerciseListPage {...props} onBack={back} />
  if (view === 'rest-clock') return <RestClockPage {...props} onBack={back} />

  const { profile, library, background, preferences, appVersion, onRequestSignOut } = props
  const backgroundLabel: Record<BackgroundKind, string> = { none: 'Plain', kees: 'Kees modus', url: 'Link', upload: 'Photo' }

  return (
    <>
      <header className="lt">
        <h1>Settings</h1>
      </header>
      <div className="stack">
        <div className="group">
          <button type="button" className="row profile-row" onClick={() => onViewChange('profile')}>
            <Avatar name={profile.profileDisplayName} url={profile.profileAvatarUrl} size={56} />
            <div className="grow">
              <div className="p-name ellipsis">{profile.profileDisplayName || 'Your profile'}</div>
              <div className="muted sm">{profile.isProgressPublic ? 'Progress visible to members' : 'Progress private'}</div>
            </div>
            <Icon name="chevronRight" className="chev" />
          </button>
        </div>

        <div className="group icons">
          <MenuRow
            icon="palette"
            color="--tile-indigo"
            label="Appearance"
            value={`${preferences.accentName} · ${backgroundLabel[background.kind]}`}
            onClick={() => onViewChange('appearance')}
          />
          <MenuRow
            icon="list"
            color="--tile-orange"
            label="Exercise list"
            value={`${library.exerciseLibrary.length} custom`}
            onClick={() => onViewChange('exercise-list')}
          />
          <MenuRow
            icon="timer"
            color="--tile-green"
            label="Rest clock"
            value={preferences.restClockEnabled ? 'On' : 'Off'}
            onClick={() => onViewChange('rest-clock')}
          />
        </div>

        <div className="group">
          <button type="button" className="row center danger" onClick={onRequestSignOut}>
            Sign out
          </button>
        </div>
        <p className="footnote center">Gym Tracker {appVersion}</p>
      </div>
    </>
  )
}

function ProfilePage({ profile, user, onBack }: SettingsTabProps & { onBack: () => void }) {
  const provider = (user.app_metadata?.provider as string | undefined) ?? 'email'
  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1)
  const memberSince = new Date(user.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <SubPage title="Profile" onBack={onBack}>
      <div className="profile-hero">
        <Avatar name={profile.profileDisplayName} url={profile.profileAvatarUrl} size={88} />
      </div>
      <div className="group">
        <label className="row form-row" htmlFor="profile-name">
          <span className="lbl">Name</span>
          <input
            id="profile-name"
            className="inline"
            autoComplete="name"
            value={profile.profileDisplayName}
            onChange={(e) => profile.setProfileDisplayName(e.target.value)}
          />
        </label>
        <label className="row form-row" htmlFor="profile-photo">
          <span className="lbl">Photo link</span>
          <input
            id="profile-photo"
            className="inline"
            inputMode="url"
            autoComplete="off"
            placeholder="https://…"
            value={profile.profileAvatarUrl}
            onChange={(e) => profile.setProfileAvatarUrl(e.target.value)}
          />
        </label>
      </div>
      <section className="section">
        <div className="group">
          <div className="row">
            <span className="grow">Public progress</span>
            <Switch
              id="profile-public"
              label="Public progress"
              checked={profile.isProgressPublic}
              onChange={profile.setIsProgressPublic}
            />
          </div>
        </div>
        <p className="footnote">Other members can compare their lifts with yours in Progress.</p>
      </section>
      <section className="section">
        <div className="section-label">Account</div>
        <div className="group">
          <div className="row">
            <span className="grow">Signed in with</span>
            <span className="value">{providerName}</span>
          </div>
          <div className="row">
            <span className="grow">Member since</span>
            <span className="value">{memberSince}</span>
          </div>
        </div>
      </section>
      <button type="button" className="btn btn-primary" onClick={() => void profile.saveProfile()} disabled={profile.isSavingProfile}>
        Save profile
      </button>
    </SubPage>
  )
}

function AppearancePage({ preferences, background, onBack }: SettingsTabProps & { onBack: () => void }) {
  const isCustom = preferences.accentId === CUSTOM_ACCENT_ID
  const backgroundRow = (kind: BackgroundKind, label: string) => (
    <button type="button" className="row" onClick={() => background.selectBackground(kind)}>
      <span className="grow">{label}</span>
      {background.kind === kind ? <Icon name="check" className="check-mark" /> : null}
    </button>
  )

  return (
    <SubPage title="Appearance" onBack={onBack}>
      <section className="section">
        <div className="section-label">Accent colour</div>
        <div className="group">
          <div className="swatches">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="sw"
                style={{ background: preset.color }}
                aria-pressed={preferences.accentId === preset.id}
                aria-label={preset.name}
                onClick={() => preferences.selectAccent(preset.id)}
              />
            ))}
            <label
              className="sw sw-custom"
              aria-pressed={isCustom}
              style={isCustom ? { background: preferences.accentColor } : undefined}
              title="Custom colour"
            >
              <input
                type="color"
                value={preferences.customAccent}
                aria-label="Pick a custom accent colour"
                onChange={(e) => preferences.chooseCustomAccent(e.target.value)}
              />
            </label>
          </div>
        </div>
        <p className="footnote">
          {preferences.accentName}
          {preferences.accentId === DEFAULT_ACCENT_ID ? ' (default)' : ''}. The last circle opens your phone’s colour picker. Very
          dark colours are lightened so text stays readable on black.
        </p>
      </section>

      <section className="section">
        <div className="section-label">Background</div>
        <div className="group">
          {backgroundRow('none', 'Plain black')}
          {backgroundRow('kees', 'Kees modus 🐵')}
          {backgroundRow('url', 'Image from a link')}
          {background.hasUploadedImage ? (
            backgroundRow('upload', 'Photo from your phone')
          ) : (
            <label className="row" htmlFor="background-file">
              <span className="grow">Photo from your phone</span>
            </label>
          )}
        </div>
        {background.kind === 'url' ? (
          <input
            className="field"
            inputMode="url"
            autoComplete="off"
            placeholder="https://example.com/photo.jpg"
            aria-label="Background image link"
            value={background.backgroundImageUrl}
            onChange={(e) => background.changeBackgroundImageUrl(e.target.value)}
          />
        ) : null}
        {background.hasUploadedImage ? (
          <div className="add-row">
            <label className="btn btn-tinted" htmlFor="background-file">
              Choose another photo
            </label>
            <button type="button" className="btn btn-danger-tinted" onClick={background.clearUploadedBackground}>
              Remove
            </button>
          </div>
        ) : null}
        <input
          id="background-file"
          className="visually-hidden-input"
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) background.uploadBackgroundImage(file)
            e.target.value = ''
          }}
        />
        <p className="footnote">Saved on this phone only. Cards stay solid over any background, so text stays readable.</p>
      </section>
    </SubPage>
  )
}

function ExerciseListPage({ library, onBack }: SettingsTabProps & { onBack: () => void }) {
  return (
    <SubPage title="Exercise list" onBack={onBack}>
      <div className="add-row">
        <input
          className="field"
          placeholder="New exercise name"
          autoComplete="off"
          enterKeyHint="done"
          aria-label="New exercise name"
          value={library.newExerciseInput}
          onChange={(e) => library.setNewExerciseInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void library.addExerciseToLibrary()
          }}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void library.addExerciseToLibrary()}
          disabled={library.createExercisePending}
        >
          Add
        </button>
      </div>

      <section className="section">
        <div className="section-label">Your exercises</div>
        <div className="group">
          {library.exerciseLibrary.length === 0 ? (
            <div className="row muted">None yet</div>
          ) : (
            library.exerciseLibrary.map((exercise) => (
              <SwipeRow key={exercise.id} className="row" onDelete={() => library.setDeleteTarget(exercise)}>
                {exercise.name}
              </SwipeRow>
            ))
          )}
        </div>
        <p className="footnote">Swipe left to delete. New names you log in a workout are added here automatically.</p>
      </section>

      <section className="section">
        <div className="section-label">Built in · {DEFAULT_EXERCISE_NAMES.length}</div>
        <div className="group">
          {DEFAULT_EXERCISE_NAMES.map((name) => (
            <div className="row" key={name}>
              {name}
            </div>
          ))}
        </div>
      </section>

      <ConfirmDialog
        open={library.deleteTarget !== null}
        title={`Delete “${library.deleteTarget?.name ?? ''}”?`}
        confirmLabel="Delete"
        destructive
        confirmDisabled={library.deleteExercisePending}
        onCancel={() => library.setDeleteTarget(null)}
        onConfirm={() => void library.confirmDeleteExercise()}
      >
        It disappears from your exercise list. Past workouts keep their sets.
      </ConfirmDialog>
    </SubPage>
  )
}

function RestClockPage({ preferences, onBack }: SettingsTabProps & { onBack: () => void }) {
  return (
    <SubPage title="Rest clock" onBack={onBack}>
      <section className="section">
        <div className="group">
          <div className="row">
            <span className="grow">Show time since last set</span>
            <Switch
              id="rest-clock-enabled"
              label="Show time since last set"
              checked={preferences.restClockEnabled}
              onChange={preferences.changeRestClockEnabled}
            />
          </div>
        </div>
        <p className="footnote">
          A clock above the tab bar counts up from the moment you finish a set and starts again at 0:00 with every new set. It’s a
          reality check on how long you rest; it never beeps or tells you to start.
        </p>
      </section>
    </SubPage>
  )
}
