/**
 * @fileoverview
 * Integration-тесты для полного пайплайна на sample_full_trace.json.
 * 7 тест-кейсов: полный пайплайн без ошибок, все записи имеют traceId/spanId,
 * классификация 'full', непустая иерархия, все LayoutItem типа 'span',
 * корректные Y-координаты.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { OpenSourceExtractor } from '../../src/parser/OpenSourceExtractor.js';
import { DataNormalizer } from '../../src/parser/DataNormalizer.js';
import { TraceGrouper } from '../../src/processor/TraceGrouper.js';
import { TraceClassifier } from '../../src/processor/TraceClassifier.js';
import { SpanHierarchyBuilder } from '../../src/processor/SpanHierarchyBuilder.js';
import { HybridLayoutEngine } from '../../src/processor/HybridLayoutEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PATH = path.resolve(
	__dirname,
	'../../samples/sample_full_trace.json',
);

/**
 * Загружает и парсит JSON-файл.
 * @returns {Object}
 */
function loadSample() {
	const content = fs.readFileSync(SAMPLE_PATH, 'utf-8');
	return JSON.parse(content);
}

/**
 * Запускает полный пайплайн: загрузка → извлечение → нормализация → группировка → классификация → иерархия → лейаут.
 * @returns {Object} Результаты всех этапов пайплайна
 */
function runFullPipeline() {
	const rawData = loadSample();

	// Шаг 1: Извлечение _source
	const sources = OpenSourceExtractor.extract(rawData);

	// Шаг 2: Нормализация
	const normalizer = new DataNormalizer();
	const records = normalizer.normalize(sources);

	// Шаг 3: Группировка по TraceId
	const { traces, uncategorized } = TraceGrouper.group(records);

	// Берём первый трейс
	const traceIds = Array.from(traces.keys());
	const firstTraceId = traceIds[0];
	const traceRecords = traces.get(firstTraceId);

	// Шаг 4: Классификация
	const classified = TraceClassifier.classify(firstTraceId, traceRecords);

	// Шаг 5: Построение иерархии
	const builder = new SpanHierarchyBuilder();
	const hierarchy = builder.build(classified.records);

	// Шаг 6: Расчёт лейаута
	const engine = new HybridLayoutEngine({ timelineWidth: 1200 });
	const layout = engine.calculate(hierarchy, []);

	return {
		sources,
		records,
		traces,
		uncategorized,
		classified,
		hierarchy,
		layout,
	};
}

export function testFullPipelineProducesLayout() {
	const result = runFullPipeline();
	assert.ok(result.layout.length > 0);
}

export function testAllRecordsHaveTraceId() {
	const result = runFullPipeline();
	for (let i = 0; i < result.records.length; i++) {
		assert.notStrictEqual(
			result.records[i].traceId,
			null,
			'Record ' + i + ' has null traceId',
		);
	}
}

export function testAllRecordsHaveSpanId() {
	const result = runFullPipeline();
	for (let i = 0; i < result.records.length; i++) {
		assert.notStrictEqual(
			result.records[i].spanId,
			null,
			'Record ' + i + ' has null spanId',
		);
	}
}

export function testTraceClassifiedAsFull() {
	const result = runFullPipeline();
	assert.strictEqual(result.classified.mode, 'full');
}

export function testHierarchyHasRoots() {
	const result = runFullPipeline();
	assert.ok(result.hierarchy.roots.length > 0);
}

export function testLayoutItemsAreSpans() {
	const result = runFullPipeline();
	for (let i = 0; i < result.layout.length; i++) {
		assert.strictEqual(
			result.layout[i].type,
			'span',
			'Item ' + i + ' is not a span',
		);
	}
}

export function testLayoutHasCorrectYOrder() {
	const result = runFullPipeline();
	// Y-координаты должны быть последовательными (0, 1, 2, ...)
	const yValues = result.layout.map(function (item) {
		return item.y;
	});
	for (let i = 1; i < yValues.length; i++) {
		assert.ok(yValues[i] >= yValues[i - 1], 'Y order broken at index ' + i);
	}
}
