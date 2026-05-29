/**
 * @fileoverview
 * SpanBarsRenderer — отрисовывает спаны и orphan-записи на SVG-полотне
 * в виде цветных прямоугольников с поддержкой виртуализации, тултипов
 * и интерактивности.
 *
 * Использует RenderEngine для доступа к SVG-группе bars-group.
 * Все SVG-элементы создаются через createElementNS, без innerHTML.
 *
 * Zero dependencies, "use strict".
 */

'use strict';

/**
 * Цвета баров по глубине вложенности.
 *
 * @type {Object}
 * @private
 */
const DEPTH_COLORS = {
	0: '#4A90D9', // синий — корень
	1: '#50C878', // зелёный
	2: '#F5A623', // оранжевый
	3: '#D0021B', // красный
};

/**
 * Цвет для orphan-записей.
 *
 * @type {string}
 * @private
 */
const ORPHAN_COLOR = '#9B9B9B';

/**
 * Цвет для баров с ошибкой.
 *
 * @type {string}
 * @private
 */
const ERROR_COLOR = '#E74C3C';

/**
 * CSS-классы для элементов баров.
 *
 * @type {Object}
 * @private
 */
const BAR_CLASSES = {
	group: 'span-bar',
	rect: 'span-bar__rect',
	label: 'span-bar__label',
	errorIcon: 'span-bar__error-icon',
	orphan: 'span-bar--orphan',
	error: 'span-bar--error',
	highlighted: 'span-bar--highlighted',
};

/**
 * CSS-классы для тултипа.
 *
 * @type {Object}
 * @private
 */
const TOOLTIP_CLASSES = {
	container: 'span-bar__tooltip',
	title: 'span-bar__tooltip-title',
	row: 'span-bar__tooltip-row',
	label: 'span-bar__tooltip-label',
	value: 'span-bar__tooltip-value',
	error: 'span-bar__tooltip-error',
};

/**
 * Возвращает цвет для бара на основе глубины и флагов.
 *
 * @param {Object} item - LayoutItem
 * @returns {string} CSS-цвет
 * @private
 */
function getBarColor(item) {
	// Приоритет 1: ошибка
	if (item.record && item.record.isError === true) {
		return ERROR_COLOR;
	}

	// Приоритет 2: orphan
	if (item.isOrphan) {
		return ORPHAN_COLOR;
	}

	// Приоритет 3: цвет по глубине
	const depth = item.depth;
	if (depth > 3) {
		depth = 3;
	}

	return DEPTH_COLORS[depth] || DEPTH_COLORS[0];
}

/**
 * Создаёт строку тултипа с label и value.
 *
 * @param {string} label - Текст метки
 * @param {string} value - Текст значения
 * @returns {HTMLElement} Элемент строки
 * @private
 */
function createTooltipRow(label, value) {
	const row = document.createElement('div');
	row.setAttribute('class', TOOLTIP_CLASSES.row);

	const labelEl = document.createElement('span');
	labelEl.setAttribute('class', TOOLTIP_CLASSES.label);
	labelEl.textContent = label;

	const valueEl = document.createElement('span');
	valueEl.setAttribute('class', TOOLTIP_CLASSES.value);
	valueEl.textContent = value;

	row.appendChild(labelEl);
	row.appendChild(valueEl);

	return row;
}

/**
 * Находит SVG-группу span-bar по целевому элементу (для делегирования).
 *
 * @param {Element} target - Целевой элемент события
 * @returns {SVGGElement|null} Группа span-bar или null
 * @private
 */
function findBarGroup(target) {
	if (!target) {
		return null;
	}

	let el = target;
	while (el) {
		if (
			el.tagName === 'g' &&
			el.getAttribute &&
			el.getAttribute('class') &&
			el.getAttribute('class').indexOf(BAR_CLASSES.group) !== -1
		) {
			return el;
		}
		el = el.parentNode;
	}

	return null;
}

/**
 * @class SpanBarsRenderer
 * Отрисовывает спаны и orphan-записи на SVG-полотне в виде цветных прямоугольников.
 *
 * @param {import('./Engine.js').RenderEngine} engine - Экземпляр RenderEngine
 */
