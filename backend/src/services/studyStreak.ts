const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(dateKey: string, amount: number) {
  const date = parseDateKey(dateKey)
  date.setUTCDate(date.getUTCDate() + amount)
  return formatDateKey(date)
}

export function getKoreaDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return `${values.year}-${values.month}-${values.day}`
}

export function calculateStudyStreak(activityDates: string[], today: string) {
  const uniqueDates = [...new Set(activityDates)]
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort()
  const activitySet = new Set(uniqueDates)

  let bestStreak = 0
  let runningStreak = 0
  let previousTime: number | null = null

  uniqueDates.forEach((dateKey) => {
    const currentTime = parseDateKey(dateKey).getTime()

    runningStreak =
      previousTime !== null && currentTime - previousTime === DAY_IN_MILLISECONDS
        ? runningStreak + 1
        : 1
    bestStreak = Math.max(bestStreak, runningStreak)
    previousTime = currentTime
  })

  const yesterday = addDays(today, -1)
  const currentStart = activitySet.has(today)
    ? today
    : activitySet.has(yesterday)
      ? yesterday
      : null

  let currentStreak = 0

  if (currentStart) {
    let cursor = currentStart

    while (activitySet.has(cursor)) {
      currentStreak += 1
      cursor = addDays(cursor, -1)
    }
  }

  const recentDays = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6)
    const parsedDate = parseDateKey(date)

    return {
      date,
      dayLabel: WEEKDAY_LABELS[parsedDate.getUTCDay()],
      active: activitySet.has(date),
      isToday: date === today,
    }
  })

  return {
    currentStreak,
    bestStreak,
    recentDays,
  }
}
