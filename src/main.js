/**
 * @fileoverview
 * Точка входа приложения Trace Viz.
 * Реализует полный пайплайн:
 *   1. FileReader → onDataLoaded(rawData)
 *   2. OpenSourceExtractor.extract(rawData) → sources[]
 *   3. new DataNormalizer(fieldMapping).normalize(sources) → NormalizedRecord[]
 *   4. TraceGrouper.group(records) → { traces, uncategorized }
 *   5. Для каждого трейса: TraceClassifier.classify(traceId, records) → { traceId, mode, records }
 *   6. Для каждого трейса: new SpanHierarchyBuilder().build(records) → hierarchy
 *   7. Для каждого трейса: new HybridLayoutEngine(config).calculate(hierarchy, orphanRecords) → layoutItems
 *   8. Для каждого трейса: TimelineCalculator.calculate(layoutItems) → timelineScale
 *   9. RenderEngine.init() + TimelineAxis.render() + SpanBarsRenderer.render()
 *   10. TraceListView.render() + RawLogViewer.render()
 *
 * Логика переключения трейсов:
 *   - При выборе трейса из списка: очистка, загрузка layout, обновление оси, рендер баров
 *   - При клике на спан: показ DetailPanel, подсветка спана
 *
 * Статус-баннер: отображает текущий статус приложения.
 */

'use strict';

import { Logger } from './utils/Logger.js';
import { FileReader } from './io/FileReader.js';
import { OpenSourceExtractor } from './parser/OpenSourceExtractor.js';
import { DataNormalizer } from './parser/DataNormalizer.js';
import { TraceGrouper } from './processor/TraceGrouper.js';
import { TraceClassifier } from './processor/TraceClassifier.js';
import { SpanHierarchyBuilder } from './processor/SpanHierarchyBuilder.js';
import { HybridLayoutEngine } from './processor/HybridLayoutEngine.js';
import { TimelineCalculator } from './processor/TimelineCalculator.js';
import { RenderEngine } from './renderer/Engine.js';
import { TimelineAxis } from './renderer/Axis.js';
import { SpanBarsRenderer } from './renderer/SpanBars.js';
import { RawLogViewer } from './ui/RawLogViewer.js';
import { TraceListView } from './ui/TraceList.js';
import { DetailPanel } from './ui/DetailPanel.js';
import { StatusBanner } from './ui/StatusBanner.js';
import { FIELD_MAPPING } from './config/field-mapping.js';
import { LAYOUT_CONFIG } from './config/app.js';

/**
 * Глобальное состояние приложения.
 * @type {Object}
 * @private
 */
const APP_STATE = {
	/** @type {import('./processor/TraceClassifier.js').ClassifiedTrace[]} */
	classifiedTraces: [],
	/** @type {Object<string, Object>} */
	traceLayouts: {},
	/** @type {Object<string, import('./processor/TimelineCalculator.js').TimelineScale>} */
	traceScales: {},
	/** @type {string|null} */
	activeTraceId: null,
	/** @type {import('./renderer/Engine.js').RenderEngine|null} */
	engine: null,
	/** @type {import('./renderer/Axis.js').TimelineAxis|null} */
	axis: null,
	/** @type {import('./renderer/SpanBars.js').SpanBarsRenderer|null} */
	spanBars: null,
	/** @type {import('./ui/TraceList.js').TraceListView|null} */
	traceList: null,
	/** @type {import('./ui/DetailPanel.js').DetailPanel|null} */
	detailPanel: null,
	/** @type {import('./ui/StatusBanner.js').StatusBanner|null} */
	statusBanner: null,
};

/**
 * Этап парсинга: извлекает источники из структуры данных и нормализует их.
 *
 * @param {Object} data - сырые данные из FileReader
 * @returns {Object} распарсенные данные с полями sources (нормализованные записи) и raw (исходные)
 */
function parseData(data) {
	Logger.info('Main', 'parseData: запуск пайплайна парсинга');

	const sources = OpenSourceExtractor.extract(data);
	Logger.info(
		'Main',
		'parseData: извлечено ' + sources.length + ' источников',
	);

	const normalizer = new DataNormalizer(FIELD_MAPPING);
	const normalized = normalizer.normalize(sources);
	Logger.info(
		'Main',
		'parseData: нормализовано ' + normalized.length + ' записей',
	);

	// Сохраняем в window.__APP_DATA__ для отладки
	if (typeof window !== 'undefined') {
		window.__APP_DATA__ = {
			raw: data,
			sources: sources,
			normalized: normalized,
		};
	}

	// Логируем ошибки парсинга
	let errorCount = 0;
	for (let i = 0; i < normalized.length; i++) {
		if (normalized[i].isError) {
			errorCount++;
		}
	}
	if (errorCount > 0) {
		Logger.warn(
			'Main',
			'parseData: обнаружено ' + errorCount + ' записей с ошибками',
		);
	}

	return {
		normalized: normalized,
		raw: data,
	};
}

