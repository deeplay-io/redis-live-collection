local valuesHashKey = KEYS[1]
local keysSortedSetKey = KEYS[2]
local versionsSortedSetKey = KEYS[3]
local revisionKey = KEYS[4]
local min = ARGV[1]
local max = ARGV[2]

local revision = redis.call('GET', revisionKey) or '0-0'

local range = redis.call('ZRANGEBYLEX', keysSortedSetKey, min, max)

local items = {}

for i = 1, #range do
  local key = range[i]
  local version = redis.call('ZSCORE', versionsSortedSetKey, key)
  local value = redis.call('HGET', valuesHashKey, key)

  table.insert(items, {key, value, version})
end

return {revision, items}
