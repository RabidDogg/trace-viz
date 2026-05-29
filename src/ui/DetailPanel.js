/**
 * @fileoverview
 * DetailPanel — компонент для отображения детальной информации о выбранном спане.
 *
 * Отображает:
 * - SpanId (или "Orphan-запись")
 * - ParentId (или "Корневой спан")
 * - TraceId
 * - StageName
 * - Timestamp (ISO формат)
 * - Duration (ms, форматированное)
 * - LogLevel
 * - Error (если есть — красный баннер)
 * - Message (полный текст)
 * - Exception (если есть — полный stack trace)
 * - Raw JSON (сворачиваемый блок)
 *
 * Запрет innerHTML — используются только createElement, textContent, appendChild.
 * Zero dependencies.
 */

'use strict';

/**
 * CSS-классы для элементов панели деталей.
 * @enum {string}
 * @private
 */
var CSS = {
	PANEL: 'detail-panel',
	PANEL_HIDDEN: 'detail-panel--hidden',
	PANEL_TITLE: 'detail-panel__title',
	PANEL_CLOSE: 'detail-panel__close',
	PANEL_CONTENT: 'detail-panel__content',
	SECTION: 'detail-panel__section',
	SECTION_TITLE: 'detail-panel__section-title',
	FIELD: 'detail-panel__field',
	FIELD_LABEL: 'detail-panel__field-label',
	FIELD_VALUE: 'detail-panel__field-value',
	FIELD_VALUE_MONO: 'detail-panel__field-value--mono',
	ERROR_BANNER: 'detail-panel__error-banner',
	ERROR_BANNER_TITLE: 'detail-panel__error-banner-title',
	ERROR_BANNER_MESSAGE: 'detail-panel__error-banner-message',
	EXCEPTION_BLOCK: 'detail-panel__exception',
	EXCEPTION_TITLE: 'detail-panel__exception-title',
	EXCEPTION_TEXT: 'detail-panel__exception-text',
	RAW_JSON: 'detail-panel__raw-json',
	RAW_JSON_SUMMARY: 'detail-panel__raw-json-summary',
	RAW_JSON_PRE: 'detail-panel__raw-json-pre',
};

/**
 * @class DetailPanel
 * Отображает детальную информацию о выбранном спане.
 *
 * @param {string} containerId - ID DOM-элемента, в который будет вставлена панель
 *
 * @example
 * var panel = new DetailPanel('detail-panel-container');
 * panel.show(selectedRecord);
 * panel.hide();
 */
export function DetailPanel(containerId) {
	/**
	 * ID контейнера.
	 * @type {string}
	 * @private
	 */
	this._containerId = containerId;

	/**
	 * Ссылка на корневой элемент панели.
	 * @type {HTMLElement|null}
	 * @private
	 */
	this._element = null;

	/**
	 * Ссылка на контейнер содержимого.
	 * @type {HTMLElement|null}
	 * @private
	 */
	this._contentEl = null;

	// Инициализация DOM-структуры
	this._init();
}

/**
 * Создаёт DOM-структуру панели.
 *
 * @private
 */
DetailPanel.prototype._init = function () {
	var container = document.getElementById(this._containerId);
	if (!container) {
		return;
	}

	var self = this;

	// Корневой элемент панели
	var panel = document.createElement('div');
	panel.className = CSS.PANEL + ' ' + CSS.PANEL_HIDDEN;

	// Заголовок панели
	var title = document.createElement('div');
	title.className = CSS.PANEL_TITLE;

	var titleText = document.createElement('span');
	titleText.textContent =
		'\u0414\u0435\u0442\u0430\u043B\u0438 \u0441\u043F\u0430\u043D\u0430';
	title.appendChild(titleText);

	// Кнопка закрытия
	var closeBtn = document.createElement('button');
	closeBtn.className = CSS.PANEL_CLOSE;
	closeBtn.textContent = '\u2716';
	closeBtn.setAttribute(
		'aria-label',
		'\u0417\u0430\u043A\u0440\u044B\u0442\u044C',
	);
	closeBtn.addEventListener('click', function () {
		self.hide();
	});
	title.appendChild(closeBtn);

	panel.appendChild(title);

	// Контейнер содержимого
	var content = document.createElement('div');
	content.className = CSS.PANEL_CONTENT;
	panel.appendChild(content);
	this._contentEl = content;

	container.appendChild(panel);
	this._element = panel;
};

