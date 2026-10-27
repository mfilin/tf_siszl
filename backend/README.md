# TF_SISZL backend

ASP.NET Core 8 Minimal API, подключающийся к SQL Server `TF_SISZL`.

## Требования

- .NET 8 SDK
- Доступность SQL Server на `localhost` с машины, где запущен API

## Настройка подключения

Пароль задаётся только через переменную окружения и не хранится в репозитории. В PowerShell задайте его в текущей сессии, используя пароль для `sa`:

```powershell
$env:Database__Password = Read-Host "Пароль SQL Server"
$env:Database__Server = "localhost"
$env:Database__Name = "TF_SISZL"
$env:Database__User = "sa"
```

Затем из каталога `backend`:

```powershell
dotnet run --project .\TfSiszl.Api
```

## Запуск UI и API через Docker Compose

Из корня репозитория в PowerShell задайте пароль SQL Server в переменной текущей сессии и запустите контейнеры:

```powershell
$env:TF_SISZL_DB_PASSWORD = Read-Host "Пароль SQL Server"
docker compose up --build -d
```

Откройте UI по адресу `http://localhost:8080`. Backend доступен напрямую на `http://localhost:5080`; UI обращается к нему через Nginx. Compose направляет соединение к SQL Server хоста через `host.docker.internal,1433`. Убедитесь, что на SQL Server включён TCP/IP и разрешены SQL-аутентификация и подключения с хоста Docker. Для остановки выполните `docker compose down`.

Для другого сервера или порта измените `Database__Server`, например на `sqlhost,1433`. Переменные ASP.NET Core с двойным подчёркиванием соответствуют ключам конфигурации с двоеточием (`Database:Password`).

## Эндпоинты

- `GET /health` — проверка, что процесс API отвечает.
- `GET /health/ready` — проверка соединения с SQL Server запросом `SELECT 1`; при недоступности БД возвращает `503` без деталей подключения.
- `GET /api/v1` — информация о версии API.
- `GET /api/v1/dn/files` и `/summary` — журнал и счётчики GST/GPT/GF.
- `GET /api/v1/dn/files/{fileId}` — карточка файла.
- `GET /api/v1/dn/files/{fileId}/records` — страницы строк GF с поиском и фильтрами; `/records/{recordKey}` — полная карточка строки.
- `GET /api/v1/dn/files/{fileId}/records/export` — потоковый CSV с теми же фильтрами.
- `GET /api/v1/dn/files/export/by-mo?fileId=gf-9&resultType=GST&resultCode=207` — анализ одного GF-файла и ZIP-архив с отдельным CSV на каждую МО; код МО (`moCode`) необязательный.
- `GET /api/v1/dn/files/{fileId}/analytics` — категории, частые коды и повторяющиеся ошибки по последовательным периодам.
- `GET /api/v1/dn/dictionaries/result-codes` и `/diagnoses` — справочники из SQL и Приложения 3.

Журнал и аналитика ограничены кодом региона из `Database:RegionCode` (по умолчанию `34`). UI Vite на `http://localhost:5173` разрешён политикой CORS по умолчанию. Список источников можно заменить через `Cors__AllowedOrigins__0`.

API читает журнал из `dbo.file_import_log` и `dbo.file_export_log`, сверку из `dbo.gf_person`, `dbo.gf_dn_list_result`, `dbo.gf_dn_plan_result`, `dbo.gf_trigger`, а справочники из `dbo.dict_dn_list_result_code` и `dbo.dict_dn_plan_result_code`.
