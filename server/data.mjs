import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { list } from '../api/list.mjs'
import { detail as fetchDetail } from '../api/detail.mjs'
import { processFlow } from '../api/process-flow.mjs'
import { processLog } from '../api/process-log.mjs'
import { expenseAmount } from '../api/_shared.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const LIST_PAGES = Math.max(1, Math.min(Number(process.env.LIST_PAGES) || 5, 10))

export const STATUS_TEXT = {
  APPROVING: '审批中',
  AUDITING: '审核中',
  SIGNING: '签收中',
  SETTLEMENT: '结算中',
  COMPLETED: '已完成',
  DELETED: '已删除',
  ABANDON: '已废弃',
  REJECTED: '已驳回',
  SUBMIT_FAILED: '提交失败',
  DRAFT: '草稿',
}

const TYPE_ALIASES = {
  员工报销单: '员工报销',
  实战推动付款单: '实战付款',
  供应商付款单: '供应商付款',
}

// 仅保留最近一次实时列表，用于详情请求定位 formType；不写磁盘，不作为看板展示缓存。
let latestLiveForms = null

const money = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const amountOf = (obj) => money(obj?.amount)

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function normalizeForm(raw) {
  const typeName = raw.formSubTypeNameZh || raw.formSubTypeName || '其他单据'
  return {
    formCode: raw.formCode,
    formType: raw.formType || 'REIMBURSE',
    formName: raw.formName || raw.reimburseName || '未命名单据',
    formStatus: raw.formStatus || 'UNKNOWN',
    statusText: raw.statusText || STATUS_TEXT[raw.formStatus] || raw.formStatus || '未知',
    formSubTypeName: typeName,
    typeLabel: TYPE_ALIASES[typeName] || typeName,
    baseAmount: amountOf(raw.baseAmount),
    approvedAmount: amountOf(raw.approvedAmount),
    paymentAmount: amountOf(raw.paymentAmount),
    coverEmployeeName: raw.coverEmployeeName || '未知',
    coverEmployeeId: raw.coverEmployeeId || '',
    fillEmployeeName: raw.fillEmployeeName || '',
    departmentName: raw.departmentName || '未分配部门',
    legalEntityName: raw.legalEntityName || '',
    createdAt: raw.createdAt || null,
    submittedAt: raw.submittedAt || null,
    approvedAt: raw.approvedAt || null,
    settledAt: raw.settledAt || null,
    updatedAt: raw.updatedAt || null,
  }
}

function expenseCategory(type) {
  if (/住宿|房租|租房/.test(type)) return 'stay'
  if (/机票|飞机|航班/.test(type)) return 'flight'
  if (/火车|高铁|动车|客票/.test(type)) return 'train'
  if (/交通|打车|用车|网约车|的士|滴滴|顺风车/.test(type)) return 'car'
  if (/餐|宴请|业务交流/.test(type)) return 'meal'
  if (/茶歇|奖品|物料|办公|印刷|快递|邮寄/.test(type)) return 'material'
  return 'other'
}

function normalizeExpense(raw) {
  const amount = round2(expenseAmount(raw))
  const approved = round2(amountOf(raw.approvedBaseAmount ?? raw.approvedAmount))
  const type = raw.expenseTypeName || raw.viceExpenseTypeName || '其他费用'
  const invoiceList = Array.isArray(raw.invoiceList) ? raw.invoiceList : []
  const invoiceTypes = [
    ...new Set(invoiceList.map((invoice) => invoice.invoiceTypeName).filter(Boolean)),
  ]
  const location = raw.consumeLocation || {}
  const locationText =
    location.location ||
    location.destinationText ||
    location.destination ||
    location.departureText ||
    ''

  return {
    type,
    viceType: raw.viceExpenseTypeName || type,
    category: expenseCategory(`${type} ${raw.viceExpenseTypeName || ''}`),
    amount,
    approved,
    startTime: raw.consumeTime?.startTime || null,
    endTime: raw.consumeTime?.endTime || null,
    location: typeof locationText === 'string' ? locationText : '',
    comments: raw.comments || '',
    invoiceCount: invoiceList.length || Number(raw.invoiceCount) || 0,
    invoiceTypes,
    attachmentCount: Array.isArray(raw.attachments) ? raw.attachments.length : 0,
  }
}

