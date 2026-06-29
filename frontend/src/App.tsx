import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Plus, Trash2, BarChart3, LineChartIcon, PieChartIcon, Table2, Hash, Grip, Database, RefreshCw, Settings } from 'lucide-react'
import type { Dashboard, Widget, DataSource, WidgetData } from './types'
import * as api from './api'
import './App.css'

const WIDGET_TYPES = [
  { type: 'line_chart', label: 'Line Chart', icon: <LineChartIcon size={18} /> },
  { type: 'bar_chart', label: 'Bar Chart', icon: <BarChart3 size={18} /> },
  { type: 'pie_chart', label: 'Pie Chart', icon: <PieChartIcon size={18} /> },
  { type: 'data_table', label: 'Data Table', icon: <Table2 size={18} /> },
  { type: 'stat_card', label: 'Stat Card', icon: <Hash size={18} /> },
]

const COLORS = ['#7c5cfc', '#4caf50', '#ff9800', '#2196f3', '#f44336', '#9c27b0', '#00bcd4', '#ffeb3b']

function App() {
  const loc = useLocation()

  const pathId = loc.pathname.split('/').filter(Boolean)[0]
  const dashId = pathId ? parseInt(pathId) : null

  if (dashId && !isNaN(dashId)) return <DashboardView dashId={dashId} />
  if (loc.pathname.includes('/ds/')) {
    return <DataSourceWizard />
  }
  return <HomePage />
}

