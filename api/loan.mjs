/**
 * 接口 5/5：员工借款余额
 *
 *   POST /meike-finance/loan/employee-balance
 *
 * 返回每人未核销借款。在途借款单不计入，已还款金额已剔除。
 *
 * ─────────────────────────────────────────────────────────
 * 入参
 * ─────────────────────────────────────────────────────────
 *   employeeNos  List<String>  必填，每刻工号列表，最多 20 个
 *                              （注意是工号，如 18124219210，不是姓名）
 *
 * ─────────────────────────────────────────────────────────
 * 响应 data 结构（数组，每个工号一条）
 * ─────────────────────────────────────────────────────────
 * [{
 *   employeeNo      string  工号
 *   tradeStatistics object  借款统计
 * }, ...]
 *
 * tradeStatistics 结构：
 * {
 *   tradeAmount      number  ★ 注意：这是「笔数」不是金额！
 *   type             number  类型，实测 0
 *   monetaryInfoList array   金额明细，真实欠款金额在这里
 * }
 *
 * monetaryInfoList 单条：
 * {
 *   amount     number  金额数值，如 7000.0
 *   amountStr  string  格式化金额，如 "￥7,000.00"
 *   currency   string  币种，如 "CNY"
 * }
 *
 * ★ 重要坑位：
 *   实测工号 18124219210 返回 {tradeAmount: 2, monetaryInfoList:[{amount:7000}]}
 *   意思是「2 笔借款，合计 7000 元」。
 *   直接把 tradeAmount 当金额会严重低估债务，务必用 loanTotal() 求和。
 *
 * 响应示例：
 * [
 *   {
 *     "employeeNo": "18124219210",
 *     "tradeStatistics": {
 *       "tradeAmount": 2,
 *       "monetaryInfoList": [
 *         {"amount": 7000.0, "amountStr": "￥7,000.00", "currency": "CNY"}
 *       ],
 *       "type": 0
 *     }
 *   }
 * ]
 */

import { request, loanTotal } from './_shared.mjs'

export const PATH = '/meike-finance/loan/employee-balance'

/** 单次最多查询工号数 */
export const MAX_EMPLOYEES = 20

/**
 * 查询员工借款余额。
 *
 * @param {Array<string|number>} employeeNos 工号列表，最多 20 个
 * @param {object} [opts] request 选项
 * @returns {Promise<Array<{employeeNo:string, tradeStatistics:object}>>}
 * @throws {Error} 超过 20 个工号
 * @throws {MkError} 服务端返回「employeeNos一次最多查20个工号」
 */
export async function loanBalance(employeeNos, opts = {}) {
  const nos = (employeeNos || []).map(String)
  if (!nos.length) throw new Error('employeeNos 必填')
  if (nos.length > MAX_EMPLOYEES) {
    throw new Error(`一次最多 ${MAX_EMPLOYEES} 个工号，当前 ${nos.length} 个`)
  }
  return request(PATH, { employeeNos: nos }, opts)
}

/**
 * 批量查询（自动按 20 个一组切分并发查询）。
 *
 * ⚠️ 实测：只要有一个工号在每刻不存在，整个批次会返回
 *    「每刻返回异常: 找不到对应的员工」，不会跳过该工号继续。
 *    若要容忍脏数据，请先用单条试跑或做 try/catch 降级为逐个查询。
 *
 * @param {Array<string|number>} employeeNos 任意数量工号
 * @returns {Promise<Array>} 合并后的结果
 */
export async function loanBalanceAll(employeeNos, opts = {}) {
  const nos = (employeeNos || []).map(String)
  const chunks = []
  for (let i = 0; i < nos.length; i += MAX_EMPLOYEES) {
    chunks.push(nos.slice(i, i + MAX_EMPLOYEES))
  }
  const results = await Promise.all(chunks.map((c) => loanBalance(c, opts)))
  return results.flat()
}

/** 取笔数（不是金额） */
export function loanCount(item) {
  return item?.tradeStatistics?.tradeAmount || 0
}

export { loanTotal }

export default { PATH, MAX_EMPLOYEES, loanBalance, loanBalanceAll, loanCount, loanTotal }
