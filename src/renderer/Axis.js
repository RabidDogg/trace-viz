/**
 * @fileoverview
 * TimelineAxis — отрисовывает ось времени с метками на основе TimelineScale.
 *
 * Использует RenderEngine для доступа к SVG-группе axis-group.
 * Все SVG-элементы создаются через createElementNS, без innerHTML.
 *
 * Zero dependencies, "use strict".
 */

'use strict';

/**
 * @class TimelineAxis
 * Отрисовывает ось времени с метками на основе TimelineScale.
 *
 * @param {import('./Engine.js').RenderEngine} engine - Экземпляр RenderEngine
 * @param {import('../processor/TimelineCalculator.js').TimelineScale} scale - Данные временной шкалы
 */
function TimelineAxis(engine, scale) {
	/**
	 * Ссылка на RenderEngine.
	 * @type {import('./Engine.js').RenderEngine}
	 * @private
	 */
	this._engine = engine;

	/**
	 * Текущий масштаб временной шкалы.
	 * @type {import('../processor/TimelineCalculator.js').TimelineScale|null}
	 * @private
	 */
	this._scale = scale || null;

	/**
	 * Высота оси в пикселях.
	 * @type {number}
	 * @private
	 */
	this._axisHeight = 30;

	/**
	 * CSS-классы для элементов оси.
	 * @type {Object}
	 * @private
	 */
	this._classes = {
		axisLine: 'axis__line',
		tick: 'axis__tick',
		tickMajor: 'axis__tick--major',
		label: 'axis__label',
		labelMajor: 'axis__label--major',
	};
}

/**
 * Отрисовывает ось времени.
 *
 * Создаёт:
 * - Горизонтальную линию внизу оси
 * - Вертикальные метки (ticks) — короткие линии
 * - Текст подписи под каждой major-меткой
 *
 * Все элементы создаются через createElementNS, textContent для текста.
 */
TimelineAxis.prototype.render = function () {
	if (!this._scale || !this._scale.ticks || this._scale.ticks.length === 0) {
		return;
	}

	var axisGroup = this._engine.getAxisGroup();
	if (!axisGroup) {
		return;
	}

	// Очищаем ось перед отрисовкой
	axisGroup.textContent = '';

	var svgHeight = this._engine._config ? this._engine._config.height : 600;
	var axisY = svgHeight - this._axisHeight;
	var ticks = this._scale.ticks;

	// 1. Горизонтальная линия оси
	var axisLine = document.createElementNS(
		'http://www.w3.org/2000/svg',
		'line',
	);
	axisLine.setAttribute('x1', '0');
	axisLine.setAttribute('y1', String(axisY));
	axisLine.setAttribute(
		'x2',
		String(this._scale.ticks[this._scale.ticks.length - 1].x),
	);
	axisLine.setAttribute('y2', String(axisY));
	axisLine.setAttribute('class', this._classes.axisLine);
	axisGroup.appendChild(axisLine);

	// 2. Метки (ticks) и подписи
	for (var i = 0; i < ticks.length; i++) {
		var tick = ticks[i];
		var isMajor = tick.isMajor;
		var tickHeight = isMajor ? 10 : 6;

		// Вертикальная линия метки
		var tickLine = document.createElementNS(
			'http://www.w3.org/2000/svg',
			'line',
		);
		tickLine.setAttribute('x1', String(tick.x));
		tickLine.setAttribute('y1', String(axisY));
		tickLine.setAttribute('x2', String(tick.x));
		tickLine.setAttribute('y2', String(axisY - tickHeight));
		tickLine.setAttribute(
			'class',
			isMajor ? this._classes.tickMajor : this._classes.tick,
		);
		axisGroup.appendChild(tickLine);

		// Подпись только для major-меток
		if (isMajor) {
			var label = document.createElementNS(
				'http://www.w3.org/2000/svg',
				'text',
			);
			label.setAttribute('x', String(tick.x));
			label.setAttribute('y', String(axisY + 16));
			label.setAttribute('text-anchor', 'middle');
			label.setAttribute(
				'class',
				isMajor ? this._classes.labelMajor : this._classes.label,
			);
			label.textContent = tick.label;
			axisGroup.appendChild(label);
		}
	}
};

/**
 * Обновляет ось с новым масштабом.
 *
 * Сохраняет новый scale и вызывает render() для перерисовки.
 *
 * @param {import('../processor/TimelineCalculator.js').TimelineScale} scale - Новые данные временной шкалы
 */
TimelineAxis.prototype.update = function (scale) {
	this._scale = scale;
	this.render();
};

/**
 * Очищает ось времени.
 *
 * Удаляет все дочерние элементы из axis-group.
 */
TimelineAxis.prototype.clear = function () {
	var axisGroup = this._engine.getAxisGroup();
	if (axisGroup) {
		axisGroup.textContent = '';
	}
	this._scale = null;
};

// Экспорт
module.exports = {
	TimelineAxis: TimelineAxis,
};
