import IORedis = require('ioredis');
import {nanoid} from 'nanoid/async';
import {get, transformGetArguments, transformGetReply} from './get';
import {set} from './set';
import {initCommands} from '../initCommands';

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

test('get', async () => {
  await set(redis, collection, 'key-1', Buffer.from([42]), 123);

  const result1 = await get(redis, collection, 'key-1');

  expect(result1).toMatchInlineSnapshot(
    {revision: expect.any(String)},
    `
    Object {
      "revision": Any<String>,
      "value": Object {
        "data": Array [
          42,
        ],
        "type": "Buffer",
      },
      "version": 123,
    }
  `,
  );

  const result2 = await get(redis, collection, 'key-2');

  expect(result2).toMatchInlineSnapshot(
    {revision: expect.any(String)},
    `
    Object {
      "revision": Any<String>,
      "value": null,
      "version": 0,
    }
  `,
  );
  expect(result1.revision).toEqual(result2.revision);

  await set(redis, collection, 'key-2', Buffer.from([]), Infinity);

  expect(await get(redis, collection, 'key-2')).toMatchInlineSnapshot(
    {
      revision: expect.any(String),
    },
    `
    Object {
      "revision": Any<String>,
      "value": Object {
        "data": Array [],
        "type": "Buffer",
      },
      "version": Infinity,
    }
  `,
  );
});

test('buffer', async () => {
  await set(redis, collection, Buffer.from([1, 2, 3]), Buffer.from([42]), 123);

  expect(
    await get(redis, collection, Buffer.from([1, 2, 3])),
  ).toMatchInlineSnapshot(
    {
      revision: expect.any(String),
    },
    `
    Object {
      "revision": Any<String>,
      "value": Object {
        "data": Array [
          42,
        ],
        "type": "Buffer",
      },
      "version": 123,
    }
  `,
  );
});

test('pipeline', async () => {
  await set(redis, collection, 'key-1', Buffer.from([]), 1);
  const {revision} = await set(redis, collection, 'key-2', Buffer.from([]), 2);

  const rawResults = await redis
    .multi()
    .lcGetBuffer(...transformGetArguments(collection, 'key-1'))
    .lcGetBuffer(...transformGetArguments(collection, 'key-2'))
    .lcGetBuffer(...transformGetArguments(collection, 'key-3'))
    .exec();

  const results = rawResults.map(([err, res]) => {
    if (err) {
      throw err;
    }

    return transformGetReply(res);
  });

  for (const result of results) {
    expect(result.revision).toEqual(revision);
  }
  expect(results.map(({value, version}) => ({value, version})))
    .toMatchInlineSnapshot(`
    Array [
      Object {
        "value": Object {
          "data": Array [],
          "type": "Buffer",
        },
        "version": 1,
      },
      Object {
        "value": Object {
          "data": Array [],
          "type": "Buffer",
        },
        "version": 2,
      },
      Object {
        "value": null,
        "version": 0,
      },
    ]
  `);
});
