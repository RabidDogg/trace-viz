/**
 * @fileoverview
 * Система логирования приложения Trace Viz.
 * Поддерживает уровни DEBUG, INFO, WARN, ERROR.
 * Флаг отладки APP_DEBUG импортируется из src/config/app.js.
 * Формат вывода: [LEVEL] [Module] Сообщение
 * Перехватывает window.onerror и unhandledrejection.
 */

'use strict';

import { APP_DEBUG } from '../config/app.js';

/** @enum {string} */
const LOG_LEVELS = Object.freeze({
	DEBUG: 'DEBUG',
	INFO: 'INFO',
	WARN: 'WARN',
	ERROR: 'ERROR',
});

/** @enum {number} */
const LOG_PRIORITY = Object.freeze({
	DEBUG: 0,
	INFO: 1,
	WARN: 2,
	ERROR: 3,
});

/**
 * Форматирует timestamp в строку ЧЧ:ММ:СС.ммм
 * @returns {string}
 */
function formatTimestamp() {
	const now = new Date();
	const hours = String(now.getHours()).padStart(2, '0');
	const minutes = String(now.getMinutes()).padStart(2, '0');
	const seconds = String(now.getSeconds()).padStart(2, '0');
	const millis = String(now.getMilliseconds()).padStart(3, '0');
	return `${hours}:${minutes}:${seconds}.${millis}`;
}

/**
 * @class Logger
 * Статический класс для структурированного логирования.
 * Формат вывода: [LEVEL] [Module] Сообщение
 */
class Logger {
	/** @type {number} */
	static #minPriority = LOG_PRIORITY.DEBUG;

	/**
	 * Выводит сообщение уровня DEBUG.
	 * Отображается только если APP_DEBUG === true.
	 * @param {string} moduleName - Имя модуля-источника лога
	 * @param {string} message
	 * @param {...*} args
	 */
	static debug(moduleName, message, ...args) {
		if (!APP_DEBUG) return;
		Logger.#write(LOG_LEVELS.DEBUG, moduleName, message, ...args);
	}

	/**
	 * Выводит сообщение уровня INFO.
	 * @param {string} moduleName - Имя модуля-источника лога
	 * @param {string} message
	 * @param {...*} args
	 */
	static info(moduleName, message, ...args) {
		Logger.#write(LOG_LEVELS.INFO, moduleName, message, ...args);
	}

	/**
	 * Выводит сообщение уровня WARN.
	 * @param {string} moduleName - Имя модуля-источника лога
	 * @param {string} message
	 * @param {...*} args
	 */
	static warn(moduleName, message, ...args) {
		Logger.#write(LOG_LEVELS.WARN, moduleName, message, ...args);
	}

	/**
	 * Выводит сообщение уровня ERROR.
	 * @param {string} moduleName - Имя модуля-источника лога
	 * @param {string} message
	 * @param {...*} args
	 */
	static error(moduleName, message, ...args) {
		Logger.#write(LOG_LEVELS.ERROR, moduleName, message, ...args);
	}

	/**
	 * Обёртка над console.time / console.timeEnd.
	 * @param {string} label
	 * @param {Function} fn
	 * @returns {*}
	 */
	static time(label, fn) {
		console.time(label);
		const result = fn();
		console.timeEnd(label);
		return result;
	}

	/**
	 * Внутренний метод записи лога.
	 * Формат: [LEVEL] [ModuleName] Сообщение
	 * @param {string} level
	 * @param {string} moduleName
	 * @param {string} message
	 * @param {...*} args
	 * @private
	 */
	static #write(level, moduleName, message, ...args) {
		const timestamp = APP_DEBUG ? ` [${formatTimestamp()}]` : '';
		const prefix = `[${level}] [${moduleName}]${timestamp}`;

		switch (level) {
			case LOG_LEVELS.DEBUG:
				console.debug(prefix, message, ...args);
				break;
			case LOG_LEVELS.INFO:
				console.info(prefix, message, ...args);
				break;
			case LOG_LEVELS.WARN:
				console.warn(prefix, message, ...args);
				break;
			case LOG_LEVELS.ERROR:
				console.error(prefix, message, ...args);
				break;
			default:
				console.log(prefix, message, ...args);
		}

		Logger.#dispatchToUI(level, moduleName, message);
	}

	/**
	 * Отправляет лог в UI-контейнер (если он существует).
	 * @param {string} level
	 * @param {string} moduleName
	 * @param {string} message
	 * @private
	 */
	static #dispatchToUI(level, moduleName, message) {
		const container = document.getElementById('log-container');
		if (!container) return;

		const entry = document.createElement('div');
		entry.className = `log-entry log-entry--${level.toLowerCase()}`;
		entry.textContent = `[${level}] [${moduleName}] ${message}`;
		container.appendChild(entry);
		container.scrollTop = container.scrollHeight;
	}

	/**
	 * Инициализирует глобальные обработчики ошибок.
	 * Вызывается один раз при старте приложения.
	 */
	static initGlobalHandlers() {
		window.onerror =
			/** @param {string} msg @param {string} url @param {number} line @param {number} col @param {Error} error */ (
				msg,
				url,
				line,
				col,
				error,
			) => {
				Logger.error(
					'GlobalHandler',
					`Uncaught error: ${msg} (${url}:${line}:${col})`,
					error || '',
				);
				// НФТ 4.3: UI-баннер при глобальной ошибке
				Logger.#showErrorBanner(msg);
			};

		window.addEventListener(
			'unhandledrejection',
			/** @param {PromiseRejectionEvent} event */ (event) => {
				const reason = event.reason;
				const message = reason?.message || String(reason);
				Logger.error(
					'GlobalHandler',
					`Unhandled Promise rejection: ${message}`,
					reason,
				);
			},
		);
	}

	/**
	 * Создаёт UI-баннер с сообщением об ошибке.
	 * Баннер отображается в правом верхнем углу и автоматически скрывается через 8 секунд.
	 *
	 * @param {string} message - Текст ошибки
	 * @private
	 */
	static #showErrorBanner(message) {
		const container =
			document.getElementById('error-banner-container') || document.body;

		const banner = document.createElement('div');
		banner.className = 'error-banner';
		banner.style.cssText =
			'position:fixed;top:16px;right:16px;z-index:10000;' +
			'background:#E74C3C;color:#fff;padding:12px 20px;' +
			'border-radius:6px;font-size:14px;font-family:sans-serif;' +
			'box-shadow:0 4px 12px rgba(0,0,0,0.3);' +
			'max-width:400px;word-break:break-word;' +
			'display:flex;align-items:center;gap:10px;' +
			'animation:errorBannerFadeIn 0.3s ease-out;';

		const icon = document.createElement('span');
		icon.textContent = '\u26A0\uFE0F';
		icon.style.fontSize = '18px';
		banner.appendChild(icon);

		const text = document.createElement('span');
		text.textContent = message;
		banner.appendChild(text);

		container.appendChild(banner);

		// Автоматическое скрытие через 8 секунд
		setTimeout(() => {
			banner.style.transition = 'opacity 0.5s ease-out';
			banner.style.opacity = '0';
			setTimeout(() => {
				if (banner.parentNode) {
					banner.parentNode.removeChild(banner);
				}
			}, 500);
		}, 8000);
	}
}

export { Logger, LOG_LEVELS, LOG_PRIORITY };
