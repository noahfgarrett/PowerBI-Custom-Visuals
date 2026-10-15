import powerbi from 'powerbi-visuals-api';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';

import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ILocalizationManager = powerbi.extensibility.ILocalizationManager;

export function createLocalizationManager(host: IVisualHost): ILocalizationManager | undefined {
  return host.createLocalizationManager?.();
}

export function createLocalizedFormattingSettingsService(host: IVisualHost): FormattingSettingsService {
  return new FormattingSettingsService(createLocalizationManager(host));
}

export function getLocalizedString(
  hostOrManager: IVisualHost | ILocalizationManager | undefined,
  key: string,
  fallback: string,
): string {
  const manager = resolveLocalizationManager(hostOrManager);
  const localized = manager?.getDisplayName(key);
  if (!localized || localized === key) {
    return fallback;
  }
  return localized;
}

function resolveLocalizationManager(
  hostOrManager: IVisualHost | ILocalizationManager | undefined,
): ILocalizationManager | undefined {
  if (!hostOrManager) return undefined;
  if ('getDisplayName' in hostOrManager && typeof hostOrManager.getDisplayName === 'function') {
    return hostOrManager;
  }
  if ('createLocalizationManager' in hostOrManager && typeof hostOrManager.createLocalizationManager === 'function') {
    return hostOrManager.createLocalizationManager();
  }
  return undefined;
}
