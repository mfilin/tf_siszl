import { useMemo, useState } from 'react'
import { Activity, ArrowDownToLine, ArrowLeft, ArrowRight, Check, ChevronDown, CircleAlert, CircleCheck, Clock3, FileArchive, FileText, Filter, Moon, Search, Sun, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type FileType = 'GST' | 'GPT' | 'GF'
type FileRow = { id: string; name: string; type: FileType; period: string; direction: 'Исходящий' | 'Входящий'; records: number; date: string; status: 'Загружен' | 'Отправлен' | 'Ошибка' | 'Загрузка'; size: string; source?: string }
type Result = { code: number; title: string; category: 'Принято' | 'Принято с замечанием' | 'Исправить и отправить' | 'Проверить обоснованность' | 'Закрыт / исключить' | 'Следует за GST' | 'Нет в списках GST'; action: string }
type RecordRow = { enp: string; patientId: string; codeL: string; codeP: string; mo: string; diagnosis: string; date: string; gst: Result; gpt: Result }

const categoryTone: Record<Result['category'], string> = {
  'Принято': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900',
  'Принято с замечанием': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900',
  'Исправить и отправить': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900',
  'Проверить обоснованность': 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900',
  'Закрыт / исключить': 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
  'Следует за GST': 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
  'Нет в списках GST': 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900',
}

const results: Result[] = [
  { code: 201, category: 'Принято', title: 'Эпизод зарегистрирован', action: 'Дополнительные действия не требуются.' },
  { code: 202, category: 'Принято с замечанием', title: 'Принято без подтверждения МО', action: 'В следующем периоде обеспечить сведения о МО в реестрах счетов.' },
  { code: 203, category: 'Закрыт / исключить', title: 'Все эпизоды закрыты', action: 'Снять застрахованное лицо с учёта ДН в медицинской организации.' },
  { code: 204, category: 'Исправить и отправить', title: 'Проблема со статусом полиса', action: 'Уточнить статус полиса в ФЕРЗЛ, затем передать запись повторно.' },
  { code: 205, category: 'Проверить обоснованность', title: 'ДН не подтверждена МО', action: 'Проверить сведения о ДН и подтверждающий случай оказания медицинской помощи.' },
  { code: 207, category: 'Нет в списках GST', title: 'Нет записи в списках ДН', action: 'Проверить включение застрахованного лица в исходный список GST.' },
  { code: 209, category: 'Исправить и отправить', title: 'Не указан диагноз', action: 'Уточнить код диагноза по учётной форме № 030/у.' },
  { code: 210, category: 'Проверить обоснованность', title: 'Диагноз вне перечня ХНИЗ', action: 'Проверить диагноз и его соответствие перечню групп ДН.' },
  { code: 301, category: 'Принято', title: 'Принято к информированию', action: 'Данные по состоянию ЗЛ на ДН подтверждены в ГИС ОМС.' },
  { code: 302, category: 'Закрыт / исключить', title: 'Застрахованное лицо умерло', action: 'Исключить запись из плана-графика.' },
  { code: 303, category: 'Закрыт / исключить', title: 'Нет страхования по ОМС', action: 'Проверить сведения ФЕРЗЛ и актуальность страхования.' },
  { code: 304, category: 'Проверить обоснованность', title: 'ДН не подтверждена', action: 'Проверить связь диагноза и сведений о медицинской помощи.' },
  { code: 305, category: 'Исправить и отправить', title: 'Диагноз не входит в группу ХНИЗ', action: 'Проверить диагноз по МКБ‑10 и справочник групп ХНИЗ.' },
  { code: 307, category: 'Нет в списках GST', title: 'Нет записи о ДН', action: 'Сверить запись плана-графика со списком состоящих/подлежащих ДН.' },
  { code: 312, category: 'Исправить и отправить', title: 'Не определена специальность врача', action: 'Заполнить специальность врача, проводящего ДН.' },
  { code: 313, category: 'Исправить и отправить', title: 'Не заполнены даты', action: 'Заполнить даты начала/окончания приёма и окончания информирования.' },
  { code: 314, category: 'Исправить и отправить', title: 'Неверный срок информирования', action: 'Проверить срок выполнения информирования.' },
  { code: 319, category: 'Исправить и отправить', title: 'Повторное информирование раньше срока', action: 'Сдвинуть повторное информирование: ранее чем через 3 месяца.' },
  { code: 399, category: 'Исправить и отправить', title: 'Ошибка форматно-логического контроля', action: 'Исправить запись согласно описанию ошибки в ГИС ОМС.' },
]
const fileRows: FileRow[] = [
  { id: 'f-gst-2607-1', name: 'GST34_2607_N1.xml', type: 'GST', period: '2026-07', direction: 'Исходящий', records: 18420, date: '28.07.2026 09:14', status: 'Отправлен', size: '8,4 МБ' },
  { id: 'f-gpt-2607-1', name: 'GPT34_2607_N1.xml', type: 'GPT', period: '2026-07', direction: 'Исходящий', records: 18420, date: '28.07.2026 09:17', status: 'Отправлен', size: '5,1 МБ' },
  { id: 'f-gf-2607', name: 'GF34_2607.xml', type: 'GF', period: '2026-07', direction: 'Входящий', records: 19108, date: '04.08.2026 16:22', status: 'Загружен', size: '11,2 МБ' },
  { id: 'f-gst-2608-1', name: 'GST34_2608_N1.xml', type: 'GST', period: '2026-08', direction: 'Исходящий', records: 19386, date: '27.08.2026 10:06', status: 'Отправлен', size: '9,2 МБ' },
  { id: 'f-gpt-2608-1', name: 'GPT34_2608_N1.xml', type: 'GPT', period: '2026-08', direction: 'Исходящий', records: 19386, date: '27.08.2026 10:12', status: 'Отправлен', size: '5,4 МБ' },
  { id: 'f-gf-2608', name: 'GF34_2608.xml', type: 'GF', period: '2026-08', direction: 'Входящий', records: 19871, date: '03.09.2026 12:45', status: 'Загружен', size: '12,6 МБ' },
  { id: 'f-gst-2609-1', name: 'GST34_2609_N1.xml', type: 'GST', period: '2026-09', direction: 'Исходящий', records: 20114, date: '28.09.2026 08:30', status: 'Отправлен', size: '9,7 МБ' },
  { id: 'f-gpt-2609-1', name: 'GPT34_2609_N1.xml', type: 'GPT', period: '2026-09', direction: 'Исходящий', records: 20114, date: '28.09.2026 08:31', status: 'Ошибка', size: '5,9 МБ' },
  { id: 'f-gf-2609', name: 'GF34_2609.xml', type: 'GF', period: '2026-09', direction: 'Входящий', records: 20490, date: '20.10.2026 14:03', status: 'Загрузка', size: '—' },
]
const diagnoses = ['I10', 'I25.9', 'E11.9', 'C50.9', 'I48', 'E66.0', 'I63.9']
const mos = ['340001', '340014', '340027', '340038', '340052', '340066']
const records: RecordRow[] = Array.from({ length: 240 }, (_, i) => {
  const gst = results[[0, 0, 0, 0, 0, 1, 4, 5, 6, 7, 8, 2, 3, 9][(i * 17 + 3) % 14]]
  const gpt = results[[8, 8, 8, 8, 12, 13, 14, 15, 16, 17, 18, 10][(i * 11 + 1) % 12]]
  return { enp: String(3400000000000000 + ((i * 7919) % 999999999999)).slice(0, 16), patientId: `DN${String(100001 + (i * 47) % 899999)}`, codeL: `L2608-${String(1001 + i).padStart(5, '0')}`, codeP: `P2608-${String(1001 + i).padStart(5, '0')}`, mo: mos[i % mos.length], diagnosis: diagnoses[i % diagnoses.length], date: `2026-10-${String(1 + (i % 20)).padStart(2, '0')}`, gst, gpt }
})
const number = (n: number) => new Intl.NumberFormat('ru-RU').format(n)
function ResultBadge({ result, type }: { result: Result; type: FileType }) { return <Badge variant="outline" className={`gap-1.5 font-medium ${categoryTone[result.category]}`}><span className="size-1.5 rounded-full bg-current" />{type} {result.code}</Badge> }
function StatusBadge({ status }: { status: FileRow['status'] }) {
  const Icon = status === 'Ошибка' ? CircleAlert : status === 'Загрузка' ? Clock3 : status === 'Отправлен' ? ArrowDownToLine : CircleCheck
  const tone = status === 'Ошибка' ? 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/40 dark:border-rose-900' : status === 'Загрузка' ? 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-900' : status === 'Отправлен' ? 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/40 dark:border-blue-900' : 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-900'
  return <Badge variant="outline" className={`gap-1.5 font-medium ${tone}`}><Icon className="size-3" />{status}</Badge>
}
function Empty({ children }: { children: string }) { return <div className="px-6 py-14 text-center text-sm text-muted-foreground"><div className="mx-auto mb-3 grid size-10 place-items-center rounded-xl bg-muted"><Filter className="size-4" /></div>{children}</div> }

export default function App() {
  const [dark, setDark] = useState(false)
  const [fileQuery, setFileQuery] = useState('')
  const [fileType, setFileType] = useState('all')
  const [filePeriod, setFilePeriod] = useState('all')
  const [fileStatus, setFileStatus] = useState('all')
  const [selectedFile, setSelectedFile] = useState<FileRow | null>(null)
  const [activeFileId, setActiveFileId] = useState('f-gf-2608')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [code, setCode] = useState('all')
  const [mo, setMo] = useState('all')
  const [page, setPage] = useState(0)
  const [selectedRecord, setSelectedRecord] = useState<RecordRow | null>(null)
  const [tab, setTab] = useState('files')
  const filteredFiles = useMemo(() => fileRows.filter(f => (!fileQuery || f.name.toLowerCase().includes(fileQuery.toLowerCase())) && (fileType === 'all' || f.type === fileType) && (filePeriod === 'all' || f.period === filePeriod) && (fileStatus === 'all' || f.status === fileStatus)), [fileQuery, fileType, filePeriod, fileStatus])
  const activeFile = fileRows.find(f => f.id === activeFileId)!
  const filteredRecords = useMemo(() => records.filter(r => (!query || r.enp.includes(query) || r.patientId.toLowerCase().includes(query.toLowerCase()) || r.codeL.toLowerCase().includes(query.toLowerCase()) || r.codeP.toLowerCase().includes(query.toLowerCase())) && (mo === 'all' || r.mo === mo) && (code === 'all' || String(r.gst.code) === code || String(r.gpt.code) === code) && (category === 'all' || r.gst.category === category || r.gpt.category === category)), [query, mo, code, category])
  const pageSize = 12
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize))
  const visibleRecords = filteredRecords.slice(page * pageSize, (page + 1) * pageSize)
  const setRecordFilter = (setter: (value: string) => void, value: string | null) => { setter(value ?? 'all'); setPage(0) }
  const openContents = (file = activeFile) => { setActiveFileId(file.id); setSelectedFile(null); setTab('content') }
  const exportCsv = () => {
    const header = ['ENP', 'DN_PATIENT_ID', 'CODE_L', 'CODE_P', 'MCOD', 'DIAG_CODE', 'DN_LIST_RESULT_CODE', 'DN_PLAN_RESULT_CODE']
    const lines = filteredRecords.map(r => [r.enp, r.patientId, r.codeL, r.codeP, r.mo, r.diagnosis, r.gst.code, r.gpt.code].join(';'))
    const blob = new Blob(['\ufeff' + [header.join(';'), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${activeFile.name.replace('.xml', '')}_filtered.csv`; a.click(); URL.revokeObjectURL(a.href)
  }
  const resetFiles = () => { setFileQuery(''); setFileType('all'); setFilePeriod('all'); setFileStatus('all') }
  const resetRows = () => { setQuery(''); setMo('all'); setCategory('all'); setCode('all'); setPage(0) }
  const summary = useMemo(() => {
    const counts = new Map<string, number>()
    const codes = new Map<string, { result: Result; type: FileType; count: number }>()
    records.forEach(r => [[r.gst, 'GST'], [r.gpt, 'GPT']].forEach(([result, type]) => {
      const item = result as Result; const typ = type as FileType
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1)
      if (item.code !== 201 && item.code !== 301) { const key = `${typ}-${item.code}`; const prev = codes.get(key); codes.set(key, { result: item, type: typ, count: (prev?.count ?? 0) + 1 }) }
    }))
    return { counts: [...counts.entries()].sort((a, b) => b[1] - a[1]), codes: [...codes.values()].sort((a, b) => b.count - a.count).slice(0, 6) }
  }, [])
  const repeatErrors = useMemo(() => {
    const pairs = new Map<string, { patientId: string; mo: string; result: Result; periods: number }>()
    records.filter(r => r.gst.code !== 201 && r.gst.code !== 202).forEach(r => { const key = `${r.patientId}-${r.gst.code}`; const prev = pairs.get(key); pairs.set(key, { patientId: r.patientId, mo: r.mo, result: r.gst, periods: (prev?.periods ?? 1) + 1 }) })
    return [...pairs.values()].filter(x => x.periods >= 2).slice(0, 6)
  }, [])

  return <main className={dark ? 'dark min-h-screen' : 'min-h-screen'}>
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground"><span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground"><Activity className="size-4" /></span> СИСЗЛ · контроль обмена</div><h1 className="text-2xl font-semibold tracking-tight">Учёт файлов ДН</h1><p className="mt-1 text-sm text-muted-foreground">Выгрузки GST/GPT и результаты сверки GF</p></div>
        <div className="flex items-center gap-2"><div className="hidden rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground sm:block">Регион <span className="ml-2 font-medium text-foreground">34 · Волгоградская область</span></div><Button variant="outline" size="icon" aria-label="Сменить тему" onClick={() => { const next = !dark; setDark(next); document.documentElement.classList.toggle('dark', next) }}>{dark ? <Sun /> : <Moon />}</Button></div>
      </header>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-5 h-auto w-full justify-center gap-1 overflow-x-auto rounded-xl border bg-muted/60 p-1">
          <TabsTrigger value="files" className="gap-2"><FileArchive className="size-4" />Журнал файлов<span className="ml-1 rounded-md bg-background/80 px-1.5 py-0.5 text-[10px]">{fileRows.length}</span></TabsTrigger>
          <TabsTrigger value="content" className="gap-2"><FileText className="size-4" />Строки GF</TabsTrigger>
          <TabsTrigger value="summary" className="gap-2"><Activity className="size-4" />Сводка сверки</TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="mt-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Файлов в журнале', value: fileRows.length, hint: 'за выбранный период', icon: FileArchive, color: 'text-foreground' },
              { label: 'Исходящие GST/GPT', value: fileRows.filter(f => f.type !== 'GF').length, hint: 'пакеты ТФОМС', icon: ArrowDownToLine, color: 'text-blue-600 dark:text-blue-400' },
              { label: 'Получено ответов GF', value: fileRows.filter(f => f.type === 'GF').length, hint: 'ответы ГИС ОМС', icon: Check, color: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Файлов с ошибкой', value: fileRows.filter(f => f.status === 'Ошибка').length, hint: 'требуют внимания', icon: CircleAlert, color: 'text-rose-600 dark:text-rose-400' },
            ].map(s => <Card key={s.label} className="shadow-none"><CardContent className="flex items-start justify-between p-4"><div><p className="text-sm text-muted-foreground">{s.label}</p><p className={`mt-1 text-2xl font-semibold tabular-nums ${s.color}`}>{s.value}</p><p className="mt-1 text-xs text-muted-foreground">{s.hint}</p></div><span className="grid size-9 place-items-center rounded-lg bg-muted"><s.icon className={`size-4 ${s.color}`} /></span></CardContent></Card>)}
          </div>
          <Card className="overflow-hidden shadow-none">
            <CardHeader className="border-b pb-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">Журнал обмена</CardTitle><CardDescription className="mt-1">Пакеты GST/GPT и ответы ГИС ОМС по выбранным фильтрам</CardDescription></div><Badge variant="outline" className="font-normal">Обновлено 21.10.2026, 14:03</Badge></div></CardHeader>
            <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 p-3">
              <div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={fileQuery} onChange={e => setFileQuery(e.target.value)} placeholder="Поиск по имени файла" className="pl-9" /></div>
              <Select value={fileType} onValueChange={v => setFileType(v ?? 'all')}><SelectTrigger className="w-[130px]"><SelectValue placeholder="Тип файла" /></SelectTrigger><SelectContent><SelectItem value="all">Все типы</SelectItem>{['GST', 'GPT', 'GF'].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
              <Select value={filePeriod} onValueChange={v => setFilePeriod(v ?? 'all')}><SelectTrigger className="w-[155px]"><SelectValue placeholder="Период" /></SelectTrigger><SelectContent><SelectItem value="all">Все периоды</SelectItem>{[...new Set(fileRows.map(f => f.period))].sort().reverse().map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
              <Select value={fileStatus} onValueChange={v => setFileStatus(v ?? 'all')}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Статус" /></SelectTrigger><SelectContent><SelectItem value="all">Все статусы</SelectItem>{['Загружен', 'Отправлен', 'Ошибка', 'Загрузка'].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
              <Button variant="ghost" size="sm" onClick={resetFiles}><X className="mr-1 size-4" />Сбросить</Button>
            </div>
            <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="w-[90px]">Тип</TableHead><TableHead>Файл</TableHead><TableHead>Период</TableHead><TableHead>Направление</TableHead><TableHead className="text-right">Записей</TableHead><TableHead>Дата</TableHead><TableHead>Статус</TableHead><TableHead className="w-10" /></TableRow></TableHeader><TableBody>
              {filteredFiles.map(f => <TableRow key={f.id} onClick={() => setSelectedFile(f)} className="cursor-pointer"><TableCell><Badge variant="secondary" className="font-mono text-[11px]">{f.type}</Badge></TableCell><TableCell className="font-mono text-xs font-medium">{f.name}</TableCell><TableCell className="tabular-nums">{f.period}</TableCell><TableCell className="text-muted-foreground">{f.direction}</TableCell><TableCell className="text-right tabular-nums">{number(f.records)}</TableCell><TableCell className="whitespace-nowrap text-muted-foreground">{f.date}</TableCell><TableCell><StatusBadge status={f.status} /></TableCell><TableCell><ChevronDown className="size-4 -rotate-90 text-muted-foreground" /></TableCell></TableRow>)}
            </TableBody></Table>{!filteredFiles.length && <Empty>Файлы не найдены. Попробуйте изменить фильтры.</Empty>}</div>
            <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground"><span>Показано {filteredFiles.length} из {fileRows.length} файлов</span><span>Период выгрузок · июль—сентябрь 2026</span></div>
          </Card>
          <div className="flex items-start gap-2 rounded-xl border bg-blue-50/60 p-3 text-xs leading-relaxed text-blue-900 dark:bg-blue-950/20 dark:text-blue-200"><CircleAlert className="mt-0.5 size-4 shrink-0" /><p><span className="font-medium">Сроки обмена.</span> План-график GPT передаётся в месяце до планового ДН; результат GF содержит отдельные результаты DN_LIST (GST) и DN_PLAN (GPT).</p></div>
        </TabsContent>

        <TabsContent value="content" className="mt-0 space-y-4">
          <Card className="shadow-none"><CardContent className="flex flex-wrap items-center gap-3 p-3"><span className="text-sm font-medium">Результат GF</span><Select value={activeFileId} onValueChange={v => { setActiveFileId(v ?? activeFileId); setPage(0) }}><SelectTrigger className="min-w-[220px] flex-1 sm:flex-none"><SelectValue /></SelectTrigger><SelectContent>{fileRows.filter(f => f.type === 'GF').map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent></Select><Separator orientation="vertical" className="hidden h-8 sm:block" /><div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={e => setRecordFilter(setQuery, e.target.value)} placeholder="ЕНП, DN_PATIENT_ID или CODE" className="pl-9" /></div>
            <Select value={category} onValueChange={v => setRecordFilter(setCategory, v)}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Категория" /></SelectTrigger><SelectContent><SelectItem value="all">Все категории</SelectItem>{Object.keys(categoryTone).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
            <Select value={code} onValueChange={v => setRecordFilter(setCode, v)}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Код результата" /></SelectTrigger><SelectContent><SelectItem value="all">Все коды</SelectItem>{[...new Set(records.flatMap(r => [r.gst.code, r.gpt.code]))].sort((a, b) => a - b).map(v => <SelectItem key={v} value={String(v)}>{v}</SelectItem>)}</SelectContent></Select>
            <Select value={mo} onValueChange={v => setRecordFilter(setMo, v)}><SelectTrigger className="w-[140px]"><SelectValue placeholder="МО" /></SelectTrigger><SelectContent><SelectItem value="all">Все МО</SelectItem>{mos.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
            <Button variant="ghost" size="sm" onClick={resetRows}><X className="mr-1 size-4" />Сбросить</Button></CardContent></Card>
          <Card className="overflow-hidden shadow-none"><CardHeader className="flex flex-row items-center gap-3 border-b py-4"><div><CardTitle className="text-base">Строки файла GF</CardTitle><CardDescription className="mt-1">{activeFile.name} · {number(filteredRecords.length)} записей после фильтрации</CardDescription></div><div className="ml-auto"><Button variant="outline" size="sm" onClick={exportCsv}><ArrowDownToLine className="mr-2 size-4" />Экспорт CSV</Button></div></CardHeader>
            <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>ЕНП</TableHead><TableHead>DN_PATIENT_ID</TableHead><TableHead>CODE_L / CODE_P</TableHead><TableHead>МО</TableHead><TableHead>Диагноз</TableHead><TableHead>Результат GST / GPT</TableHead><TableHead>Категория</TableHead></TableRow></TableHeader><TableBody>{visibleRecords.map(r => <TableRow key={r.codeL} onClick={() => setSelectedRecord(r)} className="cursor-pointer"><TableCell className="font-mono text-xs">{r.enp}</TableCell><TableCell className="font-mono text-xs">{r.patientId}</TableCell><TableCell className="font-mono text-xs"><div>{r.codeL}</div><div className="mt-1 text-muted-foreground">{r.codeP}</div></TableCell><TableCell>{r.mo}</TableCell><TableCell><Badge variant="outline" className="font-mono">{r.diagnosis}</Badge></TableCell><TableCell><div className="flex flex-col items-start gap-1"><ResultBadge result={r.gst} type="GST" /><ResultBadge result={r.gpt} type="GPT" /></div></TableCell><TableCell><div className="flex flex-col items-start gap-1"><Badge variant="outline" className={`font-normal ${categoryTone[r.gst.category]}`}>{r.gst.category}</Badge><Badge variant="outline" className={`font-normal ${categoryTone[r.gpt.category]}`}>{r.gpt.category}</Badge></div></TableCell></TableRow>)}</TableBody></Table>{!visibleRecords.length && <Empty>Записи не найдены. Измените параметры фильтра.</Empty>}</div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3"><span className="text-xs text-muted-foreground">Страница {page + 1} из {pageCount} · {pageSize} записей на странице</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ArrowLeft className="mr-1 size-4" />Назад</Button><Button variant="outline" size="sm" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>Вперёд<ArrowRight className="ml-1 size-4" /></Button></div></div>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="mt-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Сводка результатов сверки</h2><p className="text-sm text-muted-foreground">{activeFile.name} · {number(records.length)} записей GF · результаты GST и GPT считаются отдельно</p></div><Select value={activeFileId} onValueChange={v => setActiveFileId(v ?? activeFileId)}><SelectTrigger className="w-[230px]"><SelectValue /></SelectTrigger><SelectContent>{fileRows.filter(f => f.type === 'GF').map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-4 xl:grid-cols-2"><Card className="shadow-none"><CardHeader className="pb-3"><CardTitle className="text-base">Результаты по категориям</CardTitle><CardDescription>Доля от всех проверок записей GST и GPT</CardDescription></CardHeader><CardContent className="space-y-4">{summary.counts.map(([label, count]) => { const pct = Math.round(count / (records.length * 2) * 100); return <div key={label}><div className="mb-2 flex items-center justify-between gap-3 text-sm"><Badge variant="outline" className={`font-normal ${categoryTone[label as Result['category']]}`}>{label}</Badge><span className="font-medium tabular-nums">{number(count)} <span className="font-normal text-muted-foreground">· {pct}%</span></span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/75" style={{ width: `${pct}%` }} /></div></div> })}</CardContent></Card>
            <Card className="shadow-none"><CardHeader className="pb-3"><CardTitle className="text-base">Частые коды результата</CardTitle><CardDescription>Без кодов «принято» 201 и 301</CardDescription></CardHeader><CardContent className="space-y-3">{summary.codes.map((item, i) => <div key={`${item.type}-${item.result.code}`} className="flex items-center gap-3"><span className="w-5 text-xs tabular-nums text-muted-foreground">{String(i + 1).padStart(2, '0')}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><ResultBadge result={item.result} type={item.type} /><span className="truncate text-sm">{item.result.title}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.round(item.count / (summary.codes[0]?.count ?? 1) * 100)}%` }} /></div></div><span className="w-10 text-right text-sm font-medium tabular-nums">{item.count}</span></div>)}</CardContent></Card></div>
          <Card className="overflow-hidden shadow-none"><CardHeader className="border-b"><CardTitle className="text-base">Повторяющиеся ошибки</CardTitle><CardDescription>Один и тот же код GST у записи повторяется в двух и более проверках</CardDescription></CardHeader><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>DN_PATIENT_ID</TableHead><TableHead>МО</TableHead><TableHead>Код и результат</TableHead><TableHead>Повторений</TableHead><TableHead>Что делать</TableHead></TableRow></TableHeader><TableBody>{repeatErrors.map((x, i) => <TableRow key={`${x.patientId}-${i}`}><TableCell className="font-mono text-xs">{x.patientId}</TableCell><TableCell>{x.mo}</TableCell><TableCell><div className="flex flex-col items-start gap-1"><ResultBadge result={x.result} type="GST" /><span className="text-xs text-muted-foreground">{x.result.title}</span></div></TableCell><TableCell><Badge variant="secondary">{x.periods} периода</Badge></TableCell><TableCell className="max-w-[340px] text-sm text-muted-foreground">{x.result.action}</TableCell></TableRow>)}</TableBody></Table>{!repeatErrors.length && <Empty>Повторяющиеся ошибки не найдены.</Empty>}</div></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedFile} onOpenChange={open => !open && setSelectedFile(null)}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle className="font-mono text-base">{selectedFile?.name}</DialogTitle><DialogDescription>Карточка файла обмена</DialogDescription></DialogHeader>{selectedFile && <><div className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm"><span className="text-muted-foreground">Тип и направление</span><span>{selectedFile.type} · {selectedFile.direction}</span><span className="text-muted-foreground">Отчётный период</span><span>{selectedFile.period}</span><span className="text-muted-foreground">Количество записей</span><span>{number(selectedFile.records)}</span><span className="text-muted-foreground">Дата обработки</span><span>{selectedFile.date}</span><span className="text-muted-foreground">Размер файла</span><span>{selectedFile.size}</span><span className="text-muted-foreground">Статус</span><StatusBadge status={selectedFile.status} /></div><div className="rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">{selectedFile.type === 'GF' ? 'Файл-ответ ГИС ОМС содержит результат сверки GST (DN_LIST) и GPT (DN_PLAN). Подробные строки доступны во вкладке «Строки GF».' : selectedFile.status === 'Ошибка' ? 'Передача файла завершилась ошибкой. Проверьте статус обработки и повторно сформируйте выгрузку после исправления.' : 'Файл зарегистрирован в журнале обмена. Результат сверки будет доступен после получения входящего GF.'}</div>{selectedFile.type === 'GF' && <Button className="w-full" onClick={() => openContents(selectedFile)}>Открыть строки GF</Button>}</>}</DialogContent></Dialog>
      <Dialog open={!!selectedRecord} onOpenChange={open => !open && setSelectedRecord(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Карточка результата сверки</DialogTitle><DialogDescription>{selectedRecord?.patientId} · {selectedRecord?.diagnosis}</DialogDescription></DialogHeader>{selectedRecord && <><div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm"><span className="text-muted-foreground">ЕНП</span><span className="font-mono">{selectedRecord.enp}</span><span className="text-muted-foreground">DN_PATIENT_ID</span><span className="font-mono">{selectedRecord.patientId}</span><span className="text-muted-foreground">МО</span><span>{selectedRecord.mo}</span><span className="text-muted-foreground">Диагноз МКБ‑10</span><span>{selectedRecord.diagnosis}</span><span className="text-muted-foreground">Дата результата</span><span>{selectedRecord.date}</span><span className="text-muted-foreground">CODE_L / CODE_P</span><span className="font-mono text-xs">{selectedRecord.codeL}<br />{selectedRecord.codeP}</span></div><Separator /><section className="space-y-2"><h3 className="text-sm font-semibold">Список ДН · GST / DN_LIST</h3><div className="flex flex-wrap items-center gap-2"><ResultBadge result={selectedRecord.gst} type="GST" /><span className="text-sm">{selectedRecord.gst.title}</span></div><p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">{selectedRecord.gst.action}</p></section><section className="space-y-2"><h3 className="text-sm font-semibold">План-график · GPT / DN_PLAN</h3><div className="flex flex-wrap items-center gap-2"><ResultBadge result={selectedRecord.gpt} type="GPT" /><span className="text-sm">{selectedRecord.gpt.title}</span></div><p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">{selectedRecord.gpt.action}</p></section></>}</DialogContent></Dialog>
      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs text-muted-foreground"><span>СИСЗЛ · контроль обмена файлами ДН</span><span>Демонстрационные данные · интерфейс для согласования</span></footer>
    </div>
  </main>
}

