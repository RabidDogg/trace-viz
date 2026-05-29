/**
 * @fileoverview
 * ScopeExtractor — парсит Scopes-строки вида "SpanId: abc123, TraceId: xyz789".
 * Извлекает пары ключ-значение, разделённые запятыми.
 */

'use strict';

/**
 * @class ScopeExtractor
 * Статический класс для извлечения пар ключ-значение из scopes-строк.
 */
class ScopeExtractor {
	/**
	 * Набор известных ключей для валидации scopes-строки.
	 * @type {ReadonlySet<string>}
	 */
	static #KNOWN_KEYS = Object.freeze(
		new Set([
			'SpanId',
			'TraceId',
			'ParentId',
			'TraceIdOld',
			'TraceIdentifier',
		]),
	);

	/**
	 * Парсит строку scopes и возвращает объект с извлечёнными парами ключ-значение.
	 *
	 * @param {string|null|undefined} scopeStr - Строка вида "SpanId: abc123, TraceId: xyz789"
	 * @returns {Object|null} Объект с парами ключ-значение или null, если строка не содержит известных ключей
	 *
	 * @example
	 * ScopeExtractor.extract('SpanId: abc123, TraceId: xyz789');
	 * // → { SpanId: 'abc123', TraceId: 'xyz789' }
	 *
	 * @example
	 * ScopeExtractor.extract('Some random text');
	 * // → null
	 *
	 * @example
	 * ScopeExtractor.extract(null);
	 * // → null
	 */
	static extract(scopeStr) {
		if (typeof scopeStr !== 'string' || scopeStr.trim().length === 0) {
			return null;
		}

		/** @type {Object<string, string>} */
		const result = {};
		let hasKnownKey = false;

		// Разделяем по запятой
		const pairs = scopeStr.split(',');
		for (let i = 0; i < pairs.length; i++) {
			const pair = pairs[i].trim();
			if (pair.length === 0) continue;

			// Ищем первое двоеточие
			const colonIndex = pair.indexOf(':');
			if (colonIndex === -1) continue;

			const key = pair.substring(0, colonIndex).trim();
			const value = pair.substring(colonIndex + 1).trim();

			if (key.length === 0) continue;

			result[key] = value;

			if (ScopeExtractor.#KNOWN_KEYS.has(key)) {
				hasKnownKey = true;
			}
		}

		return hasKnownKey ? result : null;
	}
}

export { ScopeExtractor };
