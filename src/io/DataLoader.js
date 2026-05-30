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
	/** @type {HTMLElement|null} */
	static #statusEl = null;

	/**
	 * Регистрирует DOM-элемент для отображения статуса загрузки.
	 * @param {HTMLElement} element - Элемент #upload-status
	 */
	static setStatusElement(element) {
		DataLoader.#statusEl = element;
	}

	/**
	 * Устанавливает текст и CSS-класс статуса.
	 * @param {string} text - Текст статуса
	 * @param {string} [type] - Тип статуса (success/error/info)
	 * @private
	 */
	static #setStatus(text, type) {
		if (!DataLoader.#statusEl) return;
		DataLoader.#statusEl.textContent = text;
		DataLoader.#statusEl.className = 'upload-zone__status';
		if (type) {
			DataLoader.#statusEl.classList.add(`upload-zone__status--${type}`);
		}
	}

	/**
	 * Публичный доступ к setStatus для внешних вызовов (FileLoader, ClipboardReader).
	 * @param {string} text - Текст статуса
	 * @param {string} [type] - Тип статуса (success/error/info)
	 */
	static setStatus(text, type) {
		DataLoader.#setStatus(text, type);
	}

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
		DataLoader.#setStatus('Парсинг JSON...');
		let parsed;
		try {
			parsed = JSON.parse(rawText);
		} catch (e) {
			DataLoader.#setStatus(
				`Ошибка: невалидный JSON — ${e.message}`,
				'error',
			);
			Logger.error(
				'DataLoader',
				`Failed to parse JSON from ${source}: ${e.message}`,
			);
			throw new Error(`Невалидный JSON: ${e.message}`);
		}

		// Валидация структуры данных
		DataLoader.#setStatus('Валидация структуры...');
		if (!ClipboardReader.validateStructure(parsed)) {
			DataLoader.#setStatus(
				'Ошибка: формат данных не соответствует OpenSearch JSON',
				'error',
			);
			Logger.error(
				'DataLoader',
				`Data structure from ${source} does not match OpenSearch JSON format.`,
			);
			throw new Error('Формат данных не соответствует OpenSearch JSON');
		}

		// Извлечение записей через OpenSourceExtractor
		DataLoader.#setStatus('Извлечение записей...');
		const records = OpenSourceExtractor.extract(parsed);

		DataLoader.#setStatus(
			`Загрузка завершена (${records.length} записей)`,
			'success',
		);

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
