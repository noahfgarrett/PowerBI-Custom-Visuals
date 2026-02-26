/**
 * Number formatting utilities.
 * Locale-aware, smart abbreviation, prefix/suffix support.
 */

export interface FormatOptions {
  /** Locale string (e.g., 'en-US'). Default: browser locale. */
  locale?: string;
  /** Number of decimal places. Default: auto (0 for integers, 1 for abbreviated). */
  decimals?: number;
  /** Prefix string (e.g., '$'). */
  prefix?: string;
  /** Suffix string (e.g., '%'). */
  suffix?: string;
  /** Whether to abbreviate large numbers (1.2K, 3.4M, etc.). Default: true. */
  abbreviate?: boolean;
  /** Fallback string for null/undefined/NaN. Default: '--'. */
  fallback?: string;
  /** Force sign display (+/-). Default: false. */
  showSign?: boolean;
}

interface AbbreviationTier {
  threshold: number;
  divisor: number;
  suffix: string;
}

const ABBREVIATION_TIERS: AbbreviationTier[] = [
  { threshold: 1_000_000_000_000, divisor: 1_000_000_000_000, suffix: 'T' },
  { threshold: 1_000_000_000, divisor: 1_000_000_000, suffix: 'B' },
  { threshold: 1_000_000, divisor: 1_000_000, suffix: 'M' },
  { threshold: 1_000, divisor: 1_000, suffix: 'K' },
];

/**
 * Formats a number with smart abbreviation, locale, prefix/suffix.
 *
 * Examples:
 *   formatNumber(1234567)          → "1.2M"
 *   formatNumber(0.953, { suffix: '%', decimals: 1 }) → "0.9%"
 *   formatNumber(null)             → "--"
 *   formatNumber(42000, { prefix: '$' }) → "$42K"
 */
export function formatNumber(
  value: number | null | undefined,
  options: FormatOptions = {}
): string {
  const {
    locale,
    decimals,
    prefix = '',
    suffix = '',
    abbreviate = true,
    fallback = '--',
    showSign = false,
  } = options;

  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }

  const absValue = Math.abs(value);
  let displayValue = value;
  let abbrevSuffix = '';

  // Apply abbreviation
  if (abbreviate) {
    for (const tier of ABBREVIATION_TIERS) {
      if (absValue >= tier.threshold) {
        displayValue = value / tier.divisor;
        abbrevSuffix = tier.suffix;
        break;
      }
    }
  }

  // Determine decimal places
  let decimalPlaces: number;
  if (decimals !== undefined) {
    decimalPlaces = decimals;
  } else if (abbrevSuffix) {
    decimalPlaces = 1; // abbreviated: 1.2K, 3.4M
  } else if (Number.isInteger(displayValue)) {
    decimalPlaces = 0;
  } else {
    decimalPlaces = 2;
  }

  // Format with locale
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
    signDisplay: showSign ? 'exceptZero' : 'auto',
  }).format(displayValue);

  return `${prefix}${formatted}${abbrevSuffix}${suffix}`;
}

/**
 * Formats a percentage value (0–1 or 0–100 scale).
 * Auto-detects scale: values > 1 are treated as already in percent form.
 */
export function formatPercent(
  value: number | null | undefined,
  options: Omit<FormatOptions, 'suffix'> = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return options.fallback ?? '--';
  }

  // Auto-detect: if value <= 1 and > 0, assume it's a 0–1 ratio
  const pctValue = Math.abs(value) <= 1 && value !== 0 ? value * 100 : value;

  return formatNumber(pctValue, {
    ...options,
    suffix: '%',
    abbreviate: false,
    decimals: options.decimals ?? 1,
  });
}

/**
 * Formats a currency value.
 */
export function formatCurrency(
  value: number | null | undefined,
  currencySymbol: string = '$',
  options: Omit<FormatOptions, 'prefix'> = {}
): string {
  return formatNumber(value, {
    ...options,
    prefix: currencySymbol,
    decimals: options.decimals ?? (Math.abs(value ?? 0) >= 1000 ? 0 : 2),
  });
}
