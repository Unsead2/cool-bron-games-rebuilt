export const KEY = 'cool-bron-arcade-v2';
export const skins = [{id:'gold',name:'Los Angeles',cost:0,color:'#f9cf53'}, {id:'miami',name:'South Beach',cost:30,color:'#ee658d'}, {id:'cavs',name:'Cleveland',cost:60,color:'#af6ef0'}];
export function clean(raw={}) {
  if (!raw || typeof raw !== "object") raw={};
  const num = n => Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n),999999999) : 0;
  const unlocked = [...new Set(['gold',...(Array.isArray(raw.unlocked)?raw.unlocked:[]).filter(s=>skins.some(x=>x.id===s))])];
  const stats={}; for(const id of ['flappybron','pacbron','fighter']){stats[id]={};for(const d of ['easy','normal','hard']) {const r=raw.stats?.[id]?.[d]||{};stats[id][d]={best:num(r.best),plays:num(r.plays)};}}
  return {version:2,coins:num(raw.coins),unlocked,skin:unlocked.includes(raw.skin)?raw.skin:'gold',stats,sound:raw.sound===true};
}
export function load(storage){try{return {data:clean(JSON.parse(storage.getItem(KEY)||'{}')),available:true}}catch{return {data:clean(),available:false}}}
export function save(storage,data){try{storage.setItem(KEY,JSON.stringify(data));return true}catch{return false}}
export function record(data,id,difficulty,score,coins){const next=clean(data);const row=next.stats[id]?.[difficulty];if(!row)return next;row.best=Math.max(row.best,Math.max(0,Math.floor(Number.isFinite(score)?score:0)));row.plays++;next.coins+=Math.max(0,Math.floor(Number.isFinite(coins)?coins:0));return clean(next)}
export function purchase(data,id){const next=clean(data);const item=skins.find(x=>x.id===id);if(!item)return next;if(next.unlocked.includes(id)){next.skin=id;return next}if(next.coins>=item.cost){next.coins-=item.cost;next.unlocked.push(id);next.skin=id}return next}