class SpanBarsRenderer {
	/**
	 * @param {import('./Engine.js').RenderEngine} engine - Экземпляр RenderEngine
	 */
	constructor(engine) {
		/**
		 * Ссылка на RenderEngine.
		 * @type {import('./Engine.js').RenderEngine}
		 * @private
		 */
		this._engine = engine;

		/**
		 * Текущий массив LayoutItem[].
		 * @type {Array}
		 * @private
		 */
		this._layoutItems = [];

		/**
		 * Конфигурация рендеринга.
		 * @type {Object}
		 * @private
		 */
		this._config = {
			rowHeight: 32,
			minBarWidth: 4,
			onSpanClick: null,
		};

		/**
		 * Элемент тултипа.
		 * @type {HTMLElement|null}
		 * @private
		 */
		this._tooltipEl = null;

		/**
		 * Флаг: создан ли тултип.
		 * @type {boolean}
		 * @private
		 */
		this._tooltipCreated = false;

		/**
		 * Текущий подсвеченный spanId.
		 * @type {string|null}
		 * @private
		 */
		this._highlightedId = null;

		/**
		 * Контейнер для скролла (родитель SVG).
		 * @type {HTMLElement|null}
		 * @private
		 */
		this._scrollContainer = null;

		/**
		 * Обработчик скролла для виртуализации.
		 * @type {Function|null}
		 * @private
		 */
		this._scrollHandler = null;

		/**
		 * Привязанный обработчик mouseenter.
		 * @type {Function|null}
		 * @private
		 */
		this._boundMouseEnter = null;

		/**
		 * Привязанный обработчик mouseleave.
		 * @type {Function|null}
		 * @private
		 */
		this._boundMouseLeave = null;

		/**
		 * Привязанный обработчик клика.
		 * @type {Function|null}
		 * @private
		 */
		this._boundClick = null;
	}

	/**
	 * Создаёт HTML-элемент тултипа и добавляет его в DOM.
	 *
	 * Тултип создаётся один раз и переиспользуется.
	 *
	 * @private
	 */
	_createTooltip() {
		if (this._tooltipCreated) {
			return;
		}

		const tooltip = document.createElement('div');
		tooltip.setAttribute('class', TOOLTIP_CLASSES.container);
		tooltip.style.cssText =
			'position:fixed;display:none;z-index:9999;pointer-events:none;';

		document.body.appendChild(tooltip);
		this._tooltipEl = tooltip;
		this._tooltipCreated = true;
	}

	/**
	 * Показывает тултип с информацией о спане.
	 *
	 * @param {Object} item - LayoutItem
	 * @param {MouseEvent} event - Событие мыши
	 * @private
	 */
	_showTooltip(item, event) {
		this._createTooltip();
		if (!this._tooltipEl) {
			return;
		}

		const record = item.record || {};
		const tooltip = this._tooltipEl;

		// Очищаем тултип
		tooltip.textContent = '';

		// Заголовок — StageName
		const title = document.createElement('div');
		title.setAttribute('class', TOOLTIP_CLASSES.title);
		title.textContent = record.StageName || record.stageName || '(unnamed)';
		tooltip.appendChild(title);

		// Duration
		const durationRow = createTooltipRow(
			'Duration:',
			record.durationMs !== null && record.durationMs !== undefined
				? record.durationMs + ' ms'
				: '—',
		);
		tooltip.appendChild(durationRow);

		// Timestamp
		const tsRow = createTooltipRow(
			'Timestamp:',
			record.timestampMs !== null && record.timestampMs !== undefined
				? record.timestampMs + ' ms'
				: '—',
		);
		tooltip.appendChild(tsRow);

		// SpanId
		const spanIdRow = createTooltipRow('SpanId:', item.id || '—');
		tooltip.appendChild(spanIdRow);

		// ParentId
		const parentIdRow = createTooltipRow(
			'ParentId:',
			item.parentSpanId || '—',
		);
		tooltip.appendChild(parentIdRow);

		// Error (если есть)
		if (record.isError === true) {
			const errorRow = document.createElement('div');
			errorRow.setAttribute('class', TOOLTIP_CLASSES.error);
			errorRow.textContent = '⚠ Error';
			tooltip.appendChild(errorRow);
		}

		// Позиционирование
		const offsetX = 12;
		const offsetY = 12;
		let x = event.clientX + offsetX;
		let y = event.clientY + offsetY;

		// Проверка, чтобы тултип не выходил за правый край экрана
		const tooltipWidth = 280;
		if (x + tooltipWidth > window.innerWidth) {
			x = event.clientX - tooltipWidth - offsetX;
		}
		if (x < 0) {
			x = offsetX;
		}

		tooltip.style.left = x + 'px';
		tooltip.style.top = y + 'px';
		tooltip.style.display = 'block';
	}

