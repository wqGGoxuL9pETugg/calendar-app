import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { ja } from 'date-fns/locale'
import './App.css'
import { parseDateInput } from './lib/dateParser'
import { useSchedules } from './lib/scheduleStore'
import type { ScheduleItem } from './types'

const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土']
type CalendarTab = 'calendar' | 'free-days'

function formatDateKey(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

function formatPreviewDate(date: Date) {
  return format(date, 'yyyy/M/d (E)', { locale: ja })
}

function buildMonthDays(viewDate: Date) {
  const monthStart = startOfMonth(viewDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 0 })
  return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
}

function buildMonthRange(viewDate: Date) {
  return eachDayOfInterval({
    start: startOfMonth(viewDate),
    end: endOfMonth(viewDate),
  })
}

function isValidYearInput(value: string) {
  return /^\d{4}$/.test(value.trim())
}

function segmentText(text: string) {
  const trimmed = text.trim()
  if (!trimmed) {
    return []
  }

  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' })
    return Array.from(segmenter.segment(trimmed), (part) => part.segment)
  }

  return Array.from(trimmed)
}

function abbreviateText(text: string, maxSegments: number) {
  const segments = segmentText(text)
  if (segments.length <= maxSegments) {
    return text.trim()
  }

  return `${segments.slice(0, maxSegments).join('')}…`
}

function hasMemo(notes: string) {
  return notes.trim().length > 0
}

function alignDateToMonth(date: Date, year: number, monthIndex: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  return new Date(year, monthIndex, Math.min(date.getDate(), lastDay))
}

