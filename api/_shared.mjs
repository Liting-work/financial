/**
 * 每刻财务接口 —— 共享基础模块
 *
 * 所有接口文件都依赖这里，提供：
 *   - BASE          生产网关地址（本地 17073 不可达，实测连接被拒）
 *   - loadKey()     从 key.json / 环境变量读取 X-Api-Key
 *   - request()     统一 POST + 鉴权 + 重试 + 错误处理
 *   - MkError       统一错误类型
 *   - 金额/笔数工具
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** 生产网关。文档中的 http://<服务器>:17073 在本机不可达，不要用 */
export const BASE = 'https://train.aojuai.com/ajdataother'

/** key.json 在 api 目录的上一级 */
const KEY_FILE = join(__dirname, '..', 'key.json')

/**
 * 读取 API Key。
 * 优先级：环境变量 MKFIN_API_KEY > key.json
 * 注意：key.json 里带 // 注释，不是标准 JSON，这里做了容错解析。
 */
export function loadKey() {
  if (process.env.MKFIN_API_KEY) return process.env.MKFIN_API_KEY
  let raw
  try {
    raw = readFileSync(KEY_FILE, 'utf8')
  } catch {
    throw new Error(`找不到 Key 文件: ${KEY_FILE}，或设置环境变量 MKFIN_API_KEY`)
  }
  try {
    return JSON.parse(raw).apikey
  } catch {
    for (const line of raw.split('\n')) {
      const clean = line.split('//')[0].trim()
      if (clean.includes('"apikey"')) {
        return clean.split(':')[1].trim().replace(/^["']|["',]+$/g, '')
      }
    }
  }
  throw new Error(`无法从 ${KEY_FILE} 解析 apikey`)
}

/** 接口错误。status 为 -1 表示网络层错误 */
export class MkError extends Error {
  constructor(status, msg, raw) {
    super(`[${status}] ${msg}`)
    this.name = 'MkError'
    this.status = status
    this.msg = msg
    this.raw = raw
  }
}

/**
 * 统一请求入口。
 *
 * @param {string} path     接口路径，如 /meike-finance/reimburse/list
 * @param {object} payload  请求体（会被 JSON 序列化）
 * @param {object} [opts]
 * @param {string} [opts.key]       覆盖 Key
 * @param {string} [opts.base]      覆盖网关地址
 * @param {number} [opts.timeout]   超时毫秒，默认 30000（实测偶有 2s+ 慢响应）
 * @param {number} [opts.retries]   网络失败重试次数，默认 2
 * @returns {Promise<any>} 返回响应中的 data 字段
 * @throws {MkError} HTTP 401 / 非 200 / 业务 status != 200
 */
export async function request(path, payload, opts = {}) {
  const {
    key = loadKey(),
    base = BASE,
    timeout = 30000,
    retries = 2,
  } = opts

  const url = `${base.replace(/\/+$/, '')}${path}`
  let lastErr

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), timeout)
    let res
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': key },
        body: JSON.stringify(payload),
        signal: ac.signal,
      })
    } catch (e) {
      clearTimeout(timer)
      lastErr = new MkError(-1, `网络错误: ${e.message}`)
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
      throw lastErr
    } finally {
      clearTimeout(timer)
    }

    const text = await res.text()
    let body
    try {
      body = JSON.parse(text)
    } catch {
      throw new MkError(res.status, `HTTP ${res.status}: ${text.slice(0, 200)}`)
    }

    if (res.status === 401) throw new MkError(401, body.msg || 'Key 无效', body)
    if (res.status !== 200) throw new MkError(res.status, body.msg || '请求失败', body)
    if (body.status !== 200) throw new MkError(body.status, body.msg || '未知错误', body)

    return body.data
  }
  throw lastErr
}

/** 金额对象取值。入参形如 {amount: 165, amountStr: "165.00", currency: "CNY"} */
export function amount(d) {
  return (d && d.amount) || 0
}

/**
 * 费用行金额。
 * 实测字段是 consumeBaseAmount，不是文档里没写清的 expenseAmount。
 * 回退顺序：消费本位币金额 > 核定额 > 消费额。
 */
export function expenseAmount(e) {
  return e?.consumeBaseAmount?.amount
    ?? e?.approvedAmount?.amount
    ?? e?.consumeAmount?.amount
    ?? 0
}

/**
 * 借款真实金额。
 * 坑：tradeStatistics.tradeAmount 是「笔数」不是金额，别直接当钱用。
 */
export function loanTotal(item) {
  const list = item?.tradeStatistics?.monetaryInfoList || []
  return list.reduce((s, m) => s + (m.amount || 0), 0)
}

/** 毫秒时间戳格式化 */
export function formatTime(ms) {
  return ms ? new Date(ms).toLocaleString('zh-CN', { hour12: false }) : '-'
}

/** 金额格式化 */
export function formatMoney(n) {
  return Number(n || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
