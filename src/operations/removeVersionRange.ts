import IORedis = require('ioredis');
import * as fs from 'fs';
import * as path from 'path';
import {
  getKey,
  REVISION_SUFFIX,
  VALUES_HASH_SUFFIX,
  VERSIONS_SORTED_SET_SUFFIX,
  CHANGES_STREAM_SUFFIX,
  KEYS_SORTED_SET_SUFFIX,
} from '../keys';
import {versionToString} from '../versions';

const definition = {
  numberOfKeys: 5,
  lua: fs.readFileSync(path.join(__dirname, 'removeVersionRange.lua'), 'utf-8'),
};

declare module 'ioredis' {
  interface Redis {
    lcRemoveVersionRangeBuffer(
      valuesKey: string,
      keysKey: string,
      versionsKey: string,
      changesKey: string,
      revisionKey: string,
      min: string,
      max: string,
      maxlen: number,
    ): Promise<[Buffer, number]>;
  }

  interface Pipeline {
    lcRemoveVersionRangeBuffer(
      valuesKey: string,
      keysKey: string,
      versionsKey: string,
      changesKey: string,
      revisionKey: string,
      min: string,
      max: string,
      maxlen: number,
      callback?: IORedis.Callback<[Buffer, number]>,
    ): IORedis.Pipeline;
  }
}

export function defineRemoveVersionRangeCommand(redis: IORedis.Redis) {
  redis.defineCommand('lcRemoveVersionRange', definition);
}

export function transformRemoveVersionRangeArguments(
  collection: string,
  min: number | string,
  max: number | string,
  maxlen: number = 1000,
): Parameters<IORedis.Redis['lcRemoveVersionRangeBuffer']> {
  return [
    getKey(collection, VALUES_HASH_SUFFIX),
    getKey(collection, KEYS_SORTED_SET_SUFFIX),
    getKey(collection, VERSIONS_SORTED_SET_SUFFIX),
    getKey(collection, CHANGES_STREAM_SUFFIX),
    getKey(collection, REVISION_SUFFIX),
    typeof min === 'string' ? min : versionToString(min),
    typeof max === 'string' ? max : versionToString(max),
    maxlen,
  ];
}

export type RemoveVersionRangeResult = {
  revision: string;
  removedCount: number;
};

export function transformRemoveVersionRangeReply(
  reply: [Buffer, number],
): RemoveVersionRangeResult {
  const [revision, removedCount] = reply;

  return {
    revision: revision.toString(),
    removedCount,
  };
}

export function removeVersionRange(
  redis: IORedis.Redis,
  collection: string,
  min: number | string,
  max: number | string,
  maxlen: number = 1000,
): Promise<RemoveVersionRangeResult> {
  return redis
    .lcRemoveVersionRangeBuffer(
      ...transformRemoveVersionRangeArguments(collection, min, max, maxlen),
    )
    .then(transformRemoveVersionRangeReply);
}
