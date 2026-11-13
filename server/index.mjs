import express from 'express'
import path from 'node:path'
import { access } from 'node:fs/promises'
import process from 'node:process'
import { getFormDetail, getFreshForms, paths } from './data.mjs'

const PORT = Number(process.env.PORT) || 3001
const DIST = path.join(paths.root, 'dist')
const app = express()

app.disable('x-powered-by')
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'same-origin')
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store')
  next()
})

let refreshing = null

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() })
})

app.get('/api/bootstrap', async (req, res) => {
  try {
    // 每次都从每刻实时读取；不读取本地快照。
    const snapshot = await getFreshForms()
    res.json(snapshot)
  } catch (error) {
    res.status(503).json({
      error: '数据暂时不可用',
      message: error.message,
    })
  }
})

app.post('/api/refresh', async (req, res) => {
  try {
    if (!refreshing) {
      refreshing = getFreshForms().finally(() => {
        refreshing = null
      })
    }
    const snapshot = await refreshing
    res.json(snapshot)
  } catch (error) {
    res.status(502).json({
      error: '同步失败',
      message: error.message,
    })
  }
})

app.get('/api/forms/:code', async (req, res) => {
  try {
    const detail = await getFormDetail(String(req.params.code || '').trim())
    res.json(detail)
  } catch (error) {
    const statusCode =
      error.statusCode || (error.name === 'MkError' ? 502 : 500)
    res.status(statusCode).json({
      error: statusCode === 404 ? '未找到该单据' : '详情加载失败',
      message: error.message,
    })
  }
})

app.use('/docs', express.static(path.join(paths.root, 'doc'), { extensions: ['md'] }))

app.use(
  express.static(DIST, {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache')
    },
  }),
)

app.get('*', async (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: '接口不存在' })
    return
  }
  const indexFile = path.join(DIST, 'index.html')
  try {
    await access(indexFile)
    res.sendFile(indexFile)
  } catch {
    res
      .status(503)
      .type('text/plain')
      .send('前端尚未构建。请先运行 npm run build，或使用 npm run dev 启动开发服务。')
  }
})

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  傲举财务 · 报销看板`)
  console.log(`  → http://127.0.0.1:${PORT}\n`)
  console.log('  数据模式：实时读取每刻接口，不保存本地业务数据')
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
