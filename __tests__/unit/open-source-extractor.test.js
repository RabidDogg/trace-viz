/**
 * @fileoverview
 * Unit-тесты для OpenSourceExtractor.
 * 7 тест-кейсов: hits-структура, плоский массив, null/не-объект,
 * пустые hits, фильтрация null-хитов, одиночный объект.
 */

import assert from 'node:assert/strict';
import { OpenSourceExtractor } from '../../src/parser/OpenSourceExtractor.js';

export function testExtractsFromHitsStructure() {
	const data = { hits: { hits: [{ _source: { a: 1 } }] } };
	const result = OpenSourceExtractor.extract(data);
	assert.deepStrictEqual(result, [{ a: 1 }]);
}

export function testExtractsFromFlatArray() {
	const data = [{ a: 1 }];
	const result = OpenSourceExtractor.extract(data);
	assert.deepStrictEqual(result, [{ a: 1 }]);
}

export function testReturnsEmptyForNull() {
	const result = OpenSourceExtractor.extract(null);
	assert.deepStrictEqual(result, []);
}

export function testReturnsEmptyForNonObject() {
	const result = OpenSourceExtractor.extract('string');
	assert.deepStrictEqual(result, []);
}

export function testHandlesEmptyHits() {
	const data = { hits: { hits: [] } };
	const result = OpenSourceExtractor.extract(data);
	assert.deepStrictEqual(result, []);
}

export function testFiltersNullHits() {
	const data = { hits: { hits: [null, { _source: { a: 1 } }] } };
	const result = OpenSourceExtractor.extract(data);
	assert.deepStrictEqual(result, [{ a: 1 }]);
}

export function testWrapsSingleObject() {
	const data = { TraceId: 'abc' };
	const result = OpenSourceExtractor.extract(data);
	assert.deepStrictEqual(result, [{ TraceId: 'abc' }]);
}
