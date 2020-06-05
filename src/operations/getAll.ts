import {Redis} from 'ioredis';
import {
  VALUES_HASH_SUFFIX,
  VERSIONS_SORTED_SET_SUFFIX,
  getKey,
  REVISION_SUFFIX,
} from '../keys';
import {versionFromString} from '../versions';
import {CollectionItem} from '../collectionItem';

export type GetAllResult = {
  revision: string;
  items: CollectionItem[];
};

export async function getAll(
  redis: Redis,
  collection: string,
): Promise<GetAllResult> {
  const [
    [valuesErr, valuesResult],
    [versionsErr, versionsResult],
    [revisionErr, revisionResult],
  ] = await redis
    .multi()
    .hgetallBuffer(getKey(collection, VALUES_HASH_SUFFIX))
    .zrangeBuffer(
      getKey(collection, VERSIONS_SORTED_SET_SUFFIX),
      0,
      -1,
      'WITHSCORES',
    )
    .get(getKey(collection, REVISION_SUFFIX))
    .exec();

  if (valuesErr) {
    throw valuesErr;
  }

  if (versionsErr) {
    throw versionsErr;
  }

  if (revisionErr) {
    throw revisionErr;
  }

  const items: CollectionItem[] = [];

  for (let i = 0; i < versionsResult.length; i += 2) {
    const key = versionsResult[i];
    const version = versionFromString(versionsResult[i + 1].toString());
    const value = valuesResult[key];

    items.push({
      key,
      version,
      value,
    });
  }

  return {
    revision: revisionResult ?? '0-0',
    items,
  };
}
