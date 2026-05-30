/**
 * @fileoverview
 * DataLoader — унифицированный слой загрузки данных.
 * Принимает сырой JSON-текст из любого источника (файл, буфер обмена),
 * парсит его, валидирует структуру и передаёт в OpenSourceExtractor для извлечения записей.
 *
 * Позволяет исключить дублирование логики парсинга между FileLoader и ClipboardReader.
 */

'use strict';

import { OpenSourceExtractor } from '../parser/OpenSourceExtractor.js';
import { ClipboardReader } from './ClipboardReader.js';
import { Logger } from '../utils/Logger.js';

/**
 * @class DataLoader
 * Унифицированный слой загрузки данных.
 *
 * @example
 * // Загрузка из буфера обмена
 * const reader = new ClipboardReader();
 * const rawText = await reader.read();
 * const result = await DataLoader.load(rawText, 'clipboard');
 * // → { records: [...], raw: {...} }
 *
 * @example
 * // Загрузка из файла (если есть сырой текст)
 * const rawText = await fileReader.readAsText(file);
 * const result = await DataLoader.load(rawText, 'file');
 * // → { records: [...], raw: {...} }
 */
export class DataLoader {
	/**
	 * Загружает и парсит JSON-строку.
	 *
	 * @param {string} rawText - Сырой JSON-текст
	 * @param {string} [source='unknown'] - Источник данных (file/clipboard)
	 * @returns {Promise<Object>} Результат: { records: Array, raw: Object }
	 * @throws {Error} При невалидном JSON или неверной структуре данных
	 */
	static async load(rawText, source = 'unknown') {
		Logger.info('DataLoader', `Loading data from source: ${source}`);

		// Парсинг JSON
		let parsed;
		try {
			parsed = JSON.parse(rawText);
		} catch (e) {
			Logger.error(
				'DataLoader',
				`Failed to parse JSON from ${source}: ${e.message}`,
			);
			throw new Error(`Невалидный JSON: ${e.message}`);
		}

		// Валидация структуры данных
		if (!ClipboardReader.validateStructure(parsed)) {
			Logger.error(
				'DataLoader',
				`Data structure from ${source} does not match OpenSearch JSON format.`,
			);
			throw new Error('Формат данных не соответствует OpenSearch JSON');
		}

		// Извлечение записей через OpenSourceExtractor
		const records = OpenSourceExtractor.extract(parsed);

		Logger.info(
			'DataLoader',
			`Extracted ${records.length} records from ${source}`,
		);

		return {
			records,
			raw: parsed,
		};
	}
}
