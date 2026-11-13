/**
 * 接口 1/5：报销单列表
 *
 *   POST /meike-finance/reimburse/list
 *
 * 对应每刻页面「报销列表」。不传任何时间参数时默认查创建时间近一年。
 * 结果按创建时间倒序。
 *
 * ─────────────────────────────────────────────────────────
 * 入参（全部可选）
 * ─────────────────────────────────────────────────────────
 * 时间区间（均为 13 位毫秒时间戳，起含止不含，跨度不能超过 366 天）：
 *   createdAtStart / createdAtEnd   Long    创建时间
 *   submittedAtStart / submittedAtEnd Long  提单时间
 *   approvedAtStart / approvedAtEnd  Long   审批通过时间
 *   updatedAtStart / updatedAtEnd    Long   修改时间
 *   settledAtStart / settledAtEnd    Long   支付时间
 *   auditedAtStart / auditedAtEnd    Long   审核时间
 *
 * 筛选条件：
 *   formStatus          String        单据状态，见 STATUS 常量
 *   formCodes           List<String>  单据号列表，最多 10 个
 *   coverUserList       List<String>  承担人工号，最多 5 个
 *   fillUserList        List<String>  填单人工号，最多 5 个
 *   legalEntityBizCodes List<String>  公司抬头编码，最多 10 个
 *   formSubTypeBizCode  String        单据小类编码
 *   exportStatus        Integer       0-未导出 1-已导出
 *
 * 分页：
 *   pageNo   Integer  默认 1
 *   pageSize Integer  默认 100，最大 100（超过会被静默截断，不报错）
 *
 * ─────────────────────────────────────────────────────────
 * 响应 data 结构
 * ─────────────────────────────────────────────────────────
 * {
 *   hasNextPage: boolean,
 *   list: [{
 *     formCode          string   单据号（★ 下游 detail/expense/log 只能用这个）
 *     formDataCode      string   内部单据号（★ 不能用于下游接口，传了会报 ACK）
 *     formName          string   单据名称
 *     formStatus        string   APPROVING/COMPLETED/DRAFT...
 *     statusText        string   状态中文
 *     formSubTypeName   string   单据小类，如「员工报销单」「供应商付款单」
 *     baseAmount        object   本位币金额 {amount, amountStr, currency}
 *     approvedAmount    object   审批金额
 *     paymentAmount     object   支付金额
 *     coverEmployeeId   string   承担人工号
 *     coverEmployeeName string   承担人姓名
 *     fillEmployeeName  string   填单人姓名
 *     departmentName    string   部门名
 *     legalEntityName   string   公司抬头
 *     createdAt         number   创建时间（毫秒）
 *     submittedAt       number   提单时间
 *     approvedAt        number   审批通过时间
 *     settledAt         number   支付时间
 *   }, ...]
 * }
 */

import { request } from './_shared.mjs'

export const PATH = '/meike-finance/reimburse/list'

/** 单据状态枚举 */
export const STATUS = {
  APPROVING: 'APPROVING',           // 审批中
  AUDITING: 'AUDITING',             // 审核中
  SIGNING: 'SIGNING',               // 签收中
  SETTLEMENT: 'SETTLEMENT',         // 结算中
  COMPLETED: 'COMPLETED',           // 已完成
  DELETED: 'DELETED',               // 已删除
  ABANDON: 'ABANDON',               // 已废弃
  REJECTED: 'REJECTED',             // 已驳回
  SUBMIT_FAILED: 'SUBMIT_FAILED',   // 提交失败
  DRAFT: 'DRAFT',                   // 草稿
}

/** 时间区间字段成对出现 */
const RANGES = [
  ['createdAtStart', 'createdAtEnd'],
  ['submittedAtStart', 'submittedAtEnd'],
  ['approvedAtStart', 'approvedAtEnd'],
  ['updatedAtStart', 'updatedAtEnd'],
  ['settledAtStart', 'settledAtEnd'],
  ['auditedAtStart', 'auditedAtEnd'],
]

/**
 * 查询报销单列表（单页）。
 *
 * @param {object} [params] 见文件头入参说明，直接透传
 * @param {object} [opts]   request 选项（key/base/timeout/retries）
 * @returns {Promise<{hasNextPage: boolean, list: Array}>}
 * @throws {MkError} 跨度超 366 天、formCodes 超 10 个等会抛错
 */
export async function list(params = {}, opts = {}) {
  const payload = {
    pageNo: params.pageNo ?? 1,
    // 超过 100 会被静默截断，这里主动收敛，避免调用方误以为拿到更多
    pageSize: Math.min(params.pageSize ?? 100, 100),
  }
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    if (k === 'pageNo' || k === 'pageSize') continue
    payload[k] = v
  }
  return request(PATH, payload, opts)
}

/**
 * 自动翻页迭代所有报销单。
 *
 * @param {object} [params]  同上，另支持 maxPages 限制页数（默认 50）
 * @param {object} [opts]
 * @yields 单条报销单
 */
export async function* iterForms({ maxPages = 50, ...params } = {}, opts = {}) {
  for (let page = 1; page <= maxPages; page++) {
    const d = await list({ ...params, pageNo: page }, opts)
    for (const item of d.list || []) yield item
    if (!d.hasNextPage) return
  }
}

/** 取单据金额（本位币） */
export function formAmount(item) {
  return (item && item.baseAmount && item.baseAmount.amount) || 0
}

export default { PATH, STATUS, list, iterForms, formAmount }