/**
 * Отображает детали спана.
 *
 * @param {Object} record - Нормализованная запись спана.
 *   Ожидаемые поля:
 *     - spanId {string|null}
 *     - parentId {string|null}
 *     - traceId {string|null}
 *     - stageName {string|null}
 *     - timestampMs {number|null}
 *     - durationMs {number|null}
 *     - logLevel {string|null}
 *     - isError {boolean}
 *     - errorMessage {string|null}
 *     - message {string|null}
 *     - exception {string|null}
 *     - raw {Object|null} - сырые данные для JSON-блока
 */
DetailPanel.prototype.show = function (record) {
	if (!this._element || !this._contentEl) {
		return;
	}

	// Очищаем содержимое
	this._contentEl.textContent = '';

	if (!record) {
		return;
	}

	// 1. Error-баннер (если есть ошибка)
	if (record.isError === true) {
		var errorBanner = this._createErrorBanner(record);
		this._contentEl.appendChild(errorBanner);
	}

	// 2. Основные поля
	var fieldsSection = this._createFieldsSection(record);
	this._contentEl.appendChild(fieldsSection);

	// 3. Message (полный текст)
	if (record.message || (record.raw && record.raw.Message)) {
		var messageSection = this._createMessageSection(record);
		this._contentEl.appendChild(messageSection);
	}

	// 4. Exception (если есть)
	if (record.exception) {
		var exceptionSection = this._createExceptionSection(record);
		this._contentEl.appendChild(exceptionSection);
	}

	// 5. Raw JSON (сворачиваемый блок)
	var rawJsonSection = this._createRawJsonSection(record);
	this._contentEl.appendChild(rawJsonSection);

	// Показываем панель
	this._element.classList.remove(CSS.PANEL_HIDDEN);
};

/**
 * Создаёт блок ошибки с красным фоном.
 *
 * @param {Object} record - Запись спана
 * @returns {HTMLElement} Элемент баннера ошибки
 * @private
 */
DetailPanel.prototype._createErrorBanner = function (record) {
	var banner = document.createElement('div');
	banner.className = CSS.ERROR_BANNER;

	var title = document.createElement('div');
	title.className = CSS.ERROR_BANNER_TITLE;
	title.textContent = '\u26A0\uFE0F \u041E\u0448\u0438\u0431\u043A\u0430';
	banner.appendChild(title);

	if (record.errorMessage) {
		var msg = document.createElement('div');
		msg.className = CSS.ERROR_BANNER_MESSAGE;
		msg.textContent = record.errorMessage;
		banner.appendChild(msg);
	}

	return banner;
};

/**
 * Создаёт секцию с основными полями записи.
 *
 * @param {Object} record - Запись спана
 * @returns {HTMLElement} Элемент секции
 * @private
 */
DetailPanel.prototype._createFieldsSection = function (record) {
	var section = document.createElement('div');
	section.className = CSS.SECTION;

	var title = document.createElement('div');
	title.className = CSS.SECTION_TITLE;
	title.textContent =
		'\u041E\u0441\u043D\u043E\u0432\u043D\u0430\u044F \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044F';
	section.appendChild(title);

	// Форматируем поля
	var fields = [
		{
			label: 'SpanId',
			value:
				record.spanId ||
				'\u041E\u0440\u0444\u0430\u043D-\u0437\u0430\u043F\u0438\u0441\u044C',
		},
		{
			label: 'ParentId',
			value:
				record.parentId ||
				'\u041A\u043E\u0440\u043D\u0435\u0432\u043E\u0439 \u0441\u043F\u0430\u043D',
		},
		{
			label: 'TraceId',
			value: record.traceId || '\u2014',
		},
		{
			label: 'StageName',
			value: record.stageName || '\u2014',
		},
		{
			label: 'Timestamp',
			value: this._formatTimestamp(record.timestampMs),
		},
		{
			label: 'Duration',
			value: this._formatDuration(record.durationMs),
		},
		{
			label: 'LogLevel',
			value: record.logLevel || '\u2014',
		},
	];

	for (var i = 0; i < fields.length; i++) {
		var fieldEl = this._createField(fields[i].label, fields[i].value, true);
		section.appendChild(fieldEl);
	}

	return section;
};

/**
 * Создаёт секцию с полным текстом сообщения.
 *
 * @param {Object} record - Запись спана
 * @returns {HTMLElement} Элемент секции
 * @private
 */
