# TraceViz

> Визуализатор distributed trace-логов (OpenTelemetry / Elasticsearch/OpenSearch формат).
> Загрузка через файл или буфер обмена — полный цикл: парсинг → нормализация → иерархия → рендеринг.

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

## Лицензия

MIT. Подробнее: [LICENSE](LICENSE).
