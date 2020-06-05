local valuesHashKey = KEYS[1]
local keysSortedSetKey = KEYS[2]
local versionsSortedSetKey = KEYS[3]
local changesStreamKey = KEYS[4]
local revisionKey = KEYS[5]
local key = ARGV[1]
local streamMaxLen = ARGV[2]

local currentRevision = redis.call('GET', revisionKey) or '0-0'

local exists = redis.call('HEXISTS', valuesHashKey, key)

if exists == 0 then return {currentRevision} end

redis.call('HDEL', valuesHashKey, key)
redis.call('ZREM', keysSortedSetKey, key)
redis.call('ZREM', versionsSortedSetKey, key)

local revision = redis.call('XADD', changesStreamKey, 'MAXLEN', '~',
                            streamMaxLen, '*', 'prev', currentRevision, 'key',
                            key)

redis.call('SET', revisionKey, revision)

return {revision}