function HomePage() {
  const nav = useNavigate()
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')

  useEffect(() => { api.fetchDashboards().then(setDashboards) }, [])

  const handleCreate = async () => {
    if (!name.trim()) return
    const d = await api.createDashboard({ name, description: '', layout: {} })
    nav(`/${d.id}`)
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Dashboard Builder</h1>
        <p className="subtitle">Drag-and-drop dashboards with live data sources</p>
        <button className="btn-primary" onClick={() => setShowCreate(true)}><Plus size={16} /> New Dashboard</button>
      </header>
      <main className="main">
        {showCreate && (
          <div className="modal-overlay" onClick={() => setShowCreate(false)}>
            <div className="modal-sm" onClick={e => e.stopPropagation()}>
              <h3>Create Dashboard</h3>
              <input className="input" placeholder="Dashboard name..." value={name} onChange={e => setName(e.target.value)} autoFocus />
              <div className="row gap">
                <button className="btn-primary" onClick={handleCreate}>Create</button>
                <button className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
        <div className="dash-grid">
          {dashboards.map(d => (
            <div key={d.id} className="dash-card" onClick={() => nav(`/${d.id}`)}>
              <h3>{d.name}</h3>
              <p className="text-muted">{d.description || 'No description'}</p>
              <span className="text-muted">{new Date(d.updated_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

function DashboardView({ dashId }: { dashId: number }) {
  const nav = useNavigate()
  const wsRef = useRef<WebSocket | null>(null)
  const [dash, setDash] = useState<Dashboard | null>(null)
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [widgetData, setWidgetData] = useState<Record<number, WidgetData>>({})
  const [showPicker, setShowPicker] = useState(false)
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null)
  useEffect(() => {
    api.fetchDashboards().then(ds => setDash(ds.find(d => d.id === dashId) || null))
    api.fetchWidgets(dashId).then(setWidgets)
    api.fetchDataSources().then(setDataSources)
  }, [dashId])

  // Live streaming updates require a persistent websocket server (not available
  // on serverless). Widget data is loaded over REST below; the live socket is
  // disabled to avoid a failing connection.
  useEffect(() => {
    wsRef.current = null
  }, [dashId])

  useEffect(() => {
    widgets.forEach(w => {
      api.fetchWidgetData(w.id).then(d => setWidgetData(prev => ({ ...prev, [w.id]: d })))
    })
  }, [widgets])

  const handleAddWidget = async (type: string) => {
    const w = await api.createWidget({
      dashboard_id: dashId, widget_type: type, title: type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      config: {}, position: { x: (widgets.length % 3) * 4, y: Math.floor(widgets.length / 3) * 4, w: 4, h: 3 },
      query_text: '', refresh_interval: 0,
    })
    setWidgets([...widgets, w])
    setShowPicker(false)
    setEditingWidget(w)
  }

  const handleRemoveWidget = async (id: number) => {
    await api.deleteWidget(id)
    setWidgets(widgets.filter(w => w.id !== id))
  }

  if (!dash) return <div className="main"><p>Loading...</p></div>

  return (
    <div className="app">
      <header className="header dashboard-header">
        <div className="row gap">
          <button className="btn-ghost" onClick={() => nav('/')}>← Back</button>
          <h2>{dash.name}</h2>
        </div>
        <div className="row gap">
          <button className="btn-ghost" onClick={() => nav('/ds/new')}><Database size={14} /> Connect Data</button>
          <button className="btn-primary" onClick={() => setShowPicker(true)}><Plus size={14} /> Add Widget</button>
        </div>
      </header>
      <main className="main">
        {showPicker && (
          <div className="modal-overlay" onClick={() => setShowPicker(false)}>
            <div className="modal-sm" onClick={e => e.stopPropagation()}>
              <h3>Add Widget</h3>
              <div className="widget-grid">
                {WIDGET_TYPES.map(wt => (
                  <div key={wt.type} className="widget-option" onClick={() => handleAddWidget(wt.type)}>
                    {wt.icon}
                    <span>{wt.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {editingWidget && (
          <WidgetConfigPanel
            widget={editingWidget}
            dataSources={dataSources}
            onClose={() => setEditingWidget(null)}
            onSave={async (data) => {
              await api.updateWidget(editingWidget.id, { ...editingWidget, ...data })
              setWidgets(widgets.map(w => w.id === editingWidget.id ? { ...w, ...data } : w))
              setEditingWidget(null)
            }}
            onTest={async (dsId, query) => {
              return api.runQuery(dsId, query)
            }}
          />
        )}
        <div className="grid-canvas">
          {widgets.map(w => (
            <div key={String(w.id)} className="widget-box">
              <div className="widget-header">
                <span className="widget-drag-handle"><Grip size={14} /></span>
                <span className="widget-title">{w.title}</span>
                <div className="widget-actions">
                  <button className="icon-btn" onClick={() => setEditingWidget(w)}><Settings size={12} /></button>
                  <button className="icon-btn" onClick={() => handleRemoveWidget(w.id)}><Trash2 size={12} /></button>
                </div>
              </div>
              <div className="widget-body">
                <WidgetContent data={widgetData[w.id]} type={w.widget_type} />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

function WidgetContent({ data, type }: { data?: WidgetData; type: string }) {
  if (!data || !data.data || data.data.length === 0) {
    return <div className="widget-empty">No data — configure a data source</div>
  }

  if (type === 'line_chart') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3e" />
          <XAxis dataKey="x" tick={{ fontSize: 10 }} stroke="#9aa0a6" />
          <YAxis tick={{ fontSize: 10 }} stroke="#9aa0a6" />
          <Tooltip contentStyle={{ background: '#1a1d27', border: '1px solid #2a2e3e', borderRadius: 8 }} />
          <Line type="monotone" dataKey="y" stroke="#7c5cfc" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    )
  }
  if (type === 'bar_chart') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3e" />
          <XAxis dataKey="x" tick={{ fontSize: 10 }} stroke="#9aa0a6" />
          <YAxis tick={{ fontSize: 10 }} stroke="#9aa0a6" />
          <Tooltip contentStyle={{ background: '#1a1d27', border: '1px solid #2a2e3e', borderRadius: 8 }} />
          <Bar dataKey="y" fill="#7c5cfc" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }
  if (type === 'pie_chart') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="70%" label={({ name }) => name}>
            {data.data.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: '#1a1d27', border: '1px solid #2a2e3e', borderRadius: 8 }} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }
  if (type === 'data_table') {
    const cols = data.config?.columns || (data.data[0] ? Object.keys(data.data[0]) : [])
    return (
      <div className="widget-table">
        <table>
          <thead><tr>{cols.map((c: string) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {data.data.slice(0, 50).map((row: any, i: number) => (
              <tr key={i}>{cols.map((c: string) => <td key={c}>{String(row[c] ?? '')}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  if (type === 'stat_card') {
    const statData = (data.data as any)?.value ?? 0
    const avg = (data.data as any)?.average
    return (
      <div className="stat-card">
        <div className="stat-value">{typeof statData === 'number' ? statData.toLocaleString() : String(statData)}</div>
        <div className="stat-label">{data.config?.label || 'Value'}</div>
        {avg !== undefined && <div className="stat-sub">Avg: {avg.toFixed(2)}</div>}
      </div>
    )
  }
  return <div className="widget-empty">Unknown widget type: {type}</div>
}

function WidgetConfigPanel({ widget, dataSources, onClose, onSave, onTest }: {
  widget: Widget; dataSources: DataSource[]; onClose: () => void
  onSave: (data: Partial<Widget>) => void; onTest: (dsId: number, query: string) => Promise<any>
}) {
  const [dsId, setDsId] = useState(widget.data_source_id || 0)
  const [query, setQuery] = useState(widget.query_text || '')
  const [title, setTitle] = useState(widget.title)
  const [testResult, setTestResult] = useState<any>(null)

  const handleTest = async () => {
    if (!dsId) return
    try { const r = await onTest(dsId, query); setTestResult(r) } catch (e) { setTestResult({ error: String(e) }) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h3>Configure Widget</h3>
        <div className="form-group">
          <label>Title</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Data Source</label>
          <select className="input" value={dsId} onChange={e => setDsId(parseInt(e.target.value))}>
            <option value={0}>— None —</option>
            {dataSources.map(ds => <option key={ds.id} value={ds.id}>{ds.name} ({ds.type})</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>SQL Query</label>
          <textarea className="input textarea" rows={4} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="SELECT * FROM table LIMIT 100" />
        </div>
        <div className="row gap">
          <button className="btn-ghost" onClick={handleTest}><RefreshCw size={14} /> Test</button>
          <button className="btn-primary" onClick={() => onSave({ query_text: query, data_source_id: dsId || null, title })}>Save</button>
        </div>
        {testResult && (
          <div className="test-result">
            {testResult.error ? <p className="text-red">Error: {testResult.error}</p>
              : <p className="text-green">OK — {testResult.count} rows, columns: {testResult.columns?.join(', ')}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function DataSourceWizard() {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [type, setType] = useState('postgresql')
  const [config, setConfig] = useState<Record<string, string>>({})

  const fields: Record<string, string[]> = {
    postgresql: ['host', 'port', 'database', 'user', 'password'],
    rest: ['url', 'headers_json'],
    csv: ['csv_content'],
  }

  const handleConnect = async () => {
    try {
      const cfg: Record<string, any> = { type }
      for (const [k, v] of Object.entries(config)) {
        if (k === 'port') cfg[k] = parseInt(v) || 5432
        else if (k === 'headers_json' && v) cfg['headers'] = JSON.parse(v)
        else cfg[k] = v
      }
      const ds = await api.createDataSource({ name, type, connection_config: cfg })
      const test = await api.testDataSource(ds.id)
      if (test.ok) { alert('Connected!'); nav(-1) }
      else { alert('Test failed: ' + test.error) }
    } catch (e) { alert('Error: ' + e) }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="row gap"><button className="btn-ghost" onClick={() => nav(-1)}>← Back</button><h2>Connect Data Source</h2></div>
      </header>
      <main className="main" style={{ maxWidth: 500 }}>
        <div className="form-group"><label>Name</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Production DB" /></div>
        <div className="form-group"><label>Type</label>
          <select className="input" value={type} onChange={e => { setType(e.target.value); setConfig({}) }}>
            <option value="postgresql">PostgreSQL</option><option value="rest">REST API</option><option value="csv">CSV</option>
          </select>
        </div>
        {fields[type]?.map(f => (
          <div key={f} className="form-group">
            <label>{f.replace(/_/g, ' ')}</label>
            <input className="input" type={f.includes('password') ? 'password' : 'text'}
              value={config[f] || ''} onChange={e => setConfig({ ...config, [f]: e.target.value })}
              placeholder={f === 'headers_json' ? '{"Authorization": "Bearer ..."}' : ''} />
          </div>
        ))}
        <button className="btn-primary" onClick={handleConnect}>Connect & Test</button>
      </main>
    </div>
  )
}

export default App
