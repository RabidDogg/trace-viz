/**
 * @fileoverview
 * Модуль чтения JSON-данных из системного буфера обмена.
 * Использует navigator.clipboard.readText() в secure context.
 *
 * @requires Clipboard API (navigator.clipboard.readText)
 * @requires Secure Context (https:// или http://localhost)
 *
 * @example
 * import { ClipboardReader } from './ClipboardReader.js';
 *
 * const reader = new ClipboardReader();
 * if (ClipboardReader.isSupported()) {
 *     try {
 *         const data = await reader.read();
 *         // data — распарсенный JSON-объект
 *     } catch (err) {
 *         console.error(err.message);
 *     }
 * }
 */

import { Logger } from '../utils/Logger.js';

/**
 * @class ClipboardReader
 * @description Чтение JSON-данных из системного буфера обмена.
 * Использует navigator.clipboard.readText() в secure context.
 */
export class ClipboardReader {
	/**
	 * Проверяет поддержку Clipboard API в текущем браузере.
	 * @returns {boolean} true, если API доступен
	 */
	static isSupported() {
		return !!navigator.clipboard?.readText;
	}

	/**
	 * Асинхронно читает и парсит JSON из буфера обмена.
	 * @returns {Promise<Object>} Распарсенный JSON-объект
	 * @throws {Error} С описанием проблемы:
	 *   - "Буфер обмена пуст"
	 *   - "Невалидный формат данных в буфере"
	 *   - "Формат данных не соответствует OpenSearch JSON"
	 *   - "Доступ к буферу обмена запрещён"
	 *   - "Clipboard API не поддерживается"
	 */
	async read() {
		if (!ClipboardReader.isSupported()) {
			Logger.error(
				'ClipboardReader',
				'Access denied or API not supported.',
			);
			throw new Error('Clipboard API не поддерживается');
		}

		Logger.info('ClipboardReader', 'Start reading from clipboard.');

		let text;
		try {
			text = await navigator.clipboard.readText();
		} catch (err) {
			Logger.error(
				'ClipboardReader',
				'Access denied or API not supported.',
			);
			throw new Error('Доступ к буферу обмена запрещён');
		}

		if (!text || text.trim().length === 0) {
			Logger.error('ClipboardReader', 'Clipboard is empty.');
			throw new Error('Буфер обмена пуст');
		}

		let parsed;
		try {
			parsed = JSON.parse(text);
		} catch (err) {
			Logger.error('DataLoader', 'Failed to parse JSON from clipboard.');
			throw new Error('Невалидный формат данных в буфере');
		}

		if (!ClipboardReader.validateStructure(parsed)) {
			Logger.error(
				'ClipboardReader',
				'Data structure does not match OpenSearch JSON format.',
			);
			throw new Error('Формат данных не соответствует OpenSearch JSON');
		}

		return parsed;
	}

	/**
	 * Валидирует структуру распарсенных данных.
	 * Проверяет, что data — объект, и в нём есть либо:
	 * - hits.hits — массив (структура Elasticsearch/OpenSearch)
	 * - Либо data — сам массив логов
	 *
	 * @param {*} data - Данные после JSON.parse()
	 * @returns {boolean} true, если структура валидна
	 */
	static validateStructure(data) {
		if (data === null || typeof data !== 'object') {
			return false;
		}

		// Случай 1: data — сам массив логов
		if (Array.isArray(data)) {
			return data.length > 0;
		}

		// Случай 2: структура Elasticsearch/OpenSearch с hits.hits
		if (
			typeof data.hits === 'object' &&
			data.hits !== null &&
			Array.isArray(data.hits.hits)
		) {
			return data.hits.hits.length > 0;
		}

		return false;
	}
}
