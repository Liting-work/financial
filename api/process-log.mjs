/**
 * 接口 4/5：审批流程
 *
 *   POST /meike-finance/reimburse/process-log
 *
 * ─────────────────────────────────────────────────────────
 * 入参
 * ─────────────────────────────────────────────────────────
 *   formCode  string  必填。★ 用列表返回的 formCode，勿用 formDataCode
 *
 * ─────────────────────────────────────────────────────────
 * 响应 data 结构
 * ─────────────────────────────────────────────────────────
 * {
 *   formCode                   string  单据号
 *   lastOperatorEmployeeId     string  最后操作人工号
 *   lastAuditOperatorEmployeeId string 最后审批人工号
 *   openApiFormProcessLogs     array   流程节点列表
 * }
 *
 * ─────────────────────────────────────────────────────────
 * openApiFormProcessLogs 单条（★ 字段名与直觉不同，注意）
 * ─────────────────────────────────────────────────────────
 * {
 *   taskName              string  节点名，如「发起审批」「会计审核」「出纳支付」
 *   processNodeSubType    string  节点类型中文：审批节点 / 支付节点 / 其他节点
 *   processNodeSubTypeCode string 节点类型编码，如 CASHIER_SETTLE / OTHER
 *   operationTypeName     string  操作类型，如 PROCESS_STARTED / PAID / PAY_ORDER_PAID
 *   operationText         string  ★ 操作记录全文，如「[潘杰]提交单据」「[张超叶]审批通过」
 *   operatorName          array   ★ 操作人姓名数组，如 ["潘杰"]
 *   operatorEmployeeIds   array   操作人工号数组
 *   optTime               number  ★ 操作时间（毫秒时间戳）
 *   optReason             string  审批意见/原因
 *   delegater             string  代理人姓名
 *   delegaterEmployeeId   string  代理人工号
 *   finalAuditNode        boolean 是否终审节点
 *   taskCategory          string  任务分类
 *   nextOperatorName      array   下一处理人
 *   nextOperatorEmployeeIds array 下一处理人工号
 *   attachments           array   附件
 *   formCode              string  单据号
 * }
 *
 * 典型流程（实测 SF26111104）：
 *   发起审批 → 会计审核 → 财务部负责人 → 支付单支付 → 出纳支付
 */

import { request, formatTime } from './_shared.mjs'

export const PATH = '/meike-finance/reimburse/process-log'

/**
 * 查询审批流程。
 *
 * @param {string} formCode 单据号
 * @param {object} [opts]   request 选项
 * @returns {Promise<{formCode:string, openApiFormProcessLogs:Array}>}
 * @throws {MkError} 单据不存在 → 「每刻返回异常: 未找到对应的单据」
 */
export async function processLog(formCode, opts = {}) {
  if (!formCode) throw new Error('formCode 必填（用 list 返回的 formCode，勿用 formDataCode）')
  return request(PATH, { formCode }, opts)
}

/** 取流程节点数组 */
export function nodes(logData) {
  return logData?.openApiFormProcessLogs || []
}

/**
 * 转成可读行。
 * @returns {Array<{time:string, taskName:string, nodeType:string, operation:string, operator:string}>}
 */
export function toRows(logData) {
  return nodes(logData).map((g) => ({
    time: formatTime(g.optTime),
    taskName: g.taskName || '-',
    nodeType: g.processNodeSubType || '-',
    operation: g.operationText || '-',
    operator: (g.operatorName || []).join('、') || '-',
  }))
}

/**
 * 判断单据是否已走完（含出纳支付节点）。
 */
export function isFinished(logData) {
  return nodes(logData).some(
    (g) => g.processNodeSubTypeCode === 'CASHIER_SETTLE' || g.operationTypeName === 'PAID',
  )
}

export default { PATH, processLog, nodes, toRows, isFinished }
