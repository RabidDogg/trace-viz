/**
 * @fileoverview
 * RenderEngine — управляет SVG-полотном: создание, очистка, координатные трансформации.
 *
 * Создаёт SVG-элемент с тремя группами:
 * - axis-group   — ось времени
 * - bars-group   — бары спанов
 * - overlay-group — интерактивные оверлеи
 *
 * Zero dependencies, "use strict".
 */

'use strict';

/**
 * @typedef {Object} EngineConfig
 * @property {string} containerId - ID контейнера для SVG
 * @property {number} width - Ширина SVG (пиксели)
 * @property {number} height - Высота SVG (пиксели)
 * @property {number} axisHeight - Высота оси времени (пиксели)
 */

/**
 * @class RenderEngine
 * Управляет SVG-полотном: создание, очистка, координатные трансформации.
 */
class RenderEngine {
	/**
	 * @param {EngineConfig} config - Конфигурация движка
	 */
	constructor(config) {
		/**
		 * Конфигурация движка.
		 * @type {EngineConfig}
		 * @private
		 */
		this._config = {
			containerId: (config && config.containerId) || 'svg-container',
			width: (config && config.width) || 1200,
			height: (config && config.height) || 600,
			axisHeight: (config && config.axisHeight) || 30,
		};

		/**
		 * Ссылка на SVG-элемент.
		 * @type {SVGSVGElement|null}
		 * @private
		 */
		this._svg = null;

		/**
		 * Группа для оси времени.
		 * @type {SVGGElement|null}
		 * @private
		 */
		this._axisGroup = null;

		/**
		 * Группа для баров спанов.
		 * @type {SVGGElement|null}
		 * @private
		 */
		this._barsGroup = null;

		/**
		 * Группа для интерактивных оверлеев.
		 * @type {SVGGElement|null}
		 * @private
		 */
		this._overlayGroup = null;
	}

	/**
	 * Создаёт SVG-элемент с viewBox и группами.
	 *
	 * Ищет контейнер по containerId, создаёт внутри него SVG
	 * с xmlns="http://www.w3.org/2000/svg", устанавливает width, height, viewBox.
	 * Затем создаёт три группы: axis-group, bars-group, overlay-group.
	 *
	 * @returns {RenderEngine} this для chaining
	 */
	init() {
		const container = document.getElementById(this._config.containerId);
		if (!container) {
			throw new Error(
				'RenderEngine: container #' +
					this._config.containerId +
					' not found',
			);
		}

		// Создаём SVG-элемент
		const svg = document.createElementNS(
			'http://www.w3.org/2000/svg',
			'svg',
		);
		svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
		svg.setAttribute('width', String(this._config.width));
		svg.setAttribute('height', String(this._config.height));
		svg.setAttribute(
			'viewBox',
			'0 0 ' + this._config.width + ' ' + this._config.height,
		);
		svg.setAttribute('class', 'visualization-area__svg');

		// Создаём группы
		this._axisGroup = document.createElementNS(
			'http://www.w3.org/2000/svg',
			'g',
		);
		this._axisGroup.setAttribute('class', 'axis-group');

		this._barsGroup = document.createElementNS(
			'http://www.w3.org/2000/svg',
			'g',
		);
		this._barsGroup.setAttribute('class', 'bars-group');

		this._overlayGroup = document.createElementNS(
			'http://www.w3.org/2000/svg',
			'g',
		);
		this._overlayGroup.setAttribute('class', 'overlay-group');

		// Добавляем группы в SVG
		svg.appendChild(this._axisGroup);
		svg.appendChild(this._barsGroup);
		svg.appendChild(this._overlayGroup);

		// Очищаем контейнер и вставляем SVG
		container.textContent = '';
		container.appendChild(svg);

		this._svg = svg;

		return this;
	}

	/**
	 * Очищает все группы, кроме оси.
	 *
	 * Удаляет все дочерние элементы из bars-group и overlay-group.
	 * Ось времени не очищается, чтобы не пересоздавать её при каждом обновлении.
	 */
	clear() {
		if (this._barsGroup) {
			this._barsGroup.textContent = '';
		}
		if (this._overlayGroup) {
			this._overlayGroup.textContent = '';
		}
	}

	/**
	 * Возвращает SVG-элемент.
	 *
	 * @returns {SVGSVGElement|null} SVG-элемент или null, если движок не инициализирован
	 */
	getSvg() {
		return this._svg;
	}

	/**
	 * Возвращает группу для оси времени.
	 *
	 * @returns {SVGGElement|null} Группа axis-group или null
	 */
	getAxisGroup() {
		return this._axisGroup;
	}

	/**
	 * Возвращает группу для баров спанов.
	 *
	 * @returns {SVGGElement|null} Группа bars-group или null
	 */
	getBarsGroup() {
		return this._barsGroup;
	}

	/**
	 * Возвращает группу для интерактивных оверлеев.
	 *
	 * @returns {SVGGElement|null} Группа overlay-group или null
	 */
	getOverlayGroup() {
		return this._overlayGroup;
	}

	/**
	 * Динамически меняет высоту SVG.
	 *
	 * Обновляет атрибуты height и viewBox.
	 * Высота оси при этом не меняется — она перерисовывается отдельно через Axis.
	 *
	 * @param {number} height - Новая высота в пикселях
	 */
	setHeight(height) {
		if (!this._svg) {
			return;
		}

		this._config.height = height;
		this._svg.setAttribute('height', String(height));
		this._svg.setAttribute(
			'viewBox',
			'0 0 ' + this._config.width + ' ' + height,
		);
	}

	/**
	 * Удаляет SVG из DOM.
	 *
	 * Полностью очищает контейнер и сбрасывает все внутренние ссылки.
	 */
	destroy() {
		if (!this._svg) {
			return;
		}

		const parent = this._svg.parentNode;
		if (parent) {
			parent.textContent = '';
		}

		this._svg = null;
		this._axisGroup = null;
		this._barsGroup = null;
		this._overlayGroup = null;
	}
}

// Экспорт
export { RenderEngine };