/**
 * Этап обработки: группировка по TraceId и классификация трейсов.
 *
 * @param {Object} parsedData - Данные после этапа парсинга
 * @param {Array} parsedData.normalized - Нормализованные записи
 * @param {Object} parsedData.raw - Сырые данные
 * @returns {Object} Обработанные данные с полями:
 *   - classifiedTraces: ClassifiedTrace[]
 *   - uncategorized: NormalizedRecord[]
 *   - raw: Object
 */
function processData(parsedData) {
	Logger.info('Main', 'processData: запуск группировки и классификации');

	const normalized = parsedData.normalized;

	if (!Array.isArray(normalized) || normalized.length === 0) {
		Logger.warn('Main', 'processData: нет записей для обработки');
		return {
			classifiedTraces: [],
			uncategorized: [],
			raw: parsedData.raw,
		};
	}

	// 1. Группировка по TraceId
	const grouped = TraceGrouper.group(normalized);
	const traces = grouped.traces;
	const uncategorized = grouped.uncategorized;
	Logger.info(
		'Main',
		'processData: сгруппировано ' +
			String(traces.size) +
			' трейсов, ' +
			String(uncategorized.length) +
			' некатегоризированных записей',
	);

	// 2. Классификация каждого трейса
	/** @type {import('./processor/TraceClassifier.js').ClassifiedTrace[]} */
	const classifiedTraces = [];

	traces.forEach(function (records, traceId) {
		const classified = TraceClassifier.classify(traceId, records);
		classifiedTraces.push(classified);
		Logger.debug(
			'Main',
			'processData: трейс ' +
				traceId +
				' классифицирован как ' +
				classified.mode,
		);
	});

	// 3. Сохраняем в window.__APP_DATA__
	if (typeof window !== 'undefined') {
		window.__APP_DATA__ = {
			raw: parsedData.raw,
			normalized: normalized,
			classifiedTraces: classifiedTraces,
			uncategorized: uncategorized,
		};
	}

	Logger.info(
		'Main',
		'processData: классифицировано ' +
			String(classifiedTraces.length) +
			' трейсов',
	);

	return {
		classifiedTraces: classifiedTraces,
		uncategorized: uncategorized,
		raw: parsedData.raw,
	};
}

/**
 * Рассчитывает layout и timeline для всех трейсов.
 * Сохраняет результаты в APP_STATE для быстрого переключения.
 *
 * @param {import('./processor/TraceClassifier.js').ClassifiedTrace[]} classifiedTraces
 * @param {Array} uncategorized
 */
function precomputeLayouts(classifiedTraces, uncategorized) {
	Logger.info(
		'Main',
		'precomputeLayouts: предрасчёт layout для всех трейсов',
	);

	const config = LAYOUT_CONFIG;

	for (let i = 0; i < classifiedTraces.length; i++) {
		const trace = classifiedTraces[i];
		const traceId = trace.traceId;
		const records = trace.records || [];

		Logger.debug(
			'Main',
			'precomputeLayouts: обработка трейса ' +
				traceId +
				' (' +
				trace.mode +
				')',
		);

		// Строим иерархию спанов
		const hierarchyBuilder = new SpanHierarchyBuilder();
		const hierarchy = hierarchyBuilder.build(records);

		// Orphan-записи — это записи без spanId внутри трейса
		const orphanRecords = [];
		for (let j = 0; j < records.length; j++) {
			if (!records[j].spanId) {
				orphanRecords.push(records[j]);
			}
		}

		// Рассчитываем layout
		const layoutEngine = new HybridLayoutEngine(config);
		const layoutItems = layoutEngine.calculate(hierarchy, orphanRecords);

		// Рассчитываем временную шкалу
		const scale = TimelineCalculator.calculate(layoutItems, config);

		// Сохраняем
		APP_STATE.traceLayouts[traceId] = layoutItems;
		APP_STATE.traceScales[traceId] = scale;

		Logger.debug(
			'Main',
			'precomputeLayouts: трейс ' +
				traceId +
				' — ' +
				layoutItems.length +
				' элементов лейаута',
		);
	}

	Logger.info(
		'Main',
		'precomputeLayouts: предрасчёт завершён для ' +
			classifiedTraces.length +
			' трейсов',
	);
}

/**
 * Отображает визуализацию для указанного трейса.
 *
 * @param {string} traceId - Идентификатор трейса
 */
