/**
 * @fileoverview
 * TraceClassifier — классификация трейсов по режиму отображения.
 *
 * Определяет один из трёх режимов:
 * - full: все записи имеют spanId (FullTrace)
 * - flat: ни одна запись не имеет spanId (FlatTrace)
 * - shifted: часть записей имеет spanId, часть — нет (ShiftedTrace)
 *
 * Чистая функция, zero dependencies.
 */

'use strict';

/**
 * @typedef {import('../parser/DataNormalizer.js').NormalizedRecord} NormalizedRecord
 */

/**
 * Результат классификации трейса.
 *
 * @typedef {Object} ClassifiedTrace
 * @property {string} traceId - Идентификатор трейса
 * @property {'full' | 'flat' | 'shifted'} mode - Режим отображения
 * @property {NormalizedRecord[]} records - Записи трейса
 */

/**
 * Классифицирует массив записей одного трейса по режиму отображения.
 *
 * Чистая функция: не мутирует входной массив, не имеет побочных эффектов.
 *
 * @param {string} traceId - Идентификатор трейса
 * @param {NormalizedRecord[]} records - Массив записей одного трейса
 * @returns {ClassifiedTrace} Объект с полями traceId, mode, records
 *
 * @example
 * const result = classifyTrace('abc-123', records);
 * // { traceId: 'abc-123', mode: 'full', records: [...] }
 *
 * @example
 * const result = classifyTrace('flat-1', records);
 * // { traceId: 'flat-1', mode: 'flat', records: [...] }
 */
export function classifyTrace(traceId, records) {
	if (!Array.isArray(records) || records.length === 0) {
		return {
			traceId: String(traceId),
			mode: 'flat',
			records: [],
		};
	}

	let hasSpanId = false;
	let hasNoSpanId = false;

	for (let i = 0; i < records.length; i++) {
		const record = records[i];
		const spanId = record.spanId;

		if (spanId !== null && spanId !== undefined) {
			hasSpanId = true;
		} else {
			hasNoSpanId = true;
		}

		// Если нашли оба варианта — можно досрочно выйти
		if (hasSpanId && hasNoSpanId) {
			break;
		}
	}

	/** @type {'full' | 'flat' | 'shifted'} */
	let mode;
	if (hasSpanId && hasNoSpanId) {
		mode = 'shifted';
	} else if (hasSpanId) {
		mode = 'full';
	} else {
		mode = 'flat';
	}

	return {
		traceId: String(traceId),
		mode: mode,
		records: records,
	};
}
