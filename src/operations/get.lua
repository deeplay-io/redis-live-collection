local valuesHashKey = KEYS[1]
local versionsSortedSetKey = KEYS[2]
local revisionKey = KEYS[3]
local key = ARGV[1]

local revision = redis.call('GET', revisionKey) or '0-0'

local value = redis.call('HGET', valuesHashKey, key)

if not value then return {revision} end

local version = redis.call('ZSCORE', KEYS[2], key)

return {revision, value, version}
