#!/usr/bin/env node

/**
 * @fileoverview
 * Perf-скрипт для замера времени и памяти ключевых операций.
 *
 * Замеряет:
 * - Парсинг 10000 значений ElapsedParser (< 50ms)
 * - Нормализация 1000 записей (< 100ms)
 * - Построение иерархии для 1000 спанов (< 100ms)
 * - Расчёт лейаута для 1000 элементов (< 100ms)
 * - Память < 50MB
 */

'use strict';

import { ElapsedParser } from '../../src/parser/ElapsedParser.js';
import { DataNormalizer } from '../../src/parser/DataNormalizer.js';
import { SpanHierarchyBuilder } from '../../src/processor/SpanHierarchyBuilder.js';
import { HybridLayoutEngine } from '../../src/processor/HybridLayoutEngine.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

/**
 * @typedef {Object} PerfResult
 * @property {string} name
 * @property {number} durationMs
 * @property {number} limitMs
 * @property {boolean} passed
 */

/**
 * Замеряет время выполнения функции.
 *
 * @param {string} name - Название замера
 * @param {Function} fn - Функция для замера
 * @param {number} limitMs - Лимит времени в миллисекундах
 * @returns {PerfResult}
 */
function measure(name, fn, limitMs) {
	const start = process.hrtime.bigint();
	fn();
	const end = process.hrtime.bigint();
	const durationMs = Number(end - start) / 1e6;

	return {
		name: name,
		durationMs: durationMs,
		limitMs: limitMs,
		passed: durationMs < limitMs,
	};
}

/**
 * Генерирует массив тестовых данных для ElapsedParser.
 *
 * @param {number} count - Количество значений
 * @returns {Array<number|string>}
 */
function generateElapsedValues(count) {
	const values = [];
	for (let i = 0; i < count; i++) {
		const mod = i % 5;
		if (mod === 0) values.push(i * 1.5);
		else if (mod === 1) values.push(String(i * 10) + ' ms');
		else if (mod === 2)
			values.push('00:00:00.' + String(i % 1000).padStart(3, '0'));
		else if (mod === 3) values.push(null);
		else values.push('abc');
	}
	return values;
}

/**
 * Генерирует массив тестовых записей для нормализации.
 *
 * @param {number} count - Количество записей
 * @returns {Object[]}
 */
function generateNormalizeRecords(count) {
	const records = [];
	for (let i = 0; i < count; i++) {
		records.push({
			TraceId: 'trace-' + i,
			SpanId: 'span-' + i,
			ParentId: i > 0 ? 'span-' + (i - 1) : null,
			ElapsedMilliseconds: i * 10,
			timestamp: '2026-05-30T10:00:00.000Z',
			ActionName: 'Action.' + i,
			LogLevel: i % 10 === 0 ? 'error' : 'info',
		});
	}
	return records;
}

/**
 * Генерирует массив записей для иерархии (линейная цепочка).
 *
 * @param {number} count - Количество спанов
 * @returns {Object[]}
 */
function generateHierarchyRecords(count) {
	const records = [];
	for (let i = 0; i < count; i++) {
		records.push({
			traceId: 'perf-trace',
			spanId: 'span-' + i,
			parentId: i > 0 ? 'span-' + (i - 1) : null,
			durationMs: 10,
			timestampMs: 1000 + i * 10,
			stageName: 'Step.' + i,
			isError: false,
			raw: {},
		});
	}
	return records;
}

async function main() {
	console.log(`\n  ${CYAN}Performance Check${RESET}\n`);

	/** @type {PerfResult[]} */
	const results = [];

	// 1. ElapsedParser — 10000 значений
	const elapsedValues = generateElapsedValues(10000);
	results.push(
		measure(
			'ElapsedParser.parse (10000 values)',
			function () {
				for (let i = 0; i < elapsedValues.length; i++) {
					ElapsedParser.parse(elapsedValues[i]);
				}
			},
			50,
		),
	);

	// 2. DataNormalizer — 1000 записей
	const normalizeRecords = generateNormalizeRecords(1000);
	const normalizer = new DataNormalizer();
	results.push(
		measure(
			'DataNormalizer.normalize (1000 records)',
			function () {
				normalizer.normalize(normalizeRecords);
			},
			100,
		),
	);

	// 3. SpanHierarchyBuilder — 1000 спанов
	const hierarchyRecords = generateHierarchyRecords(1000);
	const builder = new SpanHierarchyBuilder();
	results.push(
		measure(
			'SpanHierarchyBuilder.build (1000 spans)',
			function () {
				builder.build(hierarchyRecords);
			},
			100,
		),
	);

	// 4. HybridLayoutEngine — 1000 элементов
	const engine = new HybridLayoutEngine({ timelineWidth: 1200 });
	const hierarchy = builder.build(hierarchyRecords);
	results.push(
		measure(
			'HybridLayoutEngine.calculate (1000 items)',
			function () {
				engine.calculate(hierarchy, []);
			},
			100,
		),
	);

	// Вывод результатов
	let allPassed = true;
	for (let i = 0; i < results.length; i++) {
		const r = results[i];
		const status = r.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
		const timeStr = r.durationMs.toFixed(2) + 'ms';
		const limitStr = `(limit: ${r.limitMs}ms)`;

		console.log(`  ${status} ${r.name}`);
		console.log(`      ${DIM}${timeStr} ${limitStr}${RESET}`);

		if (!r.passed) {
			allPassed = false;
		}
	}

	// Замер памяти
	const memUsage = process.memoryUsage();
	const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
	const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
	const memLimitMB = 50;
	const memPassed = heapUsedMB < memLimitMB;
	const memStatus = memPassed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;

	console.log(
		`\n  ${memStatus} Memory: ${DIM}${heapUsedMB.toFixed(2)}MB used / ${heapTotalMB.toFixed(2)}MB total (limit: ${memLimitMB}MB)${RESET}`,
	);

	if (!memPassed) {
		allPassed = false;
	}

	console.log();
	if (allPassed) {
		console.log(`  ${GREEN}✓ All performance checks passed${RESET}\n`);
		process.exit(0);
	} else {
		console.log(`  ${RED}✗ Some performance checks failed${RESET}\n`);
		process.exit(1);
	}
}

main();
