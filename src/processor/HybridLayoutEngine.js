/**
 * @fileoverview
 * HybridLayoutEngine — гибридный движок расчёта координат X/Y для таймлайна.
 *
 * Принимает результат SpanHierarchyBuilder.build() (HierarchyResult) + массив orphan-записей
 * (записи без spanId) и рассчитывает координаты X/Y для каждого элемента.
 *
 * Гибридный лейаут объединяет иерархическое дерево спанов (Full Trace)
 * с плоскими записями (Flat) в единую координатную сетку.
 *
 * Поддерживает 3 режима:
 * - Full Trace: только спаны, DFS-обход дерева
 * - Flat: только orphan-записи, хронологический порядок
 * - Shifted: спаны по дереву + orphan встраиваются в родительские спаны
 *
 * Чистая функция, zero dependencies.
 */

'use strict';

/**
 * @typedef {import('../parser/DataNormalizer.js').NormalizedRecord} NormalizedRecord
 * @typedef {import('./SpanHierarchyBuilder.js').SpanNode} SpanNode
 * @typedef {import('./SpanHierarchyBuilder.js').HierarchyResult} HierarchyResult
 */

/**
 * Конфигурация лейаута.
 *
 * @typedef {Object} LayoutConfig
 * @property {number} startX - Начальная X-координата (пиксели)
 * @property {number} rowHeight - Высота строки в пикселях
 * @property {number} indentWidth - Ширина отступа на уровень вложенности
 * @property {number} minBarWidth - Минимальная ширина бара в пикселях
 * @property {number} timelineStart - Начало временной шкалы (timestampMs)
 * @property {number} timelineEnd - Конец временной шкалы (timestampMs)
 * @property {number} timelineWidth - Ширина временной шкалы в пикселях
 */

/**
 * Элемент лейаута с рассчитанными координатами.
 *
 * @typedef {Object} LayoutItem
 * @property {string} id - Идентификатор (spanId или 'orphan-{index}')
 * @property {string} type - 'span' | 'orphan'
 * @property {number} x - X-координата (пиксели, отступ от левого края)
 * @property {number} y - Y-координата (пиксели, строка)
 * @property {number} width - Ширина бара (пиксели)
 * @property {number} depth - Глубина вложенности
 * @property {NormalizedRecord} record - Нормализованная запись
 * @property {string|null} parentSpanId - ID родительского спана (для orphan)
 * @property {boolean} isOrphan - Флаг orphan-записи
 */

/**
 * @class HybridLayoutEngine
 * Гибридный движок расчёта координат X/Y для таймлайна.
 *
 * @example
 * // Full Trace режим (только спаны)
 * const hierarchy = builder.build(records);
 * const engine = new HybridLayoutEngine(config);
 * const layout = engine.calculate(hierarchy, []);
 * // → LayoutItem[] с DFS-обходом дерева
 *
 * @example
 * // Flat режим (только orphan)
 * const engine = new HybridLayoutEngine(config);
 * const layout = engine.calculate({ roots: [], nodeMap: new Map(), maxDepth: 0 }, orphans);
 * // → LayoutItem[] в хронологическом порядке
 *
 * @example
 * // Shifted режим (спаны + orphan)
 * const hierarchy = builder.build(records);
 * const orphans = extractOrphans(allRecords);
 * const engine = new HybridLayoutEngine(config);
 * const layout = engine.calculate(hierarchy, orphans);
 * // → LayoutItem[]: спаны по дереву, orphan встроены в родительские спаны
 */
class HybridLayoutEngine {
	/**
	 * @param {LayoutConfig} [config={}] - Конфигурация лейаута
	 */
	constructor(config) {
		/**
		 * Конфигурация лейаута.
		 * @type {LayoutConfig}
		 * @private
		 */
		this._config = config || {};
	}

