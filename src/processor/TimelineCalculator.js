/**
 * @fileoverview
 * TimelineCalculator — статический класс для расчёта временной шкалы (ось X с метками).
 *
 * Принимает массив LayoutItem[] и конфигурацию, возвращает данные для отрисовки
 * временной шкалы: границы, масштаб, массив меток (ticks) с координатами.
 *
 * Чистая функция, zero dependencies.
 */

'use strict';

/**
 * @typedef {import('./HybridLayoutEngine.js').LayoutItem} LayoutItem
 */

/**
 * Метка временной шкалы.
 *
 * @typedef {Object} TimelineTick
 * @property {number} x - X-координата метки в пикселях
 * @property {number} timestampMs - Абсолютный timestamp в миллисекундах
 * @property {string} label - Текстовое представление (например, "10:00:00.000")
 * @property {boolean} isMajor - Флаг основной метки (с подписью)
 */

/**
 * Результат расчёта временной шкалы.
 *
 * @typedef {Object} TimelineScale
 * @property {number} timelineStart - Начало шкалы (timestampMs)
 * @property {number} timelineEnd - Конец шкалы (timestampMs)
 * @property {number} durationMs - Длительность шкалы в миллисекундах
 * @property {number} pixelsPerMs - Пикселей на миллисекунду
 * @property {TimelineTick[]} ticks - Массив меток для отрисовки
 * @property {number} tickInterval - Интервал между метками в миллисекундах
 */

/**
 * Конфигурация для TimelineCalculator.
 *
 * @typedef {Object} TimelineConfig
 * @property {number} timelineWidth - Ширина временной шкалы в пикселях
 */

/**
 * @class TimelineCalculator
 * Статический класс для расчёта временной шкалы.
 */
