import {versionFromString} from './versions';

export type ChangeEvent = SetEvent | RemoveEvent;

export type SetEvent = {
  type: 'set';
  revision: string;
  prevRevision: string;
  key: Buffer;
  version: number;
  value: Buffer;
};

export type RemoveEvent = {
  type: 'remove';
  revision: string;
  prevRevision: string;
  key: Buffer;
};

export function changeEventFromEntry(entry: [Buffer, Buffer[]]): ChangeEvent {
  const [revision, fields] = entry;

  const event: {[key: string]: any} = {
    type: 'remove',
    revision: revision.toString(),
  };

  for (let i = 0; i < fields.length; i += 2) {
    const field = fields[i].toString();
    const value = fields[i + 1];

    if (field === 'prev') {
      event.prevRevision = value.toString();
    } else if (field === 'key') {
      event.key = value;
    } else if (field === 'value') {
      event.value = value;
      event.type = 'set';
    } else if (field === 'version') {
      event.version = versionFromString(value.toString());
    }
  }

  return event as ChangeEvent;
}