	/**
	 * Скрывает тултип.
	 *
	 * @private
	 */
	_hideTooltip() {
		if (this._tooltipEl) {
			this._tooltipEl.style.display = 'none';
		}
	}

	/**
	 * Создаёт SVG-группу для одного LayoutItem.
	 *
	 * @param {Object} item - LayoutItem
	 * @param {Object} config - Конфигурация рендеринга
	 * @returns {SVGGElement} SVG-группа с rect и label
	 * @private
	 */
	_createBarGroup(item, config) {
		const ns = 'http://www.w3.org/2000/svg';
		const rowHeight = config.rowHeight;
		const minBarWidth = config.minBarWidth;

		// Координаты
		const rectX = item.x;
		const rectY = item.y * rowHeight;
		const rectWidth = Math.max(item.width, minBarWidth);
		const rectHeight = rowHeight - 4;

		// Цвет
		const color = getBarColor(item);

		// Создаём группу
		const group = document.createElementNS(ns, 'g');
		group.setAttribute('class', BAR_CLASSES.group);
		group.setAttribute('data-id', item.id);

		// Прямоугольник
		const rect = document.createElementNS(ns, 'rect');
		rect.setAttribute('class', BAR_CLASSES.rect);
		rect.setAttribute('x', String(rectX));
		rect.setAttribute('y', String(rectY + 2)); // отступ 2px сверху
		rect.setAttribute('width', String(rectWidth));
		rect.setAttribute('height', String(rectHeight));
		rect.setAttribute('rx', '3');
		rect.setAttribute('ry', '3');
		rect.setAttribute('fill', color);

		// Если orphan — пунктирная рамка
		if (item.isOrphan) {
			rect.setAttribute('stroke', ORPHAN_COLOR);
			rect.setAttribute('stroke-dasharray', '4,2');
			rect.setAttribute('stroke-width', '1');
		}

		group.appendChild(rect);

		// Текст (StageName) внутри бара, если ширина > 50px
		const stageName =
			(item.record && (item.record.StageName || item.record.stageName)) ||
			'';
		if (rectWidth > 50 && stageName) {
			const text = document.createElementNS(ns, 'text');
			text.setAttribute('class', BAR_CLASSES.label);
			text.setAttribute('x', String(rectX + 6));
			text.setAttribute(
				'y',
				String(item.y * rowHeight + rowHeight / 2 + 4),
			);
			text.textContent = stageName;
			group.appendChild(text);
		}

		// Иконка ошибки "⚠" справа от бара (если ширина позволяет)
		if (item.record && item.record.isError === true && rectWidth > 30) {
			const errorIcon = document.createElementNS(ns, 'text');
			errorIcon.setAttribute('class', BAR_CLASSES.errorIcon);
			errorIcon.setAttribute('x', String(rectX + rectWidth + 4));
			errorIcon.setAttribute(
				'y',
				String(item.y * rowHeight + rowHeight / 2 + 4),
			);
			errorIcon.setAttribute('font-size', '12');
			errorIcon.textContent = '\u26A0'; // ⚠
			group.appendChild(errorIcon);
		}

		return group;
	}

	/**
	 * Отрисовывает массив LayoutItem[] на SVG-полотне.
	 *
	 * Создаёт SVG-элементы для каждого элемента лейаута:
	 * - Прямоугольник с цветом по глубине/статусу
	 * - Текст StageName (если ширина > 50px)
	 * - Иконку ошибки (если isError)
	 *
	 * При количестве элементов > 100 включает базовую виртуализацию:
	 * рендерятся только элементы в видимом диапазоне + буфер.
	 *
	 * @param {Array} layoutItems - Массив LayoutItem[]
	 * @param {Object} [config={}] - Конфигурация рендеринга
	 * @param {number} [config.rowHeight=32] - Высота строки в пикселях
	 * @param {number} [config.minBarWidth=4] - Минимальная ширина бара
	 * @param {Function} [config.onSpanClick] - Колбэк при клике на спан
	 */
	render(layoutItems, config) {
		const barsGroup = this._engine.getBarsGroup();
		if (!barsGroup) {
			return;
		}

		// Сохраняем данные
		this._layoutItems = layoutItems || [];

		// Сливаем конфигурацию
		const cfg = this._config;
		if (config) {
			if (config.rowHeight !== undefined) {
				cfg.rowHeight = config.rowHeight;
			}
			if (config.minBarWidth !== undefined) {
				cfg.minBarWidth = config.minBarWidth;
			}
			if (config.onSpanClick !== undefined) {
				cfg.onSpanClick = config.onSpanClick;
			}
		}

		// Очищаем группу баров
		barsGroup.textContent = '';

		// Если нет элементов — выходим
		if (this._layoutItems.length === 0) {
			return;
		}

		// Определяем, нужна ли виртуализация
		const useVirtualization = this._layoutItems.length > 100;

		if (useVirtualization) {
			this._renderVirtualized(barsGroup, cfg);
		} else {
			this._renderAll(barsGroup, cfg);
		}

		// Навешиваем интерактивность
		this._attachInteraction(barsGroup);
	}

