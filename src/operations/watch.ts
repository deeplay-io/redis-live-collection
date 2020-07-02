import IORedis = require('ioredis');
import {Observable} from 'rxjs';
import {ChangeEvent, changeEventFromEntry} from '../changeEvents';
import {getKey, CHANGES_STREAM_SUFFIX} from '../keys';

export function watch(
  redis: IORedis.Redis | IORedis.Cluster,
  collection: string,
  lastRevision: string,
  blockMs: number = 2500,
): Observable<ChangeEvent[]> {
  return new Observable((subscriber) => {
    async function iterate() {
      while (true) {
        if (subscriber.closed) {
          return;
        }

        const result = await redis.xreadBuffer(
          'BLOCK',
          blockMs,
          'STREAMS',
          getKey(collection, CHANGES_STREAM_SUFFIX),
          lastRevision,
        );

        if (result == null) {
          continue;
        }

        const entries = result[0][1];

        const events = entries.map((entry) => changeEventFromEntry(entry));

        if (events.length > 0) {
          if (events[0].prevRevision !== lastRevision) {
            throw new Error(
              'Failed to continuously read change events from stream. Consider increasing `maxlen` parameter',
            );
          }

          lastRevision = events[events.length - 1].revision;
        }

        subscriber.next(events);
      }
    }

    iterate().catch((err) => subscriber.error(err));
  });
}