	/**
	 * Гибридный движок расчёта координат X/Y для таймлайна.
	 *
	 * Принимает результат SpanHierarchyBuilder.build() + массив orphan-записей
	 * и возвращает массив LayoutItem[] с рассчитанными координатами.
	 *
	 * Режимы работы (определяются автоматически):
	 * - **Full Trace**: только спаны (orphanRecords пуст) — DFS-обход дерева
	 * - **Flat**: только orphan-записи (roots пуст) — хронологический порядок
	 * - **Shifted**: спаны + orphan — спаны по дереву, orphan встраиваются
	 *
	 * Чистая функция: не мутирует входные данные, не имеет побочных эффектов.
	 *
	 * @param {HierarchyResult} hierarchyResult - Результат SpanHierarchyBuilder.build()
	 * @param {NormalizedRecord[]} orphanRecords - Массив orphan-записей (без spanId)
	 * @returns {LayoutItem[]} Массив элементов с рассчитанными координатами
	 */
	calculate(hierarchyResult, orphanRecords) {
		// Валидация входных данных
		if (!hierarchyResult || typeof hierarchyResult !== 'object') {
			hierarchyResult = { roots: [], nodeMap: new Map(), maxDepth: 0 };
		}

		if (!Array.isArray(orphanRecords)) {
			orphanRecords = [];
		}

		const roots = Array.isArray(hierarchyResult.roots)
			? hierarchyResult.roots
			: [];

		// Сливаем конфигурацию с умолчаниями
		/** @type {LayoutConfig} */
		const cfg = {};
		cfg.startX =
			this._config.startX !== undefined ? this._config.startX : 0;
		cfg.rowHeight =
			this._config.rowHeight !== undefined ? this._config.rowHeight : 32;
		cfg.indentWidth =
			this._config.indentWidth !== undefined
				? this._config.indentWidth
				: 20;
		cfg.minBarWidth =
			this._config.minBarWidth !== undefined
				? this._config.minBarWidth
				: 4;
		cfg.timelineWidth =
			this._config.timelineWidth !== undefined
				? this._config.timelineWidth
				: 1200;

		// Шаг 1: Расчёт временной шкалы
		const { timelineStart, timelineEnd } = this.#calculateTimeline(
			roots,
			orphanRecords,
		);
		cfg.timelineStart = timelineStart;
		cfg.timelineEnd = timelineEnd;

		/** @type {LayoutItem[]} */
		const result = [];

		// Определяем режим работы
		const hasSpans = roots.length > 0;
		const hasOrphans = orphanRecords.length > 0;

