import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Sidebar, Topbar, LoadingScreen, ErrorScreen } from './components/Shell.jsx'
import { OverviewPage } from './components/Overview.jsx'
import { DepartmentsPage } from './components/DepartmentsPage.jsx'
import { DocumentsPage } from './components/DocumentsPage.jsx'
import { DetailDrawer } from './components/DetailDrawer.jsx'
import { PolicyModal, DataModal, Toast } from './components/Modals.jsx'
import {
  TYPE_META,
  buildMetrics,
  statusCounts as countByStatus,
  filterByType,
  filterForms,
  sortForms,
} from './lib/data.js'
import { downloadCSV } from './lib/format.js'

const EMPTY_META = {
  fetchedAt: new Date().toISOString(),
  periodStart: null,
  periodEnd: null,
  count: 0,
  source: '每刻开放平台 · 报销只读接口',
}

const PAGE_META = {
  overview: { label: '数据总览', path: '/overview' },
  departments: { label: '部门洞察', path: '/departments' },
  documents: { label: '报销单据', path: '/documents' },
}

function pageFromPath(pathname = window.location.pathname) {
  const normalized = (pathname || '/').replace(/\/+$/, '') || '/'
  if (normalized.endsWith('/departments')) return 'departments'
  if (normalized.endsWith('/documents')) return 'documents'
  return 'overview'
}

