import { logger } from './index';

/**
 * Creates a module-specific logger.
 * @param moduleName The name of the module (e.g., 'drafts', 'auth')
 * @param defaultMeta Any additional default metadata for this module
 */
export function createChildLogger(moduleName: string, defaultMeta?: Record<string, any>) {
  return logger.child({
    module: moduleName,
    ...defaultMeta,
  });
}

