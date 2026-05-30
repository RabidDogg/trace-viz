/**
 * @fileoverview
 * Unit-тесты для SpanHierarchyBuilder.
 * 9 тест-кейсов: parent-child, пустой массив, сломанная parent-ссылка,
 * фильтрация без spanId, расчёт depth/endTime, сортировка детей, циклические ссылки.
 */

import assert from 'node:assert/strict';
import { SpanHierarchyBuilder } from '../../src/processor/SpanHierarchyBuilder.js';

/**
 * @param {Object} overrides
 * @returns {Object}
 */
function makeRecord(overrides) {
	return {
		traceId: 'test-trace',
		spanId: null,
		parentId: null,
		durationMs: null,
		timestampMs: null,
		stageName: null,
		isError: false,
		raw: {},
		...overrides,
	};
}

export function testBuildsSimpleParentChild() {
	const builder = new SpanHierarchyBuilder();
	const records = [
		makeRecord({
			spanId: 'A',
			parentId: null,
			timestampMs: 1000,
			durationMs: 500,
		}),
		makeRecord({
			spanId: 'B',
			parentId: 'A',
			timestampMs: 1100,
			durationMs: 200,
		}),
	];
	const result = builder.build(records);

	assert.strictEqual(result.roots.length, 1);
	assert.strictEqual(result.roots[0].spanId, 'A');
	assert.strictEqual(result.roots[0].children.length, 1);
	assert.strictEqual(result.roots[0].children[0].spanId, 'B');
}

export function testHandlesEmptyArray() {
	const builder = new SpanHierarchyBuilder();
	const result = builder.build([]);

	assert.strictEqual(result.roots.length, 0);
	assert.strictEqual(result.nodeMap.size, 0);
	assert.strictEqual(result.maxDepth, 0);
}

export function testHandlesBrokenParentRef() {
	const builder = new SpanHierarchyBuilder();
	const records = [
		makeRecord({ spanId: 'B', parentId: 'NONEXIST', timestampMs: 1000 }),
	];
	const result = builder.build(records);

	assert.strictEqual(result.roots.length, 1);
	assert.strictEqual(result.roots[0].spanId, 'B');
}

export function testFiltersRecordsWithoutSpanId() {
	const builder = new SpanHierarchyBuilder();
	const records = [
		makeRecord({ spanId: null, timestampMs: 1000 }),
		makeRecord({ spanId: 'A', parentId: null, timestampMs: 2000 }),
	];
	const result = builder.build(records);

	assert.strictEqual(result.roots.length, 1);
	assert.strictEqual(result.roots[0].spanId, 'A');
}

export function testCalculatesDepth() {
	const builder = new SpanHierarchyBuilder();
	const records = [
		makeRecord({ spanId: 'A', parentId: null, timestampMs: 1000 }),
		makeRecord({ spanId: 'B', parentId: 'A', timestampMs: 1100 }),
		makeRecord({ spanId: 'C', parentId: 'B', timestampMs: 1200 }),
	];
	const result = builder.build(records);

	assert.strictEqual(result.roots[0].depth, 0);
	assert.strictEqual(result.roots[0].children[0].depth, 1);
	assert.strictEqual(result.roots[0].children[0].children[0].depth, 2);
	assert.strictEqual(result.maxDepth, 2);
}

export function testCalculatesEndTime() {
	const builder = new SpanHierarchyBuilder();
	const records = [
		makeRecord({
			spanId: 'A',
			parentId: null,
			timestampMs: 1000,
			durationMs: 500,
		}),
	];
	const result = builder.build(records);

	assert.strictEqual(result.roots[0].startTime, 1000);
	assert.strictEqual(result.roots[0].endTime, 1500);
}

export function testSortsChildrenByStartTime() {
	const builder = new SpanHierarchyBuilder();
	const records = [
		makeRecord({ spanId: 'A', parentId: null, timestampMs: 1000 }),
		makeRecord({ spanId: 'C', parentId: 'A', timestampMs: 1300 }),
		makeRecord({ spanId: 'B', parentId: 'A', timestampMs: 1100 }),
	];
	const result = builder.build(records);

	assert.strictEqual(result.roots[0].children[0].spanId, 'B');
	assert.strictEqual(result.roots[0].children[1].spanId, 'C');
}

export function testHandlesCyclicReference() {
	const builder = new SpanHierarchyBuilder();
	const records = [
		makeRecord({ spanId: 'A', parentId: 'B', timestampMs: 1000 }),
		makeRecord({ spanId: 'B', parentId: 'A', timestampMs: 2000 }),
	];
	// При циклической ссылке A→B, B→A не должно быть ошибки/исключения
	// Оба узла должны быть в nodeMap
	const result = builder.build(records);
	assert.strictEqual(
		result.nodeMap.size,
		2,
		'Оба узла должны быть в nodeMap',
	);
}
