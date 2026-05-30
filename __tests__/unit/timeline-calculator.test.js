/**
 * @fileoverview
 * Unit-тесты для TimelineCalculator.
 * 5 тест-кейсов: границы шкалы, пустой массив, генерация меток,
 * интервал меток, единичный timestamp.
 */

import assert from 'node:assert/strict';
import { TimelineCalculator } from '../../src/processor/TimelineCalculator.js';

/**
 * @param {Object} overrides
 * @returns {Object}
 */
function makeLayoutItem(overrides) {
	return {
		id: 'test',
		type: 'span',
		x: 0,
		y: 0,
		width: 100,
		depth: 0,
		record: {
			traceId: 'test',
			spanId: 'A',
			parentId: null,
			durationMs: null,
			timestampMs: null,
			stageName: null,
			isError: false,
			raw: {},
		},
		parentSpanId: null,
		isOrphan: false,
		...overrides,
	};
}

export function testCalculatesTimelineBounds() {
	const items = [
		makeLayoutItem({ record: { timestampMs: 1000, durationMs: 500 } }),
		makeLayoutItem({ record: { timestampMs: 2000, durationMs: 300 } }),
	];
	const result = TimelineCalculator.calculate(items, { timelineWidth: 1200 });

	assert.strictEqual(result.timelineStart, 1000);
	assert.strictEqual(result.timelineEnd, 2000);
	assert.ok(result.durationMs > 0);
}

export function testReturnsEmptyForEmptyItems() {
	const result = TimelineCalculator.calculate([], { timelineWidth: 1200 });

	assert.strictEqual(result.ticks.length, 0);
	assert.strictEqual(result.durationMs, 0);
}

export function testGeneratesTicks() {
	const items = [
		makeLayoutItem({ record: { timestampMs: 1000, durationMs: 500 } }),
		makeLayoutItem({ record: { timestampMs: 5000, durationMs: 300 } }),
	];
	const result = TimelineCalculator.calculate(items, { timelineWidth: 1200 });

	assert.ok(result.ticks.length > 0);
}

export function testTickIntervalIsReasonable() {
	const items = [
		makeLayoutItem({ record: { timestampMs: 0, durationMs: 1000 } }),
		makeLayoutItem({ record: { timestampMs: 10000, durationMs: 1000 } }),
	];
	const result = TimelineCalculator.calculate(items, { timelineWidth: 1200 });

	// Интервал должен быть одним из "красивых" значений
	const niceIntervals = [
		0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 30,
		60, 120, 300, 600, 1800, 3600, 7200, 14400, 86400,
	];
	assert.ok(niceIntervals.includes(result.tickInterval));
}

export function testHandlesSingleTimestamp() {
	const items = [
		makeLayoutItem({ record: { timestampMs: 1000, durationMs: 500 } }),
		makeLayoutItem({ record: { timestampMs: 1000, durationMs: 300 } }),
	];
	const result = TimelineCalculator.calculate(items, { timelineWidth: 1200 });

	// Все записи с одним timestamp → durationMs === 1 (расширение шкалы)
	assert.strictEqual(result.durationMs, 1);
}
