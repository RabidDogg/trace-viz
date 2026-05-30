/**
 * @fileoverview
 * DataNormalizer — нормализатор данных трейсов.
 * Принимает сырой объект записи и возвращает нормализованный объект
 * с унифицированными типами полей.
 */

'use strict';

import { FIELD_MAPPING, RAW_FIELDS } from '../config/field-mapping.js';
import { ElapsedParser } from './ElapsedParser.js';
import { Logger } from '../utils/Logger.js';

/**
 * @typedef {Object} NormalizedRecord
 * @property {string|null} traceId
 * @property {string|null} spanId
 * @property {string|null} parentId
 * @property {number|null} durationMs
 * @property {number|null} timestampMs - timestamp в миллисекундах (Date.parse)
 * @property {string|null} stageName - обрезан до 200 символов
 * @property {boolean} isError
 * @property {string|null} logLevel
 * @property {Object} raw - исходный объект для сохранения полной информации
 */

/**
 * @class DataNormalizer
 * Нормализует сырые записи трейсов в единый формат.
 *
 * @example
 * const normalizer = new DataNormalizer();
 * const records = normalizer.normalize(sources);
 * // → NormalizedRecord[]
 */
class DataNormalizer {
	/**
	 * Максимальная длина stageName.
	 * @type {number}
	 */
	static #STAGE_NAME_MAX_LENGTH = 200;

	/**
	 * Уровни логирования, считающиеся ошибочными.
	 * @type {ReadonlySet<string>}
	 */
	static #ERROR_LOG_LEVELS = Object.freeze(
		new Set(['error', 'fatal', 'critical']),
	);

	/**
	 * @param {Object} [fieldMapping] - Опциональный fieldMapping (по умолчанию FIELD_MAPPING)
	 */
	constructor(fieldMapping) {
		/**
		 * Карта полей для нормализации.
		 * @type {Object}
		 * @private
		 */
		this._fieldMapping = fieldMapping || FIELD_MAPPING;
	}

	/**
	 * Нормализует массив сырых записей.
	 *
	 * @param {Object[]} sources - Массив сырых объектов-источников
	 * @returns {NormalizedRecord[]} Массив нормализованных записей
	 *
	 * @example
	 * const records = normalizer.normalize([{ TraceId: 'abc' }, { TraceId: 'def' }]);
	 * // → [NormalizedRecord, NormalizedRecord]
	 */
	normalize(sources) {
		if (!Array.isArray(sources)) {
			return [];
		}

		return sources.map(function (source) {
			const norm = this.#normalizeRecord(source);
			Logger.debug('DataNormalizer', 'Source data: ', source);
			Logger.debug('DataNormalizer', 'Normalized data: ', norm);
			return norm;
		}, this);
	}

	/**
	 * Нормализует сырой объект записи в единый формат.
	 *
	 * @param {Object} source - Сырой объект записи (_source)
	 * @returns {NormalizedRecord} Нормализованная запись
	 * @private
	 */
	#normalizeRecord(source) {
		if (!source || typeof source !== 'object') {
			return {
				traceId: null,
				spanId: null,
				parentId: null,
				durationMs: null,
				timestampMs: null,
				stageName: null,
				isError: false,
				logLevel: null,
				raw: source || {},
			};
		}

		// 1. TraceId
		const traceId = this.#getFirstValue(source, this._fieldMapping.traceId);

		// 2. SpanId
		const spanId = this.#getFirstValue(source, this._fieldMapping.spanId);

		// 3. ParentId
		const parentId = this.#getFirstValue(
			source,
			this._fieldMapping.parentId,
		);

		// 4. Duration — пропускаем через ElapsedParser
		const rawDuration = this.#getFirstValue(
			source,
			this._fieldMapping.duration,
		);
		const durationMs = ElapsedParser.parse(rawDuration);

		// 5. Timestamp — пропускаем через Date.parse()
		const rawTimestamp = this.#getFirstValue(
			source,
			this._fieldMapping.timestamp,
		);
		let timestampMs = null;
		if (rawTimestamp !== null) {
			const parsed = Date.parse(String(rawTimestamp));
			timestampMs = Number.isFinite(parsed) ? parsed : null;
		}

		// 6. StageName — обрезаем до 200 символов
		const rawStageName = this.#getFirstValue(
			source,
			this._fieldMapping.stageName,
		);
		let stageName = null;
		if (rawStageName !== null) {
			stageName = String(rawStageName).substring(
				0,
				DataNormalizer.#STAGE_NAME_MAX_LENGTH,
			);
		}

		// 7. ErrorFlag
		const isError = this.#checkIsError(source);

		// 8. LogLevel
		const logLevel = this.#getFirstValue(
			source,
			this._fieldMapping.logLevel,
		);

		// 9. Raw — сохраняем только указанные поля
		/** @type {Object} */
		const raw = {};
		for (let i = 0; i < RAW_FIELDS.length; i++) {
			const field = RAW_FIELDS[i];
			if (Object.prototype.hasOwnProperty.call(source, field)) {
				raw[field] = source[field];
			}
		}

		return {
			traceId:
				typeof traceId === 'string'
					? traceId
					: traceId !== null
						? String(traceId)
						: null,
			spanId:
				typeof spanId === 'string'
					? spanId
					: spanId !== null
						? String(spanId)
						: null,
			parentId:
				typeof parentId === 'string'
					? parentId
					: parentId !== null
						? String(parentId)
						: null,
			durationMs: durationMs,
			timestampMs: timestampMs,
			stageName: stageName,
			isError: isError,
			logLevel: logLevel,
			raw: raw,
		};
	}

	/**
	 * Извлекает первое не-null, не-undefined значение из массива ключей в объекте.
	 *
	 * @param {Object} source - Исходный объект
	 * @param {string[]} keys - Массив ключей для поиска (fallback chain)
	 * @returns {*|null} Первое найденное значение или null
	 * @private
	 */
	#getFirstValue(source, keys) {
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];
			if (Object.prototype.hasOwnProperty.call(source, key)) {
				const value = source[key];
				if (value !== null && value !== undefined) {
					return value;
				}
			}
		}
		return null;
	}

	/**
	 * Проверяет, является ли запись ошибочной.
	 *
	 * @param {Object} source - Исходный объект
	 * @returns {boolean} true, если запись содержит ошибку
	 * @private
	 */
	#checkIsError(source) {
		// Проверка LogLevel
		const logLevel = this.#getFirstValue(
			source,
			this._fieldMapping.errorFlag,
		);
		if (typeof logLevel === 'string') {
			const normalized = logLevel.trim().toLowerCase();
			if (DataNormalizer.#ERROR_LOG_LEVELS.has(normalized)) {
				return true;
			}
		}

		// Проверка наличия поля Exception
		if (Object.prototype.hasOwnProperty.call(source, 'Exception')) {
			const exc = source['Exception'];
			if (exc !== null && exc !== undefined && exc !== '') {
				return true;
			}
		}

		return false;
	}
}

export { DataNormalizer };
