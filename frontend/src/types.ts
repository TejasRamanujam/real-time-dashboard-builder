export interface DataSource {
  id: number
  name: string
  type: string
  connection_config: Record<string, any>
}

export interface Dashboard {
  id: number
  name: string
  description: string
  layout: Record<string, any>
  auto_refresh: number
  created_at: string
  updated_at: string
}

export interface Widget {
  id: number
  dashboard_id: number
  data_source_id: number | null
  widget_type: string
  title: string
  config: Record<string, any>
  position: Record<string, any>
  query_text: string
  refresh_interval: number
}

export interface WidgetData {
  data: any[]
  type: string
  x_field?: string
  y_field?: string
  config?: Record<string, any>
}
