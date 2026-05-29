# Руководство по расширению TraceViz

## Как добавить новое поле

1. Открой `src/config/field-mapping.js`
2. Добавь новое поле в `FIELD_MAPPING`:

```javascript
export const FIELD_MAPPING = Object.freeze({
	// ... существующие поля
	myNewField: ['MyField', 'MyFieldOld', 'MyFieldLegacy'],
});
```

3. Добавь поле в `RAW_FIELDS`, если нужно сохранять исходное значение
4. Обнови `DataNormalizer.js` — добавь обработку нового поля
5. Обнови `DetailPanel.js` — добавь отображение нового поля

## Как изменить fallback chain

В `src/config/field-mapping.js` измени порядок полей в массиве.
Парсер проходит по массиву слева направо, останавливаясь на первом непустом значении.

## Как изменить логику HybridLayoutEngine

### Алгоритм встраивания orphan-записей

Логика находится в `src/processor/HybridLayoutEngine.js`, функция `findParentSpan()`.

Текущий алгоритм:

1. Поиск спана, чей интервал `[startTime, endTime]` покрывает timestamp orphan
2. При множественном совпадении — выбор наиболее вложенного
3. При отсутствии совпадения — выбор хронологически ближайшего

Для изменения:

- Измени функцию `findParentSpan()` в HybridLayoutEngine.js
- Убедись, что функция остаётся чистой (без side effects)

### Параметры лейаута

```javascript
const DEFAULT_LAYOUT_CONFIG = Object.freeze({
	startX: 0, // Начальная X-координата
	rowHeight: 32, // Высота строки
	indentWidth: 20, // Ширина отступа на уровень
	minBarWidth: 4, // Минимальная ширина бара
	timelineWidth: 1200, // Ширина временной шкалы
});
```

## Как расширить RawLogViewer

### Добавление колонки

1. Открой `src/ui/RawLogViewer.js`
2. Найди массив `COLUMNS` (или создай его):

```javascript
const COLUMNS = [
    { key: 'timestamp', label: 'Timestamp', format: (v) => ... },
    { key: 'stageName', label: 'StageName', format: (v) => v ?? '—' },
    // Добавь свою колонку:
    { key: 'myField', label: 'My Field', format: (v) => v ?? '—' },
];
```

3. Обнови функцию `renderRow()` для новой колонки

### Экспорт данных

Кнопка "Экспорт JSON" выгружает текущие данные в JSON-файл.
Формат можно изменить в функции `exportToJson()`.

## Как добавить новый режим отображения

1. В `TraceClassifier.js` добавь новый режим в классификацию
2. В `HybridLayoutEngine.js` добавь обработку нового режима
3. В `SpanBars.js` добавь визуальное оформление
4. В `TraceList.js` добавь цветовую индикацию
5. Обнови `StatusBanner.js` для отображения нового режима

## Как добавить новую цветовую тему

1. В `style.css` добавь новый набор CSS-переменных:

```css
[data-theme='dark'] {
	--bg-primary: #1a1a2e;
	--text-primary: #e0e0e0;
	/* ... остальные переменные */
}
```

2. В `StatusBanner.js` или новом `ThemeProvider.js` добавь переключение темы

## Тестирование изменений

1. Загрузи тестовые файлы из `samples/`
2. Проверь все 3 режима: full, flat, shifted
3. Проверь UNCATEGORIZED логи (если есть записи без TraceId)
4. Проверь консоль на ошибки (F12)
5. Включи `APP_DEBUG = true` в `src/config/app.js` для расширенного логирования