export function normalizeLogs(logRaw) {
  const validStates = new Set(['history', 'pending', 'predict'])
  return (logRaw?.openApiFormProcessLogs || []).map((log) => ({
    // history 已处理 / pending 当前待处理 / predict 后续预演节点。
    // 完整流程接口按真实流程顺序返回，不要再按 optTime 排序，
    // 否则 optTime 为 null 的 pending、predict 节点会被排到最前面。
    state: validStates.has(log.state) ? log.state : 'history',
    taskName: log.taskName || '流程节点',
    taskCategory: log.taskCategory || '',
    nodeType: log.processNodeSubType || '',
    operationTypeName: log.operationTypeName || '',
    operation: log.operationText || log.operationTypeName || '',
    operators: Array.isArray(log.operatorName)
      ? log.operatorName
      : log.operatorName
        ? [log.operatorName]
        : [],
    optTime: log.optTime || null,
    reason: log.optReason || '',
    nextOperators: Array.isArray(log.nextOperatorName)
      ? log.nextOperatorName
      : log.nextOperatorName
        ? [log.nextOperatorName]
        : [],
    finalAuditNode: Boolean(log.finalAuditNode),
  }))
}

export function buildFlags(form, expenses, invoiceTotal) {
  const flags = []
  const baseAmount = round2(form.baseAmount || 0)
  const expenseTotal = round2(expenses.reduce((sum, item) => sum + item.amount, 0))

  if (expenses.length > 0 && Math.abs(baseAmount - expenseTotal) > 0.01) {
    flags.push({
      level: 'warn',
      title: '单据金额与费用合计不一致',
      detail: `单据金额 ¥${baseAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}，费用行合计 ¥${expenseTotal.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}，差额 ¥${Math.abs(baseAmount - expenseTotal).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}。`,
      rule: '金额一致性',
    })
  }

  const stayExpenses = expenses.filter((item) => item.category === 'stay' && item.amount > 0)
  if (stayExpenses.length > 0) {
    const stayTotal = round2(stayExpenses.reduce((sum, item) => sum + item.amount, 0))
    flags.push({
      level: 'info',
      title: '住宿费用需补充天数与城市',
      detail: `住宿共 ${stayExpenses.length} 笔、合计 ¥${stayTotal.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}。接口未返回住宿天数与实际城市，请按老师 / 员工对应日限复核，不宜直接判定超标。`,
      rule: '住宿标准',
    })
  }

  const transportOver = expenses.filter(
    (item) => item.category === 'car' && item.amount > 200,
  )
  if (transportOver.length > 0) {
    flags.push({
      level: 'warn',
      title: '市内交通可能超过单笔限额',
      detail: `${transportOver.map((item) => `${item.type} ¥${item.amount.toLocaleString('zh-CN')}`).join('；')}，超过项目用车 ¥200 / 单标准，请确认是否已前置报备。`,
      rule: '小交通',
    })
  }

  const mealOver = expenses.filter(
    (item) => item.category === 'meal' && item.amount > 100 && !/业务交流|宴请/.test(item.type),
  )
  if (mealOver.length > 0) {
    flags.push({
      level: 'info',
      title: '餐费金额需要人工确认适用标准',
      detail: `有 ${mealOver.length} 笔餐费超过 ¥100，需确认用餐类型与老师 / 员工适用标准。员工餐费原则上不报销。`,
      rule: '餐费标准',
    })
  }

  const teaOver = expenses.filter((item) => /茶歇/.test(item.type) && item.amount > 200)
  if (teaOver.length > 0) {
    flags.push({
      level: 'warn',
      title: '茶歇费用高于常见日限额',
      detail: `${teaOver.map((item) => `${item.type} ¥${item.amount.toLocaleString('zh-CN')}`).join('；')}，常规课程 ¥100 / 天、经理或标杆班 ¥200 / 天，请结合人数与天数核验。`,
      rule: '茶歇标准',
    })
  }

  const prizeOver = expenses.filter((item) => /奖品/.test(item.type) && item.amount > 100)
  if (prizeOver.length > 0) {
    flags.push({
      level: 'info',
      title: '奖品费用超过单期限额',
      detail: `奖品合计超过 ¥100 / 期标准，请确认期数及是否已完成前置报备。`,
      rule: '奖品标准',
    })
  }

  if (expenseTotal > 0 && invoiceTotal === 0) {
    flags.push({
      level: 'info',
      title: '未读取到发票记录',
      detail: '该单费用行未返回发票，请核对原票与附件是否已完整上传。',
      rule: '发票规范',
    })
  }

  return flags
}