function renderTrace(traceId) {
	const engine = APP_STATE.engine;
	const axis = APP_STATE.axis;
	const spanBars = APP_STATE.spanBars;

	if (!engine || !axis || !spanBars) {
		Logger.warn(
			'Main',
			'renderTrace: движок рендеринга не инициализирован',
		);
		return;
	}

	const layoutItems = APP_STATE.traceLayouts[traceId];
	const scale = APP_STATE.traceScales[traceId];

	if (!layoutItems || !scale) {
		Logger.warn(
			'Main',
			'renderTrace: layout не найден для трейса ' + traceId,
		);
		return;
	}

	// Очищаем текущую визуализацию
	engine.clear();
	spanBars.clear();

	// Обновляем ось времени
	axis.update(scale);

	// Отрисовываем бары
	spanBars.render(layoutItems, {
		rowHeight: LAYOUT_CONFIG.rowHeight,
		minBarWidth: LAYOUT_CONFIG.minBarWidth,
		onSpanClick: function (spanId) {
			onSpanClick(spanId, traceId);
		},
	});

	// Обновляем активный трейс в списке
	if (APP_STATE.traceList) {
		APP_STATE.traceList.setActive(traceId);
	}

	APP_STATE.activeTraceId = traceId;

	Logger.info('Main', 'renderTrace: отображён трейс ' + traceId);
}

/**
 * Обработчик клика по спану.
 * Показывает DetailPanel и подсвечивает спан.
 *
 * @param {string} spanId - Идентификатор спана
 * @param {string} traceId - Идентификатор трейса
 */
function onSpanClick(spanId, traceId) {
	Logger.debug('Main', 'onSpanClick: клик по спану ' + spanId);

	// Подсвечиваем спан
	const spanBars = APP_STATE.spanBars;
	if (spanBars) {
		spanBars.highlight(spanId);
	}

	// Ищем запись в layoutItems
	const layoutItems = APP_STATE.traceLayouts[traceId];
	if (!layoutItems) {
		return;
	}

	let record = null;
	for (let i = 0; i < layoutItems.length; i++) {
		if (layoutItems[i].id === spanId) {
			record = layoutItems[i].record;
			break;
		}
	}

	if (!record) {
		Logger.warn(
			'Main',
			'onSpanClick: запись не найдена для spanId ' + spanId,
		);
		return;
	}

	// Показываем детали
	const detailPanel = APP_STATE.detailPanel;
	if (detailPanel) {
		detailPanel.show(record);
	}
}

/**
 * Обработчик выбора трейса из списка.
 *
 * @param {string} traceId - Идентификатор трейса
 */
function onTraceSelect(traceId) {
	Logger.info('Main', 'onTraceSelect: выбран трейс ' + traceId);

	// Снимаем подсветку со спанов
	const spanBars = APP_STATE.spanBars;
	if (spanBars) {
		spanBars.unhighlightAll();
	}

	// Скрываем панель деталей
	const detailPanel = APP_STATE.detailPanel;
	if (detailPanel) {
		detailPanel.hide();
	}

	// Отображаем выбранный трейс
	renderTrace(traceId);
}

/**
 * Этап рендеринга: инициализация визуализации и отображение данных.
 *
 * @param {Object} processedData - Данные после этапа обработки
 * @param {import('./processor/TraceClassifier.js').ClassifiedTrace[]} processedData.classifiedTraces
 * @param {Array} processedData.uncategorized
 */
function renderData(processedData) {
	Logger.info('Main', 'renderData: запуск рендеринга');

	const classifiedTraces = processedData.classifiedTraces;
	const uncategorized = processedData.uncategorized;

	// Обновляем статус
	if (APP_STATE.statusBanner) {
		APP_STATE.statusBanner.setStatus(
			'\u041E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0430...',
			'info',
		);
	}

	// Предрасчёт layout для всех трейсов
	precomputeLayouts(classifiedTraces, uncategorized);

	// Инициализация RenderEngine
	const engine = new RenderEngine({
		containerId: 'svg-container',
		width: LAYOUT_CONFIG.timelineWidth,
		height: 600,
		axisHeight: 30,
	});
	engine.init();
	APP_STATE.engine = engine;

	// Инициализация TimelineAxis
	const axis = new TimelineAxis(engine, null);
	APP_STATE.axis = axis;

	// Инициализация SpanBarsRenderer
	const spanBars = new SpanBarsRenderer(engine);
	APP_STATE.spanBars = spanBars;

	// Отображаем список трейсов
	const traceList = APP_STATE.traceList;
	if (traceList) {
		const traceSummaries = [];
		for (let i = 0; i < classifiedTraces.length; i++) {
			const t = classifiedTraces[i];
			traceSummaries.push({
				traceId: t.traceId,
				mode: t.mode,
				recordCount: (t.records && t.records.length) || 0,
			});
		}
		traceList.render(traceSummaries);
	}

	// Отображаем некатегоризированные записи
	const rawLogContainer = document.getElementById('raw-log-container');
	if (rawLogContainer) {
		new RawLogViewer(uncategorized, rawLogContainer);
		Logger.info(
			'Main',
			'renderData: RawLogViewer отображает ' +
				String(uncategorized.length) +
				' некатегоризированных записей',
		);
	} else {
		Logger.warn(
			'Main',
			'renderData: элемент #raw-log-container не найден в DOM',
		);
	}

	// Если есть трейсы — отображаем первый
	if (classifiedTraces.length > 0) {
		const firstTraceId = classifiedTraces[0].traceId;
		renderTrace(firstTraceId);
	}

	// Обновляем статус
	if (APP_STATE.statusBanner) {
		const statusMsg =
			'\u0413\u043E\u0442\u043E\u0432\u043E: ' +
			String(classifiedTraces.length) +
			' \u0442\u0440\u0435\u0439\u0441\u043E\u0432';
		APP_STATE.statusBanner.setStatus(statusMsg, 'success');
	}

	Logger.info('Main', 'renderData: рендеринг завершён');
}

