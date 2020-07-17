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

const definition = {
  numberOfKeys: 5,
  lua: fs.readFileSync(path.join(__dirname, 'removeKeyRange.lua'), 'utf-8'),
};

declare module 'ioredis' {
  interface Redis {
    lcRemoveKeyRangeBuffer(
      valuesKey: string,
      keysKey: string,
      versionsKey: string,
      changesKey: string,
      revisionKey: string,
      min: string | Buffer,
      max: string | Buffer,
      maxlen: number,
    ): Promise<[Buffer, number]>;
  }

  interface Cluster {
    lcRemoveKeyRangeBuffer(
      valuesKey: string,
      keysKey: string,
      versionsKey: string,
      changesKey: string,
      revisionKey: string,
      min: string | Buffer,
      max: string | Buffer,
      maxlen: number,
    ): Promise<[Buffer, number]>;
  }

  interface Pipeline {
    lcRemoveKeyRangeBuffer(
      valuesKey: string,
      keysKey: string,
      versionsKey: string,
      changesKey: string,
      revisionKey: string,
      min: string | Buffer,
      max: string | Buffer,
      maxlen: number,
      callback?: IORedis.Callback<[Buffer, number]>,
    ): IORedis.Pipeline;
  }
}

export function defineRemoveKeyRangeCommand(redis: IORedis.Redis | IORedis.Cluster) {
  redis.defineCommand('lcRemoveKeyRange', definition);
}

export function transformRemoveKeyRangeArguments(
  collection: string,
  min: string | Buffer,
  max: string | Buffer,
  maxlen: number = 1000,
): Parameters<IORedis.Redis['lcRemoveKeyRangeBuffer']> {
  return [
    getKey(collection, VALUES_HASH_SUFFIX),
    getKey(collection, KEYS_SORTED_SET_SUFFIX),
    getKey(collection, VERSIONS_SORTED_SET_SUFFIX),
    getKey(collection, CHANGES_STREAM_SUFFIX),
    getKey(collection, REVISION_SUFFIX),
    min,
    max,
    maxlen,
  ];
}

export type RemoveKeyRangeResult = {
  revision: string;
  removedCount: number;
};

export function transformRemoveKeyRangeReply(
  reply: [Buffer, number],
): RemoveKeyRangeResult {
  const [revision, removedCount] = reply;

  return {
    revision: revision.toString(),
    removedCount,
  };
}

export function removeKeyRange(
  redis: IORedis.Redis | IORedis.Cluster,
  collection: string,
  min: string | Buffer,
  max: string | Buffer,
  maxlen: number = 1000,
): Promise<RemoveKeyRangeResult> {
  return redis
    .lcRemoveKeyRangeBuffer(
      ...transformRemoveKeyRangeArguments(collection, min, max, maxlen),
    )
    .then(transformRemoveKeyRangeReply);
}
