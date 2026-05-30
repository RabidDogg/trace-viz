# TraceViz

> **Визуализатор distributed trace-логов**  
> Загрузка через файл или буфер обмена → парсинг → нормализация → иерархия → рендеринг  
> OpenTelemetry / Elasticsearch / OpenSearch форматы

## Описание

Клиентское SPA-приложение для загрузки и визуализации JSON-файлов с трейсами.
Поддерживает 4 режима отображения: Full Trace, Flat Trace, Shifted/Mixed, UNCATEGORIZED.

## Стек технологий

- Vanilla JavaScript ES2020+ (ES Modules)
- Zero dependencies
- Нативный SVG/HTML рендеринг
- Фиксированное разрешение 1920×1080

## Запуск

```bash
# Любой локальный HTTP-сервер, например:
python -m http.server 8080
# или
npx serve .
```

## npm-скрипты

Проект использует `package.json` только для скриптов управления (без зависимостей).

| Команда                                  | Описание                                                     |
| ---------------------------------------- | ------------------------------------------------------------ |
| `npm start` / `npm run dev`              | Запуск сервера на `http://localhost:5555`                    |
| `npm run build`                          | Сборка дистрибутива: архивирование последнего тэга в `dist/` |
| `npm run commit:feat -- "сообщение"`     | Коммит с префиксом `feat:`                                   |
| `npm run commit:fix -- "сообщение"`      | Коммит с префиксом `fix:`                                    |
| `npm run commit:refactor -- "сообщение"` | Коммит с префиксом `refactor:`                               |
| `npm run commit:style -- "сообщение"`    | Коммит с префиксом `style:`                                  |
| `npm run commit:docs -- "сообщение"`     | Коммит с префиксом `docs:`                                   |
| `npm run commit:release -- "сообщение"`  | Коммит с префиксом `release:`                                |
| `npm run merge:dev -- "branch-name"`     | Переключиться на develop и влить ветку                       |
| `npm run merge:master`                   | Влить последний тэг в master                                 |
| `npm run tag`                            | Создать annotated-тэг из версии package.json                 |
| `npm run push:all`                       | Запушить всё в оба remote (origin + sourcecraft)             |

**Примеры использования:**

```bash
# Запуск сервера
npm start

# Сборка дистрибутива
npm run build

# Коммит с префиксом feat
npm run commit:feat -- "моё описание"
# эквивалентно: git commit -m "feat: моё описание"

# Merge ветки в develop
npm run merge:dev -- "feature/my-branch"
# эквивалентно: git checkout develop && git merge feature/my-branch

# Релизный тэг
npm run tag

# Публикация во все remote
npm run push:all
```

## Структура проекта

```
trace-viz/
├── index.html          # Точка входа
├── style.css           # Глобальные стили
├── src/
│   ├── config/         # Конфигурация fallback chain
│   ├── io/             # Ввод/вывод (FileLoader, ClipboardReader, DataLoader)
│   ├── parser/         # Парсинг и нормализация данных
│   ├── processor/      # Обработка и классификация
│   ├── renderer/       # SVG-рендеринг
│   ├── ui/             # Компоненты интерфейса
│   └── utils/          # Утилиты (логирование и пр.)
├── samples/            # Тестовые JSON-файлы
└── docs/               # Документация
```

## Загрузка из буфера обмена

1. Скопируйте JSON-ответ из OpenSearch (или другого источника) в буфер обмена
2. Нажмите кнопку **«📋 Загрузить из буфера обмена»** в интерфейсе
3. Данные пройдут тот же пайплайн парсинга и визуализации, что и при загрузке файла

**Требования к браузеру:**

- HTTPS или http://localhost (secure context)
- Chrome 90+, Firefox 90+, Edge 90+, Safari 14+

## Стиль коммитов и merge

Проект использует следующий формат коммитов:

| Префикс        | Назначение             | Пример                                                            |
| -------------- | ---------------------- | ----------------------------------------------------------------- |
| `feat(scope):` | Новая функциональность | `feat(epic7.1): UI-элемент «Загрузить из буфера обмена»`          |
| `fix:`         | Исправление ошибки     | `fix: рефакторинг FileReader в FileLoader, улучшение UX и стилей` |
| `refactor:`    | Рефакторинг кода       | `refactor: миграция всех модулей на ES6+ классы`                  |
| `style:`       | Изменение стилей CSS   | `style: тёмная тема для панели деталей`                           |
| `docs:`        | Изменение документации | `docs: обновление документации после Epic7`                       |
| `release:`     | Релизный коммит        | `release: v1.0.0-alpha — базовый функционал визуализации трейсов` |
| `merge:`       | Merge ветки            | `merge: epic7 Clipboard Data Ingestion в develop`                 |

**Правила:**

- Язык сообщений — русский
- Префиксы — латиница
- Каждая логическая задача — отдельный коммит
- Merge-коммиты используются для вливания завершённых фич в `develop`

## Лицензия

MIT. Подробнее: [LICENSE](LICENSE).
