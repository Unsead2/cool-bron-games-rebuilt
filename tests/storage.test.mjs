import test from 'node:test';
import assert from 'node:assert/strict';
import { KEY, clean, load, save, record, purchase } from '../dist/storage.js';

test('sanitization recovers malformed data and permits only earned known skins', () => {
  for (const raw of [null, undefined, false, 12, 'bad']) assert.deepEqual(clean(raw), clean());
  const result = clean({coins:-20, unlocked:['miami','miami','unknown'],skin:'cavs',sound:'yes',stats:{pacbron:{normal:{best:23.8,plays:Infinity}}}});
  assert.equal(result.coins,0);
  assert.deepEqual(result.unlocked,['gold','miami']);
  assert.equal(result.skin,'gold');
  assert.equal(result.sound,false);
  assert.deepEqual(result.stats.pacbron.normal,{best:23,plays:0});
  assert.equal(clean({coins:1e15}).coins,999999999);
});

test('records preserve best scores, isolate difficulty, and ignore invalid rewards', () => {
  const original=clean();
  const first=record(original,'flappybron','normal',12,4);
  const lower=record(first,'flappybron','normal',3,2);
  const invalid=record(lower,'flappybron','normal',Infinity,NaN);
  assert.deepEqual(original,clean(),'record must not mutate previous save');
  assert.deepEqual(invalid.stats.flappybron.normal,{best:12,plays:3});
  assert.equal(invalid.coins,6);
  assert.deepEqual(invalid.stats.flappybron.easy,{best:0,plays:0});
  const improved=record(invalid,'flappybron','normal',19.9,1.9);
  assert.deepEqual(improved.stats.flappybron.normal,{best:19,plays:4});
  assert.equal(improved.coins,7);
});

test('purchases cannot overspend and re-equipping never charges twice', () => {
  const insufficient=clean({coins:29});
  assert.deepEqual(purchase(insufficient,'miami'),insufficient);
  const funded=clean({coins:90});
  const miami=purchase(funded,'miami');
  assert.equal(miami.coins,60);
  assert.equal(miami.skin,'miami');
  const gold=purchase(miami,'gold');
  const equipped=purchase(gold,'miami');
  assert.equal(equipped.coins,60);
  assert.deepEqual(equipped.unlocked,['gold','miami']);
  const cavs=purchase(equipped,'cavs');
  assert.equal(cavs.coins,0);
  assert.equal(cavs.skin,'cavs');
  assert.deepEqual(purchase(cavs,'not-a-skin'),cavs);
  assert.equal(funded.coins,90,'purchases must not mutate the prior save');
});

test('storage round trip preserves progress and reports unavailable storage gracefully', () => {
  const values = new Map();
  const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  assert.equal(load(storage).available,true);
  const progress=record(clean(),'pacbron','hard',900,25);
  assert.equal(save(storage,progress),true);
  assert.deepEqual(load(storage),{data:progress,available:true});
  assert.ok(values.has(KEY));
  for(const broken of [null,{getItem(){throw new Error('denied')},setItem(){throw new Error('quota')}}]) {
    assert.deepEqual(load(broken),{data:clean(),available:false});
    assert.equal(save(broken,progress),false);
  }
  values.set(KEY,'{broken JSON');
  assert.deepEqual(load(storage),{data:clean(),available:false});
});
