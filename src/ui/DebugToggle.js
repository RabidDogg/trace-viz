/**
 * @fileoverview
 * Компонент переключателя режима отладки.
 * Управляет видимостью #log-table и синхронизирует состояние
 * с APP_DEBUG через setDebugEnabled() и localStorage.
 */

'use strict';

import { getDebugEnabled, setDebugEnabled } from '../config/app.js';

const STORAGE_KEY = 'trace-viz:debug-enabled';

class DebugToggle {
	/** @type {HTMLInputElement|null} */
	#input = null;

	/** @type {HTMLElement|null} */
	#logTable = null;

	constructor() {
		this.#input = document.getElementById('debug-toggle-input');
		this.#logTable = document.getElementById('log-table');

		if (!this.#input || !this.#logTable) {
			console.warn('[DebugToggle] Не найдены необходимые DOM-элементы');
			return;
		}

		this.#init();
	}

	/** Инициализация состояния и подписка на события */
	#init() {
		// Приоритет: localStorage > конфиг
		const saved = localStorage.getItem(STORAGE_KEY);
		const enabled = saved !== null ? saved === 'true' : getDebugEnabled();

		this.#applyState(enabled);

		// Обработчик change на чекбоксе
		this.#input.addEventListener('change', () => {
			const newValue = this.#input.checked;
			this.#applyState(newValue);
		});

		// Подписка на внешние изменения через setDebugEnabled()
		window.addEventListener('debug:changed', (e) => {
			const { enabled } = e.detail;
			if (this.#input.checked !== enabled) {
				this.#applyState(enabled);
			}
		});
	}

	/**
	 * Применяет состояние: обновляет input, log-table, localStorage, APP_DEBUG.
	 * @param {boolean} enabled
	 */
	#applyState(enabled) {
		this.#input.checked = enabled;
		this.#input.setAttribute('aria-checked', String(enabled));
		// Показываем/скрываем только тело таблицы с логами,
		// а хедер с переключателем и кнопкой "Очистить" остаётся видимым всегда
		const container = this.#logTable.querySelector('.log-table__container');
		if (container) {
			container.style.display = enabled ? '' : 'none';
		}
		setDebugEnabled(enabled);
		localStorage.setItem(STORAGE_KEY, String(enabled));
	}
}

export { DebugToggle };
