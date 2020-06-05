import IORedis = require('ioredis');
import {nanoid} from 'nanoid/async';
import {changeEventFromEntry} from '../changeEvents';
import {initCommands} from '../initCommands';
import {CHANGES_STREAM_SUFFIX, getKey} from '../keys';
import {getAll, GetAllResult} from './getAll';
import {removeKeyRange} from './removeKeyRange';
import {set} from './set';

let redis: IORedis.Redis;
const collection = 'test-collection';

beforeEach(async () => {
  redis = new IORedis({
    keyPrefix: await nanoid(),
    lazyConnect: true,
  });
  initCommands(redis);
  await redis.connect();
});

afterEach(async () => {
  await redis.quit();
});

async function getStreamRange() {
  const rawStreamRange = await redis.xrangeBuffer(
    getKey(collection, CHANGES_STREAM_SUFFIX),
    '-',
    '+',
  );

  return rawStreamRange.map((entry) => {
    const event = changeEventFromEntry(entry);
    return {
      ...event,
      key: event.key.toString(),
    };
  });
}

test('removeKeyRange', async () => {
  await set(redis, collection, 'key-1', Buffer.from([3]), -Infinity);
  await set(redis, collection, 'key-2', Buffer.from([2]), 0);
  const {revision} = await set(
    redis,
    collection,
    'key-3',
    Buffer.from([1]),
    Infinity,
  );

  const result1 = await removeKeyRange(redis, collection, '(key-3', '+');
  expect(result1.revision).toEqual(revision);
  expect(result1.removedCount).toBe(0);

  const getKeys = (result: GetAllResult) =>
    result.items.map((item) => item.key.toString());

  expect(getKeys(await getAll(redis, collection))).toMatchInlineSnapshot(`
    Array [
      "key-1",
      "key-2",
      "key-3",
    ]
  `);
  const streamRange1 = await getStreamRange();
  expect(streamRange1.length).toBe(3);

  const result2 = await removeKeyRange(redis, collection, '(key-1', '[key-3');
  expect(result2.removedCount).toBe(2);

  expect(getKeys(await getAll(redis, collection))).toMatchInlineSnapshot(`
    Array [
      "key-1",
    ]
  `);
  const streamRange2 = await getStreamRange();
  expect(streamRange2.length).toBe(5);
  expect(streamRange2[3]).toMatchInlineSnapshot(
    {
      revision: expect.any(String),
      prevRevision: expect.any(String),
    },
    `
    Object {
      "key": "key-2",
      "prevRevision": Any<String>,
      "revision": Any<String>,
      "type": "remove",
    }
  `,
  );
  expect(streamRange2[4]).toMatchInlineSnapshot(
    {
      revision: expect.any(String),
      prevRevision: expect.any(String),
    },
    `
    Object {
      "key": "key-3",
      "prevRevision": Any<String>,
      "revision": Any<String>,
      "type": "remove",
    }
  `,
  );
});
