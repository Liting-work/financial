# 报销审批核对工作流

通过 [`api/`](api/) 里的接口拉取每刻业务数据，对照 [`doc/01-费用报销标准.md`](doc/01-费用报销标准.md) 的规则做审批核对，核对结果按天写入 [`approve/`](approve/)。

## 目录

```
ltmk/
├── api/          接口客户端（5 个接口，每个一个文件）
├── doc/          规则文档、接口文档、业务背景
├── approve/      核对结果，每天一个文件，按日期命名
└── key.json      API Key（代码依赖此路径，勿移动）
```

## 整体流程

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐
│  api/ 拉数据 │ →  │ 规则比对核对  │ →  │ 生成核对报告  │ →  │ approve/日期.md │
└─────────────┘    └──────────────┘    └──────────────┘    └─────────────────┘
```

1. **拉取**：用 `api/list.mjs` 按时间窗取出当天需处理的报销单，再用 `detail` / `expense` / `process-log` / `loan` 补齐明细。
2. **核对**：逐单对照报销标准，产出「通过 / 存疑 / 不通过」的判定和依据。
3. **落盘**：结果写入 `approve/YYYY-MM-DD.md`，一天一个文件。同一天重复跑则覆盖或追加（见下文「幂等」）。

## 一、拉取数据

```js
import { iterForms } from './api/list.mjs'
import { detail } from './api/detail.mjs'

// 取当天提交的单据（时间参数是 13 位毫秒戳，跨度不能超过 366 天）
const start = new Date('2026-11-11T00:00:00+08:00').getTime()
const end   = new Date('2026-11-12T00:00:00+08:00').getTime()

for await (const f of iterForms({ submittedAtStart: start, submittedAtEnd: end })) {
  const d = await detail(f.formCode, { attachments: true })  // ★ 用 formCode
  // ...
}
```

四个接口的用途：

| 接口 | 拿到什么 | 核对时用来 |
|---|---|---|
| `list.mjs` | 单据号、状态、金额、部门、报销人 | 筛出待核对单据 |
| `detail.mjs` | 费用行、发票、附件、收款账户 | 逐项比对标准 |
| `expense.mjs` | 单据汇总 + 费用行（体积小） | 批量核金额 |
| `process-log.mjs` | 审批节点、操作人、时间 | 看是否已报备、谁审批 |
| `loan.mjs` | 未核销借款 | 核对借款额度 |

## 二、核对什么

规则来自 [`doc/01-费用报销标准.md`](doc/01-费用报销标准.md)。按「能否用接口数据自动判定」分三档：

### A. 可自动判定（字段齐全，直接比数字）

| 核对项 | 规则 | 数据来源 |
|---|---|---|
| 住宿单价 | 一线城市 ≤500/天，其他 ≤300/天 | `consumeBaseAmount` |
| 餐费单价 | 早 ≤50，中晚 ≤100 | `consumeBaseAmount` |
| 小交通 | 项目用车 ≤200/单 | `consumeBaseAmount` |
| 茶歇 | 常规 100/天，经理标杆班 200/天 | `consumeBaseAmount` |
| 奖品 | ≤100/期 | `consumeBaseAmount` |
| 员工借款 | 普课 3000/期、实战 6000/期 | `loan.mjs` |
| 借款笔数 | 课程类仅允许 2 期 | `loanCount()` |
| 单据金额一致性 | `baseAmount` 应等于费用行合计 | detail + expense |
| 电子发票格式 | 须 PDF/OFD/XML 原票，不能是截图 | 附件 `attachments` |

### B. 可提示但需人工确认（字段缺失或不完整）

| 核对项 | 为什么不能自动判 |
|---|---|
| 住宿是否超标 | **接口不返回住宿天数**，`consumeTime` 起止时间相同，无法算每晚单价 |
| 城市适用哪档标准 | `consumeLocation` 实测恒为空，只能从单据名猜（实测仅约 2/10 能识别） |
| 老师 / 员工标准适用 | 无人员类型字段，只能从费用行 `comments` 自由文本里找「老师」「本人」等线索 |
| 是否已报备 | 报备记录不在接口里，只能看 `process-log` 有无相应节点 |
| 住宿是否替票 | 票种可读，但「住宿费发票」与「普通发票」有时无法区分是否替票 |

### C. 无法核对（需要人工）

- 同行人员是否同性别合住
- 景点/旅游城市、旺季判定
- 系统外沟通（老师不配合提供附件等）
- 替票类别的合理性（税务口径）

> **重要**：住宿标准是「每天」上限，但接口只给一笔合计金额。直接把合计和日限比较会把合规单误判为超标（例如 4 晚合计 2200 元，日均 550，若城市是一线则合规；但若只有 1 晚则超标）。**必须人工补天数**，否则不要自动出「超标」结论。

## 三、输出格式

文件：`approve/YYYY-MM-DD.md`（如 `approve/2026-11-11.md`）

建议结构：

```markdown
# 报销核对 2026-11-11

- 核对时间：2026-11-11 17:00
- 核对范围：submittedAt 2026-11-11 全天
- 单据总数：37　通过：30　存疑：5　不通过：2

