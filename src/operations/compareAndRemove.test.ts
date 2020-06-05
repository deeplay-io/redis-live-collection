import IORedis = require('ioredis');
import {nanoid} from 'nanoid/async';
import {
  compareAndRemove,
  transformCompareAndRemoveArguments,
  transformCompareAndRemoveReply,
} from './compareAndRemove';
import {initCommands} from '../initCommands';
import {getKey, CHANGES_STREAM_SUFFIX} from '../keys';
import {changeEventFromEntry} from '../changeEvents';
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

test('compareAndRemove', async () => {
  expect(await compareAndRemove(redis, collection, 'key', '!=', 0))
    .toMatchInlineSnapshot(`
    Object {
      "revision": "0-0",
      "success": false,
    }
  `);
  expect(await compareAndRemove(redis, collection, 'key', '==', 0))
    .toMatchInlineSnapshot(`
    Object {
      "revision": "0-0",
      "success": true,
    }
  `);

  expect(await getStreamRange()).toMatchInlineSnapshot(`Array []`);

  const setResult = await set(redis, collection, 'key', Buffer.from([]), 42);

  const compareAndRemoveResult1 = await compareAndRemove(
    redis,
    collection,
    'key',
    '==',
    0,
  );

  expect(compareAndRemoveResult1).toMatchInlineSnapshot(
    {
      revision: expect.any(String),
    },
    `
    Object {
      "revision": Any<String>,
      "success": false,
    }
  `,
  );
  expect(compareAndRemoveResult1.revision).toEqual(setResult.revision);

  const compareAndRemoveResult2 = await compareAndRemove(
    redis,
    collection,
    'key',
    '==',
    42,
  );

  const streamRange = await getStreamRange();

  expect(streamRange.length).toBe(2);
  expect(streamRange[0]).toMatchInlineSnapshot(
    {
      revision: expect.any(String),
    },
    `
    Object {
      "key": "key",
      "prevRevision": "0-0",
      "revision": Any<String>,
      "type": "set",
      "value": Object {
        "data": Array [],
        "type": "Buffer",
      },
      "version": 42,
    }
  `,
  );
  expect(streamRange[0].revision).toEqual(setResult.revision);
  expect(streamRange[1]).toMatchInlineSnapshot(
    {
      revision: expect.any(String),
      prevRevision: expect.any(String),
    },
    `
    Object {
      "key": "key",
      "prevRevision": Any<String>,
      "revision": Any<String>,
      "type": "remove",
    }
  `,
  );
  expect(streamRange[1].revision).toEqual(compareAndRemoveResult2.revision);
  expect(streamRange[1].prevRevision).toEqual(streamRange[0].revision);
});

test('pipeline', async () => {
  await set(redis, collection, 'key-1', Buffer.from([]), 1);
  await set(redis, collection, 'key-2', Buffer.from([]), 2);

  const rawResults = await redis
    .multi()
    .lcCompareAndRemoveBuffer(
      ...transformCompareAndRemoveArguments(collection, 'key-1', '==', 1),
    )
    .lcCompareAndRemoveBuffer(
      ...transformCompareAndRemoveArguments(collection, 'key-2', '!=', 2),
    )
    .lcCompareAndRemoveBuffer(
      ...transformCompareAndRemoveArguments(collection, 'key-3', '==', 0),
    )
    .exec();

  const results = rawResults.map(([err, res]) => {
    if (err) {
      throw err;
    }

    return transformCompareAndRemoveReply(res);
  });

  expect(results.map((result) => result.success)).toMatchInlineSnapshot(`
    Array [
      true,
      false,
      true,
    ]
  `);
});
