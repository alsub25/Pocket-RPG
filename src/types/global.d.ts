// Global type declarations for Emberwood

interface Window {
  __emberwoodEngine?: any;
  __GAME_PATCH__?: string;
  __EW_BOOT_METRICS__?: any;
  PQ_BOOT_DIAG?: any;
  PQ_ACCEPT?: any;
}

interface HTMLElement {
  __pillTapTimer?: any;
}

interface Error {
  code?: string;
  originalError?: any;
  importUrl?: string;
  actualFile?: string;
  importChain?: any;
}

interface PerformanceEntry {
  initiatorType?: string;
  transferSize?: number;
}
