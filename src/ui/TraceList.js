/**
 * @fileoverview
 * TraceListView — компонент для отображения списка загруженных трейсов
 * с возможностью поиска и переключения между ними.
 *
 * Каждый трейс отображается с:
 * - TraceId
 * - Режимом (Full/Flat/Shifted) с цветовой индикацией
 * - Количеством записей
 *
 * Запрет innerHTML — используются только createElement, textContent, appendChild.
 * Zero dependencies.
 */

'use strict';

/**
 * CSS-классы для элементов списка трейсов.
 * @enum {string}
 * @private
 */
const CSS = {
	CONTAINER: 'trace-list',
	SEARCH_INPUT: 'trace-list__search',
	LIST: 'trace-list__items',
	ITEM: 'trace-list__item',
	ITEM_ACTIVE: 'trace-list__item--active',
	ITEM_ID: 'trace-list__item-id',
	ITEM_MODE: 'trace-list__item-mode',
	ITEM_COUNT: 'trace-list__item-count',
	MODE_FULL: 'trace-list__mode--full',
	MODE_FLAT: 'trace-list__mode--flat',
	MODE_SHIFTED: 'trace-list__mode--shifted',
	EMPTY: 'trace-list__empty',
};

/**
 * Текстовые метки для режимов.
 * @enum {string}
 * @private
 */
const MODE_LABELS = {
	full: 'Full',
	flat: 'Flat',
	shifted: 'Shifted',
};

/**
 * @class TraceListView
 * Отображает список загруженных трейсов с возможностью поиска и переключения.
 *
 * @param {string} containerId - ID DOM-элемента, в который будет вставлен список
 * @param {Function} onTraceSelect - Колбэк при выборе трейса (принимает traceId)
 *
 * @example
 * var traceList = new TraceListView('trace-list-container', function(traceId) {
 *     console.log('Выбран трейс:', traceId);
 * });
 * traceList.render(traces);
 */
class TraceListView {
	/**
	 * @param {string} containerId - ID DOM-элемента, в который будет вставлен список
	 * @param {Function} onTraceSelect - Колбэк при выборе трейса (принимает traceId)
	 */
	constructor(containerId, onTraceSelect) {
		/**
		 * ID контейнера.
		 * @type {string}
		 * @private
		 */
		this._containerId = containerId;

		/**
		 * Колбэк при выборе трейса.
		 * @type {Function}
		 * @private
		 */
		this._onTraceSelect =
			typeof onTraceSelect === 'function'
				? onTraceSelect
				: function () {};

		/**
		 * Текущий массив трейсов.
		 * @type {Array}
		 * @private
		 */
		this._traces = [];

		/**
		 * ID активного (выбранного) трейса.
		 * @type {string|null}
		 * @private
		 */
		this._activeTraceId = null;

		/**
		 * Текущий поисковый запрос.
		 * @type {string}
		 * @private
		 */
		this._query = '';

		/**
		 * Ссылка на корневой элемент списка.
		 * @type {HTMLElement|null}
		 * @private
		 */
		this._element = null;

		/**
		 * Ссылка на поле поиска.
		 * @type {HTMLInputElement|null}
		 * @private
		 */
		this._searchInput = null;

		/**
		 * Ссылка на контейнер элементов списка.
		 * @type {HTMLElement|null}
		 * @private
		 */
		this._listEl = null;

		// Инициализация DOM-структуры
		this._init();
	}

	/**
	 * Создаёт DOM-структуру компонента.
	 *
	 * @private
	 */
	_init() {
		const container = document.getElementById(this._containerId);
		if (!container) {
			return;
		}

		// Корневой элемент
		const root = document.createElement('div');
		root.className = CSS.CONTAINER;

		// Поле поиска
		const search = document.createElement('input');
		search.className = CSS.SEARCH_INPUT;
		search.setAttribute('type', 'text');
		search.setAttribute(
			'placeholder',
			'\u041F\u043E\u0438\u0441\u043A \u043F\u043E TraceId...',
		);
		search.setAttribute(
			'aria-label',
			'\u041F\u043E\u0438\u0441\u043A \u0442\u0440\u0435\u0439\u0441\u043E\u0432',
		);

		// Обработчик ввода для фильтрации
		search.addEventListener('input', () => {
			this.filter(search.value);
		});

		root.appendChild(search);
		this._searchInput = search;

		// Контейнер для элементов списка
		const list = document.createElement('div');
		list.className = CSS.LIST;
		root.appendChild(list);
		this._listEl = list;

		container.appendChild(root);
		this._element = root;
	}

	/**
	 * Отрисовывает список трейсов.
	 *
	 * @param {Array} traces - Массив объектов трейсов.
	 *   Каждый объект должен содержать:
	 *     - traceId {string} - Идентификатор трейса
	 *     - mode {string} - Режим ('full' | 'flat' | 'shifted')
	 *     - recordCount {number} - Количество записей
	 */
	render(traces) {
		this._traces = Array.isArray(traces) ? traces : [];
		this._renderList();
	}

