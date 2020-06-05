local valuesHashKey = KEYS[1]
local keysSortedSetKey = KEYS[2]
local versionsSortedSetKey = KEYS[3]
local changesStreamKey = KEYS[4]
local revisionKey = KEYS[5]
local key = ARGV[1]
local value = ARGV[2]
local version = ARGV[3]
local streamMaxLen = ARGV[4]

local currentRevision = redis.call('GET', revisionKey) or '0-0'

redis.call('HSET', valuesHashKey, key, value)
redis.call('ZADD', keysSortedSetKey, '0', key)
redis.call('ZADD', versionsSortedSetKey, version, key)

local revision = redis.call('XADD', changesStreamKey, 'MAXLEN', '~',
                            streamMaxLen, '*', 'prev', currentRevision, 'key',
                            key, 'value', value, 'version', version)

redis.call('SET', revisionKey, revision)

return {revision}
