const DEBUG_FLAG_KEY = "lumina.debug";

function isDebugEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(DEBUG_FLAG_KEY) === "1";
}

export const logger = {
  debug: (...args: unknown[]): void => {
    if (isDebugEnabled()) {
      console.debug(...args);
    }
  },
  info: (...args: unknown[]): void => {
    if (isDebugEnabled()) {
      console.info(...args);
    }
  },
  warn: (...args: unknown[]): void => {
    console.warn(...args);
  },
  error: (...args: unknown[]): void => {
    console.error(...args);
  },
};
