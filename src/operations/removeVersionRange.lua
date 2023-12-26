local valuesHashKey = KEYS[1]
local keysSortedSetKey = KEYS[2]
local versionsSortedSetKey = KEYS[3]
local changesStreamKey = KEYS[4]
local revisionKey = KEYS[5]
local min = ARGV[1]
local max = ARGV[2]
local streamMaxLen = ARGV[3]

local function massive_redis_command(command, key, t)
    local i = 1
    local temp = {}
    while(i <= #t) do
        table.insert(temp, t[i+1])
        table.insert(temp, t[i])
        if #temp >= 1000 then
            redis.call(command, key, unpack(temp))
            temp = {}
        end
        i = i+2
    end
    if #temp > 0 then
        redis.call(command, key, unpack(temp))
    end
end

local currentRevision = redis.call('GET', revisionKey) or '0-0'

local range = redis.call('ZRANGEBYSCORE', versionsSortedSetKey, min, max)

if #range == 0 then return {currentRevision, 0} end
massive_redis_command('HDEL', valuesHashKey, range)
massive_redis_command('ZREM', keysSortedSetKey, range)
massive_redis_command('ZREM', versionsSortedSetKey, range)

local revision = currentRevision

for i = 1, #range do
    local key = range[i]

    revision = redis.call('XADD', changesStreamKey, 'MAXLEN', '~', streamMaxLen,
                          '*', 'prev', revision, 'key', key)
end

redis.call('SET', revisionKey, revision)

return {revision, #range}
