export const CNY = '¥'

export function formatMoney(value, { decimals = 2, grouped = true } = {}) {
  const n = Number(value) || 0
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouped,
  })
}

export function splitMoney(value) {
  const safe = Math.abs(Number(value) || 0)
  const [integer, cents] = safe.toFixed(2).split('.')
  return { integer: Number(integer).toLocaleString('zh-CN'), cents }
}

export function compactMoney(value, withSymbol = false) {
  const n = Number(value) || 0
  const abs = Math.abs(n)
  let text
  if (abs >= 1e8) text = `${(n / 1e8).toFixed(abs >= 1e9 ? 0 : 1)}亿`
  else if (abs >= 1e4) text = `${(n / 1e4).toFixed(abs >= 1e6 ? 0 : 1)}万`
  else if (abs >= 1e3) text = `${(n / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}k`
  else text = `${Math.round(n)}`
  return `${withSymbol ? CNY : ''}${text}`
}

export function formatNumber(value) {
  return (Number(value) || 0).toLocaleString('zh-CN')
}

export function formatPercent(value, digits = 1) {
  const n = Number(value) || 0
  return `${n.toFixed(digits)}%`
}

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const monthDayFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: '2-digit',
  day: '2-digit',
})

const shortDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: '2-digit',
  day: '2-digit',
})

export function formatDateTime(ms) {
  if (!ms) return '—'
  return dateTimeFormatter.format(new Date(ms)).replace(/\//g, '-')
}

export function formatShortDateTime(ms) {
  if (!ms) return '—'
  const parts = dateTimeFormatter.formatToParts(new Date(ms))
  const get = (type) => parts.find((item) => item.type === type)?.value || ''
  return `${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

export function formatDate(ms) {
  if (!ms) return '—'
  const parts = monthDayFormatter.formatToParts(new Date(ms))
  const get = (type) => parts.find((item) => item.type === type)?.value || ''
  return `${get('month')}.${get('day')}`
}

export function formatDateDash(ms) {
  if (!ms) return '—'
  const parts = shortDateFormatter.formatToParts(new Date(ms))
  const get = (type) => parts.find((item) => item.type === type)?.value || ''
  return `${get('month')}-${get('day')}`
}

export function formatLongDate(ms) {
  if (!ms) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(ms))
}

export function dayKey(ms) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms))
}

export function formatRange(startMs, endMs) {
  if (!startMs || !endMs) return '—'
  const start = new Date(startMs)
  const end = new Date(endMs)
  const fmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
  })
  const startText = fmt.format(start).replace(/\//g, '.')
  const endText = fmt.format(end).replace(/\//g, '.')
  const year = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).format(end)
  return `${year} · ${startText} — ${endText}`
}

export function initials(name = '') {
  const trimmed = String(name).trim()
  if (!trimmed) return '?'
  return trimmed.slice(0, 1)
}

const AVATAR_PALETTE = [
  ['#E7F0E4', '#315E4B'],
  ['#F4E9D6', '#8D6430'],
  ['#E5ECEC', '#3E6667'],
  ['#F1E4DE', '#8E513E'],
  ['#E8E7F1', '#51527A'],
  ['#EDF0DB', '#5C6731'],
]

export function avatarStyle(name) {
  const code = Array.from(String(name || '')).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const [background, color] = AVATAR_PALETTE[code % AVATAR_PALETTE.length]
  return { background, color }
}

export function downloadCSV(filename, rows) {
  if (!rows.length) return
  const headers = [
    '单据编号',
    '报销人',
    '部门',
    '单据类型',
    '状态',
    '金额(CNY)',
    '项目/事由',
    '提交时间',
  ]
  const escape = (value) => {
    const text = value == null ? '' : String(value)
    return `"${text.replace(/"/g, '""')}"`
  }
  const lines = [
    headers.map(escape).join(','),
    ...rows.map((row) =>
      [
        row.formCode,
        row.coverEmployeeName,
        row.departmentName,
        row.typeLabel || row.formSubTypeName,
        row.statusText,
        Number(row.baseAmount || 0).toFixed(2),
        row.formName,
        formatDateTime(row.submittedAt || row.createdAt),
      ]
        .map(escape)
        .join(','),
    ),
  ]
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
