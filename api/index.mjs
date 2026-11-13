/**
 * 每刻财务只读查询 —— 统一入口
 *
 * 每个接口一个文件，本文件把它们聚合成一个 client，并保留原 mk.mjs 的 CLI 用法。
 *
 * CLI：
 *   node api/index.mjs list
 *   node api/index.mjs list --status APPROVING --pages 3
 *   node api/index.mjs detail BX26111101
 *   node api/index.mjs expense BX26111101
 *   node api/index.mjs log BX26111101
 *   node api/index.mjs loan 18124219210 17353517475
 *
 * 模块：
 *   import { MkClient } from './api/index.mjs'
 *   const mk = new MkClient()
 *   const { list } = await mk.list()
 *
 * 也可以只导入单个接口文件：
 *   import { list } from './api/list.mjs'
 *   import { detail } from './api/detail.mjs'
 */

import process from 'node:process'
import { BASE, MkError, loadKey, amount, expenseAmount, loanTotal, formatMoney } from './_shared.mjs'
import * as ListApi from './list.mjs'
import * as DetailApi from './detail.mjs'
import * as ExpenseApi from './expense.mjs'
import * as ProcessApi from './process-log.mjs'
import * as LoanApi from './loan.mjs'

export { BASE, MkError, loadKey, amount, expenseAmount, loanTotal, formatMoney }

/**
 * 聚合客户端。构造参数会传给每个接口的 request。
 */
export class MkClient {
  constructor(opts = {}) {
    this.opts = opts
  }

  list(params) { return ListApi.list(params, this.opts) }
  iterForms(params) { return ListApi.iterForms(params, this.opts) }
  detail(formCode, flags) { return DetailApi.detail(formCode, flags, this.opts) }
  expense(formCode) { return ExpenseApi.expenseList(formCode, this.opts) }
  log(formCode) { return ProcessApi.processLog(formCode, this.opts) }
  loan(nos) { return LoanApi.loanBalance(nos, this.opts) }
  loanAll(nos) { return LoanApi.loanBalanceAll(nos, this.opts) }
}

// ---------- CLI ----------

async function main(argv) {
  const [cmd, ...args] = argv.slice(2)
  const mk = new MkClient()

  if (!cmd || cmd === '-h' || cmd === '--help') {
    console.log(`每刻财务接口 CLI

用法:
  node api/index.mjs list [--status 状态] [--pages 页数]
  node api/index.mjs detail <formCode>
  node api/index.mjs expense <formCode>
  node api/index.mjs log <formCode>
  node api/index.mjs loan <工号...>

示例:
  node api/index.mjs list --status APPROVING --pages 2
  node api/index.mjs detail BX26111101
  node api/index.mjs loan 18124219210`)
    return 0
  }

  if (cmd === 'list') {
    let status, pages = 1
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--status') status = args[++i]
      else if (args[i] === '--pages') pages = Number(args[++i])
    }
    let n = 0
    for await (const f of mk.iterForms({ maxPages: pages, formStatus: status })) {
      n++
      console.log(
        `${f.formCode.padEnd(14)}${String(f.formStatus).padEnd(12)}` +
        `${formatMoney(ListApi.formAmount(f)).padStart(12)}  ` +
        `${(f.coverEmployeeName || '').padEnd(8)}${f.departmentName || ''}`,
      )
    }
    console.log(`\n共 ${n} 条`)
    return 0
  }

  if (cmd === 'detail') {
    if (!args[0]) { console.error('需要单据号'); return 1 }
    const d = await mk.detail(args[0], { attachments: true, travel: true, payee: true })
    console.log(`单据号   ${d.formCode}`)
    console.log(`名称     ${d.reimburseName}`)
    console.log(`小类     ${d.formSubTypeName}`)
    console.log(`报销人   ${d.coverEmployeeName} / ${d.departmentName ?? '-'}`)
    console.log(`公司     ${d.legalEntityName}`)
    console.log(`金额     ${d.baseAmount?.amountStr}`)
    const exp = DetailApi.expenses(d)
    console.log(`费用     ${exp.length} 条，发票 ${DetailApi.countInvoices(d)} 张`)
    for (const e of exp) {
      console.log(
        `   ${(e.expenseTypeName || '').padEnd(20)}` +
        `${formatMoney(expenseAmount(e)).padStart(10)}  ` +
        `发票${(e.invoiceList || []).length}张`,
      )
    }
    return 0
  }

  if (cmd === 'expense') {
    if (!args[0]) { console.error('需要单据号'); return 1 }
    const d = await mk.expense(args[0])
    console.log(`单据 ${d.formCode} 金额 ${d.baseAmount?.amountStr}`)
    for (const [t, v] of Object.entries(ExpenseApi.sumByType(d, expenseAmount))) {
      console.log(`   ${t.padEnd(24)}${formatMoney(v).padStart(10)}`)
    }
    return 0
  }

  if (cmd === 'log') {
    if (!args[0]) { console.error('需要单据号'); return 1 }
    const d = await mk.log(args[0])
    for (const r of ProcessApi.toRows(d)) {
      console.log(`${r.time}  ${r.taskName.padEnd(12)}${r.nodeType.padEnd(8)} ${r.operation}`)
    }
    return 0
  }

  if (cmd === 'loan') {
    if (!args.length) { console.error('需要至少一个工号'); return 1 }
    for (const item of await mk.loanAll(args)) {
      console.log(
        `${String(item.employeeNo).padEnd(14)}` +
        `笔数 ${String(LoanApi.loanCount(item)).padEnd(4)}` +
        `金额 ${formatMoney(loanTotal(item)).padStart(10)}`,
      )
    }
    return 0
  }

  console.error(`未知命令: ${cmd}`)
  return 1
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv)
    .then((c) => process.exit(c))
    .catch((e) => {
      console.error(e instanceof MkError ? `接口错误 ${e.message}` : e.message)
      process.exit(1)
    })
}
