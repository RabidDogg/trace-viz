/**
 * @fileoverview
 * Точка входа приложения Trace Viz.
 * Инициализирует FileReader, Logger и связывает их с DOM-элементами.
 * Содержит заглушки для будущих этапов пайплайна: parse → process → render.
 */

'use strict';

import { Logger } from './utils/Logger.js';
import { FileReader } from './io/FileReader.js';

/**
 * Заглушка этапа парсинга.
 * @param {Object} data - сырые данные из FileReader
 * @returns {Object} распарсенные данные
 */
function parseData(data) {
	Logger.info('parseData: заглушка — данные получены, парсинг не реализован');
	return data;
}

/**
 * Заглушка этапа обработки.
 * @param {Object} parsedData
 * @returns {Object} обработанные данные
 */
function processData(parsedData) {
	Logger.info('processData: заглушка — обработка не реализована');
	return parsedData;
}

/**
 * Заглушка этапа рендеринга.
 * @param {Object} processedData
 */
function renderData(processedData) {
	Logger.info('renderData: заглушка — рендеринг не реализован');
}

/**
 * Обработчик успешной загрузки данных.
 * Запускает пайплайн: parse → process → render.
 * @param {Object} data
 */
function onDataLoaded(data) {
	Logger.info('Данные загружены, запуск пайплайна обработки');
	Logger.debug('Сырые данные:', data);

	try {
		const parsed = parseData(data);
		const processed = processData(parsed);
		renderData(processed);
		Logger.info('Пайплайн обработки завершён');
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		Logger.error(`Ошибка в пайплайне обработки: ${msg}`);
	}
}

/**
 * Обработчик ошибки загрузки.
 * @param {string} message
 */
function onError(message) {
	Logger.error(`Ошибка загрузки: ${message}`);
}

/**
 * Инициализация приложения.
 * Вызывается после загрузки DOM.
 */
function initApp() {
	Logger.info('Trace Viz инициализация...');

	const dropZone = document.getElementById('upload-zone');
	const fileInput = document.getElementById('file-input');
	const statusEl = document.getElementById('upload-status');
	const clearLogsBtn = document.getElementById('clear-logs');
	const logContainer = document.getElementById('log-container');

	if (!dropZone || !fileInput || !statusEl) {
		Logger.error(
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
			Logger.info('Журнал событий очищен');
		});
	}

	Logger.info('Trace Viz инициализирован успешно');
	Logger.info('Ожидание загрузки файла...');
}

// Запуск приложения после полной загрузки DOM
document.addEventListener('DOMContentLoaded', initApp);