DetailPanel.prototype._createMessageSection = function (record) {
	var section = document.createElement('div');
	section.className = CSS.SECTION;

	var title = document.createElement('div');
	title.className = CSS.SECTION_TITLE;
	title.textContent =
		'\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435';
	section.appendChild(title);

	var messageText = record.message || '';
	if (!messageText && record.raw && record.raw.Message) {
		messageText = record.raw.Message;
	}

	var fieldEl = this._createField(
		'\u0422\u0435\u043A\u0441\u0442',
		messageText,
		true,
	);
	section.appendChild(fieldEl);

	return section;
};

/**
 * Создаёт секцию с exception (stack trace).
 *
 * @param {Object} record - Запись спана
 * @returns {HTMLElement} Элемент секции
 * @private
 */
DetailPanel.prototype._createExceptionSection = function (record) {
	var section = document.createElement('div');
	section.className = CSS.SECTION;

	var title = document.createElement('div');
	title.className = CSS.EXCEPTION_TITLE;
	title.textContent = '\u26A0\uFE0F Exception';
	section.appendChild(title);

	var text = document.createElement('pre');
	text.className = CSS.EXCEPTION_TEXT;
	text.textContent = record.exception;
	section.appendChild(text);

	return section;
};

/**
 * Создаёт сворачиваемый блок с Raw JSON.
 *
 * @param {Object} record - Запись спана
 * @returns {HTMLElement} Элемент details с JSON
 * @private
 */
DetailPanel.prototype._createRawJsonSection = function (record) {
	var section = document.createElement('div');
	section.className = CSS.SECTION;

	var title = document.createElement('div');
	title.className = CSS.SECTION_TITLE;
	title.textContent = 'Raw JSON';
	section.appendChild(title);

	// Сворачиваемый блок details
	var details = document.createElement('details');
	details.className = CSS.RAW_JSON;

	var summary = document.createElement('summary');
	summary.className = CSS.RAW_JSON_SUMMARY;
	summary.textContent =
		'\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C JSON';
	details.appendChild(summary);

	// Форматированный JSON
	var pre = document.createElement('pre');
	pre.className = CSS.RAW_JSON_PRE;

	var rawData = record.raw || {};
	try {
		var jsonStr = JSON.stringify(rawData, null, 2);
		pre.textContent = jsonStr;
	} catch (e) {
		pre.textContent =
			'\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0435\u0440\u0438\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u0438 JSON';
	}

	details.appendChild(pre);
	section.appendChild(details);

	return section;
};

/**
 * Создаёт элемент поля с label и value.
 *
 * @param {string} label - Метка поля
 * @param {string} value - Значение поля
 * @param {boolean} [mono=false] - Использовать моноширинный шрифт
 * @returns {HTMLElement} Элемент поля
 * @private
 */
DetailPanel.prototype._createField = function (label, value, mono) {
	var field = document.createElement('div');
	field.className = CSS.FIELD;

	var labelEl = document.createElement('span');
	labelEl.className = CSS.FIELD_LABEL;
	labelEl.textContent = label;
	field.appendChild(labelEl);

	var valueEl = document.createElement('span');
	valueEl.className = CSS.FIELD_VALUE;
	if (mono === true) {
		valueEl.classList.add(CSS.FIELD_VALUE_MONO);
	}
	valueEl.textContent = value;
	field.appendChild(valueEl);

	return field;
};

/**
 * Форматирует timestamp в ISO строку.
 *
 * @param {number|null} timestampMs - Timestamp в миллисекундах
 * @returns {string} Отформатированная дата или прочерк
 * @private
 */
DetailPanel.prototype._formatTimestamp = function (timestampMs) {
	if (timestampMs === null || timestampMs === undefined) {
		return '\u2014';
	}

	try {
		var date = new Date(timestampMs);
		if (Number.isNaN(date.getTime())) {
			return '\u2014';
		}
		return date.toISOString();
	} catch (_) {
		return '\u2014';
	}
};

/**
 * Форматирует длительность в ms.
 *
 * @param {number|null} durationMs - Длительность в миллисекундах
 * @returns {string} Отформатированное значение или прочерк
 * @private
 */
DetailPanel.prototype._formatDuration = function (durationMs) {
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
};

/**
 * Скрывает панель.
 */
DetailPanel.prototype.hide = function () {
	if (this._element) {
		this._element.classList.add(CSS.PANEL_HIDDEN);
	}
};

/**
 * Очищает содержимое панели.
 */
DetailPanel.prototype.clear = function () {
	if (this._contentEl) {
		this._contentEl.textContent = '';
	}
	this.hide();
};
