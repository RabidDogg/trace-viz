/**
 * @fileoverview
 * Глобальная конфигурация приложения Trace Viz.
 * Все настраиваемые параметры вынесены в отдельный файл
 * в соответствии с НФТ (п. 2 «Конфигурация»).
 */

'use strict';

/** @type {boolean} */
let _debugEnabled = false;

/**
 * Возвращает текущее состояние режима отладки.
 * @returns {boolean}
 */
export function getDebugEnabled() {
	return _debugEnabled;
}

/**
 * Устанавливает состояние режима отладки.
 * Диспатчит событие `debug:changed` на window.
 * @param {boolean} value
 */
export function setDebugEnabled(value) {
	_debugEnabled = Boolean(value);
	window.dispatchEvent(
		new CustomEvent('debug:changed', {
			detail: { enabled: _debugEnabled },
		}),
	);
}

/**
 * Глобальный флаг отладки (константа для обратной совместимости).
 * Для динамической проверки используйте getDebugEnabled().
 * @type {boolean}
 */
export const APP_DEBUG = false;

/**
 * Конфигурация лейаута визуализации.
 * Определяет параметры отрисовки спанов и временной шкалы.
 *
 * @type {Object}
 * @property {number} timelineWidth - Ширина временной шкалы в пикселях
 * @property {number} rowHeight - Высота строки спана в пикселях
 * @property {number} indentWidth - Ширина отступа для вложенных спанов в пикселях
 * @property {number} minBarWidth - Минимальная ширина бара спана в пикселях
 */
export const LAYOUT_CONFIG = Object.freeze({
	timelineWidth: 1200,
	rowHeight: 32,
	indentWidth: 20,
	minBarWidth: 4,
});
