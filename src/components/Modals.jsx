import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icons.jsx'
import { formatDateTime, formatRange } from '../lib/format.js'

const POLICY_ROWS = [
  {
    icon: 'bed',
    tone: 'green',
    title: '住宿',
    metric: '¥500 / ¥300',
    unit: '每晚',
    teacher: '老师：北上广深 ≤ ¥500/天，其他城市 ≤ ¥300/天',
    employee: '员工：北上广深 ≤ ¥300/天，其他城市 ≤ ¥180/天',
    note: '接口无住宿天数与城市，住宿超标必须人工确认。',
  },
  {
    icon: 'meal',
    tone: 'amber',
    title: '餐费',
    metric: '¥50 / ¥100',
    unit: '每餐',
    teacher: '老师：早餐 ≤ ¥50/餐，午晚餐各 ≤ ¥100/餐',
    employee: '员工餐费原则上不报销',
    note: '每餐额度独立计算，不叠加使用。',
  },
  {
    icon: 'car',
    tone: 'blue',
    title: '小交通',
    metric: '¥200',
    unit: '每单',
    teacher: '老师：项目用车 ≤ ¥200/单，专车按 77 折',
    employee: '员工项目用车 ≤ ¥200/单；加班用车 ≤ ¥100/单',
    note: '超标准需前置报备，否则超额部分自费。',
  },
  {
    icon: 'box',
    tone: 'green',
    title: '茶歇',
    metric: '¥100–200',
    unit: '每天',
    teacher: '常规课程 50 人内 ¥100/天；经理 / 标杆班 ¥200/天',
    employee: '超出 50 人按 ¥2 / ¥4 每人每天计算',
    note: '超额需提前请示市场区域经理。',
  },
  {
    icon: 'sparkle',
    tone: 'amber',
    title: '奖品',
    metric: '¥100',
    unit: '每期',
    teacher: '课程奖品额度 ¥100/期，组合课程按 1 期计',
    employee: '彩票费用不允许报销；理论课不可红包奖励',
    note: '大型项目或超额奖品需事前报备。',
  },
  {
    icon: 'wallet',
    tone: 'blue',
    title: '员工借款',
    metric: '¥3,000 / ¥6,000',
    unit: '每期',
    teacher: '普课 ¥3,000/期；实战（含训战）¥6,000/期',
    employee: '课程类仅允许 2 期；新人周转金 ¥2,000',
    note: '单笔调研、拜访借款上限 ¥5,000。',
  },
]

