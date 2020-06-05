import IORedis = require('ioredis');
import {nanoid} from 'nanoid/async';
import {set} from './set';
import {
  VALUES_HASH_SUFFIX,
  VERSIONS_SORTED_SET_SUFFIX,
  getKey,
  CHANGES_STREAM_SUFFIX,
  REVISION_SUFFIX,
} from '../keys';
import {initCommands} from '../initCommands';
import {changeEventFromEntry} from '../changeEvents';

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

test('set', async () => {
  await set(redis, collection, 'key-1', Buffer.from([123]), 42);

  expect(await redis.hgetallBuffer(getKey(collection, VALUES_HASH_SUFFIX)))
    .toMatchInlineSnapshot(`
    Object {
      "key-1": Object {
        "data": Array [
          123,
        ],
        "type": "Buffer",
      },
    }
  `);
  expect(
    await redis.zrange(
      getKey(collection, VERSIONS_SORTED_SET_SUFFIX),
      0,
      -1,
      'WITHSCORES',
    ),
  ).toMatchInlineSnapshot(`
    Array [
      "key-1",
      "42",
    ]
  `);
  const streamRange1 = await getStreamRange();
  expect(streamRange1.length).toBe(1);
  expect(streamRange1[0].revision).not.toBe('0-0');
  expect(streamRange1[0]).toMatchInlineSnapshot(
    {
      revision: expect.any(String),
    },
    `
    Object {
      "key": "key-1",
      "prevRevision": "0-0",
      "revision": Any<String>,
      "type": "set",
      "value": Object {
        "data": Array [
          123,
        ],
        "type": "Buffer",
      },
      "version": 42,
    }
  `,
  );
  expect(await redis.get(getKey(collection, REVISION_SUFFIX))).toEqual(
    streamRange1[0].revision,
  );

  await set(redis, collection, 'key-1', Buffer.from([123]), 24);

  expect(await redis.hgetallBuffer(getKey(collection, VALUES_HASH_SUFFIX)))
    .toMatchInlineSnapshot(`
    Object {
      "key-1": Object {
        "data": Array [
          123,
        ],
        "type": "Buffer",
      },
    }
  `);
  expect(
    await redis.zrange(
      getKey(collection, VERSIONS_SORTED_SET_SUFFIX),
      0,
      -1,
      'WITHSCORES',
    ),
  ).toMatchInlineSnapshot(`
    Array [
      "key-1",
      "24",
    ]
  `);
  const streamRange2 = await getStreamRange();
  expect(streamRange2.length).toBe(2);
  expect(streamRange2[0]).toEqual(streamRange1[0]);
  expect(streamRange2[1].revision).not.toBe('0-0');
  expect(streamRange2[1]).toMatchInlineSnapshot(
    {
      prevRevision: expect.any(String),
      revision: expect.any(String),
    },
    `
    Object {
      "key": "key-1",
      "prevRevision": Any<String>,
      "revision": Any<String>,
      "type": "set",
      "value": Object {
        "data": Array [
          123,
        ],
        "type": "Buffer",
      },
      "version": 24,
    }
  `,
  );
  expect(streamRange2[1].prevRevision).toBe(streamRange1[0].revision);
  expect(await redis.get(getKey(collection, REVISION_SUFFIX))).toEqual(
    streamRange2[1].revision,
  );

  await set(redis, collection, 'key-2', Buffer.from([42]), 123);

  expect(await redis.hgetallBuffer(getKey(collection, VALUES_HASH_SUFFIX)))
    .toMatchInlineSnapshot(`
    Object {
      "key-1": Object {
        "data": Array [
          123,
        ],
        "type": "Buffer",
      },
      "key-2": Object {
        "data": Array [
          42,
        ],
        "type": "Buffer",
      },
    }
  `);
  expect(
    await redis.zrange(
      getKey(collection, VERSIONS_SORTED_SET_SUFFIX),
      0,
      -1,
      'WITHSCORES',
    ),
  ).toMatchInlineSnapshot(`
    Array [
      "key-1",
      "24",
      "key-2",
      "123",
    ]
  `);
});

test('infinite version', async () => {
  await set(redis, collection, 'key-1', Buffer.from([123]), Infinity);

  expect(
    await redis.zrange(
      getKey(collection, VERSIONS_SORTED_SET_SUFFIX),
      0,
      -1,
      'WITHSCORES',
    ),
  ).toMatchInlineSnapshot(`
    Array [
      "key-1",
      "inf",
    ]
  `);

  const streamRange1 = await getStreamRange();
  expect(streamRange1[0]).toMatchInlineSnapshot(
    {
      revision: expect.any(String),
    },
    `
    Object {
      "key": "key-1",
      "prevRevision": "0-0",
      "revision": Any<String>,
      "type": "set",
      "value": Object {
        "data": Array [
          123,
        ],
        "type": "Buffer",
      },
      "version": Infinity,
    }
  `,
  );

  await set(redis, collection, 'key-2', Buffer.from([42]), -Infinity);

  expect(
    await redis.zrange(
      getKey(collection, VERSIONS_SORTED_SET_SUFFIX),
      0,
      -1,
      'WITHSCORES',
    ),
  ).toMatchInlineSnapshot(`
    Array [
      "key-2",
      "-inf",
      "key-1",
      "inf",
    ]
  `);

  const streamRange2 = await getStreamRange();
  expect(streamRange2[1]).toMatchInlineSnapshot(
    {
      revision: expect.any(String),
      prevRevision: expect.any(String),
    },
    `
    Object {
      "key": "key-2",
      "prevRevision": Any<String>,
      "revision": Any<String>,
      "type": "set",
      "value": Object {
        "data": Array [
          42,
        ],
        "type": "Buffer",
      },
      "version": -Infinity,
    }
  `,
  );
});

test('set buffer', async () => {
  const key = Buffer.from([1, 2, 3]);
  await set(redis, collection, key, Buffer.from([123]), 42);

  expect(
    await redis.hgetBuffer(getKey(collection, VALUES_HASH_SUFFIX), key as any),
  ).toMatchInlineSnapshot(`
    Object {
      "data": Array [
        123,
      ],
      "type": "Buffer",
    }
  `);
  expect(
    await redis.zrangeBuffer(
      getKey(collection, VERSIONS_SORTED_SET_SUFFIX),
      0,
      -1,
      'WITHSCORES',
    ),
  ).toMatchInlineSnapshot(`
    Array [
      Object {
        "data": Array [
          1,
          2,
          3,
        ],
        "type": "Buffer",
      },
      Object {
        "data": Array [
          52,
          50,
        ],
        "type": "Buffer",
      },
    ]
  `);
});
