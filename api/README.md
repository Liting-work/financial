# 每刻财务接口（Node.js）

零依赖，需 Node 18+（用内置 fetch）。每个接口一个文件，参数和响应都写在文件头注释里。

## 目录结构

```
api/
├── _shared.mjs        共享基础：网关地址、Key 读取、统一请求、错误类型、金额工具
├── list.mjs           接口1 报销单列表      POST /meike-finance/reimburse/list
├── detail.mjs         接口2 报销单详情      POST /meike-finance/reimburse/detail
├── expense.mjs        接口3 费用明细        POST /meike-finance/reimburse/expense-list
├── process-log.mjs    接口4 审批流程        POST /meike-finance/reimburse/process-log
├── loan.mjs           接口5 员工借款余额    POST /meike-finance/loan/employee-balance
└── index.mjs          统一入口 + CLI
```

每个接口文件顶部注释都包含：**入参说明**、**响应结构**、**实测坑位**。

## 命令行

```bash
node api/index.mjs list                        # 报销列表（近一年第1页）
node api/index.mjs list --status APPROVING      # 只看审批中
node api/index.mjs list --pages 3               # 拉 3 页
node api/index.mjs detail BX26111101            # 单据详情
node api/index.mjs expense BX26111101           # 费用明细（按类型汇总）
node api/index.mjs log BX26111101               # 审批流程
node api/index.mjs loan 18124219210             # 借款余额
```

## 作为模块

聚合客户端：

```js
import { MkClient } from './api/index.mjs'
const mk = new MkClient()

for await (const f of mk.iterForms({ formStatus: 'APPROVING', maxPages: 3 })) {
  console.log(f.formCode, f.baseAmount.amount)
}
const d = await mk.detail('BX26111101', { attachments: true })
```

或只导入需要的接口：

```js
import { list } from './api/list.mjs'
import { detail, expenses, countInvoices } from './api/detail.mjs'
import { processLog, toRows } from './api/process-log.mjs'
import { loanBalance, loanTotal, loanCount } from './api/loan.mjs'
```

## 各接口导出

| 文件 | 导出 |
|---|---|
| `list.mjs` | `list()` 单页、`iterForms()` 自动翻页、`STATUS` 状态枚举、`formAmount()` |
| `detail.mjs` | `detail(formCode, flags)`、`expenses()`、`countInvoices()`、`SWITCHES` |
| `expense.mjs` | `expenseList()`、`sumByType()` 按费用类型汇总 |
| `process-log.mjs` | `processLog()`、`nodes()`、`toRows()`、`isFinished()` |
| `loan.mjs` | `loanBalance()`、`loanBalanceAll()` 自动分批、`loanCount()` 笔数、`loanTotal()` 金额 |

## 实测坑位（已写进代码）

| 坑 | 处理 |
|---|---|
| 本地 `127.0.0.1:17073` 不可达 | 固定用生产网关 `https://train.aojuai.com/ajdataother` |
| `formDataCode` 会导致 `每刻返回异常: ACK` | `formCode` 必填校验，注释反复强调 |
| `pageSize` 超 100 静默截断 | `Math.min(pageSize, 100)` 主动收敛 |
| 费用金额字段不是 `expenseAmount` | 用 `consumeBaseAmount`（`expenseAmount()` 封装回退） |
| 借款 `tradeAmount` 是笔数不是金额 | `loanTotal()` 从 `monetaryInfoList` 求和 |
| 单个工号不存在导致整批失败 | `loanBalanceAll()` 注释警告，可 try/catch 降级 |
| 网络偶发 2s+ | 超时 30s，失败重试 2 次 |
| `key.json` 含 `//` 注释非标准 JSON | `loadKey()` 容错解析 |

Key 优先级：环境变量 `MKFIN_API_KEY` > `key.json`（在 api 的上一级目录）。
