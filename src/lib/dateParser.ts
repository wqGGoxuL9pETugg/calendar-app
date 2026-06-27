import { addDays, addMonths } from 'date-fns'

const kanjiDigits: Record<string, number> = {
  '〇': 0,
  '零': 0,
  '一': 1,
  '二': 2,
  '三': 3,
  '四': 4,
  '五': 5,
  '六': 6,
  '七': 7,
  '八': 8,
  '九': 9,
}

const kanjiNumberPattern = '〇零一二三四五六七八九十'

type ParseResult = {
  dates: Date[]
  normalized: string
  errors: string[]
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseKanjiNumber(value: string) {
  if (/^\d+$/.test(value)) {
    return Number(value)
  }

  let total = 0
  let current = 0

  for (const char of value) {
    if (char === '十') {
      total += (current || 1) * 10
      current = 0
      continue
    }

    const digit = kanjiDigits[char]
    if (digit === undefined) {
      return Number.NaN
    }

    current += digit
  }

  return total + current
}

function normalizeInput(input: string) {
  const asciiDigits = input.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  )

  const unifiedSeparators = asciiDigits
    .replace(/[／]/g, '/')
    .replace(/[ー－―‐〜～]/g, '-')
    .replace(/[､、，,･・]/g, '・')

  const monthDayPattern = new RegExp(
    `([0-9${kanjiNumberPattern}]+)\\s*月\\s*([0-9${kanjiNumberPattern}]+)\\s*日?`,
    'g',
  )

  const normalizedMonthDay = unifiedSeparators.replace(
    monthDayPattern,
    (_, monthText: string, dayText: string) => {
      const month = parseKanjiNumber(monthText)
      const day = parseKanjiNumber(dayText)
      return `${month}/${day}`
    },
  )

  return normalizedMonthDay
    .replace(/(\d+)\s*日/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function makeDate(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day)

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

function parseFullToken(token: string, baseYear: number) {
  const match = token.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (!match) {
    return null
  }

  return makeDate(baseYear, Number(match[1]), Number(match[2]))
}

function parseRange(segment: string, baseYear: number) {
  const shortRangeMatch = segment.match(/^(\d{1,2})\/(\d{1,2})-(\d{1,2})$/)
  if (shortRangeMatch) {
    const start = makeDate(
      baseYear,
      Number(shortRangeMatch[1]),
      Number(shortRangeMatch[2]),
    )
    if (!start) {
      throw new Error(`開始日を解釈できません: ${segment}`)
    }

    const endDay = Number(shortRangeMatch[3])
    const sameMonthEnd = makeDate(baseYear, start.getMonth() + 1, endDay)
    const end =
      sameMonthEnd && sameMonthEnd >= start
        ? sameMonthEnd
        : makeDate(
            start.getMonth() === 11 ? baseYear + 1 : baseYear,
            ((start.getMonth() + 1) % 12) + 1,
            endDay,
          )

    if (!end) {
      throw new Error(`終了日を解釈できません: ${segment}`)
    }

    const dates: Date[] = []
    for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
      dates.push(cursor)
    }
    return dates
  }

  const fullRangeMatch = segment.match(
    /^(\d{1,2})\/(\d{1,2})-(\d{1,2})\/(\d{1,2})$/,
  )
  if (!fullRangeMatch) {
    return null
  }

  const start = makeDate(
    baseYear,
    Number(fullRangeMatch[1]),
    Number(fullRangeMatch[2]),
  )
  if (!start) {
    throw new Error(`開始日を解釈できません: ${segment}`)
  }

  let end = makeDate(
    baseYear,
    Number(fullRangeMatch[3]),
    Number(fullRangeMatch[4]),
  )

  if (end && end < start) {
    end = makeDate(
      baseYear + 1,
      Number(fullRangeMatch[3]),
      Number(fullRangeMatch[4]),
    )
  }

  if (!end) {
    throw new Error(`終了日を解釈できません: ${segment}`)
  }

  const dates: Date[] = []
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    dates.push(cursor)
  }

  return dates
}

function parseMultiDay(segment: string, baseYear: number) {
  if (!segment.includes('・')) {
    return null
  }

  const tokens = segment.split('・').filter(Boolean)
  const first = parseFullToken(tokens[0], baseYear)
  if (!first) {
    throw new Error(`先頭の日付を解釈できません: ${segment}`)
  }

  const dates = [first]
  let cursor = first

  for (const token of tokens.slice(1)) {
    if (token.includes('/')) {
      const nextFull = parseFullToken(token, cursor.getFullYear())
      if (!nextFull) {
        throw new Error(`日付を解釈できません: ${segment}`)
      }

      let next = nextFull
      if (next < cursor) {
        next = addMonths(next, 12)
      }

      dates.push(next)
      cursor = next
      continue
    }

    const day = Number(token)
    if (!Number.isInteger(day)) {
      throw new Error(`日付を解釈できません: ${segment}`)
    }

    let next = makeDate(cursor.getFullYear(), cursor.getMonth() + 1, day)
    if (!next || next < cursor) {
      const nextMonth = addMonths(cursor, 1)
      next = makeDate(nextMonth.getFullYear(), nextMonth.getMonth() + 1, day)
    }

    if (!next) {
      throw new Error(`日付を解釈できません: ${segment}`)
    }

    dates.push(next)
    cursor = next
  }

  return dates
}

function parseSegment(segment: string, baseYear: number) {
  const range = parseRange(segment, baseYear)
  if (range) {
    return range
  }

  const multi = parseMultiDay(segment, baseYear)
  if (multi) {
    return multi
  }

  const single = parseFullToken(segment, baseYear)
  if (single) {
    return [single]
  }

  throw new Error(`日付形式を解釈できません: ${segment}`)
}

export function parseDateInput(input: string, baseYear: number): ParseResult {
  const normalized = normalizeInput(input)

  if (!normalized) {
    return {
      dates: [],
      normalized,
      errors: ['日付を入力してください。'],
    }
  }

  const unique = new Map<string, Date>()
  const errors: string[] = []

  for (const line of normalized.split(/\n+/)) {
    const segments = line
      .split(/\s+/)
      .map((segment) => segment.trim())
      .filter(Boolean)

    for (const segment of segments) {
      try {
        const parsedDates = parseSegment(segment, baseYear)
        for (const date of parsedDates) {
          unique.set(toLocalDateKey(date), date)
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : `日付を解釈できません: ${segment}`
        errors.push(message)
      }
    }
  }

  return {
    dates: [...unique.values()].sort((left, right) => left.getTime() - right.getTime()),
    normalized,
    errors,
  }
}