function App() {
  const today = new Date()
  const [viewDate, setViewDate] = useState(() => startOfMonth(today))
  const [selectedDateKey, setSelectedDateKey] = useState(() => formatDateKey(today))
  const [calendarTab, setCalendarTab] = useState<CalendarTab>('calendar')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [yearInput, setYearInput] = useState(() => format(today, 'yyyy'))
  const [dateInput, setDateInput] = useState(() => format(today, 'M/d'))
  const [submitError, setSubmitError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const {
    schedules,
    loading,
    error: syncError,
    syncMode,
    createSchedules,
    updateSchedule,
    deleteSchedule,
  } = useSchedules()

  const yearError = !yearInput.trim()
    ? dateInput.trim()
      ? '西暦年を先に入力してください。'
      : ''
    : !isValidYearInput(yearInput)
      ? '西暦年は4桁で入力してください。'
      : ''

  const parsedPreview =
    dateInput.trim() && isValidYearInput(yearInput)
      ? parseDateInput(dateInput, Number(yearInput.trim()))
      : { dates: [], normalized: '', errors: [] }

  const dayMap = new Map<string, ScheduleItem[]>()
  for (const schedule of schedules) {
    const items = dayMap.get(schedule.dateKey) ?? []
    items.push(schedule)
    dayMap.set(schedule.dateKey, items)
  }

  const selectedDate = parseISO(selectedDateKey)
  const selectedSchedules = dayMap.get(selectedDateKey) ?? []
  const calendarDays = buildMonthDays(viewDate)
  const monthDays = buildMonthRange(viewDate)
  const emptyMonthDays = monthDays.filter((date) => {
    const dateKey = formatDateKey(date)
    return (dayMap.get(dateKey) ?? []).length === 0
  })
  const editingItem = editingId
    ? schedules.find((schedule) => schedule.id === editingId) ?? null
    : null

  useEffect(() => {
    if (!editingItem) {
      return
    }

    const editingDate = parseISO(editingItem.dateKey)
    setSelectedDateKey(editingItem.dateKey)
    setViewDate(startOfMonth(editingDate))
    setYearInput(format(editingDate, 'yyyy'))
  }, [editingItem])

  useEffect(() => {
    if (!isValidYearInput(yearInput)) {
      return
    }

    const nextYear = Number(yearInput.trim())
    if (viewDate.getFullYear() === nextYear) {
      return
    }

    const nextViewDate = startOfMonth(new Date(nextYear, viewDate.getMonth(), 1))
    const currentSelectedDate = parseISO(selectedDateKey)
    const nextSelectedDate = alignDateToMonth(
      currentSelectedDate,
      nextYear,
      currentSelectedDate.getMonth(),
    )

    setViewDate(nextViewDate)
    setSelectedDateKey(formatDateKey(nextSelectedDate))
  }, [selectedDateKey, viewDate, yearInput])

  function resetForm(nextDate = viewDate) {
    setEditingId(null)
    setTitle('')
    setNotes('')
    setYearInput(format(nextDate, 'yyyy'))
    setDateInput(format(nextDate, 'M/d'))
    setSubmitError('')
  }

  function moveCalendar(nextDate: Date) {
    const nextMonth = startOfMonth(nextDate)
    const nextSelectedDate = alignDateToMonth(
      selectedDate,
      nextMonth.getFullYear(),
      nextMonth.getMonth(),
    )

    setViewDate(nextMonth)
    setYearInput(format(nextMonth, 'yyyy'))
    setSelectedDateKey(formatDateKey(nextSelectedDate))

    if (!editingId) {
      setDateInput(format(nextSelectedDate, 'M/d'))
    }
  }

  function handleDaySelect(date: Date) {
    setSelectedDateKey(formatDateKey(date))
    setYearInput(format(date, 'yyyy'))
    setDateInput(format(date, 'M/d'))
    setEditingId(null)
    setSubmitError('')
  }

  function handleFreeDaySelect(date: Date) {
    handleDaySelect(date)
    setCalendarTab('calendar')
  }

  function handleEdit(schedule: ScheduleItem) {
    const date = parseISO(schedule.dateKey)
    setEditingId(schedule.id)
    setTitle(schedule.title)
    setNotes(schedule.notes)
    setYearInput(format(date, 'yyyy'))
    setDateInput(format(date, 'M/d'))
    setSelectedDateKey(schedule.dateKey)
    setViewDate(startOfMonth(date))
    setSubmitError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!title.trim()) {
      setSubmitError('予定名を入力してください。')
      return
    }

    if (!isValidYearInput(yearInput)) {
      setSubmitError('西暦年は4桁で入力してください。')
      return
    }

    if (parsedPreview.errors.length > 0 || parsedPreview.dates.length === 0) {
      setSubmitError(parsedPreview.errors[0] ?? '日付を正しく入力してください。')
      return
    }

    if (editingId && parsedPreview.dates.length !== 1) {
      setSubmitError('編集では1件の日付だけ指定できます。複数日は新規作成で登録してください。')
      return
    }

    setIsSaving(true)
    setSubmitError('')

    const formattedSourceInput = `${yearInput.trim()}年 / ${dateInput.trim()}`

    try {
      if (editingId) {
        await updateSchedule(editingId, {
          title: title.trim(),
          notes: notes.trim(),
          dateKey: formatDateKey(parsedPreview.dates[0]),
          sourceInput: formattedSourceInput,
        })
        moveCalendar(parsedPreview.dates[0])
        resetForm(parsedPreview.dates[0])
        return
      }

      await createSchedules(
        parsedPreview.dates.map((date) => ({
          title: title.trim(),
          notes: notes.trim(),
          dateKey: formatDateKey(date),
          sourceInput: formattedSourceInput,
        })),
      )

      moveCalendar(parsedPreview.dates[0])
      resetForm(parsedPreview.dates[0])
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '保存中にエラーが発生しました。'
      setSubmitError(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setIsSaving(true)
    setSubmitError('')

    try {
      await deleteSchedule(id)
      if (editingId === id) {
        resetForm(viewDate)
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '削除中にエラーが発生しました。'
      setSubmitError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="hero-panel">
        <div className="hero-copy-block">
          <p className="brand-mark">TORIMADAY</p>
          <h1>西暦年を先に決めて、静かに整えるカレンダー。</h1>
          <p className="hero-copy">
            先に西暦年を指定し、その年の月日だけをまとめて入力します。シフトや定例予定を、
            PCとスマホの両方で扱いやすい落ち着いた画面にまとめました。
          </p>
          <div className="hero-tags">
            <span>Year First</span>
            <span>Firebase Sync</span>
            <span>Desktop / Mobile</span>
          </div>
        </div>

        <div className="sync-card">
          <p className="section-kicker">Cloud Sync</p>
          <h2>{syncMode === 'firebase' ? '同期設定済み' : '同期はまだ未設定'}</h2>
          <p>
            {syncMode === 'firebase'
              ? 'Firestore と接続中です。PC とスマホで同じ予定を共有できます。'
              : 'Firebase を設定すると、PC とスマホで同じ予定を同期できます。'}
          </p>
          <div className="sync-steps">
            <span>.env を作成</span>
            <span>Firestore を有効化</span>
            <span>サーバー再起動</span>
          </div>
          <span className={`sync-badge ${syncMode}`}>
            {syncMode === 'firebase' ? 'Cloud Sync On' : 'Local Mode'}
          </span>
          {syncError ? <p className="sync-error">{syncError}</p> : null}
        </div>
      </header>

      <main className="workspace">
        <section className="composer card">
          <div className="section-heading">
            <div>
              <p className="section-kicker">{editingId ? 'Edit' : 'Create'}</p>
              <h2>{editingId ? '予定を編集' : '予定を登録'}</h2>
            </div>
            {editingId ? (
              <button
                className="ghost-button"
                type="button"
                onClick={() => resetForm(viewDate)}
              >
                新規登録に戻す
              </button>
            ) : null}
          </div>

          <form className="event-form" onSubmit={handleSubmit}>
            <div className="year-row">
              <label className="year-field">
                <span className="field-step">Step 1</span>
                西暦年
                <input
                  type="number"
                  inputMode="numeric"
                  min="1900"
                  max="2100"
                  value={yearInput}
                  onChange={(event) => setYearInput(event.target.value)}
                  placeholder="2026"
                />
              </label>

              <div className="year-note">
                <p className="year-note-title">入力ルール</p>
                <p>先に西暦年を決めてから、下に月日だけを入力します。</p>
              </div>
            </div>

            <label>
              <span className="field-step">Step 2</span>
              予定名
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="例: 早番 / 会議 / 通院"
              />
            </label>

            <label>
              <span className="field-step">Step 3</span>
              日付入力
              <textarea
                rows={4}
                value={dateInput}
                onChange={(event) => setDateInput(event.target.value)}
                placeholder={'例:\n3/21-25\n4/25・26'}
              />
            </label>

            <div className="input-hints">
              <span>2026年 + 3/21</span>
              <span>2026年 + 3月21日</span>
              <span>2026年 + 3/21-25</span>
              <span>2026年 + 4/25・26</span>
              <span>複数行対応</span>
            </div>

            <label>
              メモ
              <textarea
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="場所、時間、担当、補足など"
              />
            </label>

            {parsedPreview.dates.length > 0 ? (
              <div className="preview-box">
                <p className="preview-title">解釈結果</p>
                <div className="preview-chips">
                  {parsedPreview.dates.map((date) => (
                    <span key={formatDateKey(date)}>{formatPreviewDate(date)}</span>
                  ))}
                </div>
              </div>
            ) : null}

            {yearError ? <p className="form-error">{yearError}</p> : null}
            {parsedPreview.errors.length > 0 ? (
              <p className="form-error">{parsedPreview.errors[0]}</p>
            ) : null}
            {submitError ? <p className="form-error">{submitError}</p> : null}

            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={isSaving}>
                {editingId ? '更新する' : '登録する'}
              </button>
            </div>
          </form>
        </section>

        <section className="calendar-panel card">
          <div className="calendar-toolbar">
            <div>
              <p className="section-kicker">Calendar</p>
              <h2>{format(viewDate, 'yyyy年 M月', { locale: ja })}</h2>
            </div>
            <div className="month-actions">
              <button type="button" onClick={() => moveCalendar(subMonths(viewDate, 1))}>
                前月
              </button>
              <button type="button" onClick={() => moveCalendar(today)}>
                今月
              </button>
              <button type="button" onClick={() => moveCalendar(addMonths(viewDate, 1))}>
                次月
              </button>
            </div>
          </div>

          <div className="calendar-tabs" role="tablist" aria-label="月表示の切り替え">
            <button
              type="button"
              role="tab"
              aria-selected={calendarTab === 'calendar'}
              className={calendarTab === 'calendar' ? 'calendar-tab is-active' : 'calendar-tab'}
              onClick={() => setCalendarTab('calendar')}
            >
              カレンダー
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={calendarTab === 'free-days'}
              className={calendarTab === 'free-days' ? 'calendar-tab is-active' : 'calendar-tab'}
              onClick={() => setCalendarTab('free-days')}
            >
              予定のない日
              <span className="tab-count">{emptyMonthDays.length}</span>
            </button>
          </div>

          {calendarTab === 'calendar' ? (
            <>
              <div className="weekday-row">
                {weekdayLabels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>

              <div className="calendar-grid">
                {calendarDays.map((date) => {
                  const dateKey = formatDateKey(date)
                  const items = dayMap.get(dateKey) ?? []
                  const isSelected = dateKey === selectedDateKey

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      className={[
                        'calendar-day',
                        isSameMonth(date, viewDate) ? '' : 'is-muted',
                        isSameDay(date, today) ? 'is-today' : '',
                        isSelected ? 'is-selected' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => handleDaySelect(date)}
                    >
                      <span className="day-number">{format(date, 'd')}</span>
                      <div className="day-events">
                        {items.slice(0, 3).map((schedule) => {
                          const titlePreview = abbreviateText(
                            schedule.title,
                            hasMemo(schedule.notes) ? 2 : 3,
                          )

                          return (
                            <span
                              key={schedule.id}
                              className="event-pill"
                              title={schedule.title}
                              aria-label={schedule.title}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleEdit(schedule)
                              }}
                            >
                              <span className="event-pill-content">
                                <span className="event-pill-label">{titlePreview}</span>
                                {hasMemo(schedule.notes) ? (
                                  <span className="memo-badge">memo</span>
                                ) : null}
                              </span>
                            </span>
                          )
                        })}
                        {items.length > 3 ? (
                          <span className="more-pill">+{items.length - 3}</span>
                        ) : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="free-day-panel">
              {loading ? <p className="empty-state">読み込み中です...</p> : null}

              {!loading && emptyMonthDays.length === 0 ? (
                <p className="empty-state">この月には予定のない日がありません。</p>
              ) : null}

              {!loading && emptyMonthDays.length > 0 ? (
                <div className="free-day-list">
                  {emptyMonthDays.map((date) => {
                    const dateKey = formatDateKey(date)
                    const isSelected = dateKey === selectedDateKey

                    return (
                      <button
                        key={dateKey}
                        type="button"
                        className={isSelected ? 'free-day-item is-selected' : 'free-day-item'}
                        onClick={() => handleFreeDaySelect(date)}
                      >
                        <span className="free-day-date">
                          <strong>{format(date, 'M/d')}</strong>
                          <span>{format(date, 'E', { locale: ja })}</span>
                        </span>
                        <span className="free-day-tag">予定なし</span>
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section className="agenda card">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Agenda</p>
              <h2>{format(selectedDate, 'yyyy年 M月d日 (E)', { locale: ja })}</h2>
            </div>
          </div>

          {loading ? <p className="empty-state">読み込み中です...</p> : null}

          {!loading && selectedSchedules.length === 0 ? (
            <p className="empty-state">
              この日の予定はまだありません。日付をクリックすると、その日を基準にすぐ登録できます。
            </p>
          ) : null}

          <div className="agenda-list">
            {selectedSchedules.map((schedule) => (
              <article key={schedule.id} className="agenda-item">
                <div>
                  <h3>
                    <span>{schedule.title}</span>
                    {hasMemo(schedule.notes) ? (
                      <span className="memo-badge">memo</span>
                    ) : null}
                  </h3>
                  <p className="agenda-date">
                    {format(parseISO(schedule.dateKey), 'yyyy年 M月d日 (E)', {
                      locale: ja,
                    })}
                  </p>
                  <p className="agenda-source">入力形式: {schedule.sourceInput}</p>
                  {schedule.notes ? <p className="agenda-notes">{schedule.notes}</p> : null}
                </div>
                <div className="agenda-actions">
                  <button type="button" onClick={() => handleEdit(schedule)}>
                    編集
                  </button>
                  <button type="button" onClick={() => handleDelete(schedule.id)}>
                    削除
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
