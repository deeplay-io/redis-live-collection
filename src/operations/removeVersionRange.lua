local valuesHashKey = KEYS[1]
local keysSortedSetKey = KEYS[2]
local versionsSortedSetKey = KEYS[3]
local changesStreamKey = KEYS[4]
local revisionKey = KEYS[5]
local min = ARGV[1]
local max = ARGV[2]
local streamMaxLen = ARGV[3]

local currentRevision = redis.call('GET', revisionKey) or '0-0'

local range = redis.call('ZRANGEBYSCORE', versionsSortedSetKey, min, max)

if #range == 0 then return {currentRevision, 0} end

redis.call('HDEL', valuesHashKey, unpack(range))
redis.call('ZREM', keysSortedSetKey, unpack(range))
redis.call('ZREM', versionsSortedSetKey, unpack(range))

local revision = currentRevision

for i = 1, #range do
    local key = range[i]

    revision = redis.call('XADD', changesStreamKey, 'MAXLEN', '~', streamMaxLen,
                          '*', 'prev', revision, 'key', key)
end

redis.call('SET', revisionKey, revision)

return {revision, #range}
