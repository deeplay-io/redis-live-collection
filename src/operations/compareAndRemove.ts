import IORedis = require('ioredis');
import * as fs from 'fs';
import * as path from 'path';
import {
  VALUES_HASH_SUFFIX,
  VERSIONS_SORTED_SET_SUFFIX,
  getKey,
  CHANGES_STREAM_SUFFIX,
  REVISION_SUFFIX,
  KEYS_SORTED_SET_SUFFIX,
} from '../keys';
import {CompareOperator} from '../compareOperators';

const definition = {
  numberOfKeys: 5,
  lua: fs.readFileSync(path.join(__dirname, 'compareAndRemove.lua'), 'utf-8'),
};

declare module 'ioredis' {
  interface Redis {
    lcCompareAndRemoveBuffer(
      valuesKey: string,
      keysKey: string,
      versionsKey: string,
      changesKey: string,
      revisionKey: string,
      key: string | Buffer,
      compareOperator: string,
      compareVersion: string,
      maxlen: number,
    ): Promise<[Buffer, null | 1]>;
  }

  interface Cluster {
    lcCompareAndRemoveBuffer(
      valuesKey: string,
      keysKey: string,
      versionsKey: string,
      changesKey: string,
      revisionKey: string,
      key: string | Buffer,
      compareOperator: string,
      compareVersion: string,
      maxlen: number,
    ): Promise<[Buffer, null | 1]>;
  }

  interface Pipeline {
    lcCompareAndRemoveBuffer(
      valuesKey: string,
      keysKey: string,
      versionsKey: string,
      changesKey: string,
      revisionKey: string,
      key: string | Buffer,
      compareOperator: string,
      compareVersion: string,
      maxlen: number,
      callback?: IORedis.Callback<[Buffer, null | 1]>,
    ): IORedis.Pipeline;
  }
}

export function defineCompareAndRemoveCommand(redis: IORedis.Redis | IORedis.Cluster) {
  redis.defineCommand('lcCompareAndRemove', definition);
}

export function transformCompareAndRemoveArguments(
  collection: string,
  key: string | Buffer,
  compareOperator: CompareOperator,
  compareVersion: number,
  maxlen: number = 1000,
): Parameters<IORedis.Redis['lcCompareAndRemoveBuffer']> {
  return [
    getKey(collection, VALUES_HASH_SUFFIX),
    getKey(collection, KEYS_SORTED_SET_SUFFIX),
    getKey(collection, VERSIONS_SORTED_SET_SUFFIX),
    getKey(collection, CHANGES_STREAM_SUFFIX),
    getKey(collection, REVISION_SUFFIX),
    key,
    compareOperator,
    compareVersion.toString(),
    maxlen,
  ];
}

export type CompareAndRemoveResult = {
  revision: string;
  success: boolean;
};

export function transformCompareAndRemoveReply(
  reply: [Buffer, null | 1],
): CompareAndRemoveResult {
  const [revision, success] = reply;

  return {
    revision: revision.toString(),
    success: !!success,
  };
}

export function compareAndRemove(
  redis: IORedis.Redis | IORedis.Cluster,
  collection: string,
  key: string | Buffer,
  compareOperator: CompareOperator,
  compareVersion: number,
  maxlen: number = 1000,
): Promise<CompareAndRemoveResult> {
  return redis
    .lcCompareAndRemoveBuffer(
      ...transformCompareAndRemoveArguments(
        collection,
        key,
        compareOperator,
        compareVersion,
        maxlen,
      ),
    )
    .then(transformCompareAndRemoveReply);
}
