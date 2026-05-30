/**
 * @fileoverview
 * Unit-тесты для ElapsedParser.
 * 16 тест-кейсов: число, строка с единицей, TimeSpan (чч:мм:сс.ммм и мм:сс.ммм),
 * null/undefined/NaN/Infinity, пустая строка, отрицательные числа, разделители тысяч.
 */

import assert from 'node:assert/strict';
import { ElapsedParser } from '../../src/parser/ElapsedParser.js';

export function testParsesNumber() {
	assert.strictEqual(ElapsedParser.parse(150.5), 150.5);
}

export function testParsesInteger() {
	assert.strictEqual(ElapsedParser.parse(42), 42);
}

export function testParsesZero() {
	assert.strictEqual(ElapsedParser.parse(0), 0);
}

export function testParsesStringWithMs() {
	assert.strictEqual(ElapsedParser.parse('1,200 ms'), 1200);
}

export function testParsesStringWithoutUnit() {
	assert.strictEqual(ElapsedParser.parse('1234'), 1234);
}

export function testParsesTimeSpanHms() {
	assert.strictEqual(ElapsedParser.parse('00:00:00.050'), 50);
}

export function testParsesTimeSpanHmsLong() {
	assert.strictEqual(ElapsedParser.parse('00:01:30.500'), 90500);
}

export function testParsesTimeSpanShort() {
	assert.strictEqual(ElapsedParser.parse('05:30.250'), 330250);
}

export function testReturnsNullForNull() {
	assert.strictEqual(ElapsedParser.parse(null), null);
}

export function testReturnsNullForUndefined() {
	assert.strictEqual(ElapsedParser.parse(undefined), null);
}

export function testReturnsNullForNaN() {
	assert.strictEqual(ElapsedParser.parse(NaN), null);
}

export function testReturnsNullForInfinity() {
	assert.strictEqual(ElapsedParser.parse(Infinity), null);
}

export function testReturnsNullForEmptyString() {
	assert.strictEqual(ElapsedParser.parse(''), null);
}

export function testReturnsNullForNonNumericString() {
	assert.strictEqual(ElapsedParser.parse('abc'), null);
}

export function testParsesStringWithCommas() {
	assert.strictEqual(ElapsedParser.parse('1,234,567 ms'), 1234567);
}

export function testParsesNegativeNumber() {
	assert.strictEqual(ElapsedParser.parse(-100), -100);
}
