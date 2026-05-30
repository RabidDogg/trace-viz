/**
 * @fileoverview
 * Smoke-тесты для базовой работоспособности всех ключевых модулей.
 * 7 тест-кейсов: ScopeExtractor, ElapsedParser, DataNormalizer,
 * TraceClassifier, TraceGrouper, SpanHierarchyBuilder, HybridLayoutEngine.
 */

import assert from 'node:assert/strict';
import { ScopeExtractor } from '../../src/parser/ScopeExtractor.js';
import { ElapsedParser } from '../../src/parser/ElapsedParser.js';
import { DataNormalizer } from '../../src/parser/DataNormalizer.js';
import { TraceClassifier } from '../../src/processor/TraceClassifier.js';
import { TraceGrouper } from '../../src/processor/TraceGrouper.js';
import { SpanHierarchyBuilder } from '../../src/processor/SpanHierarchyBuilder.js';
import { HybridLayoutEngine } from '../../src/processor/HybridLayoutEngine.js';

export function testScopeExtractorWorks() {
	const result = ScopeExtractor.extract('SpanId: abc');
	assert.deepStrictEqual(result, { SpanId: 'abc' });
}

export function testElapsedParserWorks() {
	const result = ElapsedParser.parse(150);
	assert.strictEqual(result, 150);
}

export function testDataNormalizerWorks() {
	const normalizer = new DataNormalizer();
	const result = normalizer.normalize([{ TraceId: 'test' }]);
	assert.strictEqual(result.length, 1);
	assert.strictEqual(result[0].traceId, 'test');
}

export function testTraceClassifierWorks() {
	const records = [
		{
			traceId: 't1',
			spanId: 'A',
			parentId: null,
			durationMs: null,
			timestampMs: null,
			stageName: null,
			isError: false,
			raw: {},
		},
		{
			traceId: 't1',
			spanId: 'B',
			parentId: null,
			durationMs: null,
			timestampMs: null,
			stageName: null,
			isError: false,
			raw: {},
		},
	];
	const result = TraceClassifier.classify('t1', records);
	assert.strictEqual(result.mode, 'full');
}

export function testTraceGrouperWorks() {
	const records = [
		{
			traceId: 't1',
			spanId: null,
			parentId: null,
			durationMs: null,
			timestampMs: null,
			stageName: null,
			isError: false,
			raw: {},
		},
		{
			traceId: 't2',
			spanId: null,
			parentId: null,
			durationMs: null,
			timestampMs: null,
			stageName: null,
			isError: false,
			raw: {},
		},
	];
	const { traces } = TraceGrouper.group(records);
	assert.strictEqual(traces.size, 2);
}

export function testSpanHierarchyBuilderWorks() {
	const builder = new SpanHierarchyBuilder();
	const records = [
		{
			traceId: 't1',
			spanId: 'A',
			parentId: null,
			durationMs: null,
			timestampMs: 1000,
			stageName: null,
			isError: false,
			raw: {},
		},
		{
			traceId: 't1',
			spanId: 'B',
			parentId: 'A',
			durationMs: null,
			timestampMs: 1100,
			stageName: null,
			isError: false,
			raw: {},
		},
	];
	const result = builder.build(records);
	assert.strictEqual(result.roots.length, 1);
}

export function testHybridLayoutEngineWorks() {
	const engine = new HybridLayoutEngine({ timelineWidth: 1200 });
	const hierarchy = { roots: [], nodeMap: new Map(), maxDepth: 0 };
	const layout = engine.calculate(hierarchy, []);
	assert.deepStrictEqual(layout, []);
}
