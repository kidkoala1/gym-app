import { formatWeight } from './workoutDraft'

export const formatSet = (weightKg: number, reps: number) => `${formatWeight(weightKg)} kg × ${reps}`
export const formatKg = (kg: number) => `${Math.round(kg).toLocaleString('en-US')} kg`

export const shortDate = (value: string | number) =>
  new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
export const dayDate = (value: string | number) =>
  new Date(value).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
export const longDate = (value: string | number) =>
  new Date(value).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
export const timeOfDay = (value: string | number) =>
  new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
