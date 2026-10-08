import { expect, it } from 'vitest';
import { parseJson, serializeJson } from './parsers';

it('json parameters made by json() are sent as they are (never encoded twice)', () => {
  const text = JSON.stringify({ duration: 'm6', conditions: ['thyroid'] });
  expect(serializeJson(text)).toBe(text);
  expect(serializeJson({ a: 1 })).toBe('{"a":1}');
});

it('rows stored as a JSON string read back as the object they meant', () => {
  const object = { duration: 'm6', format: 'online' };
  expect(parseJson(JSON.stringify(object))).toEqual(object);
  // written double-encoded before the fix
  expect(parseJson(JSON.stringify(JSON.stringify(object)))).toEqual(object);
  expect(parseJson(JSON.stringify(JSON.stringify([1, 2])))).toEqual([1, 2]);
  // a genuine string stays a string
  expect(parseJson('"merhaba"')).toBe('merhaba');
  expect(parseJson('"{not json"')).toBe('{not json');
});
