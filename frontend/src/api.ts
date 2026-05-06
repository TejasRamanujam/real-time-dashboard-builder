import type { Dashboard, Widget, DataSource, WidgetData } from './types'
const API = '/api'

const j = (r: Response) => r.json()

export const fetchDashboards = (): Promise<Dashboard[]> => fetch(`${API}/dashboards`).then(j)
export const createDashboard = (data: Partial<Dashboard>): Promise<Dashboard> => fetch(`${API}/dashboards`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(j)
export const updateDashboard = (id: number, data: Partial<Dashboard>): Promise<Response> => fetch(`${API}/dashboards/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
export const deleteDashboard = (id: number): Promise<Response> => fetch(`${API}/dashboards/${id}`, { method: 'DELETE' })

export const fetchWidgets = (dashId: number): Promise<Widget[]> => fetch(`${API}/dashboards/${dashId}/widgets`).then(j)
export const createWidget = (data: Partial<Widget>): Promise<Widget> => fetch(`${API}/widgets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(j)
export const updateWidget = (id: number, data: Partial<Widget>): Promise<Response> => fetch(`${API}/widgets/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
export const deleteWidget = (id: number): Promise<Response> => fetch(`${API}/widgets/${id}`, { method: 'DELETE' })

export const fetchWidgetData = (widgetId: number): Promise<WidgetData> => fetch(`${API}/widgets/${widgetId}/data`).then(j)
export const runQuery = (dataSourceId: number, query: string): Promise<{ data: any[]; count: number; columns: string[] }> =>
  fetch(`${API}/query`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data_source_id: dataSourceId, query }) }).then(j)

export const fetchDataSources = (): Promise<DataSource[]> => fetch(`${API}/datasources`).then(j)
export const createDataSource = (data: Partial<DataSource>): Promise<DataSource> => fetch(`${API}/datasources`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(j)
export const testDataSource = (id: number): Promise<{ ok: boolean; error?: string; preview?: any[] }> => fetch(`${API}/datasources/${id}/test`, { method: 'POST' }).then(j)
