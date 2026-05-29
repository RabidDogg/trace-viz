/**
 * @fileoverview
 * SpanHierarchyBuilder — построение иерархического дерева спанов.
 *
 * Принимает массив нормализованных записей одного трейса и строит
 * дерево спанов на основе parentId. Записи без spanId игнорируются
 * (orphan-записи, обрабатываются в HybridLayoutEngine).
 *
 * Чистая функция, zero dependencies.
 */

'use strict';

/**
 * @typedef {import('../parser/DataNormalizer.js').NormalizedRecord} NormalizedRecord
 */

/**
 * Узел дерева спанов.
 *
 * @typedef {Object} SpanNode
 * @property {string} spanId - Идентификатор спана
 * @property {string|null} parentId - Идентификатор родителя (null для корня)
 * @property {NormalizedRecord} record - Нормализованная запись
 * @property {number|null} startTime - Время начала спана (timestampMs)
 * @property {number|null} endTime - Время окончания спана (startTime + durationMs)
 * @property {SpanNode[]} children - Дочерние спаны
 * @property {number} depth - Глубина вложенности (0 для корня)
 */

/**
 * Результат построения иерархии.
 *
 * @typedef {Object} HierarchyResult
 * @property {SpanNode[]} roots - Массив корневых спанов (parentId === null)
 * @property {Map<string, SpanNode>} nodeMap - Карта "spanId → SpanNode" для быстрого доступа
 * @property {number} maxDepth - Максимальная глубина дерева
 */

/**
 * Создаёт узел SpanNode из нормализованной записи.
 *
 * @param {NormalizedRecord} record - Нормализованная запись
 * @returns {SpanNode} Созданный узел
 * @private
 */
function createSpanNode(record) {
	const spanId = /** @type {string} */ (record.spanId);
	const parentId = record.parentId;
	const startTime = record.timestampMs;
	const endTime =
		startTime !== null && record.durationMs !== null
			? startTime + record.durationMs
			: null;

	return {
		spanId: spanId,
		parentId: parentId,
		record: record,
		startTime: startTime,
		endTime: endTime,
		children: [],
		depth: 0,
	};
}

/**
 * Рекурсивно рассчитывает глубину для узла и всех его потомков.
 *
 * @param {SpanNode} node - Узел, для которого рассчитывается глубина
 * @param {number} depth - Текущая глубина
 * @returns {number} Максимальная глубина в поддереве
 * @private
 */
function calculateDepth(node, depth) {
	node.depth = depth;

	let maxChildDepth = depth;
	for (let i = 0; i < node.children.length; i++) {
		const childDepth = calculateDepth(node.children[i], depth + 1);
		if (childDepth > maxChildDepth) {
			maxChildDepth = childDepth;
		}
	}

	return maxChildDepth;
}

/**
 * Сортирует детей каждого узла по startTime (возрастание).
 * Дети с null startTime помещаются в конец.
 *
 * @param {SpanNode} node - Узел, детей которого нужно отсортировать
 * @private
 */
function sortChildrenByStartTime(node) {
	node.children.sort(function (a, b) {
		// null startTime — в конец
		if (a.startTime === null && b.startTime === null) return 0;
		if (a.startTime === null) return 1;
		if (b.startTime === null) return -1;
		return a.startTime - b.startTime;
	});

	// Рекурсивно сортируем детей каждого потомка
	for (let i = 0; i < node.children.length; i++) {
		sortChildrenByStartTime(node.children[i]);
	}
}

