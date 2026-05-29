/**
 * @fileoverview
 * RawLogViewer — компонент для отображения некатегоризированных записей
 * (без TraceId) в виде таблицы.
 *
 * Таблица с 5 фиксированными колонками:
 *   Timestamp, StageName, Message, Duration, Error
 *
 * Запрет innerHTML — используются только createElement, textContent, appendChild.
 * Zero dependencies.
 */

'use strict';

/**
 * @typedef {import('../parser/DataNormalizer.js').NormalizedRecord} NormalizedRecord
 */

/**
 * CSS-классы для элементов таблицы.
 * @enum {string}
 */
const CSS = {
	CONTAINER: 'raw-log-viewer',
	TABLE: 'raw-log-table',
	HEADER: 'raw-log-table__header',
	HEADER_CELL: 'raw-log-table__header-cell',
	ROW: 'raw-log-table__row',
	CELL: 'raw-log-table__cell',
	CELL_TIMESTAMP: 'raw-log-table__cell--timestamp',
	CELL_STAGE: 'raw-log-table__cell--stage',
	CELL_MESSAGE: 'raw-log-table__cell--message',
	CELL_DURATION: 'raw-log-table__cell--duration',
	CELL_ERROR: 'raw-log-table__cell--error',
	ERROR_ICON: 'raw-log-table__error-icon',
	ERROR_ROW: 'raw-log-table__row--error',
	EMPTY: 'raw-log-table__empty',
	EXPORT_BTN: 'raw-log-table__export-btn',
};

/**
 * Форматирует timestamp в читаемую строку.
 *
 * @param {number|null} timestampMs - timestamp в миллисекундах
 * @returns {string} Отформатированная дата/время или прочерк
 * @private
 */
function formatTimestamp(timestampMs) {
	if (timestampMs === null || timestampMs === undefined) {
		return '\u2014';
	}

	try {
		const date = new Date(timestampMs);
		if (Number.isNaN(date.getTime())) {
			return '\u2014';
		}
		return date.toISOString();
	} catch (_) {
		return '\u2014';
	}
}

/**
 * Форматирует длительность.
 *
 * @param {number|null} durationMs - длительность в миллисекундах
 * @returns {string} Отформатированное значение или прочерк
 * @private
 */
function formatDuration(durationMs) {
	if (durationMs === null || durationMs === undefined) {
		return '\u2014';
	}

	if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
		return '\u2014';
	}

	if (durationMs < 1) {
		return durationMs.toFixed(2) + ' ms';
	}
	if (durationMs < 1000) {
		return durationMs.toFixed(1) + ' ms';
	}
	return (durationMs / 1000).toFixed(2) + ' s';
}

/**
 * Создаёт ячейку таблицы с текстовым содержимым.
 *
 * @param {string} text - Текст ячейки
 * @param {string} className - CSS-класс для ячейки
 * @returns {HTMLTableCellElement} Созданный элемент td
 * @private
 */
function createCell(text, className) {
	const cell = document.createElement('td');
	cell.className = CSS.CELL + ' ' + className;
	cell.textContent = text;
	return cell;
}

/**
 * Создаёт иконку ошибки (SVG-крестик в круге).
 *
 * @returns {HTMLSpanElement} Элемент с иконкой ошибки
 * @private
 */
function createErrorIcon() {
	const span = document.createElement('span');
	span.className = CSS.ERROR_ICON;
	span.textContent = '\u2716'; // ✖
	span.setAttribute('aria-label', 'Error');
	span.setAttribute('title', 'Запись содержит ошибку');
	return span;
}

/**
 * Создаёт строку таблицы для одной записи.
 *
 * @param {NormalizedRecord} record - Нормализованная запись
 * @returns {HTMLTableRowElement} Созданный элемент tr
 * @private
 */
