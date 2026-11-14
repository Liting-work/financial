# 报销审批核对工作流

通过 [`api/`](api/) 里的接口拉取每刻业务数据，对照 [`doc/01-费用报销标准.md`](doc/01-费用报销标准.md) 的规则做审批核对，核对结果按**审批执行日**归档到 [`approve/年/月/日/`](approve/)。

> **可视化看板**：仓库已加入 React + Webpack 数据看板，拆分为「数据总览 / 部门洞察 / 报销单据」三个独立页面。运行 `npm run dev`（开发）或 `npm run build && npm start`（生产）即可查看，完整说明见 [DASHBOARD.md](DASHBOARD.md)。

## 目录

```
ltmk/
├── api/          接口客户端（5 个接口，每个一个文件）
├── doc/          规则文档、接口文档、业务背景
├── approve/      核对结果，按「年/月/日」三级目录归档，一天一个目录
│   └── 2026/11/14/BX26111242.md   一天目录内一个单据一个文件
└── key.json      API Key（代码依赖此路径，勿移动）
```

## 整体流程

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐
│  api/ 拉数据 │ →  │ 规则比对核对  │ →  │ 生成核对报告  │ →  │ approve/年/月/日/单据.md │
└─────────────┘    └──────────────┘    └──────────────┘    └──────────────────────┘
```

1. **拉取**：用 `api/list.mjs` 按时间窗取出当天需处理的报销单，再用 `detail` / `expense` / `process-log` / `loan` 补齐明细。
2. **核对**：逐单对照报销标准，产出「通过 / 存疑 / 不通过」的判定和依据。
3. **落盘**：结果写入 `approve/2026/11/14/BX26111242.md`，一天一个目录、一个单据一个文件，路径规则见「三、输出路径」。

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

## 三、输出路径与格式

### 3.1 路径规则

```
approve/<年>/<月>/<日>/<单据号>.md
```

| 段 | 规则 | 示例 |
|---|---|---|
| 年 | 四位年份 | `2026` |
| 月 | 两位补零 | `11` |
| 日 | 两位补零 | `14` |
| 单据号 | `formCode`，文件名即单据号 | `BX26111242.md` |

约定：

1. **日期口径是「审批执行日」**——哪天做的核对就落哪天，不是单据提交日 `submittedAt`。补审昨天的单，就落在今天的目录。
2. 一天一个目录，当天核对的**每张单据各写一个 md**，同一目录内不放汇总文件。
3. 文件名只用单据号，不加日期前缀（日期已在目录里），同日重跑直接覆盖同名文件。
4. 目录递归创建，不要预先手工建叶子目录。

```
approve/
└── 2026/
    └── 11/
        ├── 13/
        │   ├── BX26111241.md
        │   └── BX26111239.md
        └── 14/
            └── BX26111242.md
```

### 3.2 生成路径的代码

```js
import { mkdirSync, writeFileSync } from 'node:fs'

/** 审批执行日 → approve/YYYY/MM/DD */
function dayDir(d = new Date()) {
  const y = String(d.getFullYear())
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `approve/${y}/${m}/${dd}`
}

const dir = dayDir()                  // approve/2026/11/14
mkdirSync(dir, { recursive: true })   // 递归创建，已存在不报错
writeFileSync(`${dir}/${formCode}.md`, md, 'utf8')
```

想补审到指定日期，显式传日期即可：`dayDir(new Date('2026-11-13T00:00:00+08:00'))`。

### 3.3 单个单据文件的结构

完整样例见 [`approve/2026/11/14/BX26111242.md`](approve/2026/11/14/BX26111242.md)：

```markdown
# 单据核对 BX26111242

- 核对时间：2026-11-14 17:39
- 核对人：
- 单据：<reimburseName>
- 报销人 / 承担人：沈杨（18851729286）· 项目支撑中心
- 金额：¥3,541.21（审批额 ¥3,541.21）
- 状态：APPROVING

## 结论

**存疑 · 建议退回补正。** 金额无虚增，但住宿未按人头拆天数金额。

