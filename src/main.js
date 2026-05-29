/**
 * @fileoverview
 * Точка входа приложения Trace Viz.
 * Инициализирует FileReader, Logger и связывает их с DOM-элементами.
 * Реализует пайплайн: parse → process → render.
 */

'use strict';

import { Logger } from './utils/Logger.js';
import { FileReader } from './io/FileReader.js';
import { extractSources } from './parser/OpenSourceExtractor.js';
import { normalizeRecords } from './parser/DataNormalizer.js';
import { groupByTraceId } from './processor/TraceGrouper.js';
import { classifyTrace } from './processor/TraceClassifier.js';
import { RawLogViewer } from './ui/RawLogViewer.js';

/**
 * Этап парсинга: извлекает источники из структуры данных и нормализует их.
 * @param {Object} data - сырые данные из FileReader
 * @returns {Object} распарсенные данные с полями sources (нормализованные записи) и raw (исходные)
 */
function parseData(data) {
	Logger.info('Main', 'parseData: запуск пайплайна парсинга');

	const sources = extractSources(data);
	Logger.info('Main', `parseData: извлечено ${sources.length} источников`);

	const normalized = normalizeRecords(sources);
	Logger.info(
		'Main',
		`parseData: нормализовано ${normalized.length} записей`,
	);

	// Сохраняем в window.__APP_DATA__ для отладки
	if (typeof window !== 'undefined') {
		window.__APP_DATA__ = {
			raw: data,
			sources: sources,
			normalized: normalized,
		};
	}

	// Логируем ошибки парсинга
	let errorCount = 0;
	for (let i = 0; i < normalized.length; i++) {
		if (normalized[i].isError) {
			errorCount++;
		}
	}
	if (errorCount > 0) {
		Logger.warn(
			'Main',
			`parseData: обнаружено ${errorCount} записей с ошибками`,
		);
	}

	return {
		normalized: normalized,
		raw: data,
	};
}

/**
 * Этап обработки: группировка по TraceId и классификация трейсов.
 *
 * @param {Object} parsedData - Данные после этапа парсинга
 * @param {NormalizedRecord[]} parsedData.normalized - Нормализованные записи
 * @param {Object} parsedData.raw - Сырые данные
 * @returns {Object} Обработанные данные с полями:
 *   - classifiedTraces: ClassifiedTrace[]
 *   - uncategorized: NormalizedRecord[]
 *   - raw: Object
 */
function processData(parsedData) {
	Logger.info('Main', 'processData: запуск группировки и классификации');

	const normalized = parsedData.normalized;

	if (!Array.isArray(normalized) || normalized.length === 0) {
		Logger.warn('Main', 'processData: нет записей для обработки');
		return {
			classifiedTraces: [],
			uncategorized: [],
			raw: parsedData.raw,
		};
	}

	// 1. Группировка по TraceId
	const { traces, uncategorized } = groupByTraceId(normalized);
	Logger.info(
		'Main',
		'processData: сгруппировано ' +
			String(traces.size) +
			' трейсов, ' +
			String(uncategorized.length) +
			' некатегоризированных записей',
	);

	// 2. Классификация каждого трейса
	/** @type {import('./processor/TraceClassifier.js').ClassifiedTrace[]} */
	const classifiedTraces = [];

	traces.forEach(function (records, traceId) {
		const classified = classifyTrace(traceId, records);
		classifiedTraces.push(classified);
		Logger.debug(
			'Main',
			'processData: трейс ' +
				traceId +
				' классифицирован как ' +
				classified.mode,
		);
	});

	// 3. Сохраняем в window.__APP_DATA__
	if (typeof window !== 'undefined') {
		window.__APP_DATA__ = {
			raw: parsedData.raw,
			normalized: normalized,
			classifiedTraces: classifiedTraces,
			uncategorized: uncategorized,
		};
	}

	Logger.info(
		'Main',
		'processData: классифицировано ' +
			String(classifiedTraces.length) +
			' трейсов',
	);

	return {
		classifiedTraces: classifiedTraces,
		uncategorized: uncategorized,
		raw: parsedData.raw,
	};
}

/**
 * Этап рендеринга: отображает некатегоризированные записи в RawLogViewer.
 *
 * @param {Object} processedData - Данные после этапа обработки
 * @param {import('./processor/TraceClassifier.js').ClassifiedTrace[]} processedData.classifiedTraces
 * @param {NormalizedRecord[]} processedData.uncategorized
 */
function renderData(processedData) {
	Logger.info('Main', 'renderData: запуск рендеринга');

	// Инициализация RawLogViewer для UNCATEGORIZED записей
	const rawLogContainer = document.getElementById('raw-log-container');
	if (rawLogContainer) {
		RawLogViewer(processedData.uncategorized, rawLogContainer);
		Logger.info(
			'Main',
			'renderData: RawLogViewer отображает ' +
				String(processedData.uncategorized.length) +
				' некатегоризированных записей',
		);
	} else {
		Logger.warn(
			'Main',
			'renderData: элемент #raw-log-container не найден в DOM',
		);
	}
}

/**
 * Обработчик успешной загрузки данных.
 * Запускает пайплайн: parse → process → render.
 * @param {Object} data
 */
function onDataLoaded(data) {
	Logger.info('Main', 'Данные загружены, запуск пайплайна обработки');
	Logger.debug('Main', 'Сырые данные:', data);

	try {
		const parsed = parseData(data);
		const processed = processData(parsed);
		renderData(processed);
		Logger.info('Main', 'Пайплайн обработки завершён');
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		Logger.error('Main', `Ошибка в пайплайне обработки: ${msg}`);
	}
}

/**
 * Обработчик ошибки загрузки.
 * @param {string} message
 */
function onError(message) {
	Logger.error('Main', `Ошибка загрузки: ${message}`);
}

/**
 * Инициализация приложения.
 * Вызывается после загрузки DOM.
 */
function initApp() {
	Logger.info('Main', 'Trace Viz инициализация...');

	const dropZone = document.getElementById('upload-zone');
	const fileInput = document.getElementById('file-input');
	const statusEl = document.getElementById('upload-status');
	const clearLogsBtn = document.getElementById('clear-logs');
	const logContainer = document.getElementById('log-container');

	if (!dropZone || !fileInput || !statusEl) {
		Logger.error(
			'Main',
			'Критические DOM-элементы не найдены. Инициализация прервана.',
		);
		return;
	}

	// Инициализация глобальных обработчиков ошибок
	Logger.initGlobalHandlers();

	// Инициализация FileReader
	const fileReader = new FileReader(dropZone, fileInput, statusEl, {
		onDataLoaded,
		onError,
	});

	// Очистка логов
	if (clearLogsBtn && logContainer) {
		clearLogsBtn.addEventListener('click', () => {
			while (logContainer.firstChild) {
				logContainer.removeChild(logContainer.firstChild);
			}
			const placeholder = document.createElement('p');
			placeholder.className = 'log-table__placeholder';
			placeholder.textContent = 'Логи будут отображаться здесь';
			logContainer.appendChild(placeholder);
			Logger.info('Main', 'Журнал событий очищен');
		});
	}

	Logger.info('Main', 'Trace Viz инициализирован успешно');
	Logger.info('Main', 'Ожидание загрузки файла...');
}

// Запуск приложения после полной загрузки DOM
document.addEventListener('DOMContentLoaded', initApp);