/**
 * Обработчик успешной загрузки данных.
 * Запускает пайплайн: parse → process → render.
 *
 * @param {Object} data
 */
function onDataLoaded(data) {
	Logger.info('Main', 'Данные загружены, запуск пайплайна обработки');
	Logger.debug('Main', 'Сырые данные:', data);

	if (APP_STATE.statusBanner) {
		APP_STATE.statusBanner.setStatus(
			'\u041F\u0430\u0440\u0441\u0438\u043D\u0433...',
			'info',
		);
	}

	try {
		const parsed = parseData(data);

		if (APP_STATE.statusBanner) {
			APP_STATE.statusBanner.setStatus(
				'\u041E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0430...',
				'info',
			);
		}

		const processed = processData(parsed);
		renderData(processed);

		// НФТ 4.1: Очистка raw после завершения пайплайна
		if (typeof window !== 'undefined' && window.__APP_DATA__) {
			window.__APP_DATA__.raw = null;
		}

		Logger.info('Main', 'Пайплайн обработки завершён');
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		Logger.error('Main', 'Ошибка в пайплайне обработки: ' + msg);

		if (APP_STATE.statusBanner) {
			APP_STATE.statusBanner.setStatus(
				'\u041E\u0448\u0438\u0431\u043A\u0430: ' + msg,
				'error',
			);
		}
	}
}

/**
 * Обработчик ошибки загрузки.
 *
 * @param {string} message
 */
function onError(message) {
	Logger.error('Main', 'Ошибка загрузки: ' + message);

	if (APP_STATE.statusBanner) {
		APP_STATE.statusBanner.setStatus(
			'\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438: ' +
				message,
			'error',
		);
	}
}

/**
 * Инициализация приложения.
 * Вызывается после загрузки DOM.
 */
function initApp() {
	Logger.info('Main', 'Trace Viz инициализация...');

	const dropZone = document.getElementById('upload-zone');
	const fileInput = document.getElementById('file-input');
	const statusEl = document.getElementById('upload-status');
	const clearLogsBtn = document.getElementById('clear-logs');
	const logContainer = document.getElementById('log-container');

	if (!dropZone || !fileInput || !statusEl) {
		Logger.error(
			'Main',
			'Критические DOM-элементы не найдены. Инициализация прервана.',
		);
		return;
	}

	// Инициализация глобальных обработчиков ошибок
	Logger.initGlobalHandlers();

	// Инициализация StatusBanner
	const statusBanner = new StatusBanner('status-banner-container');
	APP_STATE.statusBanner = statusBanner;
	statusBanner.setStatus(
		'\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u0444\u0430\u0439\u043B',
		'info',
	);

	// Инициализация TraceListView
	const traceList = new TraceListView('trace-list-container', function (
		traceId,
	) {
		onTraceSelect(traceId);
	});
	APP_STATE.traceList = traceList;

	// Инициализация DetailPanel
	const detailPanel = new DetailPanel('detail-panel-container');
	APP_STATE.detailPanel = detailPanel;

	// Инициализация FileReader
	const fileReader = new FileReader(dropZone, fileInput, statusEl, {
		onDataLoaded: onDataLoaded,
		onError: onError,
	});

	// Очистка логов
	if (clearLogsBtn && logContainer) {
		clearLogsBtn.addEventListener('click', function () {
			while (logContainer.firstChild) {
				logContainer.removeChild(logContainer.firstChild);
			}
			const placeholder = document.createElement('p');
			placeholder.className = 'log-table__placeholder';
			placeholder.textContent = 'Логи будут отображаться здесь';
			logContainer.appendChild(placeholder);
			Logger.info('Main', 'Журнал событий очищен');
		});
	}

	Logger.info('Main', 'Trace Viz инициализирован успешно');
	Logger.info('Main', 'Ожидание загрузки файла...');
}

// Запуск приложения после полной загрузки DOM
document.addEventListener('DOMContentLoaded', initApp);
