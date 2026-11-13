/**
 * 完整审批流程（含已完成、待处理、预演节点）
 *
 *   GET /api/openapi/process/logs/view/{formType}/{formCode}
 *
 * 这是每刻开放平台「单据的流程预演查询接口」，用于获取流程的完整视图：
 *   - history  已完成节点（真实操作记录）
 *   - pending  当前待处理节点
 *   - predict  后续预演节点（流程引擎按当前条件推算）
 *
 * 与 /meike-finance/reimburse/process-log 的区别：后者只返回「已处理节点」。
 * 该接口走网关的通用只读代理，除 X-Api-Key 外不需要额外参数。
 *
 * 响应 data：
 *   {
 *     lastOperatorEmployeeId: string,
 *     openApiFormProcessLogs: [{
 *       state: 'history' | 'pending' | 'predict',
 *       taskName, taskCategory, processNodeSubType, processNodeSubTypeCode,
 *       operatorName: string[], operatorEmployeeIds: string[],
 *       operationText, optReason, optTime,
 *       nextOperatorName, nextOperatorEmployeeIds,
 *       delegater, delegaterEmployeeId, finalAuditNode, attachments
 *     }]
 *   }
 */

import { BASE, MkError, loadKey } from './_shared.mjs'

export const FLOW_PATH = '/api/openapi/process/logs/view'

const VALID_TYPES = new Set([
  'REIMBURSE',
  'PRECONSUME',
  'LOAN',
  'CONTRACT',
  'REPAYMENT',
  'INSTALLMENT',
])

/**
 * @param {string} formCode 单据号（用列表返回的 formCode）
 * @param {object} [opts]
 * @param {string} [opts.formType] REIMBURSE / PRECONSUME / LOAN / ...
 * @param {string} [opts.key]
 * @param {string} [opts.base]
 * @param {number} [opts.timeout]
 * @param {number} [opts.retries]
 * @returns {Promise<object>} 完整流程数据
 */
export async function processFlow(formCode, opts = {}) {
  if (!formCode) throw new Error('formCode 必填（用 list 返回的 formCode，勿用 formDataCode）')

  const {
    formType = 'REIMBURSE',
    key = loadKey(),
    base = BASE,
    timeout = 30000,
    retries = 2,
  } = opts

  const type = VALID_TYPES.has(String(formType).toUpperCase())
    ? String(formType).toUpperCase()
    : 'REIMBURSE'
  const path = `${FLOW_PATH}/${type}/${encodeURIComponent(formCode)}`
  const url = `${base.replace(/\/+$/, '')}${path}`
  let lastError

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'X-Api-Key': key },
        signal: controller.signal,
      })
      const text = await response.text()
      let body
      try {
        body = JSON.parse(text)
      } catch {
        throw new MkError(response.status, `HTTP ${response.status}: ${text.slice(0, 200)}`)
      }

      if (response.status === 401) {
        throw new MkError(401, body.message || 'Key 无效', body)
      }
      if (response.status !== 200) {
        throw new MkError(response.status, body.message || '流程查询失败', body)
      }
      if (body.code && body.code !== 'ACK') {
        throw new MkError(response.status, body.message || '流程查询失败', body)
      }

      return body.data || { openApiFormProcessLogs: [] }
    } catch (error) {
      lastError = error instanceof MkError ? error : new MkError(-1, `网络错误: ${error.message}`)
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)))
        continue
      }
      throw lastError
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError
}

export function flowNodes(flowData) {
  return flowData?.openApiFormProcessLogs || []
}

export default { FLOW_PATH, processFlow, flowNodes }
