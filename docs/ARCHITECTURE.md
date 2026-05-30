# Архитектура TraceViz

## Общая архитектура

TraceViz — одностраничное приложение (SPA) для визуализации distributed trace-логов.
Вся обработка данных происходит на стороне клиента, без серверной части.

## Data Flow (поток данных)

```
Load → Parse → Normalize → Group → Classify → Build Hierarchy → Layout → Render
```

### 1. Load (`src/io/FileLoader.js`, `src/io/ClipboardReader.js`, `src/io/DataLoader.js`)

- Drag&Drop или file input (FileLoader)
- Чтение из буфера обмена через Clipboard API (ClipboardReader)
- Унифицированный слой DataLoader для обработки данных из любого источника
- Валидация JSON
- Обёртка плоского массива в Elasticsearch-структуру

### 2. Parse (`src/parser/OpenSourceExtractor.js`)

- Извлечение записей из `hits.hits[]._source`
- Поддержка плоских массивов

### 3. Normalize (`src/parser/DataNormalizer.js`)

- Проход по fallback chain для каждого поля
- Парсинг duration через `ElapsedParser`
- Парсинг timestamp через `Date.parse()`
- Обрезка StageName до 200 символов
- Определение ErrorFlag

### 4. Group (`src/processor/TraceGrouper.js`)

- Группировка по TraceId
- Выделение UNCATEGORIZED записей

### 5. Classify (`src/processor/TraceClassifier.js`)

- Определение режима: Full / Flat / Shifted

### 6. Build Hierarchy (`src/processor/SpanHierarchyBuilder.js`)

- Построение дерева спанов (ParentId → children)
- Расчёт startTime/endTime
- Обработка циклических ссылок

### 7. Layout (`src/processor/HybridLayoutEngine.js`)

- Расчёт X/Y координат
- Встраивание orphan-записей в родительские спаны
- Поддержка 3 режимов: Full, Flat, Shifted

### 8. Render (`src/renderer/Engine.js`, `Axis.js`, `SpanBars.js`)

- SVG-полотно
- Ось времени с метками
- Цветные бары спанов
- Тултипы и интерактивность

## Модульная структура

```
src/
├── config/          # Конфигурация (field-mapping, app)
├── io/              # Ввод/вывод (FileLoader, ClipboardReader, DataLoader)
├── parser/          # Парсинг и нормализация
├── processor/       # Обработка и классификация
├── renderer/        # SVG-рендеринг
├── ui/              # UI-компоненты
└── utils/           # Утилиты (Logger)
```

## Ключевые решения

### Fallback Chain

Все цепочки полей вынесены в `src/config/field-mapping.js`.
Парсер проходит по цепочке до первого непустого значения.

### Гибридный лейаут

Orphan-записи (без SpanId) встраиваются в спан, чей временной интервал покрывает их timestamp.
При множественном совпадении выбирается наиболее вложенный спан.

### Виртуализация

При >100 элементов включается виртуализация — рендерятся только видимые строки + буфер.

## Обработка ошибок

Каждый этап пайплайна обёрнут в try/catch.
Ошибка на любом этапе не прерывает работу всего приложения.
При битом JSON — модальное окно с указанием строки ошибки.
При критической ошибке — возврат в состояние "Загрузка файла".

## Clipboard Data Ingestion (Epic 7)

### Чтение из буфера обмена

Реализовано через `ClipboardReader` — класс-обёртку над `navigator.clipboard.readText()`.

**Ограничения:**

- Работает только в secure context (HTTPS или localhost)
- Требует пользовательского жеста (click)
- Не поддерживается в file:// протоколе

**Поток данных:**

```
ClipboardReader.read() → строка JSON → DataLoader.load() → OpenSourceExtractor → Пайплайн
```

**Валидация:**

1. Проверка поддержки API → isSupported()
2. Проверка на пустую строку
3. JSON.parse()
4. Проверка структуры (hits.hits или массив)

## Ограничения

- Фиксированное разрешение 1920×1080
- Только десктопные браузеры (Chrome 90+, FF 90+, Edge 90+, Safari 14+)
- Zero dependencies
- Полностью offline после загрузки страницы
- Memory ≤150 МБ для файлов до 50 МБ
