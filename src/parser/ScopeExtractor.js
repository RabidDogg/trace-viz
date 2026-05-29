/**
 * @fileoverview
 * Парсит Scopes-строки вида "SpanId: abc123, TraceId: xyz789".
 * Извлекает пары ключ-значение, разделённые запятыми.
 */

'use strict';

/**
 * Набор известных ключей для валидации scopes-строки.
 * @type {ReadonlySet<string>}
 */
const KNOWN_KEYS = new Set([
	'SpanId',
	'TraceId',
	'ParentId',
	'TraceIdOld',
	'TraceIdentifier',
]);

/**
 * Парсит строку scopes и возвращает объект с извлечёнными парами ключ-значение.
 *
 * @param {string|null|undefined} scopeStr - Строка вида "SpanId: abc123, TraceId: xyz789"
 * @returns {Object|null} Объект с парами ключ-значение или null, если строка не содержит известных ключей
 *
 * @example
 * parseScope('SpanId: abc123, TraceId: xyz789');
 * // → { SpanId: 'abc123', TraceId: 'xyz789' }
 *
 * @example
 * parseScope('Some random text');
 * // → null
 *
 * @example
 * parseScope(null);
 * // → null
 */
export function parseScope(scopeStr) {
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

		if (KNOWN_KEYS.has(key)) {
			hasKnownKey = true;
		}
	}

	return hasKnownKey ? result : null;
}
