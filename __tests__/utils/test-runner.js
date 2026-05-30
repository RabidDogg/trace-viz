#!/usr/bin/env node

/**
 * @fileoverview
 * Кастомный test-runner с нулевыми зависимостями.
 *
 * Алгоритм:
 * 1. Принимает путь к директории из process.argv[2]
 * 2. Рекурсивный обход через fs.readdirSync, сбор *.test.js файлов
 * 3. Для каждого файла: динамический импорт через import(url) с file:// протоколом
 * 4. Сбор всех экспортированных функций, начинающихся с test или it
 * 5. Запуск каждой функции в try/catch, подсчёт результатов
 * 6. Цветной вывод
 * 7. process.exit(0) если все прошли, process.exit(1) если есть падения
 */

'use strict';

import fs from 'node:fs';
import path from 'node:path';

// Цвета для вывода
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

/**
 * Рекурсивно собирает все *.test.js файлы в директории.
 *
 * @param {string} dirPath - Путь к директории
 * @returns {string[]} Массив путей к тестовым файлам
 */
function collectTestFiles(dirPath) {
	/** @type {string[]} */
	const files = [];

	/** @type {string[]} */
	let entries;
	try {
		entries = fs.readdirSync(dirPath);
	} catch {
		return files;
	}

	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		const fullPath = path.join(dirPath, entry);
		let stat;
		try {
			stat = fs.statSync(fullPath);
		} catch {
			continue;
		}

		if (stat.isDirectory()) {
			const nested = collectTestFiles(fullPath);
			for (let j = 0; j < nested.length; j++) {
				files.push(nested[j]);
			}
		} else if (stat.isFile() && entry.endsWith('.test.js')) {
			files.push(fullPath);
		}
	}

	return files;
}

/**
 * Конвертирует Windows-путь в file:// URL для динамического импорта.
 *
 * @param {string} absolutePath - Абсолютный путь к файлу
 * @returns {string} URL для импорта
 */
function pathToFileUrl(absolutePath) {
	const normalized = absolutePath.replace(/\\/g, '/');
	return new URL('file:///' + normalized).href;
}

/**
 * Запускает один тестовый файл.
 *
 * @param {string} filePath - Путь к тестовому файлу
 * @returns {Promise<{ passed: number, failed: number, errors: Array<{ name: string, message: string }> }>}
 */
async function runTestFile(filePath) {
	const relativePath = path.relative(process.cwd(), filePath);
	const fileName = path.basename(filePath);

	console.log(
		`\n  ${YELLOW}${fileName}${RESET} ${DIM}(${relativePath})${RESET}`,
	);

	const fileUrl = pathToFileUrl(path.resolve(filePath));

	/** @type {Object} */
	let moduleExports;
	try {
		moduleExports = await import(fileUrl);
	} catch (err) {
		console.log(
			`    ${RED}LOAD ERROR${RESET} ${DIM}${err.message}${RESET}`,
		);
		return {
			passed: 0,
			failed: 1,
			errors: [{ name: 'LOAD ERROR', message: err.message }],
		};
	}

	// Собираем тестовые функции (начинаются с test или it)
	/** @type {Array<{ name: string, fn: Function }>} */
	const testFns = [];
	const exportNames = Object.keys(moduleExports);
	for (let i = 0; i < exportNames.length; i++) {
		const name = exportNames[i];
		if (
			typeof name === 'string' &&
			(name.startsWith('test') || name.startsWith('it')) &&
			typeof moduleExports[name] === 'function'
		) {
			testFns.push({ name: name, fn: moduleExports[name] });
		}
	}

	if (testFns.length === 0) {
		console.log(`    ${DIM}⚠ no tests found${RESET}`);
		return { passed: 0, failed: 0, errors: [] };
	}

	let passed = 0;
	/** @type {Array<{ name: string, message: string }>} */
	const errors = [];

	for (let i = 0; i < testFns.length; i++) {
		const { name, fn } = testFns[i];
		try {
			await fn();
			console.log(`    ${GREEN}PASS${RESET} ${name}`);
			passed++;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const stack = err instanceof Error ? err.stack : '';
			console.log(`    ${RED}FAIL${RESET} ${name}`);
			console.log(`          ${DIM}${message}${RESET}`);
			if (stack) {
				// Показываем только первую строку стека (полезную)
				const stackLines = stack.split('\n');
				for (let j = 1; j < Math.min(stackLines.length, 3); j++) {
					const line = stackLines[j].trim();
					if (line) {
						console.log(`          ${DIM}${line}${RESET}`);
					}
				}
			}
			errors.push({ name, message });
		}
	}

	return { passed, failed: errors.length, errors };
}

/**
 * Точка входа.
 */
async function main() {
	const testDir = process.argv[2];

	if (!testDir) {
		console.error(
			`${RED}Ошибка:${RESET} Укажите путь к директории с тестами`,
		);
		console.error(
			`  ${DIM}Пример: node __tests__/utils/test-runner.js __tests__/unit/${RESET}`,
		);
		process.exit(1);
	}

	const resolvedDir = path.resolve(testDir);

	if (!fs.existsSync(resolvedDir)) {
		console.error(
			`${RED}Ошибка:${RESET} Директория не найдена: ${testDir}`,
		);
		process.exit(1);
	}

	const testFiles = collectTestFiles(resolvedDir);

	if (testFiles.length === 0) {
		console.log(`${YELLOW}Тестовые файлы не найдены в:${RESET} ${testDir}`);
		process.exit(0);
	}

	console.log(
		`${CYAN}Test Runner${RESET} ${DIM}(${testFiles.length} файл(ов))${RESET}`,
	);
	console.log(`${DIM}${'─'.repeat(60)}${RESET}`);

	let totalPassed = 0;
	let totalFailed = 0;
	/** @type {Array<{ file: string, errors: Array<{ name: string, message: string }> }>} */
	const allErrors = [];

	for (let i = 0; i < testFiles.length; i++) {
		const result = await runTestFile(testFiles[i]);
		totalPassed += result.passed;
		totalFailed += result.failed;
		if (result.errors.length > 0) {
			allErrors.push({
				file: path.basename(testFiles[i]),
				errors: result.errors,
			});
		}
	}

	console.log(`\n${DIM}${'═'.repeat(60)}${RESET}`);

	if (totalFailed === 0) {
		console.log(
			`\n  ${GREEN}✓ Все тесты пройдены${RESET} ${DIM}(${totalPassed} passed)${RESET}\n`,
		);
		process.exit(0);
	} else {
		console.log(
			`\n  ${RED}✗ Упало тестов: ${totalFailed}${RESET} ${DIM}(${totalPassed} passed)${RESET}\n`,
		);

		// Выводим сводку по упавшим файлам
		for (let i = 0; i < allErrors.length; i++) {
			const { file, errors } = allErrors[i];
			console.log(`  ${RED}${file}${RESET} — ${errors.length} failed:`);
			for (let j = 0; j < errors.length; j++) {
				console.log(`    ${DIM}• ${errors[j].name}${RESET}`);
			}
		}
		console.log();

		process.exit(1);
	}
}

main();
