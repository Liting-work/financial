import { dayKey as toDayKey } from './time.js'

export const PENDING_STATUSES = ['APPROVING', 'AUDITING', 'SIGNING', 'SETTLEMENT']

export const STATUS_META = {
  APPROVING: { label: '审批中', color: '#D9A241', tone: 'amber' },
  COMPLETED: { label: '已完成', color: '#246451', tone: 'green' },
  SETTLEMENT: { label: '结算中', color: '#6B8F7C', tone: 'teal' },
  REJECTED: { label: '已驳回', color: '#C86A51', tone: 'coral' },
  DRAFT: { label: '草稿', color: '#B7B1A2', tone: 'neutral' },
  ABANDON: { label: '已废弃', color: '#8A8E86', tone: 'gray' },
  AUDITING: { label: '审核中', color: '#77917B', tone: 'teal' },
  SIGNING: { label: '签收中', color: '#8D9475', tone: 'teal' },
  DELETED: { label: '已删除', color: '#99968D', tone: 'gray' },
  SUBMIT_FAILED: { label: '提交失败', color: '#C86A51', tone: 'coral' },
}

export const STATUS_ORDER = [
  'APPROVING',
  'COMPLETED',
  'SETTLEMENT',
  'REJECTED',
  'DRAFT',
  'ABANDON',
  'AUDITING',
  'SIGNING',
  'DELETED',
  'SUBMIT_FAILED',
]

export const TYPE_META = {
  员工报销单: { key: 'employee', label: '员工报销', color: '#246451', bg: '#E9F1EC' },
  实战推动付款单: { key: 'actual', label: '实战付款', color: '#9A6B2C', bg: '#F8EFDF' },
  供应商付款单: { key: 'supplier', label: '供应商付款', color: '#516E80', bg: '#EAF0F3' },
}

export const TYPE_ORDER = ['员工报销单', '实战推动付款单', '供应商付款单']

export function getStatusMeta(status) {
  return STATUS_META[status] || {
    label: status || '未知',
    color: '#8A8E86',
    tone: 'gray',
  }
}

export function getTypeMeta(typeName) {
  return TYPE_META[typeName] || {
    key: 'other',
    label: typeName || '其他单据',
    color: '#6E736B',
    bg: '#EFEEE8',
  }
}

export function isPending(status) {
  return PENDING_STATUSES.includes(status)
}

export function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function eachDay(startMs, endMs) {
  if (!startMs || !endMs) return []
  const keys = []
  const start = new Date(`${toDayKey(startMs)}T12:00:00+08:00`)
  const end = new Date(`${toDayKey(endMs)}T12:00:00+08:00`)
  const cursor = new Date(start)
  let guard = 0
  while (cursor <= end && guard < 400) {
    keys.push(toDayKey(cursor.getTime()))
    cursor.setDate(cursor.getDate() + 1)
    guard++
  }
  if (!keys.length) keys.push(toDayKey(endMs))
  return keys
}