export default function App() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [loadVersion, setLoadVersion] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [departmentFilter, setDepartmentFilter] = useState('ALL')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)

  const [selectedForm, setSelectedForm] = useState(null)
  const [modal, setModal] = useState(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [activePage, setActivePage] = useState(() => pageFromPath())
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)
  const restoredDeepLink = useRef(false)

  const meta = data?.meta || EMPTY_META
  const forms = data?.forms || []

  const showToast = useCallback((message, tone = 'success') => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast({ message, tone, id: Date.now() })
    toastTimer.current = window.setTimeout(() => setToast(null), 2800)
  }, [])

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')
    fetch('/api/bootstrap', { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.message || body.error || '数据读取失败')
        return body
      })
      .then((body) => {
        setData({ meta: body.meta, forms: body.forms || [] })
        setLoading(false)
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setLoadError(error.message || '数据读取失败')
        setLoading(false)
      })
    return () => controller.abort()
  }, [loadVersion])

  useEffect(() => {
    if (!data || restoredDeepLink.current) return
    restoredDeepLink.current = true
    const code = new URLSearchParams(window.location.search).get('form')
    if (!code) return
    const found = data.forms.find((form) => form.formCode === code)
    if (found) setSelectedForm(found)
  }, [data])

  useEffect(() => {
    const knownPath = Object.values(PAGE_META).some((page) =>
      window.location.pathname.endsWith(page.path),
    )
    if (!knownPath) {
      window.history.replaceState(
        {},
        '',
        `${PAGE_META[pageFromPath()].path}${window.location.search}`,
      )
    }
  }, [])

  useEffect(() => {
    document.title = `${PAGE_META[activePage].label} · 傲举财务`
  }, [activePage])

  useEffect(() => {
    function onPopState() {
      setActivePage(pageFromPath())
      setSelectedForm(null)
      setModal(null)
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    setPage(1)
  }, [typeFilter, statusFilter, departmentFilter, query, sort])

  useEffect(() => {
    const locked = Boolean(selectedForm || modal)
    if (locked) document.body.classList.add('has-overlay')
    else document.body.classList.remove('has-overlay')
    return () => document.body.classList.remove('has-overlay')
  }, [selectedForm, modal])

  const closeDrawer = useCallback(() => {
    setSelectedForm(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('form')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }, [])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key !== 'Escape') return
      if (modal) setModal(null)
      else if (selectedForm) closeDrawer()
      else if (mobileNav) setMobileNav(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [modal, selectedForm, mobileNav, closeDrawer])

  const typeScopedForms = useMemo(() => filterByType(forms, typeFilter), [forms, typeFilter])
  const metrics = useMemo(() => buildMetrics(typeScopedForms, meta), [typeScopedForms, meta])
  const counts = useMemo(() => {
    const base = countByStatus(typeScopedForms)
    base.PENDING = typeScopedForms.filter((form) =>
      ['APPROVING', 'AUDITING', 'SIGNING', 'SETTLEMENT'].includes(form.formStatus),
    ).length
    return base
  }, [typeScopedForms])
  const departments = useMemo(
    () =>
      [...new Set(typeScopedForms.map((form) => form.departmentName || '未分配部门'))].sort(
        (a, b) => a.localeCompare(b, 'zh-CN'),
      ),
    [typeScopedForms],
  )
  const filteredForms = useMemo(
    () =>
      sortForms(
        filterForms(typeScopedForms, {
          status: statusFilter,
          department: departmentFilter,
          query,
        }),
        sort,
      ),
    [typeScopedForms, statusFilter, departmentFilter, query, sort],
  )
  const filteredAmount = useMemo(
    () => filteredForms.reduce((sum, form) => sum + (form.baseAmount || 0), 0),
    [filteredForms],
  )

  function openForm(form) {
    setSelectedForm(form)
    const url = new URL(window.location.href)
    url.searchParams.set('form', form.formCode)
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }

  function handleTypeChange(next) {
    setTypeFilter(next)
    setStatusFilter('ALL')
    setDepartmentFilter('ALL')
    setQuery('')
    setSort('newest')
    setPage(1)
  }

  function navigate(nextPage) {
    const targetPage = PAGE_META[nextPage] ? nextPage : 'overview'
    const { path } = PAGE_META[targetPage]

    setSelectedForm(null)
    setModal(null)
    setMobileNav(false)

    if (targetPage !== activePage) {
      window.history.pushState({ page: targetPage }, '', path)
      setActivePage(targetPage)
    } else if (window.location.search) {
      window.history.replaceState({}, '', path)
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }

  function openDepartment(departmentName) {
    setStatusFilter('ALL')
    setDepartmentFilter(departmentName)
    setQuery('')
    setSort('newest')
    setPage(1)
    navigate('documents')
  }

  function resetFilters() {
    setStatusFilter('ALL')
    setDepartmentFilter('ALL')
    setQuery('')
    setSort('newest')
    setPage(1)
  }

  async function handleRefresh() {
    if (refreshing) return
    setRefreshing(true)
    try {
      const response = await fetch('/api/refresh', { method: 'POST' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || body.error || '同步失败')
      setData({ meta: body.meta, forms: body.forms || [] })
      showToast(`数据已同步 · ${(body.forms || []).length} 笔单据`)
    } catch (error) {
      showToast(error.message || '同步失败，请稍后再试', 'error')
    } finally {
      setRefreshing(false)
    }
  }

  function handleExport(rows = filteredForms) {
    if (!rows.length) {
      showToast('当前视图没有可导出的单据', 'error')
      return
    }
    const typeName =
      typeFilter === 'ALL' ? '全部单据' : TYPE_META[typeFilter]?.label || '报销单据'
    const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })
    downloadCSV(`${typeName}_${date}.csv`, rows)
    showToast(`已导出 ${rows.length} 条单据`)
  }

  if (loading) return <LoadingScreen />
  if (loadError) {
    return (
      <ErrorScreen
        message={loadError}
        onRetry={() => setLoadVersion((version) => version + 1)}
      />
    )
  }
  if (!data) return <LoadingScreen />

  const activeTypeLabel =
    typeFilter === 'ALL' ? '全部单据' : TYPE_META[typeFilter]?.label || '全部单据'

  const tableProps = {
    forms: filteredForms,
    totalForms: counts.ALL || 0,
    pendingCount: counts.PENDING || 0,
    query,
    onQueryChange: setQuery,
    statusFilter,
    statusCounts: counts,
    onStatusChange: setStatusFilter,
    departmentFilter,
    departments,
    onDepartmentChange: setDepartmentFilter,
    sort,
    onSortChange: setSort,
    page,
    onPageChange: setPage,
    onOpenForm: openForm,
    onResetFilters: resetFilters,
    hasFilters:
      query.trim().length > 0 || statusFilter !== 'ALL' || departmentFilter !== 'ALL',
    activeTypeLabel,
  }

  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        onNavigate={navigate}
        onOpenRules={() => setModal('policy')}
        onOpenData={() => setModal('data')}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        meta={meta}
        count={forms.length}
        mobileOpen={mobileNav}
        onCloseMobile={() => setMobileNav(false)}
      />
      <div
        className={`mobile-nav-backdrop ${mobileNav ? 'is-visible' : ''}`}
        onClick={() => setMobileNav(false)}
        aria-hidden="true"
      />

      <div className="page">
        <Topbar
          meta={meta}
          pageLabel={PAGE_META[activePage].label}
          onOpenMobile={() => setMobileNav(true)}
          dataModal={() => setModal('data')}
        />

        <main className="main">
          <div className={`route-view route-${activePage}`} key={activePage}>
            {activePage === 'overview' && (
              <OverviewPage
                meta={meta}
                forms={forms}
                typeFilter={typeFilter}
                onTypeChange={handleTypeChange}
                metrics={metrics}
                onRefresh={handleRefresh}
                refreshing={refreshing}
                onExport={() => handleExport(typeScopedForms)}
              />
            )}

            {activePage === 'departments' && (
              <DepartmentsPage
                allForms={forms}
                typeFilter={typeFilter}
                onTypeChange={handleTypeChange}
                metrics={metrics}
                onOpenDepartment={openDepartment}
              />
            )}

            {activePage === 'documents' && (
              <DocumentsPage
                allForms={forms}
                typeFilter={typeFilter}
                onTypeChange={handleTypeChange}
                filteredCount={filteredForms.length}
                filteredAmount={filteredAmount}
                onExport={() => handleExport(filteredForms)}
                tableProps={tableProps}
              />
            )}
          </div>

          <footer className="page-footer">
            <div className="footer-brand">
              <span className="footer-mark">A</span>
              <div>
                <strong>傲举财务 · 数据视界</strong>
                <span>让每一笔支出都有答案</span>
              </div>
            </div>
            <p>
              数据来自每刻开放平台只读接口。审批提示仅作辅助，最终结论以人工复核为准。
            </p>
            <span className="footer-end">FY 2026 · NOV</span>
          </footer>
        </main>
      </div>

      {selectedForm && (
        <DetailDrawer
          form={selectedForm}
          onClose={closeDrawer}
          onToast={(message) => showToast(message)}
        />
      )}

      {modal === 'policy' && <PolicyModal onClose={() => setModal(null)} />}
      {modal === 'data' && <DataModal meta={meta} onClose={() => setModal(null)} />}
      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  )
}
