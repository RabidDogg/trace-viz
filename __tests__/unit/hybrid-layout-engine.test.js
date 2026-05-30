/**
 * @fileoverview
 * Unit-тесты для HybridLayoutEngine.
 * 9 тест-кейсов: full/flat/shifted режимы, пустой вход, расчёт X/Y координат,
 * отступы для вложенности, встраивание orphan, orphan без timestamp.
 */

import assert from 'node:assert/strict';
import { HybridLayoutEngine } from '../../src/processor/HybridLayoutEngine.js';
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

export function testFullTraceMode() {
	const builder = new SpanHierarchyBuilder();
	const engine = new HybridLayoutEngine({ timelineWidth: 1200 });

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
	const hierarchy = builder.build(records);
	const layout = engine.calculate(hierarchy, []);

	assert.ok(layout.length > 0);
	for (let i = 0; i < layout.length; i++) {
		assert.strictEqual(layout[i].type, 'span');
	}
}

export function testFlatMode() {
	const engine = new HybridLayoutEngine({ timelineWidth: 1200 });
	const hierarchy = { roots: [], nodeMap: new Map(), maxDepth: 0 };

	const orphans = [
		makeRecord({ timestampMs: 1000 }),
		makeRecord({ timestampMs: 2000 }),
	];
	const layout = engine.calculate(hierarchy, orphans);

	assert.ok(layout.length > 0);
	for (let i = 0; i < layout.length; i++) {
		assert.strictEqual(layout[i].type, 'orphan');
	}
}

export function testShiftedMode() {
	const builder = new SpanHierarchyBuilder();
	const engine = new HybridLayoutEngine({ timelineWidth: 1200 });

	const records = [
		makeRecord({
			spanId: 'A',
			parentId: null,
			timestampMs: 1000,
			durationMs: 500,
		}),
		makeRecord({ spanId: null, timestampMs: 1100 }),
	];
	const hierarchy = builder.build(records);

	// Извлекаем orphan-записи (без spanId)
	const orphans = records.filter(function (r) {
		return r.spanId === null;
	});
	const layout = engine.calculate(hierarchy, orphans);

	const hasSpan = layout.some(function (item) {
		return item.type === 'span';
	});
	const hasOrphan = layout.some(function (item) {
		return item.type === 'orphan';
	});

	assert.ok(hasSpan);
	assert.ok(hasOrphan);
}

export function testHandlesEmptyInput() {
	const engine = new HybridLayoutEngine({ timelineWidth: 1200 });
	const hierarchy = { roots: [], nodeMap: new Map(), maxDepth: 0 };
	const layout = engine.calculate(hierarchy, []);

	assert.deepStrictEqual(layout, []);
}

export function testCalculatesXCoordinates() {
	const builder = new SpanHierarchyBuilder();
	const engine = new HybridLayoutEngine({ timelineWidth: 1200 });

	const records = [
		makeRecord({
			spanId: 'A',
			parentId: null,
			timestampMs: 1000,
			durationMs: 500,
		}),
	];
	const hierarchy = builder.build(records);
	const layout = engine.calculate(hierarchy, []);

	assert.ok(layout[0].x >= 0);
}

export function testCalculatesYCoordinates() {
	const builder = new SpanHierarchyBuilder();
	const engine = new HybridLayoutEngine({ timelineWidth: 1200 });

	const records = [
		makeRecord({ spanId: 'A', parentId: null, timestampMs: 1000 }),
		makeRecord({ spanId: 'B', parentId: null, timestampMs: 2000 }),
	];
	const hierarchy = builder.build(records);
	const layout = engine.calculate(hierarchy, []);

	// Два корня — разные Y
	assert.notStrictEqual(layout[0].y, layout[1].y);
}

export function testAppliesIndentForDepth() {
	const builder = new SpanHierarchyBuilder();
	const engine = new HybridLayoutEngine({
		timelineWidth: 1200,
		indentWidth: 20,
	});

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
	const hierarchy = builder.build(records);
	const layout = engine.calculate(hierarchy, []);

	// Дочерний спан должен иметь больший x из-за отступа
	const spanA = layout.find(function (item) {
		return item.id === 'A';
	});
	const spanB = layout.find(function (item) {
		return item.id === 'B';
	});
	assert.ok(spanB.x > spanA.x);
}

export function testOrphanEmbeddedInParent() {
	const builder = new SpanHierarchyBuilder();
	const engine = new HybridLayoutEngine({ timelineWidth: 1200 });

	const records = [
		makeRecord({
			spanId: 'A',
			parentId: null,
			timestampMs: 1000,
			durationMs: 1000,
		}),
		makeRecord({ spanId: null, timestampMs: 1100 }),
	];
	const hierarchy = builder.build(records);
	const orphans = records.filter(function (r) {
		return r.spanId === null;
	});
	const layout = engine.calculate(hierarchy, orphans);

	const orphanItem = layout.find(function (item) {
		return item.isOrphan;
	});
	assert.ok(orphanItem !== undefined);
	assert.ok(orphanItem.parentSpanId !== null);
}

export function testOrphanWithoutTimestamp() {
	const builder = new SpanHierarchyBuilder();
	const engine = new HybridLayoutEngine({ timelineWidth: 1200 });

	const records = [
		makeRecord({
			spanId: 'A',
			parentId: null,
			timestampMs: 1000,
			durationMs: 500,
		}),
		makeRecord({ spanId: null, timestampMs: null }),
	];
	const hierarchy = builder.build(records);
	const orphans = records.filter(function (r) {
		return r.spanId === null;
	});
	const layout = engine.calculate(hierarchy, orphans);

	const orphanItem = layout.find(function (item) {
		return item.isOrphan;
	});
	assert.ok(orphanItem !== undefined);
	// orphan без timestamp должен быть в начале шкалы (x === 0)
	assert.strictEqual(orphanItem.x, 0);
}
