/**
 * @fileoverview
 * TraceGrouper — группировка нормализованных записей по TraceId.
 * Разделяет записи на трейсы (Map<string, NormalizedRecord[]>) и
 * некатегоризированные записи (NormalizedRecord[]), у которых traceId === null.
 *
 * Чистая функция, zero dependencies.
 */

'use strict';

/**
 * @typedef {import('../parser/DataNormalizer.js').NormalizedRecord} NormalizedRecord
 */

/**
 * Результат группировки.
 *
 * @typedef {Object} GroupedResult
 * @property {Map<string, NormalizedRecord[]>} traces
 *     Карта: traceId → массив записей этого трейса.
 * @property {NormalizedRecord[]} uncategorized
 *     Записи, у которых traceId === null.
 */

/**
 * Группирует массив нормализованных записей по TraceId.
 *
 * Чистая функция: не мутирует входной массив, не имеет побочных эффектов.
 *
 * @param {NormalizedRecord[]} records - Массив нормализованных записей
 * @returns {GroupedResult} Объект с полями traces (Map) и uncategorized (массив)
 *
 * @example
 * const { traces, uncategorized } = groupByTraceId(records);
 * // traces.get('abc-123') → [NormalizedRecord, ...]
 * // uncategorized → [NormalizedRecord, ...]
 */
export function groupByTraceId(records) {
	/** @type {Map<string, NormalizedRecord[]>} */
	const traces = new Map();
	/** @type {NormalizedRecord[]} */
	const uncategorized = [];

	if (!Array.isArray(records)) {
		return { traces: traces, uncategorized: uncategorized };
	}

	for (let i = 0; i < records.length; i++) {
		const record = records[i];

		if (record.traceId === null || record.traceId === undefined) {
			uncategorized.push(record);
			continue;
		}

		const traceId = String(record.traceId);
		const existing = traces.get(traceId);

		if (existing !== undefined) {
			existing.push(record);
		} else {
			traces.set(traceId, [record]);
		}
	}

	return { traces: traces, uncategorized: uncategorized };
}
