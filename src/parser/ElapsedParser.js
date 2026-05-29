/**
 * @fileoverview
 * ElapsedParser — парсит длительность (elapsed/duration) из различных форматов:
 * - Число: 150.5 → 150.5
 * - Строка с единицей: "1,200 ms" → 1200.0
 * - Интервал TimeSpan: "00:00:00.050" → 50.0
 * - null/undefined/NaN → null
 *
 * @example
 * ElapsedParser.parse(150.5);
 * // → 150.5
 *
 * @example
 * ElapsedParser.parse('1,200 ms');
 * // → 1200.0
 *
 * @example
 * ElapsedParser.parse('00:00:00.050');
 * // → 50.0
 *
 * @example
 * ElapsedParser.parse(null);
 * // → null
 */

'use strict';

/**
 * @class ElapsedParser
 * Статический класс для парсинга длительности из различных форматов.
 */
class ElapsedParser {
	/**
	 * Парсит длительность из различных форматов.
	 *
	 * @param {number|string|null|undefined} value - Входное значение длительности
	 * @returns {number|null} Длительность в миллисекундах или null при неудаче
	 */
	static parse(value) {
		if (value === null || value === undefined) {
			return null;
		}

		// Если число — используем напрямую
		if (typeof value === 'number') {
			return Number.isFinite(value) ? value : null;
		}

		if (typeof value !== 'string') {
			return null;
		}

		const trimmed = value.trim();
		if (trimmed.length === 0) {
			return null;
		}

		// Проверяем формат TimeSpan (содержит двоеточия)
		if (/^\d{1,2}:\d{2}/.test(trimmed)) {
			return ElapsedParser.#parseTimeSpan(trimmed);
		}

		// Пробуем как строку с единицей измерения
		return ElapsedParser.#parseStringWithUnit(trimmed);
	}

	/**
	 * Парсит длительность из строки с единицей измерения.
	 * Убирает запятые, извлекает число до пробела.
	 *
	 * @param {string} str - Строка вида "1,200 ms"
	 * @returns {number|null} Числовое значение или null
	 * @private
	 */
	static #parseStringWithUnit(str) {
		// Убираем запятые-разделители тысяч
		const cleaned = str.replace(/,/g, '').trim();
		// Берём часть до первого пробела
		const spaceIndex = cleaned.indexOf(' ');
		const numStr =
			spaceIndex === -1 ? cleaned : cleaned.substring(0, spaceIndex);
		const num = Number(numStr);
		return Number.isFinite(num) ? num : null;
	}

	/**
	 * Парсит строку в формате TimeSpan "чч:мм:сс.ммм".
	 *
	 * @param {string} str - Строка вида "00:00:00.050"
	 * @returns {number|null} Длительность в миллисекундах или null
	 * @private
	 */
	static #parseTimeSpan(str) {
		const parts = str.split(':');
		if (parts.length < 2 || parts.length > 3) {
			return null;
		}

		let hours = 0;
		let minutes = 0;
		let seconds = 0;
		let milliseconds = 0;

		if (parts.length === 3) {
			hours = parseFloat(parts[0]);
			minutes = parseFloat(parts[1]);
			const secParts = parts[2].split('.');
			seconds = parseFloat(secParts[0]);
			milliseconds = secParts.length === 2 ? parseFloat(secParts[1]) : 0;
		} else {
			// Формат "мм:сс.ммм"
			minutes = parseFloat(parts[0]);
			const secParts = parts[1].split('.');
			seconds = parseFloat(secParts[0]);
			milliseconds = secParts.length === 2 ? parseFloat(secParts[1]) : 0;
		}

		if (
			!Number.isFinite(hours) ||
			!Number.isFinite(minutes) ||
			!Number.isFinite(seconds) ||
			!Number.isFinite(milliseconds)
		) {
			return null;
		}

		return (
			hours * 3600000 + minutes * 60000 + seconds * 1000 + milliseconds
		);
	}
}

export { ElapsedParser };