function ModalShell({ title, eyebrow, onClose, children, className = '', closeRef }) {
  return createPortal(
    <div className="modal-layer">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className={`modal-card ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <div>
            <p className="modal-eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
          </div>
          <button
            type="button"
            className="icon-button modal-close"
            onClick={onClose}
            aria-label="关闭弹窗"
            ref={closeRef}
          >
            <Icon name="close" size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function PolicyModal({ onClose }) {
  const closeRef = useRef(null)
  useEffect(() => closeRef.current?.focus(), [])

  return (
    <ModalShell
      title="报销标准速查"
      eyebrow="POLICY / 自 2025.10.01 起执行"
      onClose={onClose}
      className="policy-modal"
      closeRef={closeRef}
    >
      <div className="modal-scroll">
        <div className="policy-intro">
          <span className="policy-stamp">
            <Icon name="book" size={20} />
          </span>
          <div>
            <strong>把制度放在审批手边</strong>
            <p>
              以下为高频费用标准的摘要。系统的规则初筛只负责提示，不替代附件复核和人工判断。
            </p>
          </div>
        </div>

        <div className="policy-caution">
          <Icon name="info" size={16} />
          <p>
            住宿标准以「每天」为上限，但接口不返回住宿天数和城市。不要直接把一笔住宿合计与日限比较。
          </p>
        </div>

        <div className="policy-grid">
          {POLICY_ROWS.map((rule) => (
            <article className={`policy-card policy-${rule.tone}`} key={rule.title}>
              <div className="policy-card-head">
                <span className="policy-icon">
                  <Icon name={rule.icon} size={18} />
                </span>
                <h3>{rule.title}</h3>
                <div className="policy-metric">
                  <strong>{rule.metric}</strong>
                  <span>{rule.unit}</span>
                </div>
              </div>
              <dl>
                <div>
                  <dt>老师</dt>
                  <dd>{rule.teacher}</dd>
                </div>
                <div>
                  <dt>员工</dt>
                  <dd>{rule.employee}</dd>
                </div>
              </dl>
              <p className="policy-note">{rule.note}</p>
            </article>
          ))}
        </div>

        <div className="policy-footer">
          <a href="/docs/01-费用报销标准.md" target="_blank" rel="noreferrer">
            查看完整报销制度 <Icon name="external" size={14} />
          </a>
          <span>发票：电子发票须为 PDF / OFD / XML 原票，不能使用截图。</span>
        </div>
      </div>
    </ModalShell>
  )
}

export function DataModal({ meta, onClose }) {
  const closeRef = useRef(null)
  useEffect(() => closeRef.current?.focus(), [])
  const fetchedAt = formatDateTime(new Date(meta.fetchedAt).getTime())

  return (
    <ModalShell
      title="数据说明"
      eyebrow="DATA / 口径与来源"
      onClose={onClose}
      className="data-modal"
      closeRef={closeRef}
    >
      <div className="modal-scroll">
        <div className="data-source-card">
          <div className="source-mark">
            <Icon name="database" size={22} />
          </div>
          <div>
            <span>数据来源</span>
            <strong>{meta.source || '每刻开放平台 · 报销只读接口'}</strong>
            <p>仅调用查询接口，不会提交、修改或审批任何单据。</p>
          </div>
          <span className="source-live">
            <i />
            READ ONLY
          </span>
        </div>

        <div className="data-stat-grid">
          <div>
            <span>覆盖区间</span>
            <strong>{formatRange(meta.periodStart, meta.periodEnd)}</strong>
          </div>
          <div>
            <span>单据数量</span>
            <strong>{meta.count.toLocaleString('zh-CN')} 笔</strong>
          </div>
          <div>
            <span>读取时间</span>
            <strong>{fetchedAt}</strong>
          </div>
          <div>
            <span>数据模式</span>
            <strong className="is-live-data">实时接口</strong>
          </div>
        </div>

        <div className="data-section">
          <h3>数据口径</h3>
          <ul className="data-list">
            <li>
              <Icon name="check" size={14} />
              金额均取本位币 <strong>CNY</strong>，按单据 baseAmount 汇总。
            </li>
            <li>
              <Icon name="check" size={14} />
              单据按创建时间倒序展示；趋势图按创建日期归集。
            </li>
            <li>
              <Icon name="check" size={14} />
              列表与详情在每次打开时实时读取每刻，不使用本地业务数据快照。
            </li>
            <li>
              <Icon name="check" size={14} />
              打开详情会重新获取当前状态与完整审批流程，确保状态与每刻系统一致。
            </li>
            <li>
              <Icon name="check" size={14} />
              页面不展示完整银行卡号，服务端不保存单据、发票或附件数据。
            </li>
          </ul>
        </div>

        <div className="data-section">
          <h3>当前看板使用的接口</h3>
          <div className="endpoint-list">
            <div>
              <span>01</span>
              <code>/meike-finance/reimburse/list</code>
              <em>报销单列表</em>
            </div>
            <div>
              <span>02</span>
              <code>/meike-finance/reimburse/detail</code>
              <em>单据详情</em>
            </div>
            <div>
              <span>03</span>
              <code>/api/openapi/process/logs/view/…</code>
              <em>完整审批流程</em>
            </div>
          </div>
        </div>

        <div className="data-footnote">
          <Icon name="shield" size={15} />
          <p>
            接口凭证只保存在本机服务端，业务数据只在请求期间经过内存。看板中的审批提示均为辅助信息，不构成财务审批结论。
          </p>
        </div>
      </div>
    </ModalShell>
  )
}

export function Toast({ message, tone = 'success' }) {
  if (!message) return null
  return createPortal(
    <div className={`toast toast-${tone}`} role="status">
      <span>
        <Icon name={tone === 'error' ? 'warning' : 'check'} size={14} />
      </span>
      {message}
    </div>,
    document.body,
  )
}