function createRow(record) {
	const row = document.createElement('tr');
	row.className = CSS.ROW;

	if (record.isError) {
		row.classList.add(CSS.ERROR_ROW);
	}

	// 1. Timestamp
	const tsCell = createCell(
		formatTimestamp(record.timestampMs),
		CSS.CELL_TIMESTAMP,
	);
	row.appendChild(tsCell);

	// 2. StageName
	const stageCell = createCell(
		record.stageName !== null ? record.stageName : '\u2014',
		CSS.CELL_STAGE,
	);
	row.appendChild(stageCell);

	// 3. Message — берём из raw.Message
	const rawMessage =
		record.raw && typeof record.raw.Message === 'string'
			? record.raw.Message
			: '\u2014';
	const msgCell = createCell(rawMessage, CSS.CELL_MESSAGE);
	row.appendChild(msgCell);

	// 4. Duration
	const durCell = createCell(
		formatDuration(record.durationMs),
		CSS.CELL_DURATION,
	);
	row.appendChild(durCell);

	// 5. Error — иконка или прочерк
	const errCell = document.createElement('td');
	errCell.className = CSS.CELL + ' ' + CSS.CELL_ERROR;

	if (record.isError) {
		const icon = createErrorIcon();
		errCell.appendChild(icon);
	} else {
		errCell.textContent = '\u2014';
	}

	row.appendChild(errCell);

	return row;
}

/**
 * Создаёт пустое состояние таблицы.
 *
 * @returns {HTMLTableRowElement} Строка с сообщением о пустом состоянии
 * @private
 */
function createEmptyRow() {
	const row = document.createElement('tr');
	const cell = document.createElement('td');
	cell.className = CSS.EMPTY;
	cell.setAttribute('colspan', '5');
	cell.textContent =
		'\u041D\u0435\u0442 \u043D\u0435\u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0445 \u0437\u0430\u043F\u0438\u0441\u0435\u0439';
	row.appendChild(cell);
	return row;
}

/**
 * Создаёт кнопку экспорта в JSON.
 *
 * @param {NormalizedRecord[]} records - Массив записей для экспорта
 * @returns {HTMLButtonElement} Кнопка экспорта
 * @private
 */
function createExportButton(records) {
	const btn = document.createElement('button');
	btn.className = CSS.EXPORT_BTN;
	btn.textContent = '\u042D\u043A\u0441\u043F\u043E\u0440\u0442 JSON';

	btn.addEventListener('click', function () {
		exportAsJson(records);
	});

	return btn;
}

/**
 * Экспортирует массив записей в JSON-файл и скачивает его.
 *
 * @param {NormalizedRecord[]} records - Массив записей
 * @private
 */
function exportAsJson(records) {
	try {
		const json = JSON.stringify(records, null, 2);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);

		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = 'uncategorized-logs.json';
		anchor.style.display = 'none';

		document.body.appendChild(anchor);
		anchor.click();

		// Очистка
		setTimeout(function () {
			document.body.removeChild(anchor);
			URL.revokeObjectURL(url);
		}, 100);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error('RawLogViewer: ошибка экспорта JSON:', msg);
	}
}

/**
 * RawLogViewer — отображает таблицу некатегоризированных записей.
 *
 * @param {NormalizedRecord[]} records - Массив записей без TraceId
 * @param {HTMLElement} container - DOM-элемент, в который будет вставлена таблица
 *
 * @example
 * const viewer = new RawLogViewer(uncategorizedRecords, document.getElementById('raw-logs'));
 */
export function RawLogViewer(records, container) {
	if (!container) {
		return;
	}

	// Очищаем контейнер
	while (container.firstChild) {
		container.removeChild(container.firstChild);
	}

	// Контейнер компонента
	const viewerEl = document.createElement('div');
	viewerEl.className = CSS.CONTAINER;

	// Кнопка экспорта
	const exportBtn = createExportButton(records);
	viewerEl.appendChild(exportBtn);

	// Таблица
	const table = document.createElement('table');
	table.className = CSS.TABLE;

	// Заголовок
	const thead = document.createElement('thead');
	const headerRow = document.createElement('tr');
	headerRow.className = CSS.HEADER;

	const headers = ['Timestamp', 'StageName', 'Message', 'Duration', 'Error'];

	for (let i = 0; i < headers.length; i++) {
		const th = document.createElement('th');
		th.className = CSS.HEADER_CELL;
		th.textContent = headers[i];
		headerRow.appendChild(th);
	}

	thead.appendChild(headerRow);
	table.appendChild(thead);

	// Тело таблицы
	const tbody = document.createElement('tbody');

	if (!Array.isArray(records) || records.length === 0) {
		tbody.appendChild(createEmptyRow());
	} else {
		for (let i = 0; i < records.length; i++) {
			const row = createRow(records[i]);
			tbody.appendChild(row);
		}
	}

	table.appendChild(tbody);
	viewerEl.appendChild(table);
	container.appendChild(viewerEl);
}
