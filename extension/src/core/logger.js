// CORE: logger — wrapper console với prefix [EXT] và feature tag
// Dùng: import { log, warn, err } from '../core/logger.js'

const PREFIX = '[EXT]';

export const log  = (tag, ...args) => console.log( `${PREFIX}[${tag}]`, ...args);
export const warn = (tag, ...args) => console.warn(`${PREFIX}[${tag}]`, ...args);
export const err  = (tag, ...args) => console.error(`${PREFIX}[${tag}]`, ...args);