export function normalizeDetail(raw, form, logRaw) {
  const expenses = (raw.expenseList || []).map(normalizeExpense)
  const processLogs = normalizeLogs(logRaw)
  const invoiceTotal = expenses.reduce((sum, item) => sum + item.invoiceCount, 0)
  const expenseTotal = round2(expenses.reduce((sum, item) => sum + item.amount, 0))
  const custom = raw.customObject || {}
  const payee = raw.payeeAccount || {}
  const accountNo = String(payee.bankAcctNumber || '')
  const summary = form || normalizeForm(raw)

  const normalized = {
    ...summary,
    formName: raw.reimburseName || summary.formName,
    baseAmount: round2(amountOf(raw.baseAmount) || summary.baseAmount || 0),
    approvedAmount: round2(amountOf(raw.approvedAmount) || summary.approvedAmount || 0),
    paymentAmount: round2(amountOf(raw.paymentAmount) || summary.paymentAmount || 0),
    submittedAt: raw.submittedAt || summary.submittedAt || null,
    approvedAt: raw.approvedAt || summary.approvedAt || null,
    settledAt: raw.settledAt || summary.settledAt || null,
    coverEmployeeName: raw.coverEmployeeName || summary.coverEmployeeName,
    fillEmployeeName: raw.fillEmployeeName || summary.fillEmployeeName,
    departmentName: raw.departmentName || summary.departmentName,
    legalEntityName: raw.legalEntityName || summary.legalEntityName,
    invoiceTotal,
    expenseTotal,
    expenseCount: expenses.length,
    expenses,
    processLogs,
    project: {
      name: custom.projectName || custom.CF44?.text || '',
      customer: custom.projectCustomer || '',
      courseName: custom.courseName || '',
      courseStart: custom.courseDateStart || '',
      courseEnd: custom.courseDateEnd || '',
      projectType: custom.projectType || '',
      owner: custom.projectOwner || custom.projectManage || '',
      members: custom.projectMembers || '',
      orderNo: custom.orderNum || '',
    },
    payee: {
      name: payee.bankAcctName || summary.coverEmployeeName || '',
      bankName: payee.bankName || '',
      accountMasked: accountNo.length > 4 ? `•••• ${accountNo.slice(-4)}` : '',
    },
    flags: [],
    fetchedAt: new Date().toISOString(),
  }

  normalized.flags = buildFlags(normalized, expenses, invoiceTotal)
  return normalized
}

function buildMeta(forms, pages) {
  const times = forms.map((item) => item.createdAt).filter(Boolean)
  return {
    source: '每刻开放平台 · 报销只读接口',
    fetchedAt: new Date().toISOString(),
    periodStart: times.length ? Math.min(...times) : null,
    periodEnd: times.length ? Math.max(...times) : null,
    count: forms.length,
    pages,
    currency: 'CNY',
    timezone: 'Asia/Shanghai',
  }
}

export async function fetchListSnapshot(pages = LIST_PAGES) {
  const rows = []
  let actualPages = 0

  // 列表接口体积小，先取第一页确认还有下一页，再把剩余页按 4 个一批并发拉取。
  // 这样首屏不必等 5 次串行请求，同时仍低于每刻 10 次/秒的共享限流。
  const first = await list({ pageNo: 1, pageSize: 100 })
  rows.push(...(first.list || []))
  actualPages = 1

  if (first.hasNextPage && pages > 1) {
    const remaining = Array.from({ length: pages - 1 }, (_, index) => index + 2)
    for (let offset = 0; offset < remaining.length; offset += 4) {
      const chunk = remaining.slice(offset, offset + 4)
      const batch = await Promise.all(
        chunk.map((pageNo) => list({ pageNo, pageSize: 100 })),
      )
      for (const data of batch) {
        rows.push(...(data.list || []))
        actualPages++
      }
    }
  }

  const deduped = [...new Map(rows.map((item) => [item.formCode, item])).values()]
  const forms = deduped
    .map(normalizeForm)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  return { forms, meta: buildMeta(forms, actualPages) }
}

/**
 * 首页/看板数据：每次请求都实时读取，不使用磁盘快照。
 * 数据只在当前进程内短暂用于单据定位，不落盘。
 */
export async function getFreshForms() {
  const live = await fetchListSnapshot(LIST_PAGES)
  latestLiveForms = live
  return {
    meta: live.meta,
    forms: live.forms,
  }
}

export async function fetchDetailBundle(formCode, form) {
  const [detailResult, logResult] = await Promise.allSettled([
    fetchDetail(formCode, { payee: true }),
    processFlow(formCode, { formType: form?.formType || 'REIMBURSE' }),
  ])

  if (detailResult.status !== 'fulfilled') throw detailResult.reason

  let logs = logResult.status === 'fulfilled' ? logResult.value : null
  if (!logs) {
    // 完整流程接口异常时退回只含已处理节点的旧接口，保证详情仍可用。
    try {
      logs = await processLog(formCode)
    } catch {
      logs = null
    }
  }
  return normalizeDetail(detailResult.value, form, logs)
}

export async function getFormDetail(formCode) {
  let form = latestLiveForms?.forms.find((item) => item.formCode === formCode)
  if (!form) {
    // 直接访问详情 URL / 服务刚启动时，先实时取一次列表用于定位 formType。
    const live = await fetchListSnapshot(LIST_PAGES)
    latestLiveForms = live
    form = live.forms.find((item) => item.formCode === formCode)
  }

  if (!form) {
    const error = new Error('未找到该单据')
    error.statusCode = 404
    throw error
  }

  // 不做本地缓存：每次打开详情都实时读取详情与完整审批流程。
  return fetchDetailBundle(formCode, form)
}

export const paths = {
  root: ROOT,
}
