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
  isPending,
  sortForms,
} from './lib/data.js'
import { downloadCSV } from './lib/format.js'
import { loadSnapshot, saveSnapshot } from './lib/idb.js'

const EMPTY_META = {
  fetchedAt: new Date().toISOString(),
  periodStart: null,
  periodEnd: null,
  count: 0,
  source: '每刻开放平台 · 报销只读接口',
}

const CHANGE_POLL_INTERVAL_MS = 5 * 60 * 1000

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

function dataScopeForStatus(status) {
  if (status === 'ALL') return 'all'
  if (status === 'PENDING' || isPending(status)) return 'pending'
  return status
}

function statusForScope(scope) {
  if (scope === 'all') return 'ALL'
  if (scope === 'pending') return 'PENDING'
  return scope
}

function countsForScope(scope, forms) {
  const counts = countByStatus(forms)
  delete counts.ALL
  if (scope === 'pending') {
    for (const status of ['APPROVING', 'AUDITING', 'SIGNING', 'SETTLEMENT']) {
      counts[status] = 0
    }
    counts.PENDING = forms.length
  } else if (scope === 'all') {
    counts.ALL = forms.length
    counts.PENDING = forms.filter((form) => isPending(form.formStatus)).length
  } else {
    counts[scope] = forms.filter((form) => form.formStatus === scope).length
  }
  return counts
}

function scopeMatchesForm(scope, form) {
  if (scope === 'all') return true
  if (scope === 'pending') return isPending(form.formStatus)
  return form.formStatus === scope
}

function summarySignature(form) {
  return [
    form?.updatedAt || '',
    form?.formStatus || '',
    form?.approvedAt || '',
    form?.auditedAt || '',
    form?.settledAt || '',
    form?.baseAmount || '',
  ].join('|')
}

