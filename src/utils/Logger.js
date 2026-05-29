/**
 * @fileoverview
 * Система логирования приложения Trace Viz.
 * Поддерживает уровни DEBUG, INFO, WARN, ERROR.
 * Глобальный флаг window.APP_DEBUG включает вывод DEBUG-сообщений.
 * Перехватывает window.onerror и unhandledrejection.
 */

'use strict';

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
 */
class Logger {
	/** @type {number} */
	static #minPriority = LOG_PRIORITY.DEBUG;

	/**
	 * Выводит сообщение уровня DEBUG.
	 * Отображается только если window.APP_DEBUG === true.
	 * @param {string} message
	 * @param {...*} args
	 */
	static debug(message, ...args) {
		if (!window.APP_DEBUG) return;
		Logger.#write(LOG_LEVELS.DEBUG, message, ...args);
	}

	/**
	 * Выводит сообщение уровня INFO.
	 * @param {string} message
	 * @param {...*} args
	 */
	static info(message, ...args) {
		Logger.#write(LOG_LEVELS.INFO, message, ...args);
	}

	/**
	 * Выводит сообщение уровня WARN.
	 * @param {string} message
	 * @param {...*} args
	 */
	static warn(message, ...args) {
		Logger.#write(LOG_LEVELS.WARN, message, ...args);
	}

	/**
	 * Выводит сообщение уровня ERROR.
	 * @param {string} message
	 * @param {...*} args
	 */
	static error(message, ...args) {
		Logger.#write(LOG_LEVELS.ERROR, message, ...args);
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
	 * @param {string} level
	 * @param {string} message
	 * @param {...*} args
	 * @private
	 */
	static #write(level, message, ...args) {
		const timestamp = formatTimestamp();
		const prefix = `[${level}] [${timestamp}]`;

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

		Logger.#dispatchToUI(level, prefix, message);
	}

	/**
	 * Отправляет лог в UI-контейнер (если он существует).
	 * @param {string} level
	 * @param {string} prefix
	 * @param {string} message
	 * @private
	 */
	static #dispatchToUI(level, prefix, message) {
		const container = document.getElementById('log-container');
		if (!container) return;

		const entry = document.createElement('div');
		entry.className = `log-entry log-entry--${level.toLowerCase()}`;
		entry.textContent = `${prefix} ${message}`;
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
					`Uncaught error: ${msg} (${url}:${line}:${col})`,
					error || '',
				);
			};

		window.addEventListener(
			'unhandledrejection',
			/** @param {PromiseRejectionEvent} event */ (event) => {
				const reason = event.reason;
				const message = reason?.message || String(reason);
				Logger.error(`Unhandled Promise rejection: ${message}`, reason);
			},
		);
	}
}

export { Logger, LOG_LEVELS, LOG_PRIORITY };
