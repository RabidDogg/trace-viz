/**
 * @fileoverview
 * Нормализатор данных трейсов.
 * Принимает сырой объект записи и возвращает нормализованный объект
 * с унифицированными типами полей.
 */

'use strict';

import { FIELD_MAPPING, RAW_FIELDS } from '../config/field-mapping.js';
import { parseElapsed } from './ElapsedParser.js';

/**
 * @typedef {Object} NormalizedRecord
 * @property {string|null} traceId
 * @property {string|null} spanId
 * @property {string|null} parentId
 * @property {number|null} durationMs
 * @property {number|null} timestampMs - timestamp в миллисекундах (Date.parse)
 * @property {string|null} stageName - обрезан до 200 символов
 * @property {boolean} isError
 * @property {Object} raw - исходный объект для сохранения полной информации
 */

/**
 * Максимальная длина stageName.
 * @type {number}
 */
const STAGE_NAME_MAX_LENGTH = 200;

/**
 * Уровни логирования, считающиеся ошибочными.
 * @type {ReadonlySet<string>}
 */
const ERROR_LOG_LEVELS = new Set(['error', 'fatal', 'critical']);

/**
 * Извлекает первое не-null, не-undefined значение из массива ключей в объекте.
 *
 * @param {Object} source - Исходный объект
 * @param {string[]} keys - Массив ключей для поиска (fallback chain)
 * @returns {*|null} Первое найденное значение или null
 * @private
 */
function getFirstValue(source, keys) {
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
function checkIsError(source) {
	// Проверка LogLevel
	const logLevel = getFirstValue(source, FIELD_MAPPING.errorFlag);
	if (typeof logLevel === 'string') {
		const normalized = logLevel.trim().toLowerCase();
		if (ERROR_LOG_LEVELS.has(normalized)) {
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

/**
 * Нормализует сырой объект записи в единый формат.
 *
 * @param {Object} source - Сырой объект записи (_source)
 * @returns {NormalizedRecord} Нормализованная запись
 *
 * @example
 * const record = normalizeRecord({
 *     TraceId: 'abc123',
 *     SpanId: 'def456',
 *     ElapsedMilliseconds: 150.5,
 *     ActionName: 'MyAction',
 *     LogLevel: 'Information'
 * });
 * // → {
 * //     traceId: 'abc123',
 * //     spanId: 'def456',
 * //     parentId: null,
 * //     durationMs: 150.5,
 * //     timestampMs: null,
 * //     stageName: 'MyAction',
 * //     isError: false,
 * //     raw: { ... }
 * // }
 */
export function normalizeRecord(source) {
	if (!source || typeof source !== 'object') {
		return {
			traceId: null,
			spanId: null,
			parentId: null,
			durationMs: null,
			timestampMs: null,
			stageName: null,
			isError: false,
			raw: source || {},
		};
	}

	// 1. TraceId
	const traceId = getFirstValue(source, FIELD_MAPPING.traceId);

	// 2. SpanId
	const spanId = getFirstValue(source, FIELD_MAPPING.spanId);

	// 3. ParentId
	const parentId = getFirstValue(source, FIELD_MAPPING.parentId);

	// 4. Duration — пропускаем через ElapsedParser
	const rawDuration = getFirstValue(source, FIELD_MAPPING.duration);
	const durationMs = parseElapsed(rawDuration);

	// 5. Timestamp — пропускаем через Date.parse()
	const rawTimestamp = getFirstValue(source, FIELD_MAPPING.timestamp);
	let timestampMs = null;
	if (rawTimestamp !== null) {
		const parsed = Date.parse(String(rawTimestamp));
		timestampMs = Number.isFinite(parsed) ? parsed : null;
	}

	// 6. StageName — обрезаем до 200 символов
	const rawStageName = getFirstValue(source, FIELD_MAPPING.stageName);
	let stageName = null;
	if (rawStageName !== null) {
		stageName = String(rawStageName).substring(0, STAGE_NAME_MAX_LENGTH);
	}

	// 7. ErrorFlag
	const isError = checkIsError(source);

	// 8. Raw — сохраняем только указанные поля
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
		raw: raw,
	};
}

/**
 * Нормализует массив сырых записей.
 *
 * @param {Object[]} sources - Массив сырых объектов-источников
 * @returns {NormalizedRecord[]} Массив нормализованных записей
 *
 * @example
 * const records = normalizeRecords([{ TraceId: 'abc' }, { TraceId: 'def' }]);
 * // → [NormalizedRecord, NormalizedRecord]
 */
export function normalizeRecords(sources) {
	if (!Array.isArray(sources)) {
		return [];
	}

	return sources.map(function (source) {
		return normalizeRecord(source);
	});
}
