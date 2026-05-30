/**
 * @fileoverview
 * Unit-тесты для DataNormalizer.
 * 14 тест-кейсов: базовая нормализация, fallback-поля, не-массив на входе,
 * null source, обрезка StageName до 200, детекция ошибок по LogLevel/Exception,
 * кастомный fieldMapping, сохранение raw-полей.
 */

import assert from 'node:assert/strict';
import { DataNormalizer } from '../../src/parser/DataNormalizer.js';
import { FIELD_MAPPING } from '../../src/config/field-mapping.js';

export function testNormalizesBasicRecord() {
	const normalizer = new DataNormalizer();
	const result = normalizer.normalize([
		{
			TraceId: 'abc123',
			SpanId: 'span1',
			ParentId: 'parent1',
			ElapsedMilliseconds: 150,
			timestamp: '2024-01-01T00:00:00.000Z',
			ActionName: 'TestAction',
		},
	]);

	assert.strictEqual(result.length, 1);
	assert.strictEqual(result[0].traceId, 'abc123');
	assert.strictEqual(result[0].spanId, 'span1');
	assert.strictEqual(result[0].parentId, 'parent1');
	assert.strictEqual(result[0].durationMs, 150);
	assert.strictEqual(result[0].stageName, 'TestAction');
	assert.strictEqual(result[0].isError, false);
}

export function testNormalizesWithFallbackFields() {
	const normalizer = new DataNormalizer();
	const result = normalizer.normalize([
		{
			TraceIdOld: 'old-trace',
			SpanId: 'span1',
		},
	]);

	assert.strictEqual(result.length, 1);
	assert.strictEqual(result[0].traceId, 'old-trace');
}

export function testReturnsEmptyArrayForNonArray() {
	const normalizer = new DataNormalizer();
	assert.deepStrictEqual(normalizer.normalize(null), []);
}

export function testReturnsEmptyArrayForObject() {
	const normalizer = new DataNormalizer();
	assert.deepStrictEqual(normalizer.normalize({}), []);
}

export function testHandlesNullSource() {
	const normalizer = new DataNormalizer();
	const result = normalizer.normalize([null]);

	assert.strictEqual(result.length, 1);
	assert.strictEqual(result[0].traceId, null);
	assert.strictEqual(result[0].spanId, null);
	assert.strictEqual(result[0].parentId, null);
	assert.strictEqual(result[0].durationMs, null);
	assert.strictEqual(result[0].timestampMs, null);
	assert.strictEqual(result[0].stageName, null);
	assert.strictEqual(result[0].isError, false);
}

export function testTruncatesStageNameTo200() {
	const normalizer = new DataNormalizer();
	const longName = 'A'.repeat(300);
	const result = normalizer.normalize([
		{
			ActionName: longName,
		},
	]);

	assert.strictEqual(result.length, 1);
	assert.strictEqual(result[0].stageName.length, 200);
}

export function testDetectsErrorByLogLevel() {
	const normalizer = new DataNormalizer();
	const result = normalizer.normalize([
		{
			LogLevel: 'error',
		},
	]);

	assert.strictEqual(result[0].isError, true);
}

export function testDetectsErrorByException() {
	const normalizer = new DataNormalizer();
	const result = normalizer.normalize([
		{
			Exception: 'Something went wrong',
		},
	]);

	assert.strictEqual(result[0].isError, true);
}

export function testIgnoresNonErrorLogLevels() {
	const normalizer = new DataNormalizer();
	const result = normalizer.normalize([
		{
			LogLevel: 'info',
		},
	]);

	assert.strictEqual(result[0].isError, false);
}

export function testParsesDurationThroughElapsedParser() {
	const normalizer = new DataNormalizer();
	const result = normalizer.normalize([
		{
			ElapsedMilliseconds: '1,000 ms',
		},
	]);

	assert.strictEqual(result[0].durationMs, 1000);
}

export function testParsesTimestamp() {
	const normalizer = new DataNormalizer();
	const result = normalizer.normalize([
		{
			timestamp: '2024-06-15T10:30:00.000Z',
		},
	]);

	assert.strictEqual(typeof result[0].timestampMs, 'number');
	assert.ok(Number.isFinite(result[0].timestampMs));
}

export function testHandlesMissingAllFields() {
	const normalizer = new DataNormalizer();
	const result = normalizer.normalize([{}]);

	assert.strictEqual(result.length, 1);
	assert.strictEqual(result[0].traceId, null);
	assert.strictEqual(result[0].spanId, null);
	assert.strictEqual(result[0].parentId, null);
	assert.strictEqual(result[0].durationMs, null);
	assert.strictEqual(result[0].timestampMs, null);
	assert.strictEqual(result[0].stageName, null);
	assert.strictEqual(result[0].isError, false);
}

export function testUsesCustomFieldMapping() {
	const customMapping = {
		traceId: ['MyTraceId'],
		spanId: ['MySpanId'],
		parentId: ['MyParentId'],
		duration: ['MyDuration'],
		timestamp: ['MyTimestamp'],
		stageName: ['MyStage'],
		errorFlag: ['MyLevel'],
	};

	const normalizer = new DataNormalizer(customMapping);
	const result = normalizer.normalize([
		{
			MyTraceId: 'custom-trace',
			MySpanId: 'custom-span',
			MyDuration: 200,
		},
	]);

	assert.strictEqual(result[0].traceId, 'custom-trace');
	assert.strictEqual(result[0].spanId, 'custom-span');
	assert.strictEqual(result[0].durationMs, 200);
}

export function testPreservesRawFields() {
	const normalizer = new DataNormalizer();
	const result = normalizer.normalize([
		{
			Message: 'test message',
			Exception: 'test exception',
			LogLevel: 'warn',
			Category: 'test-category',
			IntegrationName: 'test-integration',
			ActionName: 'test-action',
			SomeOtherField: 'should-not-be-in-raw',
		},
	]);

	assert.strictEqual(result[0].raw.Message, 'test message');
	assert.strictEqual(result[0].raw.Exception, 'test exception');
	assert.strictEqual(result[0].raw.LogLevel, 'warn');
	assert.strictEqual(result[0].raw.Category, 'test-category');
	assert.strictEqual(result[0].raw.IntegrationName, 'test-integration');
	assert.strictEqual(result[0].raw.ActionName, 'test-action');
	assert.strictEqual(result[0].raw.SomeOtherField, undefined);
}
