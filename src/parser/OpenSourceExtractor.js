/**
 * @fileoverview
 * OpenSourceExtractor — извлекает записи из структуры Elasticsearch-ответа.
 * Поддерживает стандартную структуру { hits: { hits: [{ _source: {} }] } }
 * и плоские массивы (каждый элемент — это _source).
 */

'use strict';

/**
 * @class OpenSourceExtractor
 * Статический класс для извлечения _source-объектов из Elasticsearch-ответа.
 */
class OpenSourceExtractor {
	/**
	 * Извлекает массив объектов-источников из структуры Elasticsearch.
	 *
	 * @param {Object} data - Входные данные (результат загрузки файла)
	 * @returns {Object[]} Массив объектов-источников (_source)
	 *
	 * @example
	 * // Стандартная структура Elasticsearch
	 * const sources = OpenSourceExtractor.extract({ hits: { hits: [{ _source: { TraceId: 'abc' } }] } });
	 * // → [{ TraceId: 'abc' }]
	 *
	 * @example
	 * // Плоский массив
	 * const sources = OpenSourceExtractor.extract([{ TraceId: 'abc' }]);
	 * // → [{ TraceId: 'abc' }]
	 */
	static extract(data) {
		if (!data || typeof data !== 'object') {
			return [];
		}

		// Плоский массив — каждый элемент уже является _source
		if (Array.isArray(data)) {
			return data.slice();
		}

		// Стандартная структура Elasticsearch: hits.hits[]._source
		if (data.hits && Array.isArray(data.hits.hits)) {
			return data.hits.hits
				.map(function (hit) {
					return hit && hit._source ? hit._source : null;
				})
				.filter(Boolean);
		}

		// Если data — одиночный объект с полями (не hits), оборачиваем как единственный источник
		if (typeof data === 'object' && !Array.isArray(data)) {
			return [data];
		}

		return [];
	}
}

export { OpenSourceExtractor };
