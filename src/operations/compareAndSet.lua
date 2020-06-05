local valuesHashKey = KEYS[1]
local keysSortedSetKey = KEYS[2]
local versionsSortedSetKey = KEYS[3]
local changesStreamKey = KEYS[4]
local revisionKey = KEYS[5]
local key = ARGV[1]
local compareOperator = ARGV[2]
local compareVersion = ARGV[3]
local value = ARGV[4]
local version = ARGV[5]
local streamMaxLen = ARGV[6]

local currentRevision = redis.call('GET', revisionKey) or '0-0'

local currentVersion = redis.call('ZSCORE', versionsSortedSetKey, key) or '0'

local success

if compareOperator == '<' then
    success = tonumber(currentVersion) < tonumber(compareVersion)
elseif compareOperator == '<=' then
    success = tonumber(currentVersion) <= tonumber(compareVersion)
elseif compareOperator == '==' then
    success = tonumber(currentVersion) == tonumber(compareVersion)
elseif compareOperator == '!=' then
    success = tonumber(currentVersion) ~= tonumber(compareVersion)
elseif compareOperator == '>=' then
    success = tonumber(currentVersion) >= tonumber(compareVersion)
elseif compareOperator == '>' then
    success = tonumber(currentVersion) > tonumber(compareVersion)
else
    success = false
end

if not success then return {currentRevision, success} end

redis.call('HSET', valuesHashKey, key, value)
redis.call('ZADD', keysSortedSetKey, '0', key)
redis.call('ZADD', versionsSortedSetKey, version, key)

local revision = redis.call('XADD', changesStreamKey, 'MAXLEN', '~',
                            streamMaxLen, '*', 'prev', currentRevision, 'key',
                            key, 'value', value, 'version', version)

redis.call('SET', revisionKey, revision)

return {revision, success}
