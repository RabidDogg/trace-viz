/**
 * @fileoverview
 * Декларативная карта полей с Fallback Chain для нормализации данных.
 * Все конфигурации заморожены через Object.freeze().
 */

'use strict';

/**
 * @typedef {Object} FieldMapping
 * @property {string[]} traceId - Fallback chain для TraceId
 * @property {string[]} spanId - Fallback chain для SpanId
 * @property {string[]} parentId - Fallback chain для ParentId
 * @property {string[]} duration - Fallback chain для Duration
 * @property {string[]} timestamp - Fallback chain для Timestamp
 * @property {string[]} stageName - Fallback chain для StageName
 * @property {string[]} errorFlag - Fallback chain для ErrorFlag
 */

/** @type {FieldMapping} */
export const FIELD_MAPPING = Object.freeze({
	traceId: ['TraceId', 'TraceIdOld', 'TraceIdentifier'],
	spanId: ['SpanId'],
	parentId: ['ParentId'],
	duration: ['ElapsedMilliseconds', 'elapsed'],
	timestamp: ['timestamp', 'LogDate', 'CreatedOn'],
	stageName: [
		'ActionName',
		'Category',
		'IntegrationName',
		'Exception',
		'Message',
	],
	errorFlag: ['LogLevel', 'Exception'],
	logLevel: ['LogLevel'],
});

/**
 * Поля, которые сохраняются как raw при нормализации.
 * @type {ReadonlyArray<string>}
 */
export const RAW_FIELDS = Object.freeze([
	'Message',
	'Exception',
	'LogLevel',
	'Category',
	'IntegrationName',
	'ActionName',
]);
