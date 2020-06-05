import IORedis = require('ioredis');
import {defineGetCommand} from './operations/get';
import {defineSetCommand} from './operations/set';
import {defineCompareAndSetCommand} from './operations/compareAndSet';
import {defineRemoveCommand} from './operations/remove';
import {defineCompareAndRemoveCommand} from './operations/compareAndRemove';
import {defineGetVersionRangeCommand} from './operations/getVersionRange';
import {defineGetKeyRangeCommand} from './operations/getKeyRange';
import {defineRemoveKeyRangeCommand} from './operations/removeKeyRange';
import {defineRemoveVersionRangeCommand} from './operations/removeVersionRange';

export function initCommands(redis: IORedis.Redis): void {
  defineGetCommand(redis);
  defineSetCommand(redis);
  defineCompareAndSetCommand(redis);
  defineRemoveCommand(redis);
  defineCompareAndRemoveCommand(redis);
  defineGetVersionRangeCommand(redis);
  defineGetKeyRangeCommand(redis);
  defineRemoveKeyRangeCommand(redis);
  defineRemoveVersionRangeCommand(redis);
}
