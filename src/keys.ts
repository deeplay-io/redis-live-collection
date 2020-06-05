/**
 * Hash of collection items key -> value.
 */
export const VALUES_HASH_SUFFIX = 'values';

/**
 * Sorted Set of keys with all scores set to `0`.
 */
export const KEYS_SORTED_SET_SUFFIX = 'keys';

/**
 * Sorted set of keys scored by version.
 */
export const VERSIONS_SORTED_SET_SUFFIX = 'versions';

/**
 * Stream of entries with fields:
 * - prev: stream id of previous entry or 0-0 for the first entry
 * - key: key of changed item
 * - value: updated item value, empty for remove
 * - version: updated item version, empty for remove
 */
export const CHANGES_STREAM_SUFFIX = 'changes';

/**
 * Stream ID of the last changes stream entry.
 */
export const REVISION_SUFFIX = 'revision';

export function getKey(collection: string, suffix: string) {
  return `${collection}:${suffix}`;
}
