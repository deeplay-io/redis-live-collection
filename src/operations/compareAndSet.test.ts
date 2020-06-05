import IORedis = require('ioredis');
import {nanoid} from 'nanoid/async';
import {getKey, CHANGES_STREAM_SUFFIX} from '../keys';
import {initCommands} from '../initCommands';
import {changeEventFromEntry} from '../changeEvents';
import {
  compareAndSet,
  transformCompareAndSetArguments,
  transformCompareAndSetReply,
} from './compareAndSet';
import {set} from './set';
import {CompareOperator} from '../compareOperators';

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

test('initial', async () => {
  expect(
    await compareAndSet(
      redis,
      collection,
      'key-1',
      '!=',
      0,
      Buffer.from([123]),
      42,
    ),
  ).toMatchInlineSnapshot(`
    Object {
      "revision": "0-0",
      "success": false,
    }
  `);
  expect(await getStreamRange()).toMatchInlineSnapshot(`Array []`);

  const result = await compareAndSet(
    redis,
    collection,
    'key-1',
    '==',
    0,
    Buffer.from([123]),
    42,
  );
  expect(result).toMatchInlineSnapshot(
    {
      revision: expect.any(String),
    },
    `
    Object {
      "revision": Any<String>,
      "success": true,
    }
  `,
  );

  const streamRange = await getStreamRange();

  expect(streamRange.length).toBe(1);
  expect(streamRange[0]).toMatchInlineSnapshot(
    {revision: expect.any(String)},
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
  expect(streamRange[0].revision).toEqual(result.revision);
});

test.each<[number, CompareOperator, number, boolean]>([
  [0, '<', 1, true],
  [1, '<', 0, false],
  [0, '<', 0, false],
  [-Infinity, '<', 0, true],
  [-Infinity, '<', -Infinity, false],
  [0, '<', -Infinity, false],
  [Infinity, '<', 0, false],
  [Infinity, '<', Infinity, false],
  [0, '<', Infinity, true],

  [0, '<=', 1, true],
  [1, '<=', 0, false],
  [0, '<=', 0, true],
  [-Infinity, '<=', 0, true],
  [-Infinity, '<=', -Infinity, true],
  [0, '<=', -Infinity, false],
  [Infinity, '<=', 0, false],
  [Infinity, '<=', Infinity, true],
  [0, '<=', Infinity, true],

  [0, '==', 1, false],
  [1, '==', 0, false],
  [0, '==', 0, true],
  [-Infinity, '==', 0, false],
  [-Infinity, '==', -Infinity, true],
  [0, '==', -Infinity, false],
  [Infinity, '==', 0, false],
  [Infinity, '==', Infinity, true],
  [0, '==', Infinity, false],

  [0, '!=', 1, true],
  [1, '!=', 0, true],
  [0, '!=', 0, false],
  [-Infinity, '!=', 0, true],
  [-Infinity, '!=', -Infinity, false],
  [0, '!=', -Infinity, true],
  [Infinity, '!=', 0, true],
  [Infinity, '!=', Infinity, false],
  [0, '!=', Infinity, true],

  [0, '>=', 1, false],
  [1, '>=', 0, true],
  [0, '>=', 0, true],
  [-Infinity, '>=', 0, false],
  [-Infinity, '>=', -Infinity, true],
  [0, '>=', -Infinity, true],
  [Infinity, '>=', 0, true],
  [Infinity, '>=', Infinity, true],
  [0, '>=', Infinity, false],

  [0, '>', 1, false],
  [1, '>', 0, true],
  [0, '>', 0, false],
  [-Infinity, '>', 0, false],
  [-Infinity, '>', -Infinity, false],
  [0, '>', -Infinity, true],
  [Infinity, '>', 0, true],
  [Infinity, '>', Infinity, false],
  [0, '>', Infinity, false],
])(
  '%d %s %d is %s',
  async (currentVersion, operator, compareVersion, expected) => {
    await set(redis, collection, 'key', Buffer.from([]), currentVersion);

    expect(
      await compareAndSet(
        redis,
        collection,
        'key',
        operator,
        compareVersion,
        Buffer.from([]),
      ),
    ).toMatchObject({
      success: expected,
    });
  },
);

test('pipeline', async () => {
  await set(redis, collection, 'key-1', Buffer.from([]), 1);
  await set(redis, collection, 'key-2', Buffer.from([]), 2);

  const rawResults = await redis
    .multi()
    .lcCompareAndSetBuffer(
      ...transformCompareAndSetArguments(
        collection,
        'key-1',
        '==',
        1,
        Buffer.from([]),
        Infinity,
      ),
    )
    .lcCompareAndSetBuffer(
      ...transformCompareAndSetArguments(
        collection,
        'key-2',
        '!=',
        2,
        Buffer.from([]),
        Infinity,
      ),
    )
    .lcCompareAndSetBuffer(
      ...transformCompareAndSetArguments(
        collection,
        'key-3',
        '==',
        0,
        Buffer.from([]),
        Infinity,
      ),
    )
    .exec();

  const results = rawResults.map(([err, res]) => {
    if (err) {
      throw err;
    }

    return transformCompareAndSetReply(res);
  });

  expect(results.map((result) => result.success)).toMatchInlineSnapshot(`
    Array [
      true,
      false,
      true,
    ]
  `);
});
