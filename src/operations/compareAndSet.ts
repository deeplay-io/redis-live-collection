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
  lua: fs.readFileSync(path.join(__dirname, 'compareAndSet.lua'), 'utf-8'),
};

declare module 'ioredis' {
  interface Redis {
    lcCompareAndSetBuffer(
      valuesKey: string,
      keysKey: string,
      versionsKey: string,
      changesKey: string,
      revisionKey: string,
      key: string | Buffer,
      compareOperator: string,
      compareVersion: string,
      value: Buffer,
      version: string,
      maxlen: number,
    ): Promise<[Buffer, null | 1]>;
  }

  interface Cluster {
    lcCompareAndSetBuffer(
      valuesKey: string,
      keysKey: string,
      versionsKey: string,
      changesKey: string,
      revisionKey: string,
      key: string | Buffer,
      compareOperator: string,
      compareVersion: string,
      value: Buffer,
      version: string,
      maxlen: number,
    ): Promise<[Buffer, null | 1]>;
  }

  interface Pipeline {
    lcCompareAndSetBuffer(
      valuesKey: string,
      keysKey: string,
      versionsKey: string,
      changesKey: string,
      revisionKey: string,
      key: string | Buffer,
      compareOperator: string,
      compareVersion: string,
      value: Buffer,
      version: string,
      maxlen: number,
      callback?: IORedis.Callback<[Buffer, null | 1]>,
    ): IORedis.Pipeline;
  }
}

export function defineCompareAndSetCommand(redis: IORedis.Redis | IORedis.Cluster) {
  redis.defineCommand('lcCompareAndSet', definition);
}

export function transformCompareAndSetArguments(
  collection: string,
  key: string | Buffer,
  compareOperator: CompareOperator,
  compareVersion: number,
  value: Buffer,
  version: number = Infinity,
  maxlen: number = 1000,
): Parameters<IORedis.Redis['lcCompareAndSetBuffer']> {
  return [
    getKey(collection, VALUES_HASH_SUFFIX),
    getKey(collection, KEYS_SORTED_SET_SUFFIX),
    getKey(collection, VERSIONS_SORTED_SET_SUFFIX),
    getKey(collection, CHANGES_STREAM_SUFFIX),
    getKey(collection, REVISION_SUFFIX),
    key,
    compareOperator,
    compareVersion.toString(),
    value,
    version.toString(),
    maxlen,
  ];
}

export type CompareAndSetResult = {
  revision: string;
  success: boolean;
};

export function transformCompareAndSetReply(
  reply: [Buffer, null | 1],
): CompareAndSetResult {
  const [revision, success] = reply;

  return {
    revision: revision.toString(),
    success: !!success,
  };
}

export function compareAndSet(
  redis: IORedis.Redis,
  collection: string,
  key: string | Buffer,
  compareOperator: CompareOperator,
  compareVersion: number,
  value: Buffer,
  version: number = Infinity,
  maxlen: number = 1000,
): Promise<CompareAndSetResult> {
  return redis
    .lcCompareAndSetBuffer(
      ...transformCompareAndSetArguments(
        collection,
        key,
        compareOperator,
        compareVersion,
        value,
        version,
        maxlen,
      ),
    )
    .then(transformCompareAndSetReply);
}
