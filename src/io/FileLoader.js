/**
 * @fileoverview
 * Загрузчик файлов для Trace Viz.
 * Поддерживает Drag & Drop и выбор файла через <input type="file">.
 * Валидирует JSON и приводит плоский массив к структуре Elasticsearch-хита.
 *
 * ВНИМАНИЕ: класс назван FileLoader, а не FileLoader, чтобы избежать
 * конфликта с глобальным браузерным API FileReader.
 */

'use strict';

import { Logger } from '../utils/Logger.js';
import { DataLoader } from './DataLoader.js';

/**
 * @typedef {Object} FileLoaderCallbacks
 * @property {function(Object): void} onDataLoaded - Вызывается при успешной загрузке и валидации
 * @property {function(string): void} onError - Вызывается при ошибке загрузки или валидации
 */

/**
 * @class FileLoader
 * Управляет загрузкой JSON-файлов через Drag & Drop и file input.
 */
class FileLoader {
	/** @type {HTMLElement} */
	#dropZone;

	/** @type {HTMLInputElement} */
	#fileInput;

	/** @type {FileLoaderCallbacks} */
	#callbacks;

	/** @type {boolean} */
	#isDestroyed = false;

	/** @type {number} */
	#dragEnterCounter = 0;

	/**
	 * @param {HTMLElement} dropZone - DOM-элемент зоны Drag & Drop
	 * @param {HTMLInputElement} fileInput - DOM-элемент <input type="file">
	 * @param {FileLoaderCallbacks} callbacks - Колбэки onDataLoaded и onError
	 */
	constructor(dropZone, fileInput, callbacks) {
		this.#dropZone = dropZone;
		this.#fileInput = fileInput;
		this.#callbacks = callbacks;

		this.#bindEvents();
		Logger.info('FileLoader', 'FileLoader инициализирован');
	}

