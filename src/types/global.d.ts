// Global type declarations for Emberwood

interface Window {
  __emberwoodEngine?: any;
  __emberwoodStateRef?: any;
  __emberwoodEngineRef?: any;
  __emberwoodTouchAudioUnlocked?: boolean;
  __GAME_PATCH__?: string;
  __EW_BOOT_METRICS__?: any;
  PQ_BOOT_DIAG?: any;
  PQ_ACCEPT?: any;
}

interface HTMLElement {
  __pillTapTimer?: any;
  value?: any;
  offsetParent?: any;
  focus?: any;
  dataset?: any;
  closest?: any;
}

interface Element {
  offsetTop?: number;
  offsetParent?: any;
  focus?: any;
  dataset?: any;
  closest?: any;
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

interface EventTarget {
  closest?: any;
  value?: any;
  dataset?: any;
}

