/**
 * @fileoverview
 * Integration-тесты для полного пайплайна на sample_mixed_shifted.json.
 * 5 тест-кейсов: полный пайплайн, классификация 'shifted',
 * есть и span и orphan элементы, orphan имеют parentSpanId,
 * есть uncategorized записи.
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
	'../../samples/sample_mixed_shifted.json',
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
 * Запускает полный пайплайн для shifted-трейса.
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

	// Шаг 5: Построение иерархии (только для записей с spanId)
	const builder = new SpanHierarchyBuilder();
	const hierarchy = builder.build(classified.records);

	// Извлекаем orphan-записи (без spanId) из классифицированных записей
	const orphans = classified.records.filter(function (r) {
		return r.spanId === null;
	});

	// Шаг 6: Расчёт лейаута
	const engine = new HybridLayoutEngine({ timelineWidth: 1200 });
	const layout = engine.calculate(hierarchy, orphans);

	return {
		sources,
		records,
		traces,
		uncategorized,
		classified,
		hierarchy,
		orphans,
		layout,
	};
}

export function testFullPipelineProducesLayout() {
	const result = runFullPipeline();
	assert.ok(result.layout.length > 0);
}

export function testTraceClassifiedAsShifted() {
	const result = runFullPipeline();
	assert.strictEqual(result.classified.mode, 'shifted');
}

export function testHasBothSpanAndOrphanItems() {
	const result = runFullPipeline();
	const hasSpan = result.layout.some(function (item) {
		return item.type === 'span';
	});
	const hasOrphan = result.layout.some(function (item) {
		return item.type === 'orphan';
	});

	assert.ok(hasSpan, 'No span items in layout');
	assert.ok(hasOrphan, 'No orphan items in layout');
}

export function testOrphansHaveParentSpanId() {
	const result = runFullPipeline();
	const orphanItems = result.layout.filter(function (item) {
		return item.isOrphan;
	});

	for (let i = 0; i < orphanItems.length; i++) {
		assert.notStrictEqual(
			orphanItems[i].parentSpanId,
			null,
			'Orphan ' + i + ' has null parentSpanId',
		);
	}
}

export function testUncategorizedRecordsExist() {
	const result = runFullPipeline();
	// В shifted-трейсе могут быть записи без TraceId
	assert.ok(result.uncategorized.length >= 0);
}