## 一、必须补正（硬性要求）

| # | 问题 | 依据 |
|---|---|---|

## 二、疑似问题（需说明或剔除）

| # | 问题 | 金额 | 依据 |
|---|---|---|---|

## 三、通过项

| 核对项 | 结果 |
|---|---|

## 四、费用行明细

| # | 费用类型 | 申报 | 票面合计 | 差额 | 发票/附件 |
|---|---|---|---|---|---|

## 五、发票台账

| 行 | 开票日 | 商户 | 金额 | 项目 | 备注 |
|---|---|---|---|---|---|

## 六、待人工补充

- [ ] ……
```

写作要求：

- **结论只取三档**：`通过` / `存疑` / `不通过`，写在 `## 结论` 首行，方便批量检索：`grep -rl '^\*\*存疑' approve/`。
- 每条判定都要带**依据**（引 `doc/01-费用报销标准.md` 的具体条目），便于复核和申诉。
- 不得因缺住宿天数/城市直接判「不通过」，只能标「存疑」并列入待人工补充。

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

一个单据一个文件，路径 = `approve/年/月/日/单据号.md`，因此重复运行天然幂等：

- 同一天重跑同一单 → 覆盖同名文件，文件内 `核对时间` 记录最后一次
- 不建议追加，追加会让单张单据出现多份结论，财务无法判断以哪条为准

### 目录初始化

不用手工建目录，`mkdirSync(dir, { recursive: true })` 会按年月日逐级创建。只需要 `approve/` 存在（仓库已有 `approve/.gitkeep`）。

## 五、最小可用示例

按审批执行日归档，一单一个文件：

```js
import { writeFileSync, mkdirSync } from 'node:fs'
import { iterForms } from './api/list.mjs'
import { detail, expenses } from './api/detail.mjs'
import { expenseAmount, formatMoney } from './api/_shared.mjs'

// 审批执行日 → approve/YYYY/MM/DD
function dayDir(d = new Date()) {
  const y = String(d.getFullYear())
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `approve/${y}/${m}/${dd}`
}

const day = '2026-11-11'   // 要核对的单据所属日期（提交日）
const start = new Date(`${day}T00:00:00+08:00`).getTime()
const end = start + 86400000   // 次日零点

const dir = dayDir()
mkdirSync(dir, { recursive: true })

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

  const lines = [
    `# 单据核对 ${f.formCode}`,
    '',
    `- 核对时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    `- 单据：${d.reimburseName}`,
    `- 报销人：${f.coverEmployeeName} · ${f.departmentName}`,
    `- 金额：¥${formatMoney(f.baseAmount.amount)}`,
    '',
    '## 结论',
    '',
    notes.length ? '**存疑 · 需人工确认。**' : '**通过。**',
    '',
    '## 待人工补充',
    '',
    ...(notes.length ? notes.map((n) => `- [ ] ${n}`) : ['- 无']),
  ]

  writeFileSync(`${dir}/${f.formCode}.md`, lines.join('\n'), 'utf8')
  console.log(`已写入 ${dir}/${f.formCode}.md`)
}
```

## 六、注意事项

1. **这是只读接口**，只能查询，不能提交/审批，核对结论需人工在每刻系统里操作。
2. **不要自动判「不通过」并拒单**。接口缺天数和城市，误判风险高，建议只标「存疑」并列出依据，由财务决定。
3. **结论要写依据**。每条判定注明对应规则条目，方便复核和申诉。
4. **归档目录按「年/月/日」三级**，日期取审批执行日，一单一个文件，规则见「三、输出路径与格式」。不要把多个单据合并进一个日文件，否则后期按单据回溯、覆盖重跑都会出问题。
5. **key.json 勿移动**，`api/_shared.mjs` 用相对路径 `../key.json`。该文件已加入 `.gitignore`，不会提交到仓库；克隆后请把 `key.example.json` 复制为 `key.json` 并填入 Key。
6. 相关说明见 [`api/README.md`](api/README.md) 和 [`doc/README.md`](doc/README.md)。