## 汇总

| 判定 | 数量 | 金额合计 |
|---|---|---|
| 通过 | 30 | ¥123,456.78 |
| 存疑 | 5 | ¥12,345.67 |
| 不通过 | 2 | ¥3,456.78 |

## 明细

### ✅ 通过（30）

| 单据号 | 报销人 | 部门 | 金额 | 小类 |
|---|---|---|---|---|
| BX26111101 | 潘杰 | 项目支撑中心 | 6,694.94 | 员工报销单 |

### ⚠️ 存疑（5）需人工确认

| 单据号 | 报销人 | 金额 | 存疑原因 |
|---|---|---|---|
| BX26111097 | 孟文通 | 4,480.31 | 住宿 1,883.00 元，无住宿天数，无法判断是否超日均标准 |

### ❌ 不通过（2）

| 单据号 | 报销人 | 金额 | 不通过原因 | 依据 |
|---|---|---|---|---|
| BX26111100 | 曹涵 | 2,981.05 | 小交通 350 元超 200/单 | 报销标准·小交通 |

## 待人工补充

- [ ] BX26111097：住宿天数与城市
- [ ] BX26111100：是否有超标准报备截图
```

## 四、实现要点

### 单据号只能用 formCode

`list` 返回两个编号，`formDataCode` 传给其他接口会返回 `每刻返回异常: ACK`（无意义报错，极易误判成 Key 失效）。

### 金额字段是 consumeBaseAmount

费用行金额不在 `expenseAmount`，用 `expenseAmount()` 工具函数取：

```js
import { expenseAmount } from './api/_shared.mjs'
for (const e of d.expenseList) {
  console.log(e.expenseTypeName, expenseAmount(e))
}
```

### 借款查金额不要用 tradeAmount

`tradeStatistics.tradeAmount` 是**笔数**，金额在 `monetaryInfoList`，用 `loanTotal()` 求和。查 20 个以上工号用 `loanBalanceAll()` 自动分批。

### 限速

每刻企业共享 10 次/秒，实测单次约 1 秒。逐单串行拉 `detail` 时，30 单约 30 秒。不要并发压测，`detail` 体积大，建议串行并加 200ms 间隔。

### 幂等

同一天重复运行有两种处理，按需选：

- **覆盖**：每次重跑生成完整报告，最适合「当天数据还在变」的场景
- **追加**：保留历史核对痕迹，适合多人协作

推荐覆盖 + 在文件内记录 `核对时间`。

### 目录初始化

首次运行前建目录：

```bash
mkdir -p approve
```

## 五、最小可用示例

```js
import { writeFileSync, mkdirSync } from 'node:fs'
import { iterForms } from './api/list.mjs'
import { detail, expenses } from './api/detail.mjs'
import { expenseAmount, formatMoney } from './api/_shared.mjs'

const day = '2026-11-11'
const start = new Date(`${day}T00:00:00+08:00`).getTime()
const end = new Date(`${day}T00:00:00+08:00`).getTime() + 86400000  // 次日零点

const rows = []
for await (const f of iterForms({ submittedAtStart: start, submittedAtEnd: end })) {
  const d = await detail(f.formCode)
  const notes = []

  for (const e of expenses(d)) {
    const amt = expenseAmount(e)
    // 住宿：接口没有天数和城市，这里只标「需人工核对」，不要直接判超标
    if (/住宿/.test(e.expenseTypeName) && amt > 300) {
      notes.push(`住宿 ${formatMoney(amt)} 元，需人工确认住宿天数与城市后按日限判断`)
    }
    if (/小交通|交通（/.test(e.expenseTypeName) && amt > 200) {
      notes.push(`小交通 ${formatMoney(amt)} 元，超 200/单`)
    }
  }
  rows.push({ code: f.formCode, who: f.coverEmployeeName, amt: f.baseAmount.amount, notes })
}

mkdirSync('approve', { recursive: true })
const lines = [`# 报销核对 ${day}`, '', `- 单据总数：${rows.length}`, '']
for (const r of rows) {
  lines.push(`## ${r.code}　${r.who}　${formatMoney(r.amt)}`)
  lines.push(r.notes.length ? r.notes.map((n) => `- ⚠️ ${n}`).join('\n') : '- ✅ 未发现明显问题')
  lines.push('')
}
writeFileSync(`approve/${day}.md`, lines.join('\n'), 'utf8')
console.log(`已写入 approve/${day}.md`)
```

## 六、注意事项

1. **这是只读接口**，只能查询，不能提交/审批，核对结论需人工在每刻系统里操作。
2. **不要自动判「不通过」并拒单**。接口缺天数和城市，误判风险高，建议只标「存疑」并列出依据，由财务决定。
3. **结论要写依据**。每条判定注明对应规则条目，方便复核和申诉。
4. **key.json 勿移动**，`api/_shared.mjs` 用相对路径 `../key.json`。该文件已加入 `.gitignore`，不会提交到仓库；克隆后请把 `key.example.json` 复制为 `key.json` 并填入 Key。
5. 相关说明见 [`api/README.md`](api/README.md) 和 [`doc/README.md`](doc/README.md)。
