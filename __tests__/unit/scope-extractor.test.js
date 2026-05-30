/**
 * @fileoverview
 * Unit-тесты для ScopeExtractor.
 * 11 тест-кейсов: базовый парсинг, null/undefined/пустая строка,
 * пробелы, отсутствие известных ключей, trailing comma, множественные ключи.
 */

import assert from 'node:assert/strict';
import { ScopeExtractor } from '../../src/parser/ScopeExtractor.js';

export function testParsesBasicScopes() {
	const result = ScopeExtractor.extract('SpanId: abc123, TraceId: xyz789');
	assert.deepStrictEqual(result, { SpanId: 'abc123', TraceId: 'xyz789' });
}

export function testParsesWithParentId() {
	const result = ScopeExtractor.extract(
		'SpanId: abc, TraceId: def, ParentId: 123',
	);
	assert.deepStrictEqual(result, {
		SpanId: 'abc',
		TraceId: 'def',
		ParentId: '123',
	});
}

export function testReturnsNullForRandomText() {
	const result = ScopeExtractor.extract(
		'Some random text without known keys',
	);
	assert.strictEqual(result, null);
}

export function testReturnsNullForEmptyString() {
	assert.strictEqual(ScopeExtractor.extract(''), null);
}

export function testReturnsNullForNull() {
	assert.strictEqual(ScopeExtractor.extract(null), null);
}

export function testReturnsNullForUndefined() {
	assert.strictEqual(ScopeExtractor.extract(undefined), null);
}

export function testReturnsNullForWhitespace() {
	assert.strictEqual(ScopeExtractor.extract('   '), null);
}

export function testHandlesExtraSpaces() {
	const result = ScopeExtractor.extract('  SpanId  :  abc  ');
	assert.deepStrictEqual(result, { SpanId: 'abc' });
}

export function testHandlesMissingValueAfterColon() {
	const result = ScopeExtractor.extract('SpanId: , TraceId: xyz');
	assert.deepStrictEqual(result, { SpanId: '', TraceId: 'xyz' });
}

export function testHandlesMultipleKnownKeys() {
	const result = ScopeExtractor.extract(
		'SpanId: a, TraceId: b, ParentId: c, TraceIdOld: d, TraceIdentifier: e',
	);
	assert.deepStrictEqual(result, {
		SpanId: 'a',
		TraceId: 'b',
		ParentId: 'c',
		TraceIdOld: 'd',
		TraceIdentifier: 'e',
	});
}

export function testHandlesTrailingComma() {
	const result = ScopeExtractor.extract('SpanId: abc,');
	assert.deepStrictEqual(result, { SpanId: 'abc' });
}
