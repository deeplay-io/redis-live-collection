import IORedis = require('ioredis');
import {nanoid} from 'nanoid/async';
import {remove} from './remove';
import {initCommands} from '../initCommands';
import {
  getKey,
  CHANGES_STREAM_SUFFIX,
  VALUES_HASH_SUFFIX,
  VERSIONS_SORTED_SET_SUFFIX,
} from '../keys';
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

test('remove', async () => {
  expect(await remove(redis, collection, 'key')).toMatchInlineSnapshot(`
    Object {
      "revision": "0-0",
    }
  `);

  expect(
    await redis.hgetallBuffer(getKey(collection, VALUES_HASH_SUFFIX)),
  ).toMatchInlineSnapshot(`Object {}`);
  expect(
    await redis.zrange(
      getKey(collection, VERSIONS_SORTED_SET_SUFFIX),
      0,
      -1,
      'WITHSCORES',
    ),
  ).toMatchInlineSnapshot(`Array []`);
  expect(await getStreamRange()).toMatchInlineSnapshot(`Array []`);

  const setResult = await set(redis, collection, 'key', Buffer.from([]), 42);

  const removeResult = await remove(redis, collection, 'key');

  expect(
    await redis.hgetallBuffer(getKey(collection, VALUES_HASH_SUFFIX)),
  ).toMatchInlineSnapshot(`Object {}`);
  expect(
    await redis.zrange(
      getKey(collection, VERSIONS_SORTED_SET_SUFFIX),
      0,
      -1,
      'WITHSCORES',
    ),
  ).toMatchInlineSnapshot(`Array []`);

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
  expect(streamRange[1].revision).toEqual(removeResult.revision);
  expect(streamRange[1].prevRevision).toEqual(streamRange[0].revision);
});
