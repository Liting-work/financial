/**
 * 接口 2/5：报销单详情
 *
 *   POST /meike-finance/reimburse/detail
 *
 * ─────────────────────────────────────────────────────────
 * 入参
 * ─────────────────────────────────────────────────────────
 *   formCode  string  必填。★ 必须用列表返回的 formCode，
 *                     传 formDataCode 会返回「每刻返回异常: ACK」
 *
 * 以下开关默认 false，按需打开：
 *   enableAttachments        boolean  附件
 *   enablePayeeInfo          boolean  收款账户
 *   enableTravelRouteList    boolean  行程
 *   enableAssociatedFormList boolean  关联单据
 *   enableTravelPartnerInfo  boolean  参与人
 *   enableDatahubBillList    boolean  月结账单
 *
 * 费用列表 / 发票列表 / 费用分摊默认返回，不用开关。
 *
 * ─────────────────────────────────────────────────────────
 * 响应 data 主要字段（实测返回 80+ 字段，这里列常用的）
 * ─────────────────────────────────────────────────────────
 * 单据信息：
 *   formCode            string  单据号
 *   formDataCode        string  内部单据号（不能用于其他接口）
 *   reimburseName       string  单据名称
 *   formStatus          string  状态
 *   formSubTypeName     string  小类，如「员工报销单」
 *   baseAmount          object  金额 {amount, amountStr, currency}
 *   approvedAmount      object  审批金额
 *   paymentAmount       object  支付金额
 *   formDeductionAmount object  扣款金额
 *   invoiceCount        number  发票张数
 *   allocationCount     number  分摊条数
 *
 * 人员/组织：
 *   coverEmployeeName       string  承担人
 *   coverEmployeeId         string  承担人工号
 *   fillEmployeeName        string  填单人
 *   departmentName          string  部门名
 *   legalEntityName         string  公司抬头
 *   tradingPartnerName      string  往来单位
 *
 * 时间：
 *   createdAt / submittedAt / approvedAt / auditedAt / settledAt   number  毫秒时间戳
 *
 * 列表（重点）：
 *   expenseList      array   费用明细（默认返回）
 *   attachments      array   单据级附件（需 enableAttachments）
 *   loanDeductions   array   借款抵扣
 *   travelRouteList  array   行程（需 enableTravelRouteList）
 *   datahubBillList  array   月结账单（需 enableDatahubBillList）
 *   tagList          array   标签
 *   validationResult array   校验结果
 *
 * ─────────────────────────────────────────────────────────
 * expenseList 单条结构（★ 金额字段是 consumeBaseAmount）
 * ─────────────────────────────────────────────────────────
 * {
 *   expenseTypeName  string  费用类型，如「差旅费-住宿」
 *   viceExpenseTypeName string 末级费用类型
 *   consumeBaseAmount object ★ 消费本位币金额（金额看这个）
 *   approvedAmount   object  核定金额
 *   consumeAmount    object  消费金额（原币）
 *   expenseDeductionTaxAmount object 扣税金额
 *   consumeTime      object  {startTime, endTime, startTimeZoneId} 毫秒
 *   consumeLocation  object  消费地点（实测常为 null）
 *   invoiceList      array   发票明细
 *   invoiceCount     number  发票张数
 *   attachments      array   附件
 *   allocationList   array   费用分摊
 *   comments         string  备注
 *   status           string  PROCESSING 等
 * }
 *
 * 发票 invoiceList 单条常见字段：
 *   invoiceTypeName   string  票种，如「电子发票（铁路电子客票）」
 *   code              string  发票标识
 *   invoiceTypeBizCode string 票种编码
 *   ...
 */

import { request } from './_shared.mjs'

export const PATH = '/meike-finance/reimburse/detail'

/** 开关字段名 */
export const SWITCHES = {
  attachments: 'enableAttachments',
  payee: 'enablePayeeInfo',
  travel: 'enableTravelRouteList',
  associated: 'enableAssociatedFormList',
  partner: 'enableTravelPartnerInfo',
  datahub: 'enableDatahubBillList',
}

/**
 * 查询单据详情。
 *
 * @param {string} formCode 单据号（列表返回的 formCode）
 * @param {object} [flags]  开关，见 SWITCHES。如 {attachments:true, travel:true}
 * @param {object} [opts]   request 选项
 * @returns {Promise<object>} 详情对象
 * @throws {MkError} formCode 缺失 → 「formCode(单据号)必填」
 *                   单据不存在或传错编码 → 「每刻返回异常: ACK」
 */
export async function detail(formCode, flags = {}, opts = {}) {
  if (!formCode) throw new Error('formCode 必填（用 list 返回的 formCode，勿用 formDataCode）')
  const payload = { formCode }
  for (const [short, full] of Object.entries(SWITCHES)) {
    if (flags[short]) payload[full] = true
  }
  return request(PATH, payload, opts)
}

/**
 * 取单据内所有费用行。
 * @returns {Array}
 */
export function expenses(d) {
  return d?.expenseList || []
}

/**
 * 汇总发票张数（按费用行 invoiceList 累加，比 invoiceCount 更准）
 */
export function countInvoices(d) {
  return (d?.expenseList || []).reduce(
    (s, e) => s + (e.invoiceList || []).length,
    0,
  )
}

export default { PATH, SWITCHES, detail, expenses, countInvoices }
