# 报销全景 · 数据看板

基于 **React 19 + Webpack 5** 的每刻报销数据看板。列表、详情和审批流程从每刻只读接口读取，浏览器通过 **IndexedDB** 持久化列表、审批人索引和已打开详情；服务端不保存业务数据副本。

## 快速运行

```bash
# 安装依赖
npm install

# 开发模式：API 服务 3001 + Webpack Dev Server 5173
npm run dev

# 生产构建与启动
npm run build
npm start
```

- 开发地址（本机）：<http://127.0.0.1:5173>
- 生产地址（本机）：<http://127.0.0.1:3001>
- 如果端口被占用，可指定 `PORT=3100 npm start`。

### 局域网访问（同事连我本机）

服务和开发服务器都监听 `0.0.0.0`，同一局域网内的同事可以直接用本机 IP 打开。启动时脚本会把真实 IP 打印出来：

```text
  傲举财务 · 报销看板
  本机     http://127.0.0.1:3001/
  同事访问 http://192.168.0.147:3001/   (以太网)
```

把「同事访问」那一行发给对方即可，不用自己查 `ipconfig`。

- IP 由 `server/network.mjs` 读取 `os.networkInterfaces()` 得到，多网卡时按 `192.168.x` > `10.x` > `172.16-31.x` 排序，只列真实网卡。
- 虚拟网卡（VMware / WSL / Docker / Tailscale 等）单独列在「虚拟网卡」一行，那些地址同事一般连不到。
- 开发模式（`npm run dev`，5173）同样会打印一份，`/api` 自动代理到本机 3001，同事访问 5173 即可。
- 只想本机用：`HOST=127.0.0.1 npm start`，此时横幅会提示仅本机可访问。
- 首次启动若同事打不开，多半是 **Windows 防火墙**拦了 Node.js，在弹窗里允许「专用网络」放行，或手动放行对应端口。
- ⚠️ 该服务持有每刻只读 Key，绑定 `0.0.0.0` 后同网段的任何人都能调用 `/api/*` 读到报销数据。只限公司内网使用，不要映射到公网。

首次在新环境运行前，确认根目录存在 `key.json`（或设置环境变量 `MKFIN_API_KEY`）。看板不依赖本地数据文件，也不需要手工初始化数据库；首次打开时由浏览器自动创建 IndexedDB。

## 三个独立页面

侧边栏三个入口分别对应独立路由，不再锚点滚动：

| 页面 | 路由 | 内容 |
|---|---|---|
| 数据总览 | `/overview` | 单据总额、待处理、完成率、笔均金额；提交趋势与状态构成 |
| 部门洞察 | `/departments` | 按承担部门聚合的汇总明细：单数、金额、待处理、完成率、笔均金额；点击部门跳转到该部门的单据 |
| 报销单据 | `/documents` | 默认「待处理 + 当前审批人李婷」，仅加载最近 30 天提交的数据；其它状态 tab 点击后按需加载；支持搜索、状态 / 单据类型 / 审批人筛选、分页、导出 |

公共能力：单据详情抽屉（费用行、票种、发票数、完整审批流程、项目信息、脱敏收款账户）、规则初筛、报销标准速查、数据口径说明、CSV 导出。

详情里的审批流程会同时展示三类节点：

- `history`：已完成节点，含真实操作人、操作时间与审批意见
- `pending`：当前待处理节点，含候选处理人
- `predict`：后续预演节点，展示流程引擎推算的审批人和支付节点

> 规则初筛只标记「需关注 / 需确认」，不会直接判定不通过，也不会代替财务审批。住宿天数与城市必须人工补充。

页面切换使用 History API，可直接访问或刷新 `/overview`、`/departments`、`/documents`。生产服务和 Webpack Dev Server 都已配置前端路由回退。

## 数据读取策略

| 场景 | 行为 |
|---|---|
| 打开看板 | 优先从 IndexedDB 恢复最近一次列表；无本地数据时实时读取最近 30 天提交、当前待处理的数据（审批中 / 审核中 / 签收中 / 结算中） |
| 点击状态 tab | 已加载过的状态从 IndexedDB / 内存直接复用；未加载状态（已完成 / 已驳回 / 草稿等）点击后才实时查询 |
| 点击「全部」 | 首次点击时加载最近 30 天全部状态数据，之后可从这份数据派生各状态 |
| 自动增量同步 | 页面可见时每 5 分钟按 `updatedAtStart/End` 查询变更，只合并变化单据；当前状态列表实时更新，其它状态缓存失效 |
| 点击「刷新数据」/同步按钮 | 重新拉取当前状态范围，并清理其它状态的内存与 IndexedDB 列表缓存 |
| 审批人筛选 | 默认李婷；首次进入待处理列表时，从完整流程的 pending 节点批量构建当前审批人索引 |
| 打开单据详情 | 优先使用 IndexedDB 中未变更的详情缓存；单据变更后只重新读取该单的详情 + 完整流程 |
| 接口不可用 | 已持久化的数据继续展示，增量同步失败时保留现状并下一周期重试 |
| 本地持久化 | IndexedDB 数据库 `augu-finance-dashboard`（对象仓库 `snapshot`）：列表范围、审批人索引、已打开详情、增量游标 |

