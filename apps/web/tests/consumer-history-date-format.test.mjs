import assert from 'node:assert/strict';
import test from 'node:test';
import {createHistoryDateFormatter} from '../src/app/me/taps/history-date-format.ts';

test('History UTC labels distinguish morning, afternoon and midnight with numeric parts',()=>{
 const format=createHistoryDateFormatter('UTC').format;
 for(const [raw,expected] of [
  ['2026-10-13T08:15:00.123456Z','13/10/2026 · 08:15'],
  ['2026-10-13T18:15:00.123456Z','13/10/2026 · 18:15'],
  ['2026-10-13T00:00:00.999999Z','13/10/2026 · 00:00'],
 ]){
  const visible=format(new Date(raw));assert.equal(visible,expected);
  assert.deepEqual([...visible].filter(c=>c.codePointAt(0)>127).map(c=>c.codePointAt(0)),[0x00b7]);
  assert.doesNotMatch(visible,/am|pm|a\.\s*m\.|p\.\s*m\.|\u00a0|\u202f/i);
 }
});

test('History selected device zone changes only the display date, including crossing midnight',()=>{
 const raw='2026-10-13T01:15:00.123456Z',date=new Date(raw),instant=date.getTime();
 assert.equal(createHistoryDateFormatter('UTC').format(date),'13/10/2026 · 01:15');
 assert.equal(createHistoryDateFormatter('America/Argentina/Buenos_Aires').format(date),'12/10/2026 · 22:15');
 assert.equal(createHistoryDateFormatter('Asia/Tokyo').format(date),'13/10/2026 · 10:15');
 assert.equal(date.getTime(),instant);assert.equal(raw,'2026-10-13T01:15:00.123456Z');
});

test('Gregorian Latin digits and h23 remain explicit independent of default locale',()=>{
 const date=new Date('2026-02-03T23:59:00.000001Z');
 assert.equal(createHistoryDateFormatter('UTC').format(date),'03/02/2026 · 23:59');
 assert.throws(()=>createHistoryDateFormatter('not/a-timezone'),RangeError);
});
