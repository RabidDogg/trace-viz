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
import { DataLoader } from './DataLoader.js';

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
	 * Асинхронно читает сырой текст из буфера обмена.
	 * Парсинг JSON и валидация структуры выполняются в DataLoader.
	 * @returns {Promise<string>} Сырой JSON-текст из буфера обмена
	 * @throws {Error} С описанием проблемы:
	 *   - "Буфер обмена пуст"
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

		DataLoader.setStatus('Чтение из буфера обмена...');
		Logger.info('ClipboardReader', 'Start reading from clipboard.');

		let text;
		try {
			text = await navigator.clipboard.readText();
		} catch (err) {
			DataLoader.setStatus(
				'Ошибка: доступ к буферу обмена запрещён',
				'error',
			);
			Logger.error(
				'ClipboardReader',
				'Access denied or API not supported.',
			);
			throw new Error('Доступ к буферу обмена запрещён');
		}

		if (!text || text.trim().length === 0) {
			DataLoader.setStatus('Ошибка: буфер обмена пуст', 'error');
			Logger.error('ClipboardReader', 'Clipboard is empty.');
			throw new Error('Буфер обмена пуст');
		}

		DataLoader.setStatus('Данные из буфера обмена получены');
		return text;
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
