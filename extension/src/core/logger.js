// CORE: logger — wrapper console với prefix [EXT][version] và feature tag
// Dùng: import { log, warn, err } from '../core/logger.js'

const manifest = chrome.runtime.getManifest();
const PREFIX = `[EXT][${manifest.version}]`;

export const log  = (tag, ...args) => console.log( `${PREFIX}[${tag}]`, ...args);
export const warn = (tag, ...args) => console.warn(`${PREFIX}[${tag}]`, ...args);
export const err  = (tag, ...args) => console.error(`${PREFIX}[${tag}]`, ...args);
