import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icons.jsx'
import { getExpenseIcon, getStatusMeta, getTypeMeta } from '../lib/data.js'
import {
  avatarStyle,
  formatDate,
  formatDateTime,
  formatMoney,
  initials,
} from '../lib/format.js'

function StatusChip({ status }) {
  return (
    <span className={`status-chip status-${status.tone}`}>
      <i style={{ background: status.color }} />
      {status.label}
    </span>
  )
}

function TypeBadge({ type }) {
  return (
    <span className="type-badge" style={{ color: type.color, background: type.bg }}>
      <i style={{ background: type.color }} />
      {type.label}
    </span>
  )
}

function SkeletonLine({ width = '100%', height = 12 }) {
  return <span className="skeleton-line" style={{ width, height }} />
}

function DrawerSkeleton() {
  return (
    <div className="drawer-skeleton">
      <div className="skeleton-stats">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="skeleton-stat">
            <SkeletonLine width="55%" height={10} />
            <SkeletonLine width="80%" height={19} />
          </div>
        ))}
      </div>
      {[0, 1, 2].map((item) => (
        <div className="skeleton-expense" key={item}>
          <span className="skeleton-square" />
          <div>
            <SkeletonLine width={`${72 - item * 9}%`} height={13} />
            <SkeletonLine width="50%" height={10} />
          </div>
          <SkeletonLine width={68} height={14} />
        </div>
      ))}
    </div>
  )
}

function ExpenseItem({ expense, open, onToggle }) {
  const invoiceLabel = expense.invoiceCount ? `${expense.invoiceCount} 张发票` : '暂无发票'
  return (
    <li className={`expense-item ${open ? 'is-open' : ''}`}>
      <button type="button" className="expense-main" onClick={onToggle}>
        <span className="expense-icon" data-category={expense.category}>
          <Icon name={getExpenseIcon(expense.category)} size={18} />
        </span>
        <span className="expense-copy">
          <span className="expense-title-row">
            <strong>{expense.type}</strong>
            {expense.viceType && expense.viceType !== expense.type && (
              <em>{expense.viceType}</em>
            )}
          </span>
          <span className="expense-sub">
            <span>{expense.startTime ? formatDate(expense.startTime) : '日期未提供'}</span>
            <i />
            <span>{invoiceLabel}</span>
            {expense.attachmentCount > 0 && (
              <>
                <i />
                <span>{expense.attachmentCount} 个附件</span>
              </>
            )}
          </span>
          {expense.comments && <span className="expense-comment">{expense.comments}</span>}
        </span>
        <span className="expense-amount">¥{formatMoney(expense.amount)}</span>
        <Icon name="chevronDown" size={15} className="expense-chevron" />
      </button>
      {open && (
        <div className="expense-expanded">
          {expense.comments && (
            <div className="expense-note">
              <span>报销备注</span>
              <p>{expense.comments}</p>
            </div>
          )}
          <div className="expense-detail-grid">
            <div>
              <span>票种</span>
              <p>{expense.invoiceTypes.length ? expense.invoiceTypes.join(' · ') : '未返回票种'}</p>
            </div>
            <div>
              <span>核定金额</span>
              <p>¥{formatMoney(expense.approved || expense.amount)}</p>
            </div>
            <div>
              <span>消费地点</span>
              <p>{expense.location || '接口未返回'}</p>
            </div>
          </div>
        </div>
      )}
    </li>
  )
}