	/**
	 * Отрисовывает все элементы без виртуализации.
	 *
	 * @param {SVGGElement} barsGroup - Группа для баров
	 * @param {Object} config - Конфигурация
	 * @private
	 */
	_renderAll(barsGroup, config) {
		for (let i = 0; i < this._layoutItems.length; i++) {
			const group = this._createBarGroup(this._layoutItems[i], config);
			barsGroup.appendChild(group);
		}
	}

	/**
	 * Отрисовывает элементы с виртуализацией.
	 *
	 * Рассчитывает видимый диапазон по Y на основе scrollTop контейнера
	 * и рендерит только элементы в видимом диапазоне + буфер.
	 *
	 * @param {SVGGElement} barsGroup - Группа для баров
	 * @param {Object} config - Конфигурация
	 * @private
	 */
	_renderVirtualized(barsGroup, config) {
		const container = this._getScrollContainer();
		const scrollTop = container ? container.scrollTop : 0;
		const viewportHeight = container ? container.clientHeight : 600;

		const rowHeight = config.rowHeight;
		const buffer = 10;

		// Рассчитываем видимый диапазон строк
		let firstVisibleRow = Math.floor(scrollTop / rowHeight) - buffer;
		let lastVisibleRow =
			Math.ceil((scrollTop + viewportHeight) / rowHeight) + buffer;

		if (firstVisibleRow < 0) {
			firstVisibleRow = 0;
		}

		// Рендерим только элементы в видимом диапазоне
		for (let i = 0; i < this._layoutItems.length; i++) {
			const item = this._layoutItems[i];
			if (item.y >= firstVisibleRow && item.y <= lastVisibleRow) {
				const group = this._createBarGroup(item, config);
				barsGroup.appendChild(group);
			}
		}
	}

	/**
	 * Возвращает контейнер для скролла.
	 *
	 * Ищет родительский элемент SVG с overflow:auto или overflow-y:auto.
	 *
	 * @returns {HTMLElement|null} Контейнер для скролла
	 * @private
	 */
	_getScrollContainer() {
		if (this._scrollContainer) {
			return this._scrollContainer;
		}

		const svg = this._engine.getSvg();
		if (!svg) {
			return null;
		}

		let parent = svg.parentNode;
		while (parent) {
			const style = window.getComputedStyle
				? window.getComputedStyle(parent)
				: parent.style;
			const overflowY = style.overflowY || style.overflow || '';
			if (
				overflowY === 'auto' ||
				overflowY === 'scroll' ||
				parent.tagName === 'BODY'
			) {
				this._scrollContainer = parent;
				return parent;
			}
			parent = parent.parentNode;
		}

		this._scrollContainer = document.body;
		return document.body;
	}

