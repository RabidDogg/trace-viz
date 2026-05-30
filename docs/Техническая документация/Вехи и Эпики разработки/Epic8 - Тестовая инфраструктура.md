# 🟪 Epic 8: Тестовая инфраструктура

| Задача                                   | Артефакт                                                                                                     | Критерий приёмки                                                                                                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8.1 Кастомный test-runner                | `__tests__/utils/test-runner.js`                                                                             | Рекурсивный обход `.test.js` файлов, динамический импорт через `import()`, сбор функций `test*`/`it*`, подсчёт пройденных/упавших, цветной вывод, код возврата 0/1                                            |
| 8.2 Unit-тесты ScopeExtractor            | `__tests__/unit/scope-extractor.test.js`                                                                     | 11 тест-кейсов: базовый парсинг, null/undefined/пустая строка, пробелы, отсутствие известных ключей, trailing comma, множественные ключи                                                                      |
| 8.3 Unit-тесты ElapsedParser             | `__tests__/unit/elapsed-parser.test.js`                                                                      | 16 тест-кейсов: число, строка с единицей, TimeSpan (чч:мм:сс.ммм и мм:сс.ммм), null/undefined/NaN/Infinity, пустая строка, отрицательные числа, разделители тысяч                                             |
| 8.4 Unit-тесты DataNormalizer            | `__tests__/unit/data-normalizer.test.js`                                                                     | 14 тест-кейсов: базовая нормализация, fallback-поля, не-массив на входе, null source, обрезка StageName до 200, детекция ошибок по LogLevel/Exception, кастомный fieldMapping, сохранение raw-полей           |
| 8.5 Unit-тесты TraceClassifier           | `__tests__/unit/trace-classifier.test.js`                                                                    | 7 тест-кейсов: full/flat/shifted режимы, пустой/null массив, одиночные записи                                                                                                                                 |
| 8.6 Unit-тесты OpenSourceExtractor       | `__tests__/unit/open-source-extractor.test.js`                                                               | 7 тест-кейсов: hits-структура, плоский массив, null/не-объект, пустые hits, фильтрация null-хитов, одиночный объект                                                                                           |
| 8.7 Unit-тесты TraceGrouper              | `__tests__/unit/trace-grouper.test.js`                                                                       | 5 тест-кейсов: группировка по traceId, uncategorized, не-массив, один трейс, сохранение порядка                                                                                                               |
| 8.8 Unit-тесты SpanHierarchyBuilder      | `__tests__/unit/span-hierarchy-builder.test.js`                                                              | 9 тест-кейсов: parent-child, пустой массив, сломанная parent-ссылка, фильтрация без spanId, расчёт depth/endTime, сортировка детей, циклические ссылки                                                        |
| 8.9 Unit-тесты HybridLayoutEngine        | `__tests__/unit/hybrid-layout-engine.test.js`                                                                | 9 тест-кейсов: full/flat/shifted режимы, пустой вход, расчёт X/Y координат, отступы для вложенности, встраивание orphan, orphan без timestamp                                                                 |
| 8.10 Unit-тесты TimelineCalculator       | `__tests__/unit/timeline-calculator.test.js`                                                                 | 5 тест-кейсов: границы шкалы, пустой массив, генерация меток, интервал меток, единичный timestamp                                                                                                             |
| 8.11 Integration: full-trace pipeline    | `__tests__/integration/pipeline-full-trace.test.js`                                                          | 7 тест-кейсов на `samples/sample_full_trace.json`: полный пайплайн без ошибок, все записи имеют traceId/spanId, классификация 'full', непустая иерархия, все LayoutItem типа 'span', корректные Y-координаты  |
| 8.12 Integration: shifted-trace pipeline | `__tests__/integration/pipeline-shifted-trace.test.js`                                                       | 5 тест-кейсов на `samples/sample_mixed_shifted.json`: полный пайплайн, классификация 'shifted', есть и span и orphan элементы, orphan имеют parentSpanId, есть uncategorized записи                           |
| 8.13 Smoke-тесты                         | `__tests__/smoke/smoke-test.test.js`                                                                         | 7 тест-кейсов: базовая работоспособность всех ключевых модулей (ScopeExtractor, ElapsedParser, DataNormalizer, TraceClassifier, TraceGrouper, SpanHierarchyBuilder, HybridLayoutEngine)                       |
| 8.14 Perf-скрипт                         | `__tests__/perf/perf-check.js`                                                                               | Замер времени парсинга 10000 значений ElapsedParser (< 50ms), нормализации 1000 записей (< 100ms), построения иерархии для 1000 спанов (< 100ms), расчёта лейаута для 1000 элементов (< 100ms), память < 50MB |
| 8.15 npm scripts                         | `package.json`                                                                                               | Добавлены скрипты: `test`, `test:unit`, `test:integration`, `test:smoke`, `test:perf`, `prepush`                                                                                                              |
| ✅ **Acceptance**                        | `npm test` без установки пакетов, все тесты зелёные ≤ 5 сек, понятные сообщения об ошибках, код возврата 0/1 |