function chunkList(items, size) {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

export default function App() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [loadVersion, setLoadVersion] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [knownStatusCounts, setKnownStatusCounts] = useState({})
  const [statusLoading, setStatusLoading] = useState(false)
  const [approverFilter, setApproverFilter] = useState('李婷')
  const [approverIndex, setApproverIndex] = useState({})
  const [approverLoading, setApproverLoading] = useState(false)
  const [approverProgress, setApproverProgress] = useState({ done: 0, total: 0 })
  const [drawerRefreshToken, setDrawerRefreshToken] = useState(0)
  const statusCacheRef = useRef(new Map())
  const statusRequestRef = useRef(0)
  const approverIndexRef = useRef({})
  const approverBuildRef = useRef({ loaded: false, inFlight: false, requestId: 0 })
  const currentStatusRef = useRef('PENDING')
  const statusLoadingRef = useRef(false)
  const selectedFormRef = useRef(null)
  const lastChangePollRef = useRef(Date.now())
  const pollBusyRef = useRef(false)
  const pollHandlerRef = useRef(null)
  const detailCacheRef = useRef(new Map())
  const persistTimerRef = useRef(null)
  const hydratedRef = useRef(false)

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

  function persistNow() {
    if (!statusCacheRef.current.size) return
    const scopes = [...statusCacheRef.current.entries()].map(([key, payload]) => ({
      key,
      meta: payload.meta,
      forms: payload.forms,
    }))
    const details = [...detailCacheRef.current.entries()].map(([formCode, entry]) => ({
      formCode,
      signature: entry.signature,
      detail: entry.detail,
    }))
    saveSnapshot({
      scopes,
      approverIndex: approverIndexRef.current,
      approverLoaded: approverBuildRef.current.loaded,
      details,
      lastChangePoll: lastChangePollRef.current,
    }).catch(() => {
      // IndexedDB 不可用时继续使用当前页面数据，不阻塞业务。
    })
  }

  function schedulePersist() {
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current)
    persistTimerRef.current = window.setTimeout(persistNow, 250)
  }

  useEffect(() => {
    const flush = () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current)
      persistNow()
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [])

  function restoreSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.scopes)) return false
    const scopes = new Map()
    for (const record of snapshot.scopes) {
      if (!record?.key || !Array.isArray(record.forms)) continue
      scopes.set(record.key, {
        meta: record.meta || EMPTY_META,
        forms: record.forms,
      })
    }
    const pending = scopes.get('pending')
    const primaryKey = pending
      ? 'pending'
      : scopes.has('all')
        ? 'all'
        : scopes.keys().next().value
    const primary = primaryKey ? scopes.get(primaryKey) : null
    if (!primary) return false

    statusCacheRef.current = scopes
    const restoredCounts = {}
    for (const [key, payload] of scopes) {
      Object.assign(restoredCounts, countsForScope(key, payload.forms))
    }
    setKnownStatusCounts(restoredCounts)
    setStatusFilter(statusForScope(primaryKey))
    setTypeFilter('ALL')
    setQuery('')
    setApproverFilter('李婷')

    const index = snapshot.approverIndex || {}
    approverIndexRef.current = index
    setApproverIndex(index)
    const loaded = Boolean(snapshot.approverLoaded)
    approverBuildRef.current = {
      loaded,
      inFlight: false,
      requestId: approverBuildRef.current.requestId + 1,
    }
    setApproverLoading(
      !loaded && primaryKey === 'pending' && primary.forms.length > 0,
    )
    setApproverProgress({
      done: 0,
      total: primaryKey === 'pending' ? primary.forms.length : 0,
    })

    const details = new Map()
    for (const entry of snapshot.details || []) {
      if (entry?.formCode && entry.detail) {
        details.set(entry.formCode, {
          detail: entry.detail,
          signature: entry.signature,
        })
      }
    }
    detailCacheRef.current = details

    lastChangePollRef.current =
      snapshot.lastChangePoll ||
      Date.parse(primary.meta?.fetchedAt) ||
      Date.now()
    hydratedRef.current = true
    setData(primary)
    setLoading(false)
    setLoadError('')
    return true
  }

  async function requestApproverEntries(codes) {
    const entries = {}
    for (const chunk of chunkList(codes, 20)) {
      const response = await fetch('/api/approver-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formCodes: chunk }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.message || body.error || '审批人同步失败')
      }
      Object.assign(entries, body.index || {})
    }

    const forms = new Map()
    for (const payload of statusCacheRef.current.values()) {
      for (const form of payload.forms) forms.set(form.formCode, form)
    }
    for (const code of Object.keys(entries)) {
      const form = forms.get(code)
      const entry = entries[code]
      if (form && entry && !entry.error && !entry.missing) {
        entries[code] = { ...entry, signature: summarySignature(form) }
      }
    }
    return entries
  }

  async function buildApproverIndex(forms) {
    if (approverBuildRef.current.inFlight) return
    const codes = [...new Set(forms.map((form) => form.formCode).filter(Boolean))]
    const buildId = approverBuildRef.current.requestId + 1
    approverBuildRef.current = {
      ...approverBuildRef.current,
      inFlight: true,
      requestId: buildId,
    }
    setApproverLoading(true)
    setApproverProgress({ done: 0, total: codes.length })

    try {
      let done = 0
      for (const chunk of chunkList(codes, 20)) {
        if (buildId !== approverBuildRef.current.requestId) return
        const entries = await requestApproverEntries(chunk)
        if (buildId !== approverBuildRef.current.requestId) return
        approverIndexRef.current = {
          ...approverIndexRef.current,
          ...entries,
        }
        setApproverIndex(approverIndexRef.current)
        done += chunk.length
        setApproverProgress({ done, total: codes.length })
        schedulePersist()
      }
      if (buildId === approverBuildRef.current.requestId) {
        // 构建期间可能刚好有增量数据进入待处理，补一次缺失项。
        const pendingCache = statusCacheRef.current.get('pending')
        const missing = (pendingCache?.forms || [])
          .filter((form) => {
            if (!form.formCode) return false
            const entry = approverIndexRef.current[form.formCode]
            return !entry || !entry.signature
          })
          .map((form) => form.formCode)
        if (missing.length) {
          const extra = await requestApproverEntries([...new Set(missing)])
          approverIndexRef.current = {
            ...approverIndexRef.current,
            ...extra,
          }
          setApproverIndex(approverIndexRef.current)
        }
        approverBuildRef.current.loaded = true
        schedulePersist()
      }
    } catch (error) {
      if (buildId === approverBuildRef.current.requestId) {
        showToast(error.message || '审批人同步失败', 'error')
      }
    } finally {
      if (buildId === approverBuildRef.current.requestId) {
        approverBuildRef.current.inFlight = false
        setApproverLoading(false)
      }
    }
  }

  async function refreshApproverEntries(codes) {
    if (!approverBuildRef.current.loaded || !codes.length) return
    try {
      const entries = await requestApproverEntries([...new Set(codes)])
      approverIndexRef.current = {
        ...approverIndexRef.current,
        ...entries,
      }
      setApproverIndex(approverIndexRef.current)
      schedulePersist()
    } catch {
      // 增量同步失败时保留旧索引，下一次列表变更还会再次尝试。
    }
  }

  async function applyIncomingChanges(changes) {
    const currentScope = dataScopeForStatus(currentStatusRef.current)
    const currentCache = statusCacheRef.current.get(currentScope)
    if (!currentCache) return

    const formMap = new Map(currentCache.forms.map((form) => [form.formCode, form]))
    let currentChanged = false

    for (const change of changes) {
      if (!change?.formCode) continue
      const previous = formMap.get(change.formCode)
      const belongs = scopeMatchesForm(currentScope, change)
      const changed = previous
        ? summarySignature(previous) !== summarySignature(change)
        : belongs

      if (belongs && changed) {
        formMap.set(change.formCode, change)
        currentChanged = true
      } else if (!belongs && previous) {
        formMap.delete(change.formCode)
        currentChanged = true
      }
    }

    const nextForms = currentChanged
      ? [...formMap.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      : currentCache.forms
    const nextPayload = currentChanged
      ? {
          ...currentCache,
          meta: {
            ...currentCache.meta,
            count: nextForms.length,
            fetchedAt: new Date().toISOString(),
          },
          forms: nextForms,
        }
      : currentCache

    // 其它状态缓存可能已过期，统一丢弃，下次点击 tab 时重新加载。
    statusCacheRef.current = new Map([[currentScope, nextPayload]])
    setKnownStatusCounts(countsForScope(currentScope, nextForms))
    if (currentChanged) setData(nextPayload)

    const invalidatedDetailCodes = []
    for (const form of changes) {
      const cached = detailCacheRef.current.get(form.formCode)
      if (cached && cached.signature !== summarySignature(form)) {
        detailCacheRef.current.delete(form.formCode)
        invalidatedDetailCodes.push(form.formCode)
      }
    }
    if (
      selectedFormRef.current &&
      invalidatedDetailCodes.includes(selectedFormRef.current)
    ) {
      setDrawerRefreshToken((value) => value + 1)
    }

    if (approverBuildRef.current.loaded) {
      let removed = false
      for (const form of changes) {
        if (!isPending(form.formStatus) && approverIndexRef.current[form.formCode]) {
          delete approverIndexRef.current[form.formCode]
          removed = true
        }
      }
      if (removed) setApproverIndex({ ...approverIndexRef.current })

      const refreshCodes = changes
        .filter((form) => isPending(form.formStatus))
        .filter((form) => {
          const entry = approverIndexRef.current[form.formCode]
          return (
            !entry ||
            !entry.signature ||
            entry.signature !== summarySignature(form)
          )
        })
        .map((form) => form.formCode)
      if (refreshCodes.length) void refreshApproverEntries(refreshCodes)
    }

    schedulePersist()
  }
  pollHandlerRef.current = applyIncomingChanges

  useEffect(() => {
    if (!data) return undefined
    let stopped = false

    const tick = async () => {
      if (
        stopped ||
        document.visibilityState === 'hidden' ||
        pollBusyRef.current ||
        statusLoadingRef.current
      ) {
        return
      }
      pollBusyRef.current = true
      try {
        const response = await fetch(
          `/api/forms/changes?since=${lastChangePollRef.current}`,
        )
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.message || '增量同步失败')
        lastChangePollRef.current = Date.parse(body.serverTime) || Date.now()
        if (body.forms?.length) {
          await pollHandlerRef.current?.(body.forms)
        }
      } catch {
        // 增量同步是后台维护，失败时保留当前数据，下个周期继续尝试。
      } finally {
        pollBusyRef.current = false
      }
    }

    const timer = window.setInterval(tick, CHANGE_POLL_INTERVAL_MS)
    void tick()
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [Boolean(data), loadVersion])

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    setLoading(true)
    setLoadError('')

    async function boot() {
      try {
        const snapshot = await loadSnapshot()
        if (!cancelled && restoreSnapshot(snapshot)) return
      } catch {
        // IndexedDB 不可用时回退到实时接口。
      }

      try {
        const response = await fetch('/api/bootstrap', { signal: controller.signal })
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.message || body.error || '数据读取失败')
        if (cancelled) return

        const payload = { meta: body.meta, forms: body.forms || [] }
        // 首屏只加载「待处理」；其它状态 tab 点击时再拉取。
        statusCacheRef.current = new Map([['pending', payload]])
        setKnownStatusCounts(countsForScope('pending', payload.forms))
        setStatusFilter('PENDING')
        setApproverFilter('李婷')
        setApproverIndex({})
        approverIndexRef.current = {}
        approverBuildRef.current = {
          loaded: false,
          inFlight: false,
          requestId: approverBuildRef.current.requestId + 1,
        }
        setApproverLoading(payload.forms.length > 0)
        setApproverProgress({ done: 0, total: payload.forms.length })
        lastChangePollRef.current = Date.parse(body.meta?.fetchedAt) || Date.now()
        setData(payload)
        setLoading(false)
        schedulePersist()
      } catch (error) {
        if (cancelled || error.name === 'AbortError') return
        setLoadError(error.message || '数据读取失败')
        setLoading(false)
      }
    }

    void boot()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [loadVersion])

  useEffect(() => {
    if (!data || activePage !== 'documents') return
    if (dataScopeForStatus(statusFilter) !== 'pending') return
    const missing = data.forms
      .filter((form) => {
        if (!form.formCode) return false
        const entry = approverIndexRef.current[form.formCode]
        return (
          !entry ||
          !entry.signature ||
          entry.signature !== summarySignature(form)
        )
      })
      .map((form) => form.formCode)
    if (approverBuildRef.current.loaded) {
      if (missing.length) {
        setApproverLoading(true)
        void refreshApproverEntries(missing).finally(() => setApproverLoading(false))
      }
      return
    }
    if (approverBuildRef.current.inFlight) return
    void buildApproverIndex(data.forms)
  }, [data, activePage, statusFilter])

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
  }, [typeFilter, statusFilter, query, approverFilter])

  useEffect(() => {
    currentStatusRef.current = statusFilter
  }, [statusFilter])

  useEffect(() => {
    statusLoadingRef.current = statusLoading
  }, [statusLoading])

  useEffect(() => {
    selectedFormRef.current = selectedForm?.formCode || null
  }, [selectedForm])

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
  const isPendingView = dataScopeForStatus(statusFilter) === 'pending'
  const filteredForms = useMemo(() => {
    let rows = filterForms(typeScopedForms, {
      status: statusFilter,
      query,
    })
    if (
      isPendingView &&
      approverFilter !== 'ALL' &&
      approverBuildRef.current.loaded
    ) {
      rows = rows.filter((form) =>
        (approverIndex[form.formCode]?.approvers || []).includes(approverFilter),
      )
    }
    return sortForms(rows, 'newest')
  }, [
    typeScopedForms,
    statusFilter,
    query,
    isPendingView,
    approverFilter,
    approverIndex,
    approverLoading,
  ])
  const filteredAmount = useMemo(
    () => filteredForms.reduce((sum, form) => sum + (form.baseAmount || 0), 0),
    [filteredForms],
  )
  const approverOptions = useMemo(() => {
    const names = new Set(['李婷'])
    for (const entry of Object.values(approverIndex)) {
      for (const name of entry?.approvers || []) names.add(name)
    }
    return [...names].sort((a, b) => {
      if (a === '李婷') return -1
      if (b === '李婷') return 1
      return a.localeCompare(b, 'zh-CN')
    })
  }, [approverIndex])

  useEffect(() => {
    if (!isPendingView) return
    if (approverFilter !== 'ALL' && !approverOptions.includes(approverFilter)) {
      setApproverFilter('李婷')
    }
  }, [approverFilter, approverOptions, isPendingView])

  function openForm(form) {
    setSelectedForm(form)
    const url = new URL(window.location.href)
    url.searchParams.set('form', form.formCode)
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }

  function rememberDetail(detail) {
    if (!selectedForm || !detail) return
    detailCacheRef.current.set(selectedForm.formCode, {
      detail,
      signature: summarySignature(selectedForm),
    })
    schedulePersist()
  }

  let selectedCachedDetail = null
  if (selectedForm) {
    const entry = detailCacheRef.current.get(selectedForm.formCode)
    if (entry && entry.signature === summarySignature(selectedForm)) {
      selectedCachedDetail = entry.detail
    }
  }

  async function changeStatus(nextStatus) {
    if (!nextStatus) return
    const scope = dataScopeForStatus(nextStatus)
    const previousStatus = statusFilter
    const requestId = ++statusRequestRef.current
    let cached = statusCacheRef.current.get(scope)

    // 已经加载过「全部」时，所有状态都能从这份数据直接派生，不再重复请求。
    if (!cached && scope !== 'all') {
      const allData = statusCacheRef.current.get('all')
      if (allData) {
        const forms =
          scope === 'pending'
            ? allData.forms.filter((form) => isPending(form.formStatus))
            : allData.forms.filter((form) => form.formStatus === scope)
        cached = { meta: allData.meta, forms }
        statusCacheRef.current.set(scope, cached)
      }
    }

    if (scope === 'pending' && !approverBuildRef.current.loaded) {
      setApproverLoading(true)
    }

    if (cached) {
      setStatusLoading(false)
      setStatusFilter(nextStatus)
      setKnownStatusCounts((prev) => ({
        ...prev,
        ...countsForScope(scope, cached.forms),
      }))
      setData(cached)
      setPage(1)
      schedulePersist()
      return
    }

    setStatusFilter(nextStatus)
    setStatusLoading(true)
    try {
      const response = await fetch(
        `/api/forms/query?scope=${encodeURIComponent(scope)}`,
      )
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.message || body.error || '列表数据读取失败')
      }
      if (requestId !== statusRequestRef.current) return

      const payload = { meta: body.meta, forms: body.forms || [] }
      statusCacheRef.current.set(scope, payload)
      setKnownStatusCounts((prev) => ({
        ...prev,
        ...countsForScope(scope, payload.forms),
      }))
      setData(payload)
      setPage(1)
      schedulePersist()

      if (scope === 'pending' && approverBuildRef.current.loaded) {
        const missing = payload.forms
          .filter((form) => form.formCode && !approverIndexRef.current[form.formCode])
          .map((form) => form.formCode)
        if (missing.length) void refreshApproverEntries(missing)
      }
    } catch (error) {
      if (requestId !== statusRequestRef.current) return
      setStatusFilter(previousStatus)
      showToast(error.message || '列表加载失败，请稍后再试', 'error')
    } finally {
      if (requestId === statusRequestRef.current) setStatusLoading(false)
    }
  }

  function handleTypeChange(next) {
    setTypeFilter(next)
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
    setQuery(departmentName)
    setPage(1)
    navigate('documents')
    if (statusFilter !== 'PENDING') void changeStatus('PENDING')
  }

  function resetFilters() {
    setTypeFilter('ALL')
    setQuery('')
    setApproverFilter('李婷')
    setPage(1)
    if (statusFilter !== 'PENDING') void changeStatus('PENDING')
  }

  async function handleRefresh() {
    if (refreshing) return
    const scope = dataScopeForStatus(statusFilter)
    statusRequestRef.current += 1
    setStatusLoading(false)
    setRefreshing(true)
    try {
      const response = await fetch(
        `/api/forms/query?scope=${encodeURIComponent(scope)}`,
      )
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || body.error || '同步失败')

      const payload = { meta: body.meta, forms: body.forms || [] }
      // 手动刷新后只保留当前范围的缓存，其它 tab 下次点击时重新拉取。
      statusCacheRef.current = new Map([[scope, payload]])
      setKnownStatusCounts(countsForScope(scope, payload.forms))
      lastChangePollRef.current = Date.now()

      approverBuildRef.current = {
        loaded: false,
        inFlight: false,
        requestId: approverBuildRef.current.requestId + 1,
      }
      approverIndexRef.current = {}
      setApproverIndex({})
      setApproverLoading(scope === 'pending' && payload.forms.length > 0)
      setApproverProgress({ done: 0, total: payload.forms.length })

      setData(payload)
      schedulePersist()
      showToast(`数据已同步 · ${payload.forms.length} 笔单据`)
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

  const tableLoading = statusLoading || (isPendingView && approverLoading)
  const tableLoadingText = statusLoading
    ? '正在加载当前状态的数据…'
    : approverLoading
      ? `正在同步审批人 ${approverProgress.done}/${approverProgress.total || '—'}…`
      : '正在加载数据…'

  const tableProps = {
    forms: filteredForms,
    loading: tableLoading,
    loadingText: tableLoadingText,
    query,
    onQueryChange: setQuery,
    statusFilter,
    statusCounts: knownStatusCounts,
    onStatusChange: changeStatus,
    showApproverFilter: isPendingView,
    approverFilter,
    approverOptions,
    onApproverChange: setApproverFilter,
    approverDisabled: approverLoading,
    typeFilter,
    onTypeChange: handleTypeChange,
    page,
    onPageChange: setPage,
    onOpenForm: openForm,
    onResetFilters: resetFilters,
    hasFilters:
      query.trim().length > 0 ||
      statusFilter !== 'PENDING' ||
      typeFilter !== 'ALL' ||
      (isPendingView && approverFilter !== '李婷'),
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
          cachedDetail={selectedCachedDetail}
          refreshToken={drawerRefreshToken}
          onDetailLoaded={rememberDetail}
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