	/**
	 * Навешивает обработчики интерактивности на бары.
	 *
	 * - mouseenter: подсветка + тултип
	 * - mouseleave: снятие подсветки + скрытие тултипа
	 * - click: вызов onSpanClick
	 *
	 * @param {SVGGElement} barsGroup - Группа с барами
	 * @private
	 */
	_attachInteraction(barsGroup) {
		// Удаляем старые обработчики
		if (this._boundMouseEnter) {
			barsGroup.removeEventListener(
				'mouseenter',
				this._boundMouseEnter,
				true,
			);
		}
		if (this._boundMouseLeave) {
			barsGroup.removeEventListener(
				'mouseleave',
				this._boundMouseLeave,
				true,
			);
		}
		if (this._boundClick) {
			barsGroup.removeEventListener('click', this._boundClick, true);
		}

		/**
		 * Обработчик mouseenter (делегирование).
		 *
		 * @param {MouseEvent} event
		 * @private
		 */
		this._boundMouseEnter = (event) => {
			const target = event.target;
			const group = findBarGroup(target);
			if (!group) {
				return;
			}

			const spanId = group.getAttribute('data-id');
			if (!spanId) {
				return;
			}

			// Подсветка
			const rect = group.querySelector('rect');
			if (rect) {
				rect.style.opacity = '0.8';
			}

			// Тултип
			const item = this._findItemById(spanId);
			if (item) {
				this._showTooltip(item, event);
			}
		};

		/**
		 * Обработчик mouseleave (делегирование).
		 *
		 * @param {MouseEvent} event
		 * @private
		 */
		this._boundMouseLeave = (event) => {
			const target = event.target;
			const group = findBarGroup(target);
			if (!group) {
				return;
			}

			const rect = group.querySelector('rect');
			if (rect) {
				rect.style.opacity = '1';
			}

			this._hideTooltip();
		};

		/**
		 * Обработчик click (делегирование).
		 *
		 * @param {MouseEvent} event
		 * @private
		 */
		this._boundClick = (event) => {
			const target = event.target;
			const group = findBarGroup(target);
			if (!group) {
				return;
			}

			const spanId = group.getAttribute('data-id');
			if (!spanId) {
				return;
			}

			if (typeof this._config.onSpanClick === 'function') {
				this._config.onSpanClick(spanId);
			}
		};

		// Навешиваем обработчики с делегированием (capture phase)
		barsGroup.addEventListener('mouseenter', this._boundMouseEnter, true);
		barsGroup.addEventListener('mouseleave', this._boundMouseLeave, true);
		barsGroup.addEventListener('click', this._boundClick, true);
	}

	/**
	 * Находит LayoutItem по ID.
	 *
	 * @param {string} id - Идентификатор (spanId или 'orphan-{index}')
	 * @returns {Object|null} Найденный LayoutItem или null
	 * @private
	 */
	_findItemById(id) {
		for (let i = 0; i < this._layoutItems.length; i++) {
			if (this._layoutItems[i].id === id) {
				return this._layoutItems[i];
			}
		}
		return null;
	}

	/**
	 * Очищает все бары.
	 *
	 * Удаляет все дочерние элементы из bars-group и скрывает тултип.
	 */
	clear() {
		const barsGroup = this._engine.getBarsGroup();
		if (barsGroup) {
			barsGroup.textContent = '';
		}

		this._layoutItems = [];
		this._hideTooltip();
		this._highlightedId = null;
	}

	/**
	 * Подсвечивает спан по spanId (изменение opacity).
	 *
	 * @param {string} spanId - Идентификатор спана
	 */
	highlight(spanId) {
		const barsGroup = this._engine.getBarsGroup();
		if (!barsGroup) {
			return;
		}

		// Снимаем предыдущую подсветку
		this.unhighlightAll();

		// Ищем группу с data-id = spanId
		const groups = barsGroup.querySelectorAll('g.' + BAR_CLASSES.group);
		for (let i = 0; i < groups.length; i++) {
			const group = groups[i];
			if (group.getAttribute('data-id') === spanId) {
				const rect = group.querySelector('rect');
				if (rect) {
					rect.style.opacity = '1';
					rect.setAttribute(
						'class',
						rect.getAttribute('class') +
							' ' +
							BAR_CLASSES.highlighted,
					);
				}
				this._highlightedId = spanId;
				break;
			}
		}
	}

	/**
	 * Снимает подсветку со всех спанов.
	 */
	unhighlightAll() {
		const barsGroup = this._engine.getBarsGroup();
		if (!barsGroup) {
			return;
		}

		const groups = barsGroup.querySelectorAll('g.' + BAR_CLASSES.group);
		for (let i = 0; i < groups.length; i++) {
			const group = groups[i];
			const rect = group.querySelector('rect');
			if (rect) {
				rect.style.opacity = '1';
				let cls = rect.getAttribute('class') || '';
				cls = cls
					.replace(
						new RegExp(
							'\\b' + BAR_CLASSES.highlighted + '\\b',
							'g',
						),
						'',
					)
					.trim();
				rect.setAttribute('class', cls);
			}
		}

		this._highlightedId = null;
	}
}

// Экспорт
export { SpanBarsRenderer };
