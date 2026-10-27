# Учёт файлов ДН · GST / GPT / GF

React + TypeScript прототип трёх экранов на shadcn/ui: журнал обмена, содержимое GF и сводка результатов сверки. Данные в интерфейсе демонстрационные; API-контракт см. в [../docs/REST_API.md](../docs/REST_API.md).

## Запуск

```bash
npm install
npm run dev
```

UI обращается к REST API по адресу `http://localhost:5080`. Для другого адреса задайте `VITE_API_BASE_URL`, например в файле `.env.local`:

```env
VITE_API_BASE_URL=http://localhost:5080
```

Для production-сборки:

```bash
npm run build
```

Компоненты shadcn/ui находятся в `src/components/ui`; стили темы — в `src/index.css`. Экран журнала, строки GF, карточки деталей и аналитика загружаются из REST API по контракту `../docs/REST_API.md`.