class TimelineCalculator {
	/**
	 * "Красивые" интервалы для автоматического подбора шага меток.
	 *
	 * Значения в миллисекундах, покрывают диапазон от микросекунд до суток.
	 * Отсортированы по возрастанию.
	 *
	 * @type {ReadonlyArray<number>}
	 */
	static #NICE_INTERVALS_MS = Object.freeze([
		0.001,
		0.002,
		0.005, // < 1 ms
		0.01,
		0.02,
		0.05, // 10-50 ms
		0.1,
		0.2,
		0.5, // 100-500 ms
		1,
		2,
		5, // 1-5 s
		10,
		30, // 10-30 s
		60,
		120,
		300, // 1-5 min
		600,
		1800, // 10-30 min
		3600,
		7200,
		14400, // 1-4 hours
		86400, // 1 day
	]);

	/**
	 * Рассчитывает временную шкалу на основе массива LayoutItem[].
	 *
	 * Алгоритм:
	 * 1. Определение границ шкалы (timelineStart, timelineEnd) по X → timestamp
	 * 2. Расчёт длительности и масштаба (pixelsPerMs)
	 * 3. Автоматический подбор интервала меток
	 * 4. Генерация массива меток с координатами и форматированием
	 *
	 * @param {LayoutItem[]} items - Массив элементов лейаута с рассчитанными X-координатами
	 * @param {TimelineConfig} config - Конфигурация (timelineWidth)
	 * @returns {TimelineScale} Объект с данными временной шкалы
	 */
	static calculate(items, config) {
		// Шаг 1: Определение границ шкалы
		let timelineStart = 0;
		let timelineEnd = 0;

		if (items.length === 0) {
			// Пустой массив — возвращаем нулевую шкалу
			return {
				timelineStart: 0,
				timelineEnd: 0,
				durationMs: 0,
				pixelsPerMs: 0,
				ticks: [],
				tickInterval: 0,
			};
		}

		// Ищем минимальный и максимальный timestamp среди всех записей
		timelineStart = items[0].record.timestampMs;
		timelineEnd = items[0].record.timestampMs;

		for (let i = 1; i < items.length; i++) {
			const ts = items[i].record.timestampMs;
			if (ts < timelineStart) {
				timelineStart = ts;
			}
			if (ts > timelineEnd) {
				timelineEnd = ts;
			}
		}

		// Шаг 2: Расчёт длительности и масштаба
		let durationMs = timelineEnd - timelineStart;

		// Если длительность нулевая (все записи в один момент),
		// расширяем шкалу до 1 мс, чтобы избежать деления на ноль
		if (durationMs === 0) {
			durationMs = 1;
		}

		const timelineWidth = (config && config.timelineWidth) || 1200;
		const pixelsPerMs = timelineWidth / durationMs;

		// Шаг 3: Автоматический подбор интервала меток
		const tickInterval =
			TimelineCalculator.#calculateTickInterval(durationMs);

		// Шаг 4: Генерация меток (ticks)
		const ticks = [];
		let tickIndex = 0;

		// Начинаем от timelineStart, идём с шагом tickInterval
		let currentTimestamp = timelineStart;

		while (currentTimestamp <= timelineEnd) {
			// X-координата метки: (timestampMs - timelineStart) * pixelsPerMs
			const x = (currentTimestamp - timelineStart) * pixelsPerMs;

			// Форматирование подписи
			const label = TimelineCalculator.#formatTimestamp(
				currentTimestamp,
				durationMs,
			);

			// Основная метка (isMajor) — каждая 5-я,
			// или каждая, если меток меньше 5
			let isMajor = tickIndex % 5 === 0;
			if (ticks.length < 5) {
				isMajor = true;
			}

			ticks.push({
				x: x,
				timestampMs: currentTimestamp,
				label: label,
				isMajor: isMajor,
			});

			tickIndex++;
			currentTimestamp += tickInterval;
		}

		return {
			timelineStart: timelineStart,
			timelineEnd: timelineEnd,
			durationMs: durationMs,
			pixelsPerMs: pixelsPerMs,
			ticks: ticks,
			tickInterval: tickInterval,
		};
	}

	/**
	 * Подбирает "красивый" интервал между метками временной шкалы.
	 *
	 * Алгоритм:
	 * 1. Вычисляет "грубый" интервал = durationMs / targetTicks (цель — 8 меток)
	 * 2. Ищет ближайший "красивый" интервал из NICE_INTERVALS_MS,
	 *    который >= грубого интервала
	 * 3. Если подходящий не найден, возвращает максимальный (86400 ms = 1 день)
	 *
	 * @param {number} durationMs - Длительность шкалы в миллисекундах
	 * @returns {number} Подобранный интервал в миллисекундах
	 * @private
	 */
	static #calculateTickInterval(durationMs) {
		// Целевое количество меток: 5-10, используем 8 как середину
		const targetTicks = 8;
		const roughInterval = durationMs / targetTicks;

		// Ищем первый "красивый" интервал, который >= грубого
		return (
			TimelineCalculator.#NICE_INTERVALS_MS.find(function (interval) {
				return interval >= roughInterval;
			}) ||
			TimelineCalculator.#NICE_INTERVALS_MS[
				TimelineCalculator.#NICE_INTERVALS_MS.length - 1
			]
		);
	}

	/**
	 * Форматирует timestamp в строку для подписи метки шкалы.
	 *
	 * Выбор формата зависит от длительности шкалы:
	 * - < 1 секунды: ЧЧ:ММ:СС.ммм (с миллисекундами)
	 * - < 1 часа:    ЧЧ:ММ:СС (без миллисекунд)
	 * - >= 1 часа:   ЧЧ:ММ (без секунд)
	 *
	 * @param {number} timestampMs - Абсолютный timestamp в миллисекундах
	 * @param {number} durationMs - Длительность шкалы для выбора формата
	 * @returns {string} Отформатированная строка времени
	 * @private
	 */
	static #formatTimestamp(timestampMs, durationMs) {
		// Создаём Date из timestamp (умножаем на 1, т.к. timestamp уже в мс)
		const date = new Date(timestampMs);

		// Часы, минуты, секунды, миллисекунды — с ведущими нулями
		const hours = String(date.getUTCHours()).padStart(2, '0');
		const minutes = String(date.getUTCMinutes()).padStart(2, '0');
		const seconds = String(date.getUTCSeconds()).padStart(2, '0');
		const millis = String(date.getUTCMilliseconds()).padStart(3, '0');

		if (durationMs < 1000) {
			// Менее 1 секунды — показываем миллисекунды
			return hours + ':' + minutes + ':' + seconds + '.' + millis;
		}

		if (durationMs < 3600000) {
			// Менее 1 часа — показываем секунды без миллисекунд
			return hours + ':' + minutes + ':' + seconds;
		}

		// 1 час и более — только часы и минуты
		return hours + ':' + minutes;
	}
}

export { TimelineCalculator };