## Детальная спецификация test-runner.js

**Файл:** `__tests__/utils/test-runner.js`

### Алгоритм

1. Принимает путь к директории из `process.argv[2]`
2. Рекурсивный обход через `fs.readdirSync`, сбор `*.test.js` файлов
3. Для каждого файла: динамический импорт через `import(url)` с `file://` протоколом
4. Сбор всех экспортированных функций, начинающихся с `test` или `it`
5. Запуск каждой функции в `try/catch`, подсчёт результатов
6. Цветной вывод: `\x1b[32m` (зелёный PASS), `\x1b[31m` (красный FAIL), `\x1b[33m` (жёлтый заголовки), `\x1b[36m` (голубой файлы)
7. `process.exit(0)` если все прошли, `process.exit(1)` если есть падения

### API для тестов

Используется нативный Node.js `assert`:

- `assert.strictEqual(actual, expected, message)`
- `assert.deepStrictEqual(actual, expected, message)`
- `assert.throws(fn, expectedError, message)`
- `assert.ok(value, message)`

### Пример тестового файла

```javascript
import assert from 'node:assert/strict';
import { ScopeExtractor } from '../../src/parser/ScopeExtractor.js';

export function testParsesBasicScopes() {
	const result = ScopeExtractor.extract('SpanId: abc123, TraceId: xyz789');
	assert.deepStrictEqual(result, { SpanId: 'abc123', TraceId: 'xyz789' });
}

export function testReturnsNullForEmptyString() {
	assert.strictEqual(ScopeExtractor.extract(''), null);
}
```

## Стратегия мокирования

### Принципы

1. **Чистые функции не мокаются** — `ElapsedParser`, `ScopeExtractor`, `TraceClassifier`, `TraceGrouper`, `TimelineCalculator` не имеют зависимостей, тестируются напрямую
2. **DI через конструктор** — `DataNormalizer` принимает `fieldMapping` параметром, что позволяет подменить конфигурацию без моков
3. **Интеграционные тесты без моков** — пайплайн-тесты используют реальные модули и реальные данные из `samples/`
4. **Logger не мокается** — в unit-тестах он не вызывается (чистые функции), в integration-тестах работает как есть

### Когда моки всё же нужны

Для новых модулей с внешними зависимостями — проектировать с DI с самого начала, чтобы можно было подменить зависимости через конструктор.

## Структура директорий после реализации

```
__tests__/
├── unit/
│   ├── scope-extractor.test.js
│   ├── elapsed-parser.test.js
│   ├── data-normalizer.test.js
│   ├── trace-classifier.test.js
│   ├── open-source-extractor.test.js
│   ├── trace-grouper.test.js
│   ├── span-hierarchy-builder.test.js
│   ├── hybrid-layout-engine.test.js
│   └── timeline-calculator.test.js
├── integration/
│   ├── pipeline-full-trace.test.js
│   └── pipeline-shifted-trace.test.js
├── smoke/
│   └── smoke-test.test.js
├── perf/
│   └── perf-check.js
└── utils/
    └── test-runner.js
```

## npm scripts (изменения в package.json)

```json
{
	"scripts": {
		"test": "npm run test:unit && npm run test:integration",
		"test:unit": "node __tests__/utils/test-runner.js __tests__/unit/",
		"test:integration": "node __tests__/utils/test-runner.js __tests__/integration/",
		"test:smoke": "node __tests__/utils/test-runner.js __tests__/smoke/",
		"test:perf": "node __tests__/utils/perf-check.js",
		"prepush": "npm test"
	}
}
```