export function buildMetrics(forms, meta) {
  const count = forms.length
  const total = forms.reduce((sum, form) => sum + (form.baseAmount || 0), 0)
  const amounts = forms.map((form) => form.baseAmount || 0)
  const pendingForms = forms.filter((form) => isPending(form.formStatus))
  const pendingAmount = pendingForms.reduce((sum, form) => sum + (form.baseAmount || 0), 0)
  const completedForms = forms.filter((form) => form.formStatus === 'COMPLETED')
  const completedAmount = completedForms.reduce((sum, form) => sum + (form.baseAmount || 0), 0)
  const rejected = forms.filter((form) => form.formStatus === 'REJECTED').length
  const drafts = forms.filter((form) => form.formStatus === 'DRAFT').length
  const completionRate = count ? (completedForms.length / count) * 100 : 0
  const average = count ? total / count : 0
  const medianAmount = median(amounts)
  const highest = forms.reduce(
    (best, form) => ((form.baseAmount || 0) > (best?.baseAmount || 0) ? form : best),
    null,
  )

  const durations = completedForms
    .filter((form) => form.approvedAt && form.submittedAt)
    .map((form) => (form.approvedAt - form.submittedAt) / 86400000)
    .filter((days) => days >= 0)
  const averageApprovalDays = durations.length
    ? durations.reduce((sum, days) => sum + days, 0) / durations.length
    : 0

  const statusCounts = {}
  for (const form of forms) {
    statusCounts[form.formStatus] = (statusCounts[form.formStatus] || 0) + 1
  }
  const statusSegments = STATUS_ORDER.filter((status) => statusCounts[status]).map((status) => ({
    key: status,
    ...getStatusMeta(status),
    value: statusCounts[status],
    percent: count ? (statusCounts[status] / count) * 100 : 0,
  }))

  const days = eachDay(meta.periodStart, meta.periodEnd)
  const dayMap = new Map(
    days.map((key) => [key, { key, label: key.slice(5).replace('-', '.'), count: 0, amount: 0 }]),
  )
  for (const form of forms) {
    if (!form.createdAt) continue
    const key = toDayKey(form.createdAt)
    const row = dayMap.get(key)
    if (!row) continue
    row.count += 1
    row.amount += form.baseAmount || 0
  }
  const daily = [...dayMap.values()]

  const deptMap = new Map()
  for (const form of forms) {
    const dept = form.departmentName || '未分配部门'
    if (!deptMap.has(dept)) {
      deptMap.set(dept, { name: dept, count: 0, amount: 0, pending: 0, completed: 0 })
    }
    const entry = deptMap.get(dept)
    entry.count += 1
    entry.amount += form.baseAmount || 0
    if (isPending(form.formStatus)) entry.pending += 1
    if (form.formStatus === 'COMPLETED') entry.completed += 1
  }
  const departments = [...deptMap.values()].sort((a, b) => b.amount - a.amount)

  const peak = daily.reduce(
    (best, day) => (day.amount > (best?.amount || 0) ? day : best),
    daily[0],
  )
  const dailyAverage = daily.length ? total / daily.length : 0

  return {
    count,
    total,
    average,
    medianAmount,
    highest,
    pendingCount: pendingForms.length,
    pendingAmount,
    pendingRatio: count ? (pendingForms.length / count) * 100 : 0,
    pendingAmountRatio: total ? (pendingAmount / total) * 100 : 0,
    completedCount: completedForms.length,
    completedAmount,
    completionRate,
    rejected,
    drafts,
    averageApprovalDays,
    statusSegments,
    daily,
    peak,
    dailyAverage,
    departments,
  }
}

export function filterByType(forms, type) {
  if (!type || type === 'ALL') return forms
  return forms.filter((form) => form.formSubTypeName === type)
}

export function filterForms(forms, { status = 'ALL', department = 'ALL', query = '' } = {}) {
  const keyword = String(query || '').trim().toLowerCase()
  return forms.filter((form) => {
    if (status === 'PENDING' && !isPending(form.formStatus)) return false
    if (status !== 'ALL' && status !== 'PENDING' && form.formStatus !== status) return false
    if (department !== 'ALL' && form.departmentName !== department) return false
    if (!keyword) return true
    return [
      form.formCode,
      form.formName,
      form.coverEmployeeName,
      form.departmentName,
      form.legalEntityName,
      form.typeLabel,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword))
  })
}

export function sortForms(forms, sort) {
  const sorted = [...forms]
  switch (sort) {
    case 'amount-desc':
      return sorted.sort((a, b) => (b.baseAmount || 0) - (a.baseAmount || 0))
    case 'amount-asc':
      return sorted.sort((a, b) => (a.baseAmount || 0) - (b.baseAmount || 0))
    case 'oldest':
      return sorted.sort(
        (a, b) => (a.submittedAt || a.createdAt || 0) - (b.submittedAt || b.createdAt || 0),
      )
    case 'newest':
    default:
      return sorted.sort(
        (a, b) => (b.submittedAt || b.createdAt || 0) - (a.submittedAt || a.createdAt || 0),
      )
  }
}

export function statusCounts(forms) {
  const counts = { ALL: forms.length }
  for (const form of forms) {
    counts[form.formStatus] = (counts[form.formStatus] || 0) + 1
  }
  return counts
}

export const FLAG_TONES = {
  warn: { tone: 'amber', label: '需关注' },
  info: { tone: 'blue', label: '需确认' },
}

export function getExpenseIcon(category) {
  switch (category) {
    case 'stay':
      return 'bed'
    case 'flight':
      return 'plane'
    case 'train':
      return 'train'
    case 'car':
      return 'car'
    case 'meal':
      return 'meal'
    case 'material':
      return 'box'
    default:
      return 'receipt'
  }
}

export const TYPE_FILTERS = [
  { key: 'ALL', label: '全部单据', full: '全部' },
  ...TYPE_ORDER.map((type) => ({
    key: type,
    label: TYPE_META[type].label,
    full: type,
  })),
]
