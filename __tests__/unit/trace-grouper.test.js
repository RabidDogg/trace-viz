/**
 * @fileoverview
 * Unit-тесты для TraceGrouper.
 * 5 тест-кейсов: группировка по traceId, uncategorized, не-массив,
 * один трейс, сохранение порядка.
 */

import assert from 'node:assert/strict';
import { TraceGrouper } from '../../src/processor/TraceGrouper.js';

/**
 * @param {string|null} traceId
 * @param {number} order
 * @returns {Object}
 */
function makeRecord(traceId, order) {
	return {
		traceId: traceId,
		spanId: null,
		parentId: null,
		durationMs: null,
		timestampMs: null,
		stageName: null,
		isError: false,
		raw: { order: order },
	};
}

export function testGroupsByTraceId() {
	const records = [
		makeRecord('trace-A', 1),
		makeRecord('trace-B', 2),
		makeRecord('trace-A', 3),
	];
	const { traces, uncategorized } = TraceGrouper.group(records);

	assert.strictEqual(traces.size, 2);
	assert.strictEqual(traces.get('trace-A').length, 2);
	assert.strictEqual(traces.get('trace-B').length, 1);
	assert.strictEqual(uncategorized.length, 0);
}

export function testPutsNullTraceIdInUncategorized() {
	const records = [makeRecord(null, 1), makeRecord('trace-A', 2)];
	const { traces, uncategorized } = TraceGrouper.group(records);

	assert.strictEqual(traces.size, 1);
	assert.strictEqual(uncategorized.length, 1);
	assert.strictEqual(uncategorized[0].traceId, null);
}

export function testReturnsEmptyForNonArray() {
	const { traces, uncategorized } = TraceGrouper.group(null);

	assert.strictEqual(traces.size, 0);
	assert.strictEqual(uncategorized.length, 0);
}

export function testHandlesSingleTrace() {
	const records = [makeRecord('trace-A', 1), makeRecord('trace-A', 2)];
	const { traces } = TraceGrouper.group(records);

	assert.strictEqual(traces.size, 1);
	assert.strictEqual(traces.get('trace-A').length, 2);
}

export function testPreservesRecordOrder() {
	const records = [
		makeRecord('trace-A', 1),
		makeRecord('trace-A', 2),
		makeRecord('trace-A', 3),
	];
	const { traces } = TraceGrouper.group(records);
	const group = traces.get('trace-A');

	assert.strictEqual(group[0].raw.order, 1);
	assert.strictEqual(group[1].raw.order, 2);
	assert.strictEqual(group[2].raw.order, 3);
}
