/**
 * Minimal colored terminal logger. Everything goes to stderr so that stdout
 * stays clean for potential machine consumption / piping.
 */
const c = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
};

export const logger = {
  info: (msg: string): void => console.error(`${c.cyan}›${c.reset} ${msg}`),
  success: (msg: string): void => console.error(`${c.green}✔${c.reset} ${msg}`),
  warn: (msg: string): void => console.error(`${c.yellow}⚠${c.reset} ${msg}`),
  error: (msg: string): void => console.error(`${c.red}✖${c.reset} ${msg}`),
  plain: (msg = ""): void => console.error(msg),
  bold: (msg: string): string => `${c.bold}${msg}${c.reset}`,
  dim: (msg: string): string => `${c.gray}${msg}${c.reset}`,
};
