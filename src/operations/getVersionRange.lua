local valuesHashKey = KEYS[1]
local versionsSortedSetKey = KEYS[2]
local revisionKey = KEYS[3]
local min = ARGV[1]
local max = ARGV[2]

local revision = redis.call('GET', revisionKey) or '0-0'

local range = redis.call('ZRANGEBYSCORE', versionsSortedSetKey, min, max,
                         'WITHSCORES')

local items = {}

for i = 1, #range, 2 do
  local key = range[i]
  local version = range[i+1]
  local value = redis.call('HGET', valuesHashKey, key)

  table.insert(items, {key, value, version})
end

return {revision, items}
