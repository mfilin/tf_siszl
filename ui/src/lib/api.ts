const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5080').replace(/\/$/, '')

export type FileType = 'GST' | 'GPT' | 'GF'
export type ApiStatus = 'queued' | 'processing' | 'processed' | 'sent' | 'failed'
export type ResultCategory = 'accepted' | 'accepted_with_warning' | 'fix_and_resend' | 'verify_basis' | 'closed_exclude' | 'follows_gst' | 'missing_gst'

export type ApiFile = {
  id: string
  type: FileType
  fileName: string
  period: string
  direction: 'inbound' | 'outbound'
  recordCount: number | null
  status: ApiStatus
  createdAt: string
  fileSizeBytes: number | null
  sourceFileName: string | null
  checksum?: string | null
  processingStartedAt?: string | null
  processingFinishedAt?: string | null
  error: { code: string; message: string } | null
}

export type Page<T> = { items: T[]; page: number; pageSize: number; totalItems: number; totalPages: number }
export type FileFilters = { q?: string; type?: FileType; periodFrom?: string; periodTo?: string; status?: ApiStatus; page?: number; pageSize?: number; sort?: string }
export type RecordFilters = { q?: string; category?: ResultCategory; resultCode?: number; moCode?: string; page?: number; pageSize?: number; sort?: string }

export type ResultCode = { code: string | number; description: string; category: ResultCategory; recommendation: string | null }
export type ResultDictionaries = { gst: ResultCode[]; gpt: ResultCode[] }
export type ResultBranch = { period?: string | null; fileName?: string | null; code?: string | null; resultCode?: string | number | null; resultDate?: string | null; resultDescription?: string | null }
export type RecordItem = {
  id: string
  enp: string | null
  dnPatientId: string | null
  diagnosisCode: string | null
  groupRhCode: number | null
  groupRhProfile?: string | null
  groupRhName?: string | null
  dnRuleInName?: string | null
  patient?: { sexCode?: number | null; birthDate?: string | null; smoCode?: string | null; attachMoCode?: string | null; attachDate?: string | null; smoRegionCode?: string | null } | null
  dnList?: ResultBranch | null
  dnPlan?: ResultBranch | null
  insertedAt?: string | null
  updatedAt?: string | null
  moCode?: string | null
  gisEvidence?: { fileName?: string; code?: string; invoiceNumber?: string; invoiceDate?: string; caseId?: string; serviceId?: string; historyNumber?: string; diagnosisCode?: string; moCode?: string; date?: string } | null
}
export type RecordsPage = Page<RecordItem> & { fileId: string; fileName: string }
export type FileSummary = { totalFiles: number; outboundGstGpt: number; inboundGf: number; failedFiles: number; asOf: string }
export type Analytics = {
  fileId: string; fileName: string; recordCount: number; checks: { gst: number; gpt: number }
  categories: { type: 'GST' | 'GPT'; category: ResultCategory; count: number; percent: number }[]
  topResultCodes: { type: 'GST' | 'GPT'; code: string; description: string; category: ResultCategory; count: number }[]
  repeatedErrors: { dnPatientId: string; moCode: string | null; type: 'GST' | 'GPT'; code: string; periodCount: number; periods: string[]; recommendation: string | null }[]
  generatedAt: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers: { Accept: 'application/json', ...init?.headers } })
  } catch {
    throw new Error('Не удалось связаться с API. Проверьте, что backend запущен.')
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string }; detail?: string; title?: string } | null
    throw new Error(body?.error?.message ?? body?.detail ?? body?.title ?? `Ошибка API (${response.status})`)
  }
  return response.json() as Promise<T>
}

function queryString(values: object) {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  })
  const query = params.toString()
  return query ? `?${query}` : ''
}

export const api = {
  files: (filters: FileFilters) => request<Page<ApiFile>>(`/api/v1/dn/files${queryString(filters)}`),
  fileSummary: (filters: Pick<FileFilters, 'periodFrom' | 'periodTo' | 'type' | 'status'>) => request<FileSummary>(`/api/v1/dn/files/summary${queryString(filters)}`),
  file: (fileId: string) => request<ApiFile>(`/api/v1/dn/files/${encodeURIComponent(fileId)}`),
  records: (fileId: string, filters: RecordFilters) => request<RecordsPage>(`/api/v1/dn/files/${encodeURIComponent(fileId)}/records${queryString(filters)}`),
  record: (fileId: string, recordKey: string) => request<RecordItem>(`/api/v1/dn/files/${encodeURIComponent(fileId)}/records/${encodeURIComponent(recordKey)}`),
  analytics: (fileId: string, repeatPeriods = 2, top = 6) => request<Analytics>(`/api/v1/dn/files/${encodeURIComponent(fileId)}/analytics${queryString({ repeatPeriods, top })}`),
  resultCodes: () => request<ResultDictionaries>('/api/v1/dn/dictionaries/result-codes'),
  exportUrl: (fileId: string, filters: RecordFilters) => `${apiBaseUrl}/api/v1/dn/files/${encodeURIComponent(fileId)}/records/export${queryString(filters)}`,
  moGroupExportUrl: (filters: { resultType: 'GST' | 'GPT'; resultCode: string | number; fileId: string; moCode?: string }) => `${apiBaseUrl}/api/v1/dn/files/export/by-mo${queryString(filters)}`,
}

export function categoryLabel(category: ResultCategory) {
  return ({ accepted: 'Принято', accepted_with_warning: 'Принято с замечанием', fix_and_resend: 'Исправить и отправить', verify_basis: 'Проверить обоснованность', closed_exclude: 'Закрыт / исключить', follows_gst: 'Следует за GST', missing_gst: 'Нет в списках GST' })[category]
}

export function statusLabel(status: ApiStatus) {
  return ({ queued: 'В очереди', processing: 'Обрабатывается', processed: 'Обработан', sent: 'Отправлен', failed: 'Ошибка' })[status]
}

export function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export function formatBytes(value?: number | null) {
  if (value == null) return '—'
  const units = ['Б', 'КБ', 'МБ', 'ГБ']
  let size = value
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1 }
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(size)} ${units[unit]}`
}
