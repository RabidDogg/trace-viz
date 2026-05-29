/**
 * @fileoverview
 * Глобальная конфигурация приложения Trace Viz.
 * Все настраиваемые параметры вынесены в отдельный файл
 * в соответствии с НФТ (п. 2 «Конфигурация»).
 */

'use strict';

/**
 * Глобальный флаг отладки.
 * При true включаются DEBUG-логи и расширенные проверки типов.
 * В релизе — false.
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