function Flags({ flags }) {
  if (!flags?.length) {
    return (
      <div className="flag-ok">
        <span>
          <Icon name="check" size={15} />
        </span>
        <div>
          <strong>金额与基础字段未发现明显异常</strong>
          <p>仍需按制度核对附件、发票原票与特殊报备，系统提示不构成审批结论。</p>
        </div>
      </div>
    )
  }
  return (
    <div className="flag-list">
      {flags.map((flag) => (
        <div key={`${flag.level}-${flag.title}`} className={`flag-item flag-${flag.level}`}>
          <span className="flag-icon">
            <Icon name={flag.level === 'warn' ? 'warning' : 'info'} size={16} />
          </span>
          <div>
            <div className="flag-title-row">
              <strong>{flag.title}</strong>
              <em>{flag.level === 'warn' ? '需关注' : '需确认'}</em>
            </div>
            <p>{flag.detail}</p>
            <span className="flag-rule">依据 · {flag.rule}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function ExpenseSummary({ detail }) {
  const difference = Math.abs((detail.baseAmount || 0) - (detail.expenseTotal || 0))
  const matched = difference <= 0.01
  return (
    <div className="expense-summary-grid">
      <div>
        <span>单据金额</span>
        <strong>¥{formatMoney(detail.baseAmount)}</strong>
      </div>
      <div>
        <span>费用合计</span>
        <strong>¥{formatMoney(detail.expenseTotal)}</strong>
      </div>
      <div>
        <span>费用行</span>
        <strong>{detail.expenseCount} 条</strong>
      </div>
      <div>
        <span>金额校验</span>
        <strong className={matched ? 'is-match' : 'is-diff'}>
          {matched ? '一致' : `差 ¥${formatMoney(difference)}`}
        </strong>
      </div>
    </div>
  )
}

function ExpenseTab({ detail }) {
  const [openIndex, setOpenIndex] = useState(null)
  return (
    <div className="drawer-section">
      <div className="detail-section-title">
        <div>
          <span className="detail-index">01</span>
          <h3>规则初筛</h3>
        </div>
        <span className="detail-caption">
          {detail.flags?.length ? `${detail.flags.length} 项提示` : '未发现明显异常'}
        </span>
      </div>
      <Flags flags={detail.flags} />

      <div className="detail-section-title detail-section-spaced">
        <div>
          <span className="detail-index">02</span>
          <h3>费用构成</h3>
        </div>
        <span className="detail-caption">发票合计 {detail.invoiceTotal} 张</span>
      </div>
      <ExpenseSummary detail={detail} />

      {detail.expenses.length ? (
        <ul className="expense-list">
          {detail.expenses.map((expense, index) => (
            <ExpenseItem
              key={`${expense.type}-${index}`}
              expense={expense}
              open={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </ul>
      ) : (
        <div className="drawer-empty">
          <Icon name="receipt" size={24} />
          <strong>该单据没有返回费用行</strong>
          <p>供应商付款单或零金额单据可能不包含费用明细。</p>
        </div>
      )}
    </div>
  )
}

const FLOW_STATE_META = {
  history: { label: '已处理', tone: 'done' },
  pending: { label: '进行中', tone: 'pending' },
  predict: { label: '待流转', tone: 'predict' },
}

function flowTimeLabel(log) {
  if (log.state === 'pending') return '进行中'
  if (log.state === 'predict') return '待流转'
  return log.optTime ? formatDateTime(log.optTime) : '时间未记录'
}

function flowOperation(log) {
  const text = log.operation || log.operationTypeName || '流程已更新'
  if (log.state === 'history') return text
  return text.replace(/\s*\((审批中|待审批)\)\s*$/u, '').replace(/^待/, '等待 ')
}

function TimelineTab({ detail }) {
  const logs = detail.processLogs || []
  if (!logs.length) {
    return (
      <div className="drawer-section">
        <div className="drawer-empty">
          <Icon name="clock" size={24} />
          <strong>暂时没有审批记录</strong>
          <p>流程节点可能仍在生成，打开每刻可查看更完整的流转信息。</p>
        </div>
      </div>
    )
  }

  const historyCount = logs.filter((log) => log.state === 'history').length
  const pendingCount = logs.filter((log) => log.state === 'pending').length
  const predictCount = logs.filter((log) => log.state === 'predict').length
  const current = logs.find((log) => log.state === 'pending')
  const progress = logs.length ? (historyCount / logs.length) * 100 : 0
  const isActiveForm = ['APPROVING', 'AUDITING', 'SIGNING', 'SETTLEMENT'].includes(
    detail.formStatus,
  )
  const flowNeedsSync = isActiveForm && !current

  return (
    <div className="drawer-section">
      <div className="detail-section-title">
        <div>
          <span className="detail-index">03</span>
          <h3>审批流程</h3>
        </div>
        <span className="detail-caption">
          {historyCount} 已完成 · {pendingCount} 进行中 · {predictCount} 待流转
        </span>
      </div>

      <div className="flow-summary">
        <div className="flow-summary-copy">
          <span className="flow-summary-kicker">
            {current ? 'CURRENT NODE / 当前节点' : 'FLOW STATUS / 流程状态'}
          </span>
          <strong>
            {current?.taskName ||
              (flowNeedsSync ? '等待流程节点同步' : pendingCount === 0 ? '流程已结束' : '流程处理中')}
          </strong>
          <p>
            {current
              ? `候选处理人 · ${current.operators.length ? current.operators.join('、') : '等待分配'}`
              : flowNeedsSync
                ? '单据状态为审批中，流程数据暂未同步到最新节点'
                : predictCount > 0
                  ? `剩余 ${predictCount} 个预演节点`
                  : '全部节点已完成'}
          </p>
        </div>
        <div className="flow-progress">
          <div>
            <span>流程进度</span>
            <strong>
              {historyCount}
              <em> / {logs.length}</em>
            </strong>
          </div>
          <div className="flow-progress-track" aria-hidden="true">
            <i style={{ width: `${Math.max(progress, 2)}%` }} />
          </div>
        </div>
      </div>

      {flowNeedsSync && (
        <div className="flow-sync-note">
          <Icon name="info" size={14} />
          当前单据仍在审批中，但流程接口暂未返回待处理节点。请关闭详情后重新打开，或稍后再试。
        </div>
      )}

      <ol className="timeline timeline-full">
        {logs.map((log, index) => {
          const state = log.state || 'history'
          const stateMeta = FLOW_STATE_META[state] || FLOW_STATE_META.history
          return (
            <li
              key={`${log.taskName}-${log.state}-${log.optTime || index}-${index}`}
              className={`timeline-item flow-${state}`}
            >
              <span className="timeline-marker">
                <i />
              </span>
              <div className="timeline-content">
                <div className="timeline-top">
                  <div className="timeline-title-group">
                    <strong>{log.taskName}</strong>
                    <span className={`flow-state flow-state-${stateMeta.tone}`}>
                      {stateMeta.label}
                    </span>
                  </div>
                  <span className={`timeline-time ${state !== 'history' ? 'is-future' : ''}`}>
                    {flowTimeLabel(log)}
                  </span>
                </div>
                <p>{flowOperation(log)}</p>
                {log.reason && <blockquote>{log.reason}</blockquote>}
                <div className="timeline-people">
                  <span className="timeline-people-label">
                    {state === 'history' ? '操作人' : '候选处理人'}
                  </span>
                  <div className="timeline-people-list">
                    {(log.operators.length ? log.operators : ['待分配']).map((name) => (
                      <span className="flow-person" key={name}>
                        <span className="flow-person-avatar" style={avatarStyle(name)}>
                          {initials(name)}
                        </span>
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
                {log.nextOperators.length > 0 && (
                  <div className="timeline-foot">
                    <span>下一处理人 · {log.nextOperators.join('、')}</span>
                  </div>
                )}
                {state === 'predict' && (
                  <p className="flow-predict-note">预演节点，实际处理人可能随流程变化。</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function InfoCell({ label, children, wide = false }) {
  return (
    <div className={`info-cell ${wide ? 'is-wide' : ''}`}>
      <span>{label}</span>
      <strong>{children || '—'}</strong>
    </div>
  )
}

function InfoTab({ detail }) {
  const project = detail.project || {}
  return (
    <div className="drawer-section">
      <div className="detail-section-title">
        <div>
          <span className="detail-index">04</span>
          <h3>单据信息</h3>
        </div>
      </div>
      <div className="info-grid">
        <InfoCell label="单据编号">{detail.formCode}</InfoCell>
        <InfoCell label="单据小类">{detail.formSubTypeName}</InfoCell>
        <InfoCell label="承担人">{detail.coverEmployeeName}</InfoCell>
        <InfoCell label="填单人">{detail.fillEmployeeName}</InfoCell>
        <InfoCell label="提交部门">{detail.departmentName}</InfoCell>
        <InfoCell label="公司主体">{detail.legalEntityName}</InfoCell>
        <InfoCell label="创建时间">{formatDateTime(detail.createdAt)}</InfoCell>
        <InfoCell label="提交时间">{formatDateTime(detail.submittedAt)}</InfoCell>
        <InfoCell label="审批完成">{formatDateTime(detail.approvedAt)}</InfoCell>
        <InfoCell label="支付时间">{formatDateTime(detail.settledAt)}</InfoCell>
      </div>

      <div className="detail-section-title detail-section-spaced">
        <div>
          <span className="detail-index">05</span>
          <h3>项目关联</h3>
        </div>
      </div>
      <div className="info-grid">
        <InfoCell label="项目名称" wide>
          {project.name}
        </InfoCell>
        <InfoCell label="客户">{project.customer}</InfoCell>
        <InfoCell label="项目类型">{project.projectType}</InfoCell>
        <InfoCell label="课程周期">
          {project.courseStart || project.courseEnd
            ? `${project.courseStart || '—'} → ${project.courseEnd || '—'}`
            : '—'}
        </InfoCell>
        <InfoCell label="项目负责人">{project.owner}</InfoCell>
        <InfoCell label="项目成员" wide>
          {project.members}
        </InfoCell>
        <InfoCell label="订单号">{project.orderNo}</InfoCell>
      </div>

      <div className="detail-section-title detail-section-spaced">
        <div>
          <span className="detail-index">06</span>
          <h3>收款信息</h3>
        </div>
      </div>
      <div className="info-grid">
        <InfoCell label="收款人">{detail.payee?.name}</InfoCell>
        <InfoCell label="开户行">{detail.payee?.bankName}</InfoCell>
        <InfoCell label="收款账号" wide>
          {detail.payee?.accountMasked || '—'}
        </InfoCell>
      </div>
      <div className="privacy-note">
        <Icon name="shield" size={14} />
        为保护账户安全，完整银行卡号不在本页展示。
      </div>
    </div>
  )
}

export function DetailDrawer({ form, onClose, onToast }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('expenses')
  const [retryKey, setRetryKey] = useState(0)
  const closeRef = useRef(null)
  const bodyRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    let mounted = true
    setLoading(true)
    setError('')
    setDetail(null)
    setTab('expenses')

    fetch(`/api/forms/${encodeURIComponent(form.formCode)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.message || '详情读取失败')
        return body
      })
      .then((body) => {
        if (!mounted) return
        setDetail(body)
        setLoading(false)
      })
      .catch((err) => {
        if (!mounted || err.name === 'AbortError') return
        setError(err.message || '详情读取失败')
        setLoading(false)
      })

    return () => {
      mounted = false
      controller.abort()
    }
  }, [form.formCode, retryKey])

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }, [form.formCode, tab])

  const status = getStatusMeta((detail || form).formStatus)
  const type = getTypeMeta((detail || form).formSubTypeName)
  const active = detail || form
  const displayName = detail?.formName || form.formName
  const flagCount = detail?.flags?.length || 0
  const tabs = useMemo(
    () => [
      { key: 'expenses', label: '费用明细', count: detail?.expenseCount, alert: flagCount > 0 },
      { key: 'timeline', label: '审批流程', count: detail?.processLogs?.length },
      { key: 'info', label: '基本信息' },
    ],
    [detail, flagCount],
  )

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(form.formCode)
      onToast?.('单据编号已复制')
    } catch {
      onToast?.('复制失败，请手动选择单号')
    }
  }

  return createPortal(
    <div className="drawer-layer">
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside
        className="detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        <header className="drawer-header">
          <div className="drawer-topline">
            <span className="drawer-kicker">
              <Icon name="receipt" size={14} />
              REIMBURSEMENT / 单据详情
            </span>
            <div className="drawer-top-actions">
              <span className="drawer-readonly">
                <Icon name="shield" size={12} />
                只读
              </span>
              <button
                type="button"
                className="icon-button drawer-close"
                onClick={onClose}
                ref={closeRef}
                aria-label="关闭单据详情"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          </div>

          <div className="drawer-code-row">
            <span className="drawer-code">{form.formCode}</span>
            <button type="button" className="copy-button" onClick={copyCode} aria-label="复制单据编号">
              <Icon name="copy" size={13} />
              复制
            </button>
            <StatusChip status={status} />
          </div>

          <h2 id="drawer-title">{displayName}</h2>

          <div className="drawer-amount-row">
            <div className="drawer-amount">
              <span>单据金额</span>
              <strong>
                <em>¥</em>
                {formatMoney(active.baseAmount)}
              </strong>
            </div>
            <TypeBadge type={type} />
          </div>

          <div className="drawer-person-row">
            <span className="avatar avatar-small" style={avatarStyle(active.coverEmployeeName)}>
              {initials(active.coverEmployeeName)}
            </span>
            <span className="drawer-person-name">{active.coverEmployeeName}</span>
            <i />
            <span>{active.departmentName}</span>
            <i />
            <span>{formatDateTime(active.submittedAt || active.createdAt)}</span>
          </div>
        </header>

        <nav className="drawer-tabs" aria-label="单据详情分页">
          {tabs.map((item) => (
            <button
              type="button"
              key={item.key}
              className={tab === item.key ? 'is-active' : ''}
              onClick={() => setTab(item.key)}
            >
              {item.label}
              {typeof item.count === 'number' && <em>{item.count}</em>}
              {item.alert && <i className="tab-alert" />}
            </button>
          ))}
        </nav>

        <div className="drawer-body" ref={bodyRef}>
          {loading && <DrawerSkeleton />}
          {!loading && error && (
            <div className="drawer-error">
              <span className="error-icon">
                <Icon name="warning" size={22} />
              </span>
              <h3>单据详情没有读取成功</h3>
              <p>{error}</p>
              <button
                type="button"
                className="button button-primary button-small"
                onClick={() => setRetryKey((value) => value + 1)}
              >
                <Icon name="refresh" size={14} />
                重新读取
              </button>
            </div>
          )}
          {!loading && !error && detail && (
            <>
              {tab === 'expenses' && <ExpenseTab detail={detail} />}
              {tab === 'timeline' && <TimelineTab detail={detail} />}
              {tab === 'info' && <InfoTab detail={detail} />}
            </>
          )}
        </div>

        <footer className="drawer-footer">
          <span>
            <i className="footer-live-dot" />
            每刻只读数据 · 实时读取
          </span>
          <button type="button" className="button button-ghost button-small" onClick={onClose}>
            关闭
          </button>
        </footer>
      </aside>
    </div>,
    document.body,
  )
}
