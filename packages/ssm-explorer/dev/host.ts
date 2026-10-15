/** Synthetic Power BI host for the actual Visual browser harness and DOM tests.
 * Records model identities rather than claiming to verify the Power BI host.
 */
import type powerbi from 'powerbi-visuals-api';

export interface HarnessDownload {
    method: 'exportVisualsContent' | 'exportVisualsContentExtended';
    content: string;
    fileName: string;
    fileType: string;
    fileDescription: string;
    downloadCompleted: boolean;
    browserDownload: boolean;
    error?: string;
}

export interface HarnessHostOptions {
    downloadStatus?: powerbi.PrivilegeStatus;
    /** Only the dev preview enables this. DOM tests capture content without files. */
    browserDownloads?: boolean | (() => boolean);
    onDownload?: (download: HarnessDownload) => void;
}

export function createHarnessHost(highContrast = false, onPersist?: (value: any) => void, options: HarnessHostOptions = {}) {
    const calls = {
        selections: [] as Array<{ keys: string[]; multiSelect: boolean }>,
        contexts: [] as Array<{ key: string; position: { x: number; y: number } }>,
        persisted: [] as unknown[],
        renderFailures: [] as unknown[],
        fetches: 0,
        downloads: [] as HarnessDownload[],
        downloadStatusChecks: 0,
    };
    let downloadStatus = options.downloadStatus ?? 0 as powerbi.PrivilegeStatus;
    const exportContent = async (method: HarnessDownload['method'], content: string, fileName: string, fileType: string, fileDescription: string) => {
        const download: HarnessDownload = { method, content, fileName, fileType, fileDescription, downloadCompleted: downloadStatus === 0, browserDownload: false };
        const browserEnabled = typeof options.browserDownloads === 'function' ? options.browserDownloads() : options.browserDownloads;
        if (download.downloadCompleted && browserEnabled) {
            try {
                const mime = fileName.toLowerCase().endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    : fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf'
                    : fileName.toLowerCase().endsWith('.csv') ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8';
                const payload = fileType === 'base64' ? Uint8Array.from(atob(content), character => character.charCodeAt(0)) : content;
                const url = URL.createObjectURL(new Blob([payload], { type: mime }));
                const anchor = document.createElement('a');
                anchor.href = url; anchor.download = fileName; anchor.hidden = true;
                document.body.append(anchor); anchor.click(); anchor.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                download.browserDownload = true;
            } catch (error) { download.downloadCompleted = false; download.error = String(error); }
        }
        calls.downloads.push(download); options.onDownload?.(download);
        return download;
    };
    // SDK 5.3 declares its legacy IPromise; this synthetic host uses native
    // Promises while preserving every SDK argument and resolved-result shape.
    const downloadService = {
        exportStatus: () => { calls.downloadStatusChecks++; return Promise.resolve(downloadStatus); },
        exportVisualsContent: async (...args: Parameters<powerbi.extensibility.IDownloadService['exportVisualsContent']>) => (await exportContent('exportVisualsContent', ...args)).downloadCompleted,
        exportVisualsContentExtended: async (...args: Parameters<powerbi.extensibility.IDownloadService['exportVisualsContentExtended']>) => {
            const result = await exportContent('exportVisualsContentExtended', ...args);
            return { downloadCompleted: result.downloadCompleted, ...(result.downloadCompleted ? { fileName: result.fileName } : {}) };
        },
    };
    let selected: any[] = [];
    let selectCallback: ((ids: any[]) => void) | undefined;
    const selectionManager = {
        select: (ids: any | any[], multiSelect = false) => {
            const incoming = Array.isArray(ids) ? ids : [ids];
            selected = multiSelect ? [...selected, ...incoming] : incoming;
            calls.selections.push({ keys: incoming.map(id => id.getKey()), multiSelect });
            selectCallback?.(selected);
            return Promise.resolve(selected);
        },
        clear: () => { selected = []; selectCallback?.([]); return Promise.resolve([]); },
        getSelectionIds: () => selected,
        hasSelection: () => selected.length > 0,
        containsSelection: (id: any) => selected.some(value => value.equals(id)),
        registerOnSelectCallback: (callback: (ids: any[]) => void) => { selectCallback = callback; },
        showContextMenu: (id: any, position: { x: number; y: number }) => {
            calls.contexts.push({ key: id.getKey(), position });
            return Promise.resolve();
        },
        applySelectionFilter: () => {},
    };
    const host = {
        createSelectionManager: () => selectionManager,
        createSelectionIdBuilder: () => {
            const parts: string[] = [];
            const builder: any = {
                withTable: (table: any, index: number) => {
                    parts.push(`table:${table.identity?.[index]?.key ?? index}`);
                    return builder;
                },
                withCategory: (category: any, index: number) => {
                    parts.push(`${category.source.queryName}:${category.identity?.[index]?.key ?? index}`);
                    return builder;
                },
                withMeasure: (measure: string) => { parts.push(`measure:${measure}`); return builder; },
                createSelectionId: () => {
                    const key = parts.join('|');
                    return {
                        getKey: () => key,
                        getSelector: () => ({ data: [{ key }] }),
                        getSelectorsByColumn: () => ({ dataMap: { key } }),
                        hasIdentity: () => parts.length > 0,
                        equals: (other: any) => other?.getKey?.() === key,
                        includes: (other: any) => other?.getKey?.() === key,
                    };
                },
            };
            return builder;
        },
        colorPalette: {
            isHighContrast: highContrast,
            foreground: { value: highContrast ? '#FFFF00' : '#243b45' },
            foregroundSelected: { value: highContrast ? '#00FFFF' : '#007d89' },
            foregroundNeutral: { value: highContrast ? '#FFFF00' : '#61747b' },
            background: { value: highContrast ? '#000000' : '#FFFFFF' },
            hyperlink: { value: '#00FFFF' },
            getColor: () => ({ value: '#007d89' }),
        },
        eventService: {
            renderingStarted: () => {}, renderingFinished: () => {},
            renderingFailed: (error: unknown) => calls.renderFailures.push(error),
        },
        tooltipService: { show: () => {}, move: () => {}, hide: () => {}, enabled: () => true },
        createLocalizationManager: () => ({ getDisplayName: (key: string) => key }),
        persistProperties: (value: unknown) => { calls.persisted.push(value); onPersist?.(value); },
        fetchMoreData: () => { calls.fetches++; return false; },
        hostCapabilities: { allowInteractions: true },
        downloadService,
        locale: 'en-US', instanceId: 'synthetic-ssm-harness',
        storageService: { get: () => Promise.resolve(null), set: () => Promise.resolve() },
        telemetry: { trace: () => {} },
        launchUrl: () => {}, applyJsonFilter: () => {}, refreshHostData: () => {},
        displayWarningIcon: () => {},
    };
    return { host, calls, selectionManager, setDownloadStatus: (status: powerbi.PrivilegeStatus) => { downloadStatus = status; } };
}
