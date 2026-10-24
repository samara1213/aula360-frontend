export function inlineScriptHashes(html: string): string[];
export const CSP_REPORT_URL: string;
export function securityHeaders(options: {
  html: string;
  imgOrigins?: string[];
  connectOrigins?: string[];
  reportUrl?: string;
}): Record<string, string>;
export function nginxHeaders(headers: Record<string, string>): string;
export const CACHE_HTML: string;
export const CACHE_ASSETS: string;
export function originsFromEnv(value: string | undefined): string[];