	/**
	 * Отрисовывает элементы списка с учётом текущего фильтра.
	 *
	 * @private
	 */
	_renderList() {
		if (!this._listEl) {
			return;
		}

		// Очищаем список
		this._listEl.textContent = '';

		// Фильтруем трейсы по поисковому запросу
		const filtered = this._filterTraces(this._traces, this._query);

		if (filtered.length === 0) {
			// Показываем сообщение "Трейсы не найдены"
			const emptyEl = document.createElement('div');
			emptyEl.className = CSS.EMPTY;
			emptyEl.textContent =
				'\u0422\u0440\u0435\u0439\u0441\u044B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B';
			this._listEl.appendChild(emptyEl);
			return;
		}

		// Создаём элементы для каждого трейса
		for (let i = 0; i < filtered.length; i++) {
			const trace = filtered[i];
			const item = this._createTraceItem(trace);
			this._listEl.appendChild(item);
		}
	}

	/**
	 * Создаёт DOM-элемент для одного трейса.
	 *
	 * @param {Object} trace - Объект трейса
	 * @returns {HTMLElement} Элемент трейса
	 * @private
	 */
	_createTraceItem(trace) {
		const item = document.createElement('div');
		item.className = CSS.ITEM;
		item.setAttribute('data-trace-id', trace.traceId);

		// Подсветка активного трейса
		if (trace.traceId === this._activeTraceId) {
			item.classList.add(CSS.ITEM_ACTIVE);
		}

		// TraceId
		const idEl = document.createElement('span');
		idEl.className = CSS.ITEM_ID;
		idEl.textContent = trace.traceId;
		item.appendChild(idEl);

		// Режим (с цветовой индикацией)
		const mode = trace.mode || 'unknown';
		const modeLabel = MODE_LABELS[mode] || mode;
		const modeClass = this._getModeClass(mode);

		const modeEl = document.createElement('span');
		modeEl.className = CSS.ITEM_MODE + ' ' + modeClass;
		modeEl.textContent = modeLabel;
		item.appendChild(modeEl);

		// Количество записей
		const count = trace.recordCount || 0;
		const countEl = document.createElement('span');
		countEl.className = CSS.ITEM_COUNT;
		countEl.textContent =
			String(count) + ' \u0437\u0430\u043F\u0438\u0441\u0435\u0439';
		item.appendChild(countEl);

		// Обработчик клика для выбора трейса
		item.addEventListener('click', () => {
			this._onTraceSelect(trace.traceId);
		});

		return item;
	}

	/**
	 * Возвращает CSS-класс для режима трейса.
	 *
	 * @param {string} mode - Режим трейса
	 * @returns {string} CSS-класс
	 * @private
	 */
	_getModeClass(mode) {
		switch (mode) {
			case 'full':
				return CSS.MODE_FULL;
			case 'flat':
				return CSS.MODE_FLAT;
			case 'shifted':
				return CSS.MODE_SHIFTED;
			default:
				return '';
		}
	}

	/**
	 * Фильтрует массив трейсов по поисковому запросу (case-insensitive).
	 *
	 * @param {Array} traces - Массив трейсов
	 * @param {string} query - Поисковый запрос
	 * @returns {Array} Отфильтрованный массив
	 * @private
	 */
	_filterTraces(traces, query) {
		if (!query || query.trim() === '') {
			return traces;
		}

		const lowerQuery = query.toLowerCase();

		const result = [];
		for (let i = 0; i < traces.length; i++) {
			const traceId = traces[i].traceId || '';
			if (traceId.toLowerCase().indexOf(lowerQuery) !== -1) {
				result.push(traces[i]);
			}
		}

		return result;
	}

	/**
	 * Подсвечивает выбранный трейс.
	 *
	 * @param {string} traceId - Идентификатор трейса
	 */
	setActive(traceId) {
		this._activeTraceId = traceId;

		if (!this._listEl) {
			return;
		}

		// Обновляем классы у всех элементов
		const items = this._listEl.querySelectorAll('.' + CSS.ITEM);
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			const itemTraceId = item.getAttribute('data-trace-id');

			if (itemTraceId === traceId) {
				item.classList.add(CSS.ITEM_ACTIVE);
			} else {
				item.classList.remove(CSS.ITEM_ACTIVE);
			}
		}
	}

	/**
	 * Фильтрует список трейсов по TraceId (case-insensitive).
	 *
	 * @param {string} query - Поисковый запрос
	 */
	filter(query) {
		this._query = query || '';
		this._renderList();
	}

	/**
	 * Очищает список трейсов.
	 */
	clear() {
		this._traces = [];
		this._activeTraceId = null;
		this._query = '';

		if (this._searchInput) {
			this._searchInput.value = '';
		}

		if (this._listEl) {
			this._listEl.textContent = '';
		}
	}
}

export { TraceListView };
