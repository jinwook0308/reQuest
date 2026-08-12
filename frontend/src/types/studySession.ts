export type StudySessionMode = 'focus' | 'practice'
export type StudySessionStatus =
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled'

export type StudySession = {
  id: string | number
  recordType: 'general' | 'certification'
  mode: StudySessionMode
  subject: string
  unit: string
  targetMinutes: number
  status: StudySessionStatus
  startedAt: string
  endedAt: string | null
  elapsedSeconds: number
  pausedSeconds: number
  interruptionCount: number
}

export type StudySessionResponse = {
  success: boolean
  message?: string
  data?: StudySession | null
}
