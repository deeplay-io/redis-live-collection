import IORedis = require('ioredis');
import * as fs from 'fs';
import * as path from 'path';
import {
  VALUES_HASH_SUFFIX,
  VERSIONS_SORTED_SET_SUFFIX,
  getKey,
  REVISION_SUFFIX,
} from '../keys';
import {versionToString, versionFromString} from '../versions';
import {CollectionItem} from '../collectionItem';

const definition = {
  numberOfKeys: 3,
  lua: fs.readFileSync(path.join(__dirname, 'getVersionRange.lua'), 'utf-8'),
};

declare module 'ioredis' {
  interface Redis {
    lcGetVersionRangeBuffer(
      valuesKey: string,
      versionsKey: string,
      revisionKey: string,
      min: string,
      max: string,
    ): Promise<[Buffer, Array<[Buffer, Buffer, Buffer]>]>;
  }

  interface Cluster {
    lcGetVersionRangeBuffer(
      valuesKey: string,
      versionsKey: string,
      revisionKey: string,
      min: string,
      max: string,
    ): Promise<[Buffer, Array<[Buffer, Buffer, Buffer]>]>;
  }

  interface Pipeline {
    lcGetVersionRangeBuffer(
      valuesKey: string,
      versionsKey: string,
      revisionKey: string,
      min: string,
      max: string,
      callback?: IORedis.Callback<[Buffer, Array<[Buffer, Buffer, Buffer]>]>,
    ): IORedis.Pipeline;
  }
}

export function defineGetVersionRangeCommand(redis: IORedis.Redis | IORedis.Cluster) {
  redis.defineCommand('lcGetVersionRange', definition);
}

export function transformGetVersionRangeArguments(
  collection: string,
  min: number | string,
  max: number | string,
): Parameters<IORedis.Redis['lcGetVersionRangeBuffer']> {
  return [
    getKey(collection, VALUES_HASH_SUFFIX),
    getKey(collection, VERSIONS_SORTED_SET_SUFFIX),
    getKey(collection, REVISION_SUFFIX),
    typeof min === 'string' ? min : versionToString(min),
    typeof max === 'string' ? max : versionToString(max),
  ];
}

export type GetVersionRangeResult = {
  revision: string;
  items: CollectionItem[];
};

export function transformGetVersionRangeReply(
  reply: [Buffer, Array<[Buffer, Buffer, Buffer]>],
): GetVersionRangeResult {
  const [revision, items] = reply;

  return {
    revision: revision.toString(),
    items: items.map(([key, value, version]) => ({
      key,
      value,
      version: versionFromString(version.toString()),
    })),
  };
}

export function getVersionRange(
  redis: IORedis.Redis,
  collection: string,
  min: number | string,
  max: number | string,
): Promise<GetVersionRangeResult> {
  return redis
    .lcGetVersionRangeBuffer(
      ...transformGetVersionRangeArguments(collection, min, max),
    )
    .then(transformGetVersionRangeReply);
}
