# TraceViz

> **BUDGET:** 0 часов (pet-project, энтузиазм)

Визуализатор distributed trace-логов (OpenTelemetry/Elastic APM формат).

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
│   ├── io/             # Ввод/вывод (загрузка файлов)
│   ├── parser/         # Парсинг и нормализация данных
│   ├── processor/      # Обработка и классификация
│   ├── renderer/       # SVG-рендеринг
│   ├── ui/             # Компоненты интерфейса
│   └── utils/          # Утилиты (логирование и пр.)
├── samples/            # Тестовые JSON-файлы
└── docs/               # Документация
```

## Лицензия

MIT. Подробнее: [LICENSE](LICENSE).
