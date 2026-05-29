/**
 * @fileoverview
 * StatusBanner — компонент для отображения текущего статуса приложения.
 *
 * Отображает сообщение с цветовым индикатором в зависимости от типа статуса:
 * - info: синий фон
 * - success: зелёный фон
 * - warning: жёлтый фон
 * - error: красный фон
 *
 * Запрет innerHTML — используются только createElement, textContent, appendChild.
 * Zero dependencies.
 */

'use strict';

/**
 * CSS-классы для баннера статуса.
 * @enum {string}
 * @private
 */
const CSS = {
	BANNER: 'status-banner',
	BANNER_INFO: 'status-banner--info',
	BANNER_SUCCESS: 'status-banner--success',
	BANNER_WARNING: 'status-banner--warning',
	BANNER_ERROR: 'status-banner--error',
	BANNER_HIDDEN: 'status-banner--hidden',
	BANNER_TEXT: 'status-banner__text',
	BANNER_ICON: 'status-banner__icon',
};

/**
 * Иконки для каждого типа статуса.
 * @enum {string}
 * @private
 */
const ICONS = {
	info: '\u2139\uFE0F',
	success: '\u2705',
	warning: '\u26A0\uFE0F',
	error: '\u274C',
};

/**
 * Маппинг типа статуса на CSS-класс.
 * @type {Object<string, string>}
 * @private
 */
const TYPE_CLASS_MAP = {
	info: CSS.BANNER_INFO,
	success: CSS.BANNER_SUCCESS,
	warning: CSS.BANNER_WARNING,
	error: CSS.BANNER_ERROR,
};

/**
 * @class StatusBanner
 * Отображает текущий статус приложения с цветовой индикацией.
 *
 * @param {string} containerId - ID DOM-элемента, в который будет вставлен баннер
 *
 * @example
 * var banner = new StatusBanner('status-banner-container');
 * banner.setStatus('Файл загружен', 'success');
 * banner.setStatus('Идёт обработка...', 'info');
 * banner.setStatus('Ошибка загрузки', 'error');
 * banner.clear();
 */
class StatusBanner {
	/**
	 * @param {string} containerId - ID DOM-элемента, в который будет вставлен баннер
	 */
	constructor(containerId) {
		/**
		 * ID контейнера.
		 * @type {string}
		 * @private
		 */
		this._containerId = containerId;

		/**
		 * Ссылка на корневой элемент баннера.
		 * @type {HTMLElement|null}
		 * @private
		 */
		this._element = null;

		/**
		 * Ссылка на элемент с текстом статуса.
		 * @type {HTMLElement|null}
		 * @private
		 */
		this._textEl = null;

		/**
		 * Ссылка на элемент с иконкой.
		 * @type {HTMLElement|null}
		 * @private
		 */
		this._iconEl = null;

		/**
		 * Текущий тип статуса.
		 * @type {string}
		 * @private
		 */
		this._currentType = 'info';

		// Инициализация DOM-структуры
		this._init();
	}

	/**
	 * Создаёт DOM-структуру баннера.
	 *
	 * @private
	 */
	_init() {
		const container = document.getElementById(this._containerId);
		if (!container) {
			return;
		}

		// Корневой элемент баннера
		const banner = document.createElement('div');
		banner.className =
			CSS.BANNER + ' ' + CSS.BANNER_HIDDEN + ' ' + CSS.BANNER_INFO;

		// Иконка
		const icon = document.createElement('span');
		icon.className = CSS.BANNER_ICON;
		icon.textContent = ICONS.info;
		banner.appendChild(icon);

		// Текст статуса
		const text = document.createElement('span');
		text.className = CSS.BANNER_TEXT;
		text.textContent = '';
		banner.appendChild(text);

		container.appendChild(banner);

		this._element = banner;
		this._iconEl = icon;
		this._textEl = text;
	}

	/**
	 * Устанавливает статус баннера.
	 *
	 * @param {string} message - Текст статуса
	 * @param {string} [type='info'] - Тип статуса: 'info' | 'success' | 'warning' | 'error'
	 */
	setStatus(message, type) {
		if (!this._element || !this._textEl || !this._iconEl) {
			return;
		}

		// Определяем тип
		const statusType = type || 'info';
		const isValidType = TYPE_CLASS_MAP.hasOwnProperty(statusType);
		if (!isValidType) {
			statusType = 'info';
		}

		this._currentType = statusType;

		// Обновляем текст
		this._textEl.textContent = message;

		// Обновляем иконку
		this._iconEl.textContent = ICONS[statusType] || ICONS.info;

		// Обновляем CSS-классы
		const classList = this._element.classList;

		// Удаляем все классы типа
		classList.remove(
			CSS.BANNER_INFO,
			CSS.BANNER_SUCCESS,
			CSS.BANNER_WARNING,
			CSS.BANNER_ERROR,
			CSS.BANNER_HIDDEN,
		);

		// Добавляем класс текущего типа
		classList.add(TYPE_CLASS_MAP[statusType] || CSS.BANNER_INFO);
	}

	/**
	 * Очищает статус и скрывает баннер.
	 */
	clear() {
		if (!this._element || !this._textEl) {
			return;
		}

		this._textEl.textContent = '';
		this._element.classList.add(CSS.BANNER_HIDDEN);
	}
}

export { StatusBanner };