	/**
	 * Привязывает обработчики событий.
	 * @private
	 */
	#bindEvents() {
		// Drag & Drop на зоне загрузки
		this.#dropZone.addEventListener('dragenter', (e) =>
			this.#onDragEnter(e),
		);
		this.#dropZone.addEventListener('dragover', (e) => this.#onDragOver(e));
		this.#dropZone.addEventListener('dragleave', (e) =>
			this.#onDragLeave(e),
		);
		this.#dropZone.addEventListener('drop', (e) => this.#onDrop(e));

		// Выбор файла через input
		this.#fileInput.addEventListener('change', () => this.#onFileSelect());
	}

	/**
	 * Удаляет все обработчики и очищает ссылки.
	 */
	destroy() {
		if (this.#isDestroyed) return;

		// Клонируем и заменяем элементы, чтобы снять все слушатели
		const oldDropZone = this.#dropZone;
		const newDropZone = oldDropZone.cloneNode(true);
		oldDropZone.parentNode.replaceChild(newDropZone, oldDropZone);

		const oldInput = this.#fileInput;
		const newInput = oldInput.cloneNode(true);
		oldInput.parentNode.replaceChild(newInput, oldInput);

		this.#dropZone = null;
		this.#fileInput = null;
		this.#callbacks = null;
		this.#isDestroyed = true;

		Logger.debug('FileLoader', 'FileLoader уничтожен');
	}

	/**
	 * Обработчик dragenter — добавляет визуальный класс.
	 * Использует счётчик для корректной обработки вложенных элементов.
	 * @param {DragEvent} e
	 * @private
	 */
	#onDragEnter(e) {
		e.preventDefault();
		e.stopPropagation();
		this.#dragEnterCounter++;
		this.#dropZone.classList.add('upload-zone--dragover');
	}

	/**
	 * Обработчик dragover — добавляет визуальный класс.
	 * @param {DragEvent} e
	 * @private
	 */
	#onDragOver(e) {
		e.preventDefault();
		e.stopPropagation();
		e.dataTransfer.dropEffect = 'copy';
		this.#dropZone.classList.add('upload-zone--dragover');
	}

	/**
	 * Обработчик dragleave — убирает визуальный класс.
	 * Использует счётчик для предотвращения мерцания при наведении на дочерние элементы.
	 * @param {DragEvent} e
	 * @private
	 */
	#onDragLeave(e) {
		e.preventDefault();
		e.stopPropagation();
		this.#dragEnterCounter--;
		if (this.#dragEnterCounter <= 0) {
			this.#dragEnterCounter = 0;
			this.#dropZone.classList.remove('upload-zone--dragover');
		}
	}

	/**
	 * Обработчик drop — читает перетащенный файл.
	 * @param {DragEvent} e
	 * @private
	 */
	#onDrop(e) {
		e.preventDefault();
		e.stopPropagation();
		this.#dragEnterCounter = 0;
		this.#dropZone.classList.remove('upload-zone--dragover');

		const files = e.dataTransfer.files;
		if (files.length === 0) return;

		this.#processFile(files[0]);
	}

	/**
	 * Обработчик выбора файла через input.
	 * @private
	 */
	#onFileSelect() {
		const files = this.#fileInput.files;
		if (!files || files.length === 0) return;

		this.#processFile(files[0]);
	}

	/**
	 * Читает файл через FileReader API и валидирует JSON.
	 * @param {File} file
	 * @private
	 */
	#processFile(file) {
		if (!file.name.endsWith('.json')) {
			const msg = 'Пожалуйста, выберите файл с расширением .json';
			this.#showError(msg);
			this.#callbacks.onError(msg);
			return;
		}

		Logger.info(
			'FileLoader',
			`Загрузка файла: ${file.name} (${Logger.time('readFile', () => file.size)} байт)`,
		);

		DataLoader.setStatus('Чтение файла...');

		// Используем window.FileReader (браузерный API), а не наш класс FileLoader
		const reader = new window.FileReader();

		reader.onload = () => {
			try {
				const rawText = /** @type {string} */ (reader.result);
				const data = this.#parseAndValidate(rawText, file.name);
				DataLoader.setStatus(
					`Файл "${file.name}" загружен успешно`,
					'success',
				);
				this.#callbacks.onDataLoaded(data);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				this.#showError(msg);
				this.#callbacks.onError(msg);
			}
		};

		reader.onerror = () => {
			const msg = `Ошибка чтения файла "${file.name}"`;
			this.#showError(msg);
			this.#callbacks.onError(msg);
		};

		reader.readAsText(file);
	}

	/**
	 * Парсит JSON и приводит к единой структуре.
	 * @param {string} rawText
	 * @param {string} fileName
	 * @returns {Object}
	 * @throws {Error}
	 * @private
	 */
	#parseAndValidate(rawText, fileName) {
		let parsed;

		try {
			parsed = JSON.parse(rawText);
		} catch (e) {
			const position =
				e instanceof SyntaxError && e.message.match(/position\s+(\d+)/);
			const posStr = position ? ` (позиция ${position[1]})` : '';
			throw new Error(
				`Ошибка парсинга JSON в файле "${fileName}": ${e.message}${posStr}`,
			);
		}

		// Если загружен плоский массив — оборачиваем в структуру hits
		if (Array.isArray(parsed)) {
			Logger.info(
				'FileLoader',
				`Обнаружен плоский массив (${parsed.length} записей). Оборачиваю в структуру hits.`,
			);
			return {
				hits: {
					hits: parsed.map((item) => ({
						_source: item,
					})),
				},
			};
		}

		// Если уже структура с hits.hits — используем как есть
		if (
			parsed &&
			typeof parsed === 'object' &&
			parsed.hits &&
			Array.isArray(parsed.hits.hits)
		) {
			Logger.info(
				'FileLoader',
				`Загружена структура hits (${parsed.hits.hits.length} записей).`,
			);
			return parsed;
		}

		// Если объект, но не массив и не hits — оборачиваем как единственный _source
		if (parsed && typeof parsed === 'object') {
			Logger.info(
				'FileLoader',
				'Загружен одиночный объект. Оборачиваю в структуру hits.',
			);
			return {
				hits: {
					hits: [{ _source: parsed }],
				},
			};
		}

		throw new Error(
			`Неподдерживаемый формат данных в файле "${fileName}". Ожидался JSON-массив или объект.`,
		);
	}

	/**
	 * Показывает сообщение об ошибке и модальное окно.
	 * @param {string} message
	 * @private
	 */
	#showError(message) {
		Logger.error('FileLoader', message);
		this.#showModal(message);
	}

	/**
	 * Показывает модальное окно с сообщением об ошибке.
	 * После закрытия — recovery в состояние "Загрузка файла".
	 * @param {string} message
	 * @private
	 */
	#showModal(message) {
		const overlay = document.createElement('div');
		overlay.className = 'modal-overlay';

		const modal = document.createElement('div');
		modal.className = 'modal';

		const title = document.createElement('h3');
		title.className = 'modal__title';
		title.textContent = 'Ошибка загрузки';

		const msgEl = document.createElement('p');
		msgEl.className = 'modal__message';
		msgEl.textContent = message;

		const btn = document.createElement('button');
		btn.className = 'modal__button';
		btn.textContent = 'Закрыть';

		btn.addEventListener('click', () => {
			document.body.removeChild(overlay);
			this.#recover();
		});

		modal.appendChild(title);
		modal.appendChild(msgEl);
		modal.appendChild(btn);
		overlay.appendChild(modal);
		document.body.appendChild(overlay);
	}

	/**
	 * Recovery: сбрасывает статус и file input в исходное состояние.
	 * @private
	 */
	#recover() {
		DataLoader.setStatus('');
		this.#fileInput.value = '';
		Logger.info(
			'FileLoader',
			'FileLoader восстановлен в состояние ожидания файла',
		);
	}
}

export { FileLoader };
