# Карта маршрутов API

Swagger UI с интерактивным описанием запросов доступен по адресу `http://localhost:5080/swagger` после запуска Docker Compose.
OpenAPI JSON: `http://localhost:5080/swagger/v1/swagger.json`.

## Состояние сервиса

| Метод | Маршрут | Назначение |
| --- | --- | --- |
| GET | `/health` | Проверка, что API запущен |
| GET | `/health/ready` | Проверка подключения к SQL Server |
| GET | `/api/v1` | Информация о версии API и health-маршрутах |

## Данные ДН и файлы GF

| Метод | Маршрут | Назначение |
| --- | --- | --- |
| GET | `/api/v1/dn/files` | Список файлов; фильтры: `q`, `type`, `periodFrom`, `periodTo`, `status`, `direction`; пагинация: `page`, `pageSize`; сортировка: `sort` |
| GET | `/api/v1/dn/files/summary` | Сводные показатели файлов с теми же фильтрами |
| GET | `/api/v1/dn/files/{fileId}` | Карточка файла |
| GET | `/api/v1/dn/files/{fileId}/records` | Строки GF; фильтры: `q`, `category`, `resultCode`, `moCode`; пагинация и `sort` |
| GET | `/api/v1/dn/files/{fileId}/records/{recordKey}` | Одна запись GF |
| GET | `/api/v1/dn/files/{fileId}/records/export` | Выгрузка строк выбранного файла с применёнными фильтрами |
| GET | `/api/v1/dn/files/export/by-mo` | Групповая выгрузка GF по МО с фильтром по статусу результата; параметры: `resultType`, `resultCode`, `fileId`, `moCode` |
| GET | `/api/v1/dn/files/{fileId}/analytics` | Аналитика повторяющихся ошибок; параметры: `repeatPeriods` (2–24), `top` (1–20) |
| GET | `/api/v1/dn/dictionaries/result-codes` | Справочник статусов результата |
| GET | `/api/v1/dn/dictionaries/diagnoses` | Справочник диагнозов |
