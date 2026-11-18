import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowDownToLine, ArrowLeft, ArrowRight, Check, ChevronDown, CircleAlert, FileArchive, FileText, Filter, LoaderCircle, Moon, Search, Sun, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, categoryLabel, formatBytes, formatDate, type Analytics, type ApiFile, type ApiStatus, type FileSummary, type RecordItem, type RecordsPage, type ResultCategory, type ResultCode } from '@/lib/api'

const categories: ResultCategory[] = ['accepted', 'accepted_with_warning', 'fix_and_resend', 'verify_basis', 'closed_exclude', 'follows_gst', 'missing_gst']
const categoryTone: Record<ResultCategory, string> = {
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900',
  accepted_with_warning: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900',
  fix_and_resend: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900',
  verify_basis: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900',
  closed_exclude: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
  follows_gst: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
  missing_gst: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900',
}
const number = (value: number | null | undefined) => value == null ? '—' : new Intl.NumberFormat('ru-RU').format(value)
const fileNameWithoutExtension = (fileName: string) => fileName.replace(/\.[^.]+$/, '')
const statusTone: Record<ApiStatus, string> = { queued: 'text-zinc-700 bg-zinc-50 border-zinc-200', processing: 'text-amber-700 bg-amber-50 border-amber-200', processed: 'text-emerald-700 bg-emerald-50 border-emerald-200', sent: 'text-blue-700 bg-blue-50 border-blue-200', failed: 'text-rose-700 bg-rose-50 border-rose-200' }
const resultLookupKey = (type: 'GST' | 'GPT', code?: string | number | null) => `${type}:${code ?? ''}`
function Empty({ children }: { children: string }) { return <div className="px-6 py-14 text-center text-sm text-muted-foreground"><div className="mx-auto mb-3 grid size-10 place-items-center rounded-xl bg-muted"><Filter className="size-4" /></div>{children}</div> }
function RecordsLoader() { return <div role="status" aria-live="polite" className="flex min-h-[420px] min-w-[320px] flex-col items-center justify-center rounded-xl border bg-card/95 px-6 py-10 text-center shadow-lg"><div className="mb-5 grid size-24 place-items-center rounded-full bg-primary/5 ring-1 ring-primary/10"><LoaderCircle className="size-14 animate-spin text-primary" strokeWidth={1.5} /></div><p className="text-lg font-semibold">Загружаем записи</p><p className="mt-2 max-w-sm text-sm text-muted-foreground">Получаем данные из базы и применяем выбранные фильтры</p><div className="mt-7 flex items-center gap-2" aria-hidden="true"><span className="size-2 animate-pulse rounded-full bg-primary/40 [animation-delay:-300ms]" /><span className="size-2 animate-pulse rounded-full bg-primary/60 [animation-delay:-150ms]" /><span className="size-2 animate-pulse rounded-full bg-primary" /></div><span className="sr-only">Идёт загрузка записей</span></div> }
function ErrorBox({ message }: { message: string }) { return <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"><CircleAlert className="mt-0.5 size-4 shrink-0" />{message}</div> }
function ResultBadge({ type, code, dictionaries }: { type: 'GST' | 'GPT'; code?: string | number | null; dictionaries: Map<string, ResultCode> }) {
  const result = dictionaries.get(resultLookupKey(type, code))
  const category = result?.category
  return <Badge variant="outline" className={`gap-1.5 font-medium ${category ? categoryTone[category] : ''}`}><span className="size-1.5 rounded-full bg-current" />{type} {code ?? '—'}</Badge>
}

export default function App() {
  const [dark, setDark] = useState(false)
  const [tab, setTab] = useState('files')
  const [files, setFiles] = useState<ApiFile[]>([])
  const [fileSummary, setFileSummary] = useState<FileSummary | null>(null)
  const [fileTotal, setFileTotal] = useState(0)
  const [filesError, setFilesError] = useState('')
  const [filesLoading, setFilesLoading] = useState(true)
  const [bulkResultSelection, setBulkResultSelection] = useState('')
  const [bulkFileId, setBulkFileId] = useState('')
  const [gfFiles, setGfFiles] = useState<ApiFile[]>([])
  const [gfFilesLoading, setGfFilesLoading] = useState(false)
  const [gfFilesError, setGfFilesError] = useState('')
  const [bulkMoCode, setBulkMoCode] = useState('')
  const [fileQuery, setFileQuery] = useState('')
  const [fileType, setFileType] = useState('all')
  const [filePeriod, setFilePeriod] = useState('all')
  const [fileStatus, setFileStatus] = useState('all')
  const [selectedFile, setSelectedFile] = useState<ApiFile | null>(null)
  const [fileDetailLoading, setFileDetailLoading] = useState(false)
  const [activeFileId, setActiveFileId] = useState('')
  const [gfFileSearch, setGfFileSearch] = useState('')
  const [gfFilePickerOpen, setGfFilePickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [code, setCode] = useState('all')
  const [mo, setMo] = useState('all')
  const [page, setPage] = useState(1)
  const [recordsPage, setRecordsPage] = useState<RecordsPage | null>(null)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [recordsError, setRecordsError] = useState('')
  const [d05ExportLoading, setD05ExportLoading] = useState(false)
  const [d05ExportError, setD05ExportError] = useState('')
  const [d05ExportProgress, setD05ExportProgress] = useState(0)
  const [d05ExportFileCount, setD05ExportFileCount] = useState<number | null>(null)
  const [recordCountOpen, setRecordCountOpen] = useState(false)
  const [recordCountLoading, setRecordCountLoading] = useState(false)
  const [recordCount, setRecordCount] = useState<number | null>(null)
  const [recordCountError, setRecordCountError] = useState('')
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null)
  const [recordDetailLoading, setRecordDetailLoading] = useState(false)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [analyticsError, setAnalyticsError] = useState('')
  const [dictionaries, setDictionaries] = useState<ResultCode[]>([])
  const [dictionariesError, setDictionariesError] = useState('')

  const apiStatus = fileStatus === 'all' ? undefined : fileStatus as ApiStatus
  const periodFilter = filePeriod === 'all' ? {} : { periodFrom: filePeriod, periodTo: filePeriod }
  const dictionaryMap = useMemo(() => new Map(dictionaries.map(item => [resultLookupKey(Number(item.code) >= 300 ? 'GPT' : 'GST', item.code), item])), [dictionaries])
  const resultCodes = useMemo(() => [...new Set(dictionaries.map(item => String(item.code)))].sort(), [dictionaries])
  const moExportOptions = useMemo(() => dictionaries.map(item => {
    const type = Number(item.code) >= 300 ? 'GPT' as const : 'GST' as const
    return { ...item, type, value: `${type}:${item.code}` }
  }), [dictionaries])
  const selectedMoExportOption = moExportOptions.find(item => item.value === bulkResultSelection)
  const selectedBulkFile = gfFiles.find(file => file.id === bulkFileId)
  const activeFile = files.find(file => file.id === activeFileId) ?? gfFiles.find(file => file.id === activeFileId) ?? null
  const filteredGfFiles = gfFiles.filter(file => fileNameWithoutExtension(file.fileName).toLocaleLowerCase('ru-RU').includes(gfFileSearch.trim().toLocaleLowerCase('ru-RU')))

  useEffect(() => {
    let current = true
    setFilesLoading(true)
    setFilesError('')
    const filters = { q: fileQuery || undefined, type: fileType === 'all' ? undefined : fileType as ApiFile['type'], ...periodFilter, status: apiStatus, page: 1, pageSize: 100, sort: 'createdAt:desc' }
    api.resultCodes().then(resultDictionaries => {
      if (current) { setDictionaries([...resultDictionaries.gst, ...resultDictionaries.gpt]); setDictionariesError('') }
    }).catch(error => { if (current) setDictionariesError(error instanceof Error ? error.message : 'Не удалось загрузить справочник результатов') })
    Promise.all([api.files(filters), api.fileSummary({ ...periodFilter, type: fileType === 'all' ? undefined : fileType as ApiFile['type'], status: apiStatus })])
      .then(([fileResponse, summary]) => {
        if (!current) return
        setFiles(fileResponse.items); setFileTotal(fileResponse.totalItems); setFileSummary(summary)
        setActiveFileId(previous => fileResponse.items.some(file => file.id === previous) ? previous : fileResponse.items.find(file => file.type === 'GF' && file.status === 'processed')?.id ?? fileResponse.items.find(file => file.type === 'GF')?.id ?? '')
      })
      .catch(error => { if (current) setFilesError(error instanceof Error ? error.message : 'Ошибка загрузки журнала') })
      .finally(() => { if (current) setFilesLoading(false) })
    return () => { current = false }
  }, [fileQuery, fileType, filePeriod, fileStatus])

  useEffect(() => {
    let current = true
    setGfFilesLoading(true); setGfFilesError('')
    api.files({ type: 'GF', page: 1, pageSize: 100, sort: 'createdAt:desc' })
      .then(async firstPage => {
        const remainingPages = await Promise.all(Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, (_, index) =>
          api.files({ type: 'GF', page: index + 2, pageSize: 100, sort: 'createdAt:desc' })))
        if (!current) return
        const items = [...firstPage.items, ...remainingPages.flatMap(page => page.items)]
        setGfFiles(items)
        setBulkFileId(previous => items.some(file => file.id === previous) ? previous : items[0]?.id ?? '')
      })
      .catch(error => { if (current) setGfFilesError(error instanceof Error ? error.message : 'Не удалось загрузить список GF-файлов') })
      .finally(() => { if (current) setGfFilesLoading(false) })
    return () => { current = false }
  }, [])


  useEffect(() => {
    if (!activeFileId || !activeFile || activeFile.type !== 'GF') { setRecordsPage(null); return }
    let current = true
    setRecordsLoading(true); setRecordsError('')
    api.records(activeFileId, { q: query || undefined, category: category === 'all' ? undefined : category as ResultCategory, resultCode: code === 'all' ? undefined : Number(code), moCode: mo === 'all' ? undefined : mo, page, pageSize: 12, sort: 'enp:asc' })
      .then(response => { if (current) setRecordsPage(response) })
      .catch(error => { if (current) { setRecordsPage(null); setRecordsError(error instanceof Error ? error.message : 'Ошибка загрузки записей') } })
      .finally(() => { if (current) setRecordsLoading(false) })
    return () => { current = false }
  }, [activeFileId, activeFile?.type, query, category, code, mo, page])

  useEffect(() => {
    if (tab !== 'summary' || !activeFileId || activeFile?.type !== 'GF') return
    let current = true
    setAnalyticsError('')
    api.analytics(activeFileId).then(data => { if (current) setAnalytics(data) }).catch(error => { if (current) setAnalyticsError(error instanceof Error ? error.message : 'Ошибка загрузки аналитики') })
    return () => { current = false }
  }, [tab, activeFileId, activeFile?.type])

  const openFile = async (file: ApiFile) => {
    setSelectedFile(file); setFileDetailLoading(true)
    try { setSelectedFile(await api.file(file.id)) } catch (error) { setFilesError(error instanceof Error ? error.message : 'Не удалось загрузить карточку файла') }
    finally { setFileDetailLoading(false) }
  }
  const openRecord = async (record: RecordItem) => {
    setSelectedRecord(record); setRecordDetailLoading(true)
    try { setSelectedRecord(await api.record(activeFileId, record.id)) } catch (error) { setRecordsError(error instanceof Error ? error.message : 'Не удалось загрузить карточку записи') }
    finally { setRecordDetailLoading(false) }
  }
  const exportCsv = () => {
    if (!activeFileId) return
    const href = api.exportUrl(activeFileId, { q: query || undefined, category: category === 'all' ? undefined : category as ResultCategory, resultCode: code === 'all' ? undefined : Number(code), moCode: mo === 'all' ? undefined : mo, sort: 'enp:asc' })
    const link = document.createElement('a'); link.href = href; link.download = ''; document.body.appendChild(link); link.click(); link.remove()
  }
  const exportD05Test = async () => {
    if (!activeFileId) return
    setD05ExportLoading(true); setD05ExportError(''); setD05ExportProgress(1); setD05ExportFileCount(null)
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        const request = new XMLHttpRequest()
        request.open('GET', api.d05TestExportUrl(activeFileId, mo === 'all' ? undefined : mo))
        request.responseType = 'blob'
        request.setRequestHeader('Accept', 'application/zip, application/problem+json')
        const preparing = window.setInterval(() => setD05ExportProgress(value => Math.min(9, value + 1)), 700)
        request.onprogress = event => {
          const fileCount = Number(request.getResponseHeader('X-D05-Total-Files'))
          if (Number.isFinite(fileCount)) setD05ExportFileCount(fileCount)
          setD05ExportProgress(event.lengthComputable && event.total > 0
            ? Math.max(10, Math.min(99, 10 + Math.floor(event.loaded / event.total * 89)))
            : value => Math.min(95, Math.max(10, value + 1)))
        }
        request.onload = () => {
          window.clearInterval(preparing)
          const fileCount = Number(request.getResponseHeader('X-D05-Total-Files'))
          if (Number.isFinite(fileCount)) setD05ExportFileCount(fileCount)
          if (request.status >= 200 && request.status < 300) resolve(request.response as Blob)
          else (request.response as Blob).text().then(text => {
            try { const body = JSON.parse(text) as { detail?: string; title?: string }; reject(new Error(body.detail ?? body.title ?? `Ошибка API (${request.status})`)) }
            catch { reject(new Error(`Ошибка API (${request.status})`)) }
          })
        }
        request.onerror = () => { window.clearInterval(preparing); reject(new Error('Не удалось связаться с сервером')) }
        request.onabort = () => { window.clearInterval(preparing); reject(new Error('Выгрузка отменена')) }
        request.send()
      })
      setD05ExportProgress(100)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a'); link.href = url; link.download = `D05_TEST_${fileNameWithoutExtension(activeFile?.fileName ?? activeFileId)}.zip`; document.body.appendChild(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) { setD05ExportError(error instanceof Error ? error.message : 'Не удалось сформировать тестовый D05') }
    finally { setD05ExportLoading(false) }
  }
  const showRecordCount = async () => {
    if (!activeFileId) return
    setRecordCountOpen(true); setRecordCountLoading(true); setRecordCount(null); setRecordCountError('')
    try {
      const result = await api.recordCount(activeFileId, { q: query || undefined, category: category === 'all' ? undefined : category as ResultCategory, resultCode: code === 'all' ? undefined : Number(code), moCode: mo === 'all' ? undefined : mo })
      setRecordCount(result.count)
    } catch (error) {
      setRecordCountError(error instanceof Error ? error.message : 'Не удалось посчитать записи')
    } finally { setRecordCountLoading(false) }
  }
  const exportMoGroup = () => {
    if (!selectedMoExportOption || !bulkFileId) return
    const link = document.createElement('a')
    link.href = api.moGroupExportUrl({ resultType: selectedMoExportOption.type, resultCode: selectedMoExportOption.code, fileId: bulkFileId, moCode: bulkMoCode.trim() || undefined })
    link.download = ''; document.body.appendChild(link); link.click(); link.remove()
  }
  const resetFiles = () => { setFileQuery(''); setFileType('all'); setFilePeriod('all'); setFileStatus('all') }
  const resetRows = () => { setQuery(''); setMo('all'); setCategory('all'); setCode('all'); setPage(1) }
  const updateFilter = (setter: (value: string) => void, value: string | null) => { setter(value ?? 'all'); setPage(1) }
  const openContents = (file: ApiFile) => { setActiveFileId(file.id); setSelectedFile(null); setTab('content') }

  return <main className={dark ? 'dark min-h-screen' : 'min-h-screen'}>
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground"><span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground"><Activity className="size-4" /></span> СИСЗЛ · контроль обмена</div><h1 className="text-2xl font-semibold tracking-tight">Учёт файлов ДН</h1><p className="mt-1 text-sm text-muted-foreground">Выгрузки GST/GPT и результаты сверки GF</p></div>
        <div className="flex items-center gap-2"><div className="hidden rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground sm:block">Регион <span className="ml-2 font-medium text-foreground">34 · Волгоградская область</span></div><Button variant="outline" size="icon" aria-label="Сменить тему" onClick={() => { const next = !dark; setDark(next); document.documentElement.classList.toggle('dark', next) }}>{dark ? <Sun /> : <Moon />}</Button></div>
      </header>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-5 h-auto w-full justify-center gap-1 overflow-x-auto rounded-xl border bg-muted/60 p-1">
          <TabsTrigger value="files" className="gap-2"><FileArchive className="size-4" />Журнал файлов<span className="ml-1 rounded-md bg-background/80 px-1.5 py-0.5 text-[10px]">{number(fileTotal)}</span></TabsTrigger>
          <TabsTrigger value="content" className="gap-2"><FileText className="size-4" />Строки GF</TabsTrigger>
          <TabsTrigger value="mo-export" className="gap-2"><ArrowDownToLine className="size-4" />Выгрузка по МО</TabsTrigger>
          <TabsTrigger value="summary" className="gap-2"><Activity className="size-4" />Сводка сверки</TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="mt-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
            { label: 'Файлов в журнале', value: fileSummary?.totalFiles, hint: 'за выбранный период', icon: FileArchive },
            { label: 'Исходящие GST/GPT', value: fileSummary?.outboundGstGpt, hint: 'пакеты ТФОМС', icon: ArrowDownToLine },
            { label: 'Получено ответов GF', value: fileSummary?.inboundGf, hint: 'ответы ГИС ОМС', icon: Check },
            { label: 'Файлов с ошибкой', value: fileSummary?.failedFiles, hint: 'требуют внимания', icon: CircleAlert },
          ].map((item, index) => <Card key={item.label} className="shadow-none"><CardContent className="flex items-start justify-between p-4"><div><p className="text-sm text-muted-foreground">{item.label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{number(item.value)}</p><p className="mt-1 text-xs text-muted-foreground">{item.hint}</p></div><span className="grid size-9 place-items-center rounded-lg bg-muted"><item.icon className={`size-4 ${['', 'text-blue-600', 'text-emerald-600', 'text-rose-600'][index]}`} /></span></CardContent></Card>)}</div>
          <Card className="overflow-hidden shadow-none">
            <CardHeader className="border-b pb-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">Журнал обмена</CardTitle><CardDescription className="mt-1">Пакеты GST/GPT и ответы ГИС ОМС по выбранным фильтрам</CardDescription></div><Badge variant="outline" className="font-normal">Обновлено {formatDate(fileSummary?.asOf)}</Badge></div></CardHeader>
            <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 p-3">
              <div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={fileQuery} onChange={event => setFileQuery(event.target.value)} placeholder="Поиск по имени файла" className="pl-9" /></div>
              <Select value={fileType} onValueChange={value => setFileType(value ?? 'all')}><SelectTrigger className="w-[130px]"><SelectValue placeholder="Тип файла" /></SelectTrigger><SelectContent><SelectItem value="all">Все типы</SelectItem>{['GST', 'GPT', 'GF'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
              <Select value={filePeriod} onValueChange={value => setFilePeriod(value ?? 'all')}><SelectTrigger className="w-[155px]"><SelectValue placeholder="Период" /></SelectTrigger><SelectContent><SelectItem value="all">Все периоды</SelectItem>{[...new Set(files.map(file => file.period))].sort().reverse().map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
              <Select value={fileStatus} onValueChange={value => setFileStatus(value ?? 'all')}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Статус" /></SelectTrigger><SelectContent><SelectItem value="all">Все статусы</SelectItem>{(['queued', 'processing', 'processed', 'sent', 'failed'] as ApiStatus[]).map(value => <SelectItem key={value} value={value}>{({ queued: 'В очереди', processing: 'Обрабатывается', processed: 'Обработан', sent: 'Отправлен', failed: 'Ошибка' })[value]}</SelectItem>)}</SelectContent></Select>
              <Button variant="ghost" size="sm" onClick={resetFiles}><X className="mr-1 size-4" />Сбросить</Button>
            </div>
            {filesError && <div className="p-3"><ErrorBox message={filesError} /></div>}
            <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="w-[90px]">Тип</TableHead><TableHead>Файл</TableHead><TableHead>Период</TableHead><TableHead>Направление</TableHead><TableHead className="text-right">Записей</TableHead><TableHead>Дата</TableHead><TableHead>Статус</TableHead><TableHead className="w-10" /></TableRow></TableHeader><TableBody>
              {files.map(file => <TableRow key={file.id} onClick={() => void openFile(file)} className="cursor-pointer"><TableCell><Badge variant="secondary" className="font-mono text-[11px]">{file.type}</Badge></TableCell><TableCell className="font-mono text-xs font-medium">{file.fileName}</TableCell><TableCell className="tabular-nums">{file.period}</TableCell><TableCell className="text-muted-foreground">{file.direction === 'inbound' ? 'Входящий' : 'Исходящий'}</TableCell><TableCell className="text-right tabular-nums">{number(file.recordCount)}</TableCell><TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(file.createdAt)}</TableCell><TableCell><Badge variant="outline" className={`font-medium ${statusTone[file.status]}`}><span className="mr-1.5 size-1.5 rounded-full bg-current" />{({ queued: 'В очереди', processing: 'Обрабатывается', processed: 'Обработан', sent: 'Отправлен', failed: 'Ошибка' })[file.status]}</Badge></TableCell><TableCell><ChevronDown className="size-4 -rotate-90 text-muted-foreground" /></TableCell></TableRow>)}
            </TableBody></Table>{!filesLoading && !filesError && !files.length && <Empty>Файлы не найдены. Попробуйте изменить фильтры.</Empty>}{filesLoading && <div className="p-8 text-center text-sm text-muted-foreground">Загрузка журнала…</div>}</div>
            <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground"><span>Показано {files.length} из {number(fileTotal)} файлов</span><span>Период выгрузок · данные из SQL Server</span></div>
          </Card>
          <div className="flex items-start gap-2 rounded-xl border bg-blue-50/60 p-3 text-xs leading-relaxed text-blue-900 dark:bg-blue-950/20 dark:text-blue-200"><CircleAlert className="mt-0.5 size-4 shrink-0" /><p><span className="font-medium">Сроки обмена.</span> План-график GPT передаётся в месяце до планового ДН; результат GF содержит отдельные результаты DN_LIST (GST) и DN_PLAN (GPT).</p></div>
        </TabsContent>

        <TabsContent value="mo-export" className="mt-0 space-y-4">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Групповая выгрузка записей GF по МО</CardTitle>
              <CardDescription>Выберите код результата записи GST/GPT и при необходимости укажите МО. Для каждой МО в архиве будет отдельный CSV-файл; если выбрать одну МО, архив будет содержать один файл.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Статус записи (код результата)</label>
                  <Select value={bulkResultSelection} onValueChange={value => setBulkResultSelection(value ?? '')}>
                    <SelectTrigger><SelectValue placeholder="Выберите GST/GPT и код" /></SelectTrigger>
                    <SelectContent>
                      {moExportOptions.map(item => <SelectItem key={item.value} value={item.value}>{item.type} {item.code} — {item.description}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Файл GF для анализа</label>
                  <Select value={bulkFileId} disabled={gfFilesLoading || !gfFiles.length} onValueChange={value => setBulkFileId(value ?? '')}>
                    <SelectTrigger><SelectValue placeholder={gfFilesLoading ? 'Загружаем список GF…' : 'Выберите файл GF'} /></SelectTrigger>
                    <SelectContent>
                      {gfFiles.map(file => <SelectItem key={file.id} value={file.id}>{file.fileName} — {file.period}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Код МО (необязательно)</label>
                  <Input value={bulkMoCode} onChange={event => setBulkMoCode(event.target.value)} placeholder="Все МО, если оставить пустым" />
                </div>
              </div>
              {gfFilesError && <ErrorBox message={gfFilesError} />}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-4">
                <div>
                  <p className="font-medium">{selectedBulkFile?.fileName ?? (gfFilesLoading ? 'Загружаем список GF…' : 'Выберите файл GF')} {selectedMoExportOption && `· ${selectedMoExportOption.type} ${selectedMoExportOption.code}`}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Обрабатывается выбранный GF. Его записи будут разбиты по МО: один CSV-файл на каждую организацию.</p>
                </div>
                <Button onClick={exportMoGroup} disabled={!selectedMoExportOption || !bulkFileId || gfFilesLoading || !!gfFilesError}>
                  <ArrowDownToLine className="mr-2 size-4" />Скачать ZIP
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="mt-0 space-y-4">
          <Card className={`shadow-none ${gfFilePickerOpen ? 'relative z-30 overflow-visible' : ''}`}><CardContent className="flex flex-wrap items-center gap-3 p-3"><span className="text-sm font-medium">Результат GF</span><div className="relative min-w-[220px] flex-1 sm:flex-none"><Input role="combobox" aria-expanded={gfFilePickerOpen} aria-controls="gf-file-options" value={gfFilePickerOpen ? gfFileSearch : activeFile ? fileNameWithoutExtension(activeFile.fileName) : ''} onFocus={() => { setGfFileSearch(''); setGfFilePickerOpen(true) }} onChange={event => { setGfFileSearch(event.target.value); setGfFilePickerOpen(true) }} onBlur={() => window.setTimeout(() => setGfFilePickerOpen(false), 120)} placeholder="Поиск файла GF по названию" autoComplete="off" />{gfFilePickerOpen && <div id="gf-file-options" role="listbox" className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full min-w-[260px] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">{filteredGfFiles.length ? filteredGfFiles.map(file => <button key={file.id} type="button" role="option" aria-selected={file.id === activeFileId} onMouseDown={event => event.preventDefault()} onClick={() => { setActiveFileId(file.id); setPage(1); setGfFileSearch(''); setGfFilePickerOpen(false) }} className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground ${file.id === activeFileId ? 'bg-accent/60' : ''}`}><span>{fileNameWithoutExtension(file.fileName)}</span><span className="ml-3 shrink-0 text-xs text-muted-foreground">{file.period}</span></button>) : <p className="px-2 py-3 text-sm text-muted-foreground">GF-файлы не найдены</p>}</div>}</div>
            <Separator orientation="vertical" className="hidden h-8 sm:block" /><div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="Поиск по ЕНП" className="pl-9" /></div>
            <Select value={category} onValueChange={value => updateFilter(setCategory, value)}><SelectTrigger className="w-[190px]"><SelectValue placeholder="Категория" /></SelectTrigger><SelectContent><SelectItem value="all">Все категории</SelectItem>{categories.map(value => <SelectItem key={value} value={value}>{categoryLabel(value)}</SelectItem>)}</SelectContent></Select>
            <Select value={code} onValueChange={value => updateFilter(setCode, value)}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Код результата" /></SelectTrigger><SelectContent><SelectItem value="all">Все коды</SelectItem>{resultCodes.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
            <Input value={mo === 'all' ? '' : mo} onChange={event => updateFilter(setMo, event.target.value || 'all')} placeholder="Код МО" className="w-[140px]" />
            <Button variant="ghost" size="sm" onClick={resetRows}><X className="mr-1 size-4" />Сбросить</Button></CardContent></Card>
          <Card className="overflow-hidden shadow-none"><CardHeader className="flex flex-row flex-wrap items-center gap-3 border-b py-4"><div><CardTitle className="text-base">Строки файла GF</CardTitle><CardDescription className="mt-1">{recordsPage?.fileName ?? activeFile?.fileName ?? 'Выберите GF'} · записи по текущим фильтрам</CardDescription></div><div className="ml-auto flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={!activeFileId || activeFile?.type !== 'GF' || recordsLoading || d05ExportLoading} onClick={() => void exportD05Test()}>{d05ExportLoading ? 'Формируем D05…' : 'Тестовая выгрузка D05'}</Button><Button variant="outline" size="sm" disabled={!activeFileId || recordsLoading || recordCountLoading} onClick={() => void showRecordCount()}>Показать кол-во</Button><Button variant="outline" size="sm" disabled={!activeFileId || recordsLoading} onClick={exportCsv}><ArrowDownToLine className="mr-2 size-4" />Экспорт CSV</Button></div></CardHeader>
            {d05ExportLoading && <div className="border-b px-4 py-3" role="status" aria-live="polite"><div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm"><span>{d05ExportProgress < 10 ? 'Подготовка выгрузки на сервере…' : 'Передача архива…'}</span><span className="font-medium tabular-nums">{d05ExportProgress}% · {d05ExportFileCount === null ? 'подсчитываем файлы' : `${number(d05ExportFileCount)} файлов`}</span></div><div role="progressbar" aria-label="Прогресс выгрузки D05" aria-valuemin={1} aria-valuemax={100} aria-valuenow={d05ExportProgress} className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${d05ExportProgress}%` }} /></div></div>}            {d05ExportError && <div className="p-3"><ErrorBox message={d05ExportError} /></div>}
            {recordsError && <div className="p-3"><ErrorBox message={recordsError} /></div>}
            <div className="relative min-h-[520px] overflow-x-auto"><Table><TableHeader><TableRow><TableHead>ЕНП</TableHead><TableHead>DN_PATIENT_ID</TableHead><TableHead>CODE_L / CODE_P</TableHead><TableHead>МО</TableHead><TableHead>Диагноз</TableHead><TableHead>Результат GST / GPT</TableHead><TableHead>Категория</TableHead></TableRow></TableHeader><TableBody>{recordsPage?.items.map(record => <TableRow key={record.id} onClick={() => void openRecord(record)} className="cursor-pointer"><TableCell className="font-mono text-xs">{record.enp ?? '—'}</TableCell><TableCell className="font-mono text-xs">{record.dnPatientId ?? '—'}</TableCell><TableCell className="font-mono text-xs"><div>{record.dnList?.code ?? '—'}</div><div className="mt-1 text-muted-foreground">{record.dnPlan?.code ?? '—'}</div></TableCell><TableCell>{record.moCode ?? record.patient?.attachMoCode ?? '—'}</TableCell><TableCell><Badge variant="outline" className="font-mono">{record.diagnosisCode ?? '—'}</Badge></TableCell><TableCell><div className="flex flex-col items-start gap-1"><ResultBadge type="GST" code={record.dnList?.resultCode} dictionaries={dictionaryMap} /><ResultBadge type="GPT" code={record.dnPlan?.resultCode} dictionaries={dictionaryMap} /></div></TableCell><TableCell><div className="flex flex-col items-start gap-1">{record.dnList?.resultCode != null && <Badge variant="outline" className={`font-normal ${categoryTone[dictionaryMap.get(resultLookupKey('GST', record.dnList.resultCode))?.category ?? 'accepted']}`}>{categoryLabel(dictionaryMap.get(resultLookupKey('GST', record.dnList.resultCode))?.category ?? 'accepted')}</Badge>}{record.dnPlan?.resultCode != null && <Badge variant="outline" className={`font-normal ${categoryTone[dictionaryMap.get(resultLookupKey('GPT', record.dnPlan.resultCode))?.category ?? 'accepted']}`}>{categoryLabel(dictionaryMap.get(resultLookupKey('GPT', record.dnPlan.resultCode))?.category ?? 'accepted')}</Badge>}</div></TableCell></TableRow>)}</TableBody></Table>{!recordsLoading && !recordsError && !recordsPage?.items.length && <Empty>Записи не найдены. Измените параметры фильтра.</Empty>}{recordsLoading && <div className="absolute inset-0 z-10 grid place-items-center bg-background/75 px-4 py-6 backdrop-blur-[2px]"><RecordsLoader /></div>}</div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3"><span className="text-xs text-muted-foreground">Страница {recordsPage?.page ?? 1} · {recordsPage?.pageSize ?? 12} записей на странице</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={!recordsPage || page <= 1 || recordsLoading} onClick={() => setPage(page - 1)}><ArrowLeft className="mr-1 size-4" />Назад</Button><Button variant="outline" size="sm" disabled={!recordsPage?.hasMore || recordsLoading} onClick={() => setPage(page + 1)}>Вперёд<ArrowRight className="ml-1 size-4" /></Button></div></div>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="mt-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Сводка результатов сверки</h2><p className="text-sm text-muted-foreground">{activeFile?.fileName ?? 'Выберите GF'} · {number(analytics?.recordCount)} записей GF · GST и GPT учитываются отдельно</p></div><Select value={activeFileId} onValueChange={value => setActiveFileId(value ?? '')}><SelectTrigger className="w-[230px]"><SelectValue placeholder="Выберите GF" /></SelectTrigger><SelectContent>{files.filter(file => file.type === 'GF').map(file => <SelectItem key={file.id} value={file.id}>{file.fileName}</SelectItem>)}</SelectContent></Select></div>
          {analyticsError && <ErrorBox message={analyticsError} />}
          {analytics && <><div className="grid gap-4 xl:grid-cols-2"><Card className="shadow-none"><CardHeader className="pb-3"><CardTitle className="text-base">Результаты по категориям</CardTitle><CardDescription>Доля от проверок каждой ветви</CardDescription></CardHeader><CardContent className="space-y-4">{analytics.categories.map((item, index) => <div key={`${item.type}-${item.category}`}><div className="mb-2 flex items-center justify-between gap-3 text-sm"><div className="flex items-center gap-2"><Badge variant="secondary">{item.type}</Badge><Badge variant="outline" className={`font-normal ${categoryTone[item.category]}`}>{categoryLabel(item.category)}</Badge></div><span className="font-medium tabular-nums">{number(item.count)} <span className="font-normal text-muted-foreground">· {item.percent}%</span></span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full ${index % 2 ? 'bg-blue-500' : 'bg-primary/75'}`} style={{ width: `${item.percent}%` }} /></div></div>)}</CardContent></Card>
              <Card className="shadow-none"><CardHeader className="pb-3"><CardTitle className="text-base">Частые коды результата</CardTitle><CardDescription>Коды и описания из справочника SQL Server</CardDescription></CardHeader><CardContent className="space-y-3">{analytics.topResultCodes.map((item, index) => <div key={`${item.type}-${item.code}`} className="flex items-center gap-3"><span className="w-5 text-xs tabular-nums text-muted-foreground">{String(index + 1).padStart(2, '0')}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><ResultBadge type={item.type} code={item.code} dictionaries={dictionaryMap} /><span className="truncate text-sm">{item.description}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-blue-500" style={{ width: `${Math.round(item.count / (analytics.topResultCodes[0]?.count ?? 1) * 100)}%` }} /></div></div><span className="w-10 text-right text-sm font-medium tabular-nums">{number(item.count)}</span></div>)}{!analytics.topResultCodes.length && <Empty>Нет результатов для сводки.</Empty>}</CardContent></Card></div>
            <Card className="overflow-hidden shadow-none"><CardHeader className="border-b"><CardTitle className="text-base">Повторяющиеся ошибки</CardTitle><CardDescription>Одинаковый DN_PATIENT_ID, ветвь и код результата в последовательных отчётных периодах</CardDescription></CardHeader><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>DN_PATIENT_ID</TableHead><TableHead>МО</TableHead><TableHead>Код и результат</TableHead><TableHead>Повторений</TableHead><TableHead>Что делать</TableHead></TableRow></TableHeader><TableBody>{analytics.repeatedErrors.map((item, index) => { const result = dictionaryMap.get(resultLookupKey(item.type, item.code)); return <TableRow key={`${item.dnPatientId}-${item.type}-${item.code}-${index}`}><TableCell className="font-mono text-xs">{item.dnPatientId}</TableCell><TableCell>{item.moCode ?? '—'}</TableCell><TableCell><div className="flex flex-col items-start gap-1"><ResultBadge type={item.type} code={item.code} dictionaries={dictionaryMap} /><span className="text-xs text-muted-foreground">{result?.description ?? item.code}</span></div></TableCell><TableCell><Badge variant="secondary">{item.periodCount} периода</Badge></TableCell><TableCell className="max-w-[340px] text-sm text-muted-foreground">{item.recommendation ?? result?.recommendation ?? '—'}</TableCell></TableRow>})}</TableBody></Table>{!analytics.repeatedErrors.length && <Empty>Повторяющиеся ошибки не найдены.</Empty>}</div></Card>
          </>}
        </TabsContent>
      </Tabs>

      <Dialog open={recordCountOpen} onOpenChange={setRecordCountOpen}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Количество записей</DialogTitle><DialogDescription>{activeFile?.fileName ?? recordsPage?.fileName ?? 'Файл GF'} · с учётом текущих фильтров</DialogDescription></DialogHeader>{recordCountLoading ? <div className="py-6 text-center text-sm text-muted-foreground">Подсчитываем записи…</div> : recordCountError ? <ErrorBox message={recordCountError} /> : <p className="py-2 text-2xl font-semibold tabular-nums">{number(recordCount)}</p>}</DialogContent></Dialog>
      <Dialog open={!!selectedFile} onOpenChange={open => !open && setSelectedFile(null)}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle className="font-mono text-base">{selectedFile?.fileName}</DialogTitle><DialogDescription>Карточка файла обмена</DialogDescription></DialogHeader>{fileDetailLoading ? <div className="py-8 text-center text-sm text-muted-foreground">Загрузка карточки…</div> : selectedFile && <><div className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm"><span className="text-muted-foreground">Тип и направление</span><span>{selectedFile.type} · {selectedFile.direction === 'inbound' ? 'Входящий' : 'Исходящий'}</span><span className="text-muted-foreground">Отчётный период</span><span>{selectedFile.period}</span><span className="text-muted-foreground">Количество записей</span><span>{number(selectedFile.recordCount)}</span><span className="text-muted-foreground">Дата обработки</span><span>{formatDate(selectedFile.createdAt)}</span><span className="text-muted-foreground">Размер файла</span><span>{formatBytes(selectedFile.fileSizeBytes)}</span><span className="text-muted-foreground">Статус</span><span>{selectedFile.status}</span><span className="text-muted-foreground">Контрольная сумма</span><span className="break-all font-mono text-xs">{selectedFile.checksum ?? '—'}</span></div>{selectedFile.error && <ErrorBox message={`${selectedFile.error.code}: ${selectedFile.error.message}`} />}{selectedFile.type === 'GF' && <Button className="w-full" onClick={() => openContents(selectedFile)}>Открыть строки GF</Button>}</>}</DialogContent></Dialog>
          <Dialog open={!!selectedRecord} onOpenChange={open => !open && setSelectedRecord(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Карточка результата сверки</DialogTitle><DialogDescription>{selectedRecord?.dnPatientId ?? '—'} · {selectedRecord?.diagnosisCode ?? '—'}</DialogDescription></DialogHeader>{recordDetailLoading ? <div className="py-8 text-center text-sm text-muted-foreground">Загрузка карточки…</div> : selectedRecord && <><div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm"><span className="text-muted-foreground">ЕНП</span><span className="font-mono">{selectedRecord.enp ?? '—'}</span><span className="text-muted-foreground">DN_PATIENT_ID</span><span className="font-mono">{selectedRecord.dnPatientId ?? '—'}</span><span className="text-muted-foreground">МО прикрепления</span><span>{selectedRecord.patient?.attachMoCode ?? selectedRecord.moCode ?? '—'}</span><span className="text-muted-foreground">Диагноз МКБ‑10</span><span>{selectedRecord.diagnosisCode ?? '—'}</span><span className="text-muted-foreground">Группа ДН</span><span>{selectedRecord.groupRhCode ?? '—'} · {selectedRecord.groupRhName ?? '—'}</span><span className="text-muted-foreground">Профиль</span><span>{selectedRecord.groupRhProfile ?? '—'}</span><span className="text-muted-foreground">Пол / дата рождения</span><span>{selectedRecord.patient?.sexCode ?? '—'} / {selectedRecord.patient?.birthDate ?? '—'}</span><span className="text-muted-foreground">СМО</span><span>{selectedRecord.patient?.smoCode ?? '—'}</span><span className="text-muted-foreground">Прикрепление с</span><span>{selectedRecord.patient?.attachDate ?? '—'}</span><span className="text-muted-foreground">CODE_L / CODE_P</span><span className="font-mono text-xs">{selectedRecord.dnList?.code ?? '—'}<br />{selectedRecord.dnPlan?.code ?? '—'}</span></div><Separator />{(['GST', 'GPT'] as const).map(type => { const branch = type === 'GST' ? selectedRecord.dnList : selectedRecord.dnPlan; const result = dictionaryMap.get(resultLookupKey(type, branch?.resultCode)); return <section key={type} className="space-y-2"><h3 className="text-sm font-semibold">{type === 'GST' ? 'Список ДН · GST / DN_LIST' : 'План-график · GPT / DN_PLAN'}</h3><div className="flex flex-wrap items-center gap-2"><ResultBadge type={type} code={branch?.resultCode} dictionaries={dictionaryMap} /><span className="text-sm">{branch?.resultDescription ?? result?.description ?? '—'}</span></div><p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">{result?.recommendation ?? '—'}</p><p className="text-xs text-muted-foreground">{branch?.fileName ?? '—'} · {branch?.code ?? '—'} · {branch?.resultDate ?? '—'}</p></section>})}{selectedRecord.gisEvidence && <section className="space-y-2"><h3 className="text-sm font-semibold">Подтверждающий случай медпомощи</h3><pre className="overflow-auto rounded-lg border bg-muted/40 p-3 text-xs">{JSON.stringify(selectedRecord.gisEvidence, null, 2)}</pre></section>}</>}</DialogContent></Dialog>
      {dictionariesError && <div className="mt-4"><ErrorBox message={dictionariesError} /></div>}
      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs text-muted-foreground"><span>СИСЗЛ · контроль обмена файлами ДН</span><span>Данные загружаются из TF_SISZL через REST API</span></footer>
    </div>
  </main>
}
