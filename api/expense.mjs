/**
 * 接口 3/5：费用明细
 *
 *   POST /meike-finance/reimburse/expense-list
 *
 * 与 detail 的区别：只返回单据汇总字段 + expenseList，
 * 不带附件/收款账户/行程等大对象，体积小、速度快，适合批量核对金额。
 *
 * ─────────────────────────────────────────────────────────
 * 入参
 * ─────────────────────────────────────────────────────────
 *   formCode  string  必填。★ 用列表返回的 formCode，勿用 formDataCode
 *
 * ─────────────────────────────────────────────────────────
 * 响应 data 结构
 * ─────────────────────────────────────────────────────────
 * 单据汇总：
 *   formCode           string  单据号
 *   formDataCode       string  内部单据号
 *   formSubTypeName    string  小类，如「员工报销单」
 *   coverEmployeeName  string  承担人
 *   coverEmployeeId    string  承担人工号
 *   departmentName     string  部门
 *   legalEntityName    string  公司抬头
 *   formStatus         string  状态
 *   amount             object  原币金额
 *   baseAmount         object  本位币金额 ★ 常用
 *   approvedAmount     object  核定金额
 *   paymentAmount      object  支付金额
 *   detailTotalAmount  object  明细合计
 *   formDeductionAmount object 扣款金额
 *   submittedAt        number  提单时间（毫秒）
 *   createdAt          number  创建时间（毫秒）
 *
 * 费用列表：
 *   expenseList  array  结构同 detail 的 expenseList
 *                       注意金额字段是 consumeBaseAmount
 *
 * ─────────────────────────────────────────────────────────
 * expenseList 单条（同 detail）
 * ─────────────────────────────────────────────────────────
 *   expenseTypeName    string  费用类型
 *   consumeBaseAmount  object ★ 金额
 *   approvedAmount     object  核定金额
 *   invoiceList        array   发票
 *   attachments        array   附件
 *   allocationList     array   分摊
 *   consumeTime        object  消费时间
 *   comments           string  备注
 */

import { request } from './_shared.mjs'

export const PATH = '/meike-finance/reimburse/expense-list'

/**
 * 查询费用明细。
 *
 * @param {string} formCode 单据号
 * @param {object} [opts]   request 选项
 * @returns {Promise<{formCode:string, baseAmount:object, expenseList:Array}>}
 * @throws {MkError}
 */
export async function expenseList(formCode, opts = {}) {
  if (!formCode) throw new Error('formCode 必填（用 list 返回的 formCode，勿用 formDataCode）')
  return request(PATH, { formCode }, opts)
}

/**
 * 按费用类型汇总金额。
 * @returns {Object<string, number>} 如 { "差旅费-住宿": 4102.6, ... }
 */
export function sumByType(expenseData, amountFn) {
  const getAmt = amountFn || ((e) => e?.consumeBaseAmount?.amount ?? 0)
  const out = {}
  for (const e of expenseData?.expenseList || []) {
    const t = e.expenseTypeName || '(未分类)'
    out[t] = (out[t] || 0) + getAmt(e)
  }
  return out
}

export default { PATH, expenseList, sumByType }