- 列表读取 `/meike-finance/reimburse/list`，固定带 `submittedAtStart/End`（最近 30 天）和状态范围，单个范围最多取 5 页。
- 默认待处理范围会分别请求 `APPROVING / AUDITING / SIGNING / SETTLEMENT`，只合并这些状态。
- 详情读取 `/meike-finance/reimburse/detail`。
- 审批流程读取完整流程接口 `GET /api/openapi/process/logs/view/REIMBURSE/{formCode}`，返回已完成、待处理、预演节点；旧的 `/meike-finance/reimburse/process-log` 只返回已处理节点，仅在完整流程接口异常时作为实时降级请求。
- 金额统一取本位币 `baseAmount`；费用行金额取 `consumeBaseAmount`。
- 页面不落地发票、附件或完整银行卡号。
- 如页面长时间停留在打开状态，审批状态可能继续变化；可点击刷新，或重新加载页面获取最新数据。

## 本地服务接口

看板生产模式由 `server/index.mjs` 同时提供静态页面与数据接口：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/bootstrap` | 首屏只返回待处理数据 |
| GET | `/api/forms/query?scope=...` | 按状态范围按需加载；`pending` / `all` / 状态码 |
| GET | `/api/forms/changes?since=...` | 按 `updatedAt` 返回增量变更单据 |
| POST | `/api/approver-index` | 批量读取待处理节点候选审批人 |
| POST | `/api/refresh` | 重新实时拉取待处理列表 |
| GET | `/api/forms/:formCode` | 读取详情与完整流程；浏览器优先复用 IndexedDB 中未变更的缓存 |
| GET | `/api/health` | 服务健康检查 |
| GET | `/docs/*` | 报销制度文档静态访问 |

开发模式下，`webpack-dev-server` 会把 `/api` 与 `/docs` 代理到 `127.0.0.1:3001`。

## 目录

```text
├── src/
│   ├── App.jsx                  页面路由、数据组合、筛选与导出
│   ├── components/
│   │   ├── Shell.jsx            侧边栏、顶栏、加载与错误页
│   │   ├── PageParts.jsx        独立页标题与指标条
│   │   ├── Overview.jsx         数据总览页、趋势与状态环
│   │   ├── DepartmentsPage.jsx  部门洞察页、部门聚合汇总明细
│   │   ├── DocumentsPage.jsx    报销单据页、搜索筛选与导出
│   │   ├── FormsTable.jsx       单据表格、筛选与分页
│   │   ├── DetailDrawer.jsx     详情抽屉、费用 / 流程 / 基本信息
│   │   ├── Modals.jsx           标准速查、数据说明、Toast
│   │   └── Icons.jsx            线性 SVG 图标
│   ├── lib/
│   │   ├── data.js              指标建模、状态与类型元信息、筛选排序
│   │   ├── format.js            金额、日期、CSV 等格式化
│   │   └── time.js              时区日期工具
│   └── styles.css               设计系统与响应式样式
├── server/
│   ├── index.mjs                Express 静态服务 + 只读 API
│   ├── network.mjs              局域网 IP 探测与启动横幅
│   └── data.mjs                 实时拉取、标准化与规则初筛
├── api/
│   ├── process-flow.mjs         完整审批流程（history / pending / predict）
│   └── ...                      每刻列表、详情、费用、借款等客户端
├── public/index.html            Webpack HTML 模板
├── webpack.config.js            React + Babel + devServer 配置
└── dist/                        生产构建产物（npm run build 生成）
```

## 命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 同时启动 Express API 与 Webpack Dev Server |
| `npm run build` | 生产构建至 `dist/` |
| `npm start` | 启动生产服务，托管 `dist/` 与 API |

## 注意事项

1. **只读**：所有接口只会查询，不会提交、修改或审批任何单据。
2. **密钥安全**：`key.json` 仅由服务端读取，不进入前端产物；请勿提交到 Git。
3. **数据口径**：所有业务数据实时读取，不写入磁盘；列表区间来自当前读取结果的创建时间首尾。
4. **审批提示**：接口缺少住宿天数、城市、人员类型等关键字段，看板只做辅助提示，不构成最终审批结论。
5. **附件查看**：发票及完整附件仍在每刻系统内查看，本页只展示票种、发票张数与脱敏后的收款信息。