/**
 * Строит иерархическое дерево спанов из массива нормализованных записей.
 *
 * Алгоритм:
 * 1. Фильтрация записей с spanId (без spanId — orphan-записи)
 * 2. Создание SpanNode для каждой записи
 * 3. Построение nodeMap (Map<spanId, SpanNode>)
 * 4. Для каждого узла: поиск родителя по parentId в nodeMap
 * 5. Если parentId === null — узел становится корневым
 * 6. Если parentId указан, но не найден — узел становится корневым (сломанная ссылка)
 * 7. Защита от циклических ссылок: если parentId уже встречался в цепочке
 * 8. Расчёт startTime, endTime, depth
 * 9. Сортировка детей по startTime
 *
 * Чистая функция: не мутирует входной массив, не имеет побочных эффектов.
 *
 * @param {NormalizedRecord[]} records - Массив нормализованных записей одного трейса
 * @returns {HierarchyResult} Объект с полями roots, nodeMap, maxDepth
 *
 * @example
 * // Пустой массив
 * const result = buildSpanHierarchy([]);
 * // → { roots: [], nodeMap: Map{}, maxDepth: 0 }
 *
 * @example
 * // Одна корневая запись
 * const result = buildSpanHierarchy([
 *   { spanId: 'A', parentId: null, timestampMs: 1000, durationMs: 500, ... }
 * ]);
 * // → roots: [SpanNode{spanId:'A', depth:0, children:[]}]
 *
 * @example
 * // Два спана: A (корень) → B (потомок)
 * const result = buildSpanHierarchy([
 *   { spanId: 'A', parentId: null, timestampMs: 1000, durationMs: 500, ... },
 *   { spanId: 'B', parentId: 'A', timestampMs: 1100, durationMs: 200, ... }
 * ]);
 * // → A.depth === 0, B.depth === 1, A.children === [B]
 */
export function buildSpanHierarchy(records) {
	// Краевой случай: пустой массив
	if (!Array.isArray(records) || records.length === 0) {
		return {
			roots: [],
			nodeMap: new Map(),
			maxDepth: 0,
		};
	}

	// Шаг 1: Фильтрация записей с spanId
	/** @type {NormalizedRecord[]} */
	const recordsWithSpanId = [];
	for (let i = 0; i < records.length; i++) {
		const record = records[i];
		if (record && record.spanId !== null && record.spanId !== undefined) {
			recordsWithSpanId.push(record);
		}
	}

	// Краевой случай: ни одна запись не имеет spanId
	if (recordsWithSpanId.length === 0) {
		return {
			roots: [],
			nodeMap: new Map(),
			maxDepth: 0,
		};
	}

	// Шаг 2: Создание узлов и построение nodeMap
	/** @type {Map<string, SpanNode>} */
	const nodeMap = new Map();

	for (let i = 0; i < recordsWithSpanId.length; i++) {
		const record = recordsWithSpanId[i];
		const node = createSpanNode(record);
		nodeMap.set(node.spanId, node);
	}

	// Шаг 3: Построение иерархии
	// Множество для обнаружения циклических ссылок
	// Хранит spanId узлов, которые уже были обработаны как чьи-то родители
	/** @type {Set<string>} */
	const processedAsChild = new Set();

	/** @type {SpanNode[]} */
	const roots = [];

	// Проходим по всем узлам и устанавливаем родительские связи
	for (const node of nodeMap.values()) {
		const parentId = node.parentId;

		// Случай 1: parentId === null — корневой узел
		if (parentId === null) {
			roots.push(node);
			continue;
		}

		// Случай 2: parentId указан, ищем родителя в nodeMap
		const parent = nodeMap.get(parentId);

		if (parent) {
			// Защита от циклических ссылок:
			// Если parentId уже встречался как дочерний по отношению к текущему узлу,
			// это означает цикл A→B→A. В этом случае узел становится корнем.
			if (
				processedAsChild.has(node.spanId) &&
				processedAsChild.has(parentId)
			) {
				// Циклическая ссылка: узел становится корневым
				roots.push(node);
				continue;
			}

			// Нормальный случай: добавляем узел как потомка родителя
			parent.children.push(node);
			processedAsChild.add(node.spanId);
		} else {
			// Случай 3: parentId указан, но родитель не найден — сломанная ссылка
			// Узел становится корневым
			roots.push(node);
		}
	}

	// Шаг 4: Расчёт глубины для каждого корневого поддерева
	let maxDepth = 0;
	for (let i = 0; i < roots.length; i++) {
		const subtreeDepth = calculateDepth(roots[i], 0);
		if (subtreeDepth > maxDepth) {
			maxDepth = subtreeDepth;
		}
	}

	// Шаг 5: Сортировка детей каждого узла по startTime
	for (let i = 0; i < roots.length; i++) {
		sortChildrenByStartTime(roots[i]);
	}

	// Шаг 6: Сортировка корневых узлов по startTime
	roots.sort(function (a, b) {
		if (a.startTime === null && b.startTime === null) return 0;
		if (a.startTime === null) return 1;
		if (b.startTime === null) return -1;
		return a.startTime - b.startTime;
	});

	return {
		roots: roots,
		nodeMap: nodeMap,
		maxDepth: maxDepth,
	};
}
