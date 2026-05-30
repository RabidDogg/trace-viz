/**
 * @fileoverview
 * Unit-тесты для TraceClassifier.
 * 7 тест-кейсов: full/flat/shifted режимы, пустой/null массив, одиночные записи.
 */

import assert from 'node:assert/strict';
import { TraceClassifier } from '../../src/processor/TraceClassifier.js';

/**
 * @param {string|null} spanId
 * @returns {Object}
 */
function makeRecord(spanId) {
	return {
		traceId: 'test-trace',
		spanId: spanId,
		parentId: null,
		durationMs: null,
		timestampMs: null,
		stageName: null,
		isError: false,
		raw: {},
	};
}

export function testClassifiesFullTrace() {
	const records = [makeRecord('A'), makeRecord('B'), makeRecord('C')];
	const result = TraceClassifier.classify('trace-1', records);
	assert.strictEqual(result.mode, 'full');
}

export function testClassifiesFlatTrace() {
	const records = [makeRecord(null), makeRecord(null), makeRecord(null)];
	const result = TraceClassifier.classify('trace-1', records);
	assert.strictEqual(result.mode, 'flat');
}

export function testClassifiesShiftedTrace() {
	const records = [makeRecord('A'), makeRecord(null), makeRecord('B')];
	const result = TraceClassifier.classify('trace-1', records);
	assert.strictEqual(result.mode, 'shifted');
}

export function testReturnsFlatForEmptyRecords() {
	const result = TraceClassifier.classify('trace-1', []);
	assert.strictEqual(result.mode, 'flat');
	assert.deepStrictEqual(result.records, []);
}

export function testReturnsFlatForNullRecords() {
	const result = TraceClassifier.classify('trace-1', null);
	assert.strictEqual(result.mode, 'flat');
	assert.deepStrictEqual(result.records, []);
}

export function testHandlesSingleRecordFull() {
	const records = [makeRecord('A')];
	const result = TraceClassifier.classify('trace-1', records);
	assert.strictEqual(result.mode, 'full');
	assert.strictEqual(result.records.length, 1);
}

export function testHandlesSingleRecordFlat() {
	const records = [makeRecord(null)];
	const result = TraceClassifier.classify('trace-1', records);
	assert.strictEqual(result.mode, 'flat');
	assert.strictEqual(result.records.length, 1);
}