		// Режим 1: Full Trace — только спаны, нет orphan
		if (hasSpans && !hasOrphans) {
			const spanItems = this.#layoutSpanTree(
				roots,
				timelineStart,
				timelineEnd,
				cfg.timelineWidth,
				cfg.minBarWidth,
				cfg.indentWidth,
				0,
			);
			return spanItems;
		}

		// Режим 2: Flat — только orphan, нет спанов
		if (!hasSpans && hasOrphans) {
			// Сортируем orphan по timestampMs (хронологический порядок)
			const sortedOrphans = orphanRecords.slice().sort(function (a, b) {
				const ta = a.timestampMs !== null ? a.timestampMs : -Infinity;
				const tb = b.timestampMs !== null ? b.timestampMs : -Infinity;
				if (ta !== tb) return ta - tb;
				// При равных timestamp — сохраняем исходный порядок
				return 0;
			});

			for (let i = 0; i < sortedOrphans.length; i++) {
				const item = this.#createFlatOrphanItem(
					sortedOrphans[i],
					i,
					i,
					timelineStart,
					timelineEnd,
					cfg.timelineWidth,
					cfg.minBarWidth,
				);
				result.push(item);
			}

			return result;
		}

		// Режим 3: Shifted — спаны по дереву + orphan встраиваются
		// Шаг 3.1: Рассчитываем лейаут для спанов
		const spanItems = this.#layoutSpanTree(
			roots,
			timelineStart,
			timelineEnd,
			cfg.timelineWidth,
			cfg.minBarWidth,
			cfg.indentWidth,
			0,
		);

		// Добавляем все спаны в результат
		for (let i = 0; i < spanItems.length; i++) {
			result.push(spanItems[i]);
		}

		// Шаг 3.2: Встраиваем orphan-записи
		// Сортируем orphan по timestampMs для последовательной обработки
		const sortedOrphans = orphanRecords.slice().sort(function (a, b) {
			const ta = a.timestampMs !== null ? a.timestampMs : -Infinity;
			const tb = b.timestampMs !== null ? b.timestampMs : -Infinity;
			if (ta !== tb) return ta - tb;
			return 0;
		});

		// Отслеживаем занятые Y-координаты, чтобы orphan не накладывались друг на друга
		/** @type {Set<number>} */
		const usedY = new Set();
		for (let i = 0; i < spanItems.length; i++) {
			usedY.add(spanItems[i].y);
		}

		// Находим максимальную Y среди спанов
		let maxSpanY = 0;
		for (let i = 0; i < spanItems.length; i++) {
			if (spanItems[i].y > maxSpanY) {
				maxSpanY = spanItems[i].y;
			}
		}

		/** @type {LayoutItem[]} */
		const orphanItems = [];

		for (let i = 0; i < sortedOrphans.length; i++) {
			const record = sortedOrphans[i];
			const parentSpan = this.#findParentSpan(
				record.timestampMs,
				spanItems,
			);

			if (parentSpan !== null) {
				// Orphan встраивается в родительский спан
				const orphanY = this.#calculateOrphanY(parentSpan, spanItems);

				// Если Y уже занята, сдвигаем вниз
				let finalY = orphanY;
				while (usedY.has(finalY)) {
					finalY++;
				}
				usedY.add(finalY);

				const item = this.#createEmbeddedOrphanItem(
					record,
					i,
					parentSpan,
					finalY,
					timelineStart,
					timelineEnd,
					cfg.timelineWidth,
					cfg.minBarWidth,
					cfg.indentWidth,
				);
				orphanItems.push(item);
			} else {
				// Orphan не удалось встроить — размещаем на отдельной строке после всех спанов
				let flatY = maxSpanY + 1 + orphanItems.length;
				while (usedY.has(flatY)) {
					flatY++;
				}
				usedY.add(flatY);

				const item = this.#createFlatOrphanItem(
					record,
					i,
					flatY,
					timelineStart,
					timelineEnd,
					cfg.timelineWidth,
					cfg.minBarWidth,
				);
				orphanItems.push(item);
			}
		}

		// Добавляем orphan-элементы в результат
		for (let i = 0; i < orphanItems.length; i++) {
			result.push(orphanItems[i]);
		}

		// Шаг 5: Сортировка по Y (для последовательного рендеринга)
		result.sort(function (a, b) {
			if (a.y !== b.y) return a.y - b.y;
			// При одинаковой Y: спаны перед orphan, затем по X
			if (a.isOrphan !== b.isOrphan) {
				return a.isOrphan ? 1 : -1;
			}
			return a.x - b.x;
		});

		return result;
	}

	/**
	 * Рассчитывает временную шкалу (timelineStart, timelineEnd) на основе
	 * всех записей (спаны + orphan).
	 *
	 * @param {SpanNode[]} roots - Корневые узлы дерева спанов
	 * @param {NormalizedRecord[]} orphanRecords - Массив orphan-записей
	 * @returns {{ timelineStart: number, timelineEnd: number }}
	 * @private
	 */
	#calculateTimeline(roots, orphanRecords) {
		/** @type {number|null} */
		let minTimestamp = null;
		/** @type {number|null} */
		let maxEndTime = null;

		// Собираем времена из дерева спанов
		for (let i = 0; i < roots.length; i++) {
			this.#collectSpanTimes(roots[i]);
		}

		// Собираем времена из orphan-записей
		for (let i = 0; i < orphanRecords.length; i++) {
			const record = orphanRecords[i];
			const ts = record.timestampMs;
			if (ts !== null) {
				if (minTimestamp === null || ts < minTimestamp) {
					minTimestamp = ts;
				}
			}

			const endTime =
				ts !== null && record.durationMs !== null
					? ts + record.durationMs
					: null;
			if (endTime !== null) {
				if (maxEndTime === null || endTime > maxEndTime) {
					maxEndTime = endTime;
				}
			}
		}

		// Краевой случай: нет ни одного timestamp
		if (minTimestamp === null) {
			return { timelineStart: 0, timelineEnd: 1 };
		}

		// Если maxEndTime не определён (нет duration ни у одной записи),
		// используем timelineStart + 1 как конец шкалы
		if (maxEndTime === null) {
			return {
				timelineStart: minTimestamp,
				timelineEnd: minTimestamp + 1,
			};
		}

		// Если все записи в один момент, расширяем шкалу
		if (minTimestamp === maxEndTime) {
			return {
				timelineStart: minTimestamp,
				timelineEnd: minTimestamp + 1,
			};
		}

		return { timelineStart: minTimestamp, timelineEnd: maxEndTime };

		/**
		 * Рекурсивно собирает timestampMs и endTime из дерева спанов.
		 *
		 * @param {SpanNode} node - Узел дерева
		 * @private
		 */
		function collectSpanTimes(node) {
			const ts = node.record.timestampMs;
			if (ts !== null) {
				if (minTimestamp === null || ts < minTimestamp) {
					minTimestamp = ts;
				}
			}

			const end = node.endTime;
			if (end !== null) {
				if (maxEndTime === null || end > maxEndTime) {
					maxEndTime = end;
				}
			}

			for (let i = 0; i < node.children.length; i++) {
				collectSpanTimes(node.children[i]);
			}
		}
	}

	/**
	 * Рассчитывает X-координату и ширину для записи на временной шкале.
	 *
	 * @param {number|null} timestampMs - Время начала записи
	 * @param {number|null} endTime - Время окончания записи
	 * @param {number} timelineStart - Начало временной шкалы
	 * @param {number} timelineEnd - Конец временной шкалы
	 * @param {number} timelineWidth - Ширина шкалы в пикселях
	 * @param {number} minBarWidth - Минимальная ширина бара
	 * @returns {{ x: number, width: number }}
	 * @private
	 */
	#calculateXAndWidth(
		timestampMs,
		endTime,
		timelineStart,
		timelineEnd,
		timelineWidth,
		minBarWidth,
	) {
		const timelineRange = timelineEnd - timelineStart;

		// Краевой случай: timestampMs === null → размещаем в начале шкалы
		if (timestampMs === null) {
			return { x: 0, width: minBarWidth };
		}

		// Расчёт X-координаты
		const x =
			((timestampMs - timelineStart) / timelineRange) * timelineWidth;

		// Расчёт ширины
		let width;
		if (endTime === null) {
			// Нет информации о длительности → минимальная ширина
			width = minBarWidth;
		} else {
			width = Math.max(
				minBarWidth,
				((endTime - timestampMs) / timelineRange) * timelineWidth,
			);
		}

		return { x: x, width: width };
	}

	/**
	 * Выполняет DFS-обход дерева спанов и рассчитывает Y-координаты.
	 * Каждый узел получает новую строку. Дети располагаются сразу после родителя.
	 *
	 * @param {SpanNode[]} roots - Корневые узлы
	 * @param {number} timelineStart - Начало временной шкалы
	 * @param {number} timelineEnd - Конец временной шкалы
	 * @param {number} timelineWidth - Ширина шкалы в пикселях
	 * @param {number} minBarWidth - Минимальная ширина бара
	 * @param {number} indentWidth - Ширина отступа на уровень вложенности
	 * @param {number} startY - Начальная Y-координата
	 * @returns {LayoutItem[]} Массив элементов лейаута для спанов
	 * @private
	 */
	#layoutSpanTree(
		roots,
		timelineStart,
		timelineEnd,
		timelineWidth,
		minBarWidth,
		indentWidth,
		startY,
	) {
		/** @type {LayoutItem[]} */
		const items = [];

		/**
		 * Рекурсивный DFS-обход.
		 *
		 * @param {SpanNode} node - Текущий узел
		 * @param {number} y - Y-координата текущего узла
		 * @returns {number} Следующая свободная Y-координата после обработки поддерева
		 */
		const dfs = (node, y) => {
			const { x, width } = this.#calculateXAndWidth(
				node.record.timestampMs,
				node.endTime,
				timelineStart,
				timelineEnd,
				timelineWidth,
				minBarWidth,
			);

			// Отступ по X на глубину вложенности (визуальный сдвиг)
			const offsetX = x + node.depth * indentWidth;

			items.push({
				id: node.spanId,
				type: 'span',
				x: offsetX,
				y: y,
				width: width,
				depth: node.depth,
				record: node.record,
				parentSpanId: node.parentId,
				isOrphan: false,
			});

			// Следующая строка после текущего узла
			let nextY = y + 1;

			// Обрабатываем детей — каждый на новой строке
			for (let i = 0; i < node.children.length; i++) {
				nextY = dfs(node.children[i], nextY);
			}

			return nextY;
		};

		let currentY = startY;
		for (let i = 0; i < roots.length; i++) {
			currentY = dfs(roots[i], currentY);
		}

		return items;
	}

	/**
	 * Создаёт LayoutItem для orphan-записи в Flat режиме (хронологический порядок).
	 *
	 * @param {NormalizedRecord} record - Orphan-запись
	 * @param {number} index - Индекс orphan-записи
	 * @param {number} y - Y-координата
	 * @param {number} timelineStart - Начало временной шкалы
	 * @param {number} timelineEnd - Конец временной шкалы
	 * @param {number} timelineWidth - Ширина шкалы в пикселях
	 * @param {number} minBarWidth - Минимальная ширина бара
	 * @returns {LayoutItem}
	 * @private
	 */
	#createFlatOrphanItem(
		record,
		index,
		y,
		timelineStart,
		timelineEnd,
		timelineWidth,
		minBarWidth,
	) {
		const endTime =
			record.timestampMs !== null && record.durationMs !== null
				? record.timestampMs + record.durationMs
				: null;

		const { x, width } = this.#calculateXAndWidth(
			record.timestampMs,
			endTime,
			timelineStart,
			timelineEnd,
			timelineWidth,
			minBarWidth,
		);

		return {
			id: 'orphan-' + index,
			type: 'orphan',
			x: x,
			y: y,
			width: width,
			depth: 0,
			record: record,
			parentSpanId: null,
			isOrphan: true,
		};
	}

	/**
	 * Находит наиболее подходящий спан для встраивания orphan-записи.
	 *
	 * @param {number|null} orphanTimestamp - timestampMs orphan-записи
	 * @param {LayoutItem[]} spanItems - Массив уже рассчитанных элементов спанов
	 * @returns {LayoutItem|null} Родительский спан или null, если спанов нет
	 * @private
	 */
	#findParentSpan(orphanTimestamp, spanItems) {
		if (spanItems.length === 0) {
			return null;
		}

		// Если timestampMs === null, orphan не может быть встроен
		if (orphanTimestamp === null) {
			return null;
		}

		/** @type {LayoutItem|null} */
		let bestParent = null;
		/** @type {LayoutItem|null} */
		let closestParent = null;

		for (let i = 0; i < spanItems.length; i++) {
			const span = spanItems[i];
			const record = span.record;
			const startTime = record.timestampMs;
			const endTime =
				startTime !== null && record.durationMs !== null
					? startTime + record.durationMs
					: null;

			// Шаг 1: Проверка покрытия интервала
			if (
				startTime !== null &&
				endTime !== null &&
				orphanTimestamp >= startTime &&
				orphanTimestamp <= endTime
			) {
				// Спан покрывает orphan — выбираем наиболее вложенный
				if (
					bestParent === null ||
					span.depth > bestParent.depth ||
					(span.depth === bestParent.depth && span.y > bestParent.y)
				) {
					bestParent = span;
				}
			}

			// Шаг 3: Хронологически ближайший спан (startTime ≤ orphanTimestamp)
			if (
				startTime !== null &&
				startTime <= orphanTimestamp &&
				(closestParent === null ||
					startTime > closestParent.record.timestampMs ||
					(startTime === closestParent.record.timestampMs &&
						span.y > closestParent.y))
			) {
				closestParent = span;
			}
		}

		// Шаг 2: Если есть покрывающий спан — возвращаем его
		if (bestParent !== null) {
			return bestParent;
		}

		// Шаг 3: Если нет покрывающего — возвращаем хронологически ближайший
		if (closestParent !== null) {
			return closestParent;
		}

		// Если ни один спан не подошёл — orphan на отдельной строке
		return null;
	}

	/**
	 * Рассчитывает Y-координату для orphan-записи, встроенной в родительский спан.
	 *
	 * @param {LayoutItem} parentSpan - Родительский спан
	 * @param {LayoutItem[]} allSpanItems - Все элементы спанов
	 * @returns {number} Y-координата для orphan
	 * @private
	 */
	#calculateOrphanY(parentSpan, allSpanItems) {
		// Находим максимальную Y среди всех потомков родительского спана
		let maxChildY = parentSpan.y;

		for (let i = 0; i < allSpanItems.length; i++) {
			const item = allSpanItems[i];
			// Ищем элементы, которые являются потомками родительского спана
			// (начинаются с parentSpan.y + 1 и имеют depth > parentSpan.depth)
			if (
				item.y > parentSpan.y &&
				item.depth > parentSpan.depth &&
				this.#isDescendantOf(item, parentSpan, allSpanItems)
			) {
				if (item.y > maxChildY) {
					maxChildY = item.y;
				}
			}
		}

		return maxChildY + 1;
	}

	/**
	 * Проверяет, является ли элемент потомком указанного родителя.
	 *
	 * @param {LayoutItem} item - Проверяемый элемент
	 * @param {LayoutItem} potentialParent - Потенциальный родитель
	 * @param {LayoutItem[]} allItems - Все элементы для поиска по parentSpanId
	 * @returns {boolean}
	 * @private
	 */
	#isDescendantOf(item, potentialParent, allItems) {
		if (item.parentSpanId === null) {
			return false;
		}

		if (item.parentSpanId === potentialParent.id) {
			return true;
		}

		// Ищем родителя элемента в массиве и проверяем рекурсивно
		for (let i = 0; i < allItems.length; i++) {
			if (allItems[i].id === item.parentSpanId) {
				return this.#isDescendantOf(
					allItems[i],
					potentialParent,
					allItems,
				);
			}
		}

		return false;
	}

	/**
	 * Создаёт LayoutItem для orphan-записи, встроенной в родительский спан.
	 *
	 * @param {NormalizedRecord} record - Orphan-запись
	 * @param {number} index - Индекс orphan-записи
	 * @param {LayoutItem} parentSpan - Родительский спан
	 * @param {number} y - Y-координата
	 * @param {number} timelineStart - Начало временной шкалы
	 * @param {number} timelineEnd - Конец временной шкалы
	 * @param {number} timelineWidth - Ширина шкалы в пикселях
	 * @param {number} minBarWidth - Минимальная ширина бара
	 * @param {number} indentWidth - Ширина отступа
	 * @returns {LayoutItem}
	 * @private
	 */
	#createEmbeddedOrphanItem(
		record,
		index,
		parentSpan,
		y,
		timelineStart,
		timelineEnd,
		timelineWidth,
		minBarWidth,
		indentWidth,
	) {
		const orphanTimestamp = record.timestampMs;
		const parentEndTime =
			parentSpan.record.timestampMs !== null &&
			parentSpan.record.durationMs !== null
				? parentSpan.record.timestampMs + parentSpan.record.durationMs
				: null;

		// X = X спана + отступ (indentWidth)
		const baseX =
			orphanTimestamp !== null
				? ((orphanTimestamp - timelineStart) /
						(timelineEnd - timelineStart)) *
					timelineWidth
				: 0;

		const x = baseX + indentWidth;

		// Ширина: от timestamp orphan до endTime родителя (или minBarWidth)
		let width;
		if (parentEndTime !== null && orphanTimestamp !== null) {
			width = Math.max(
				minBarWidth,
				((parentEndTime - orphanTimestamp) /
					(timelineEnd - timelineStart)) *
					timelineWidth,
			);
		} else {
			width = minBarWidth;
		}

		return {
			id: 'orphan-' + index,
			type: 'orphan',
			x: x,
			y: y,
			width: width,
			depth: parentSpan.depth + 1,
			record: record,
			parentSpanId: parentSpan.id,
			isOrphan: true,
		};
	}
}

export { HybridLayoutEngine };
