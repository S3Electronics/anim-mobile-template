#!/usr/bin/env node
// หาเสียงฟรีถูกลิขสิทธิ์ (CC0) มาใส่คลิป — ไม่ต้องติดตั้งอะไร (Node 18+)
//   node tools/find-sound.mjs ซอมบี้            ค้นหา (ไทยหรืออังกฤษ) จาก 3 แหล่ง เรียงตามนี้
//   node tools/find-sound.mjs get <id>          โหลดเข้า sounds/ + เพิ่มใน sounds/catalog.json → ใช้ชื่อ <id> ใน CLIP_SOUND ได้ทันที
// แหล่ง: 1) คลังใน repo (sounds/catalog.json)  2) คลังเสริม ~340 ไฟล์ บน GitHub (โหลดได้แม้เน็ต cloud จำกัด)
//        3) Openverse/Freesound (ทั้งเว็บ ใช้ได้เมื่อเน็ตเปิด เช่น Codespaces/คอม — ใน Claude cloud มักโดนบล็อก)
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CAT = path.join(ROOT, 'sounds/catalog.json');
const EXT = 'https://raw.githubusercontent.com/S3Electronics/anim-sounds/main/';
const local = JSON.parse(fs.readFileSync(CAT, 'utf8'));
const [cmd, ...rest] = process.argv.slice(2);
if (!cmd) { console.log('ใช้: node tools/find-sound.mjs <คำค้น>  |  get <id>'); process.exit(0); }

const words = (q) => q.toLowerCase().split(/\s+/).filter(Boolean);
const match = (e, ws) => { const h = [e.id, e.tags, e.title].join(' ').toLowerCase(); return ws.every((w) => h.includes(w)); };
async function getJSON(u) { const r = await fetch(u, { signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error(r.status + ' ' + u); return r.json(); }
async function extCatalog() { try { return await getJSON(EXT + 'catalog.json'); } catch (e) { console.log('  (คลังเสริมโหลดไม่ได้: ' + e.message + ')'); return []; } }
async function openverse(q) {
  try {
    const j = await getJSON('https://api.openverse.org/v1/audio/?license=cc0&page_size=12&q=' + encodeURIComponent(q));
    return j.results.map((r) => ({ id: 'ov_' + r.id.slice(0, 8), tags: q, title: r.title, dur: Math.round((r.duration || 0) / 100) / 10, author: r.creator, source: r.foreign_landing_url, url: r.url, license: 'CC0' }));
  } catch (e) { console.log('  (Openverse ใช้ไม่ได้ — เน็ตถูกจำกัด: ' + e.message + ')'); return []; }
}
const show = (e) => console.log(`  ${e.id.padEnd(24)} ${String(e.dur ?? '?').padStart(5)} วิ  ${e.tags}  — ${e.title || ''}`);

if (cmd !== 'get') {
  const q = [cmd, ...rest].join(' '), ws = words(q);
  const a = local.filter((e) => match(e, ws));
  console.log(`1) คลังใน repo: ${a.length} รายการ (ใช้ชื่อนี้ได้เลย)`); a.forEach(show);
  const ext = (await extCatalog()).filter((e) => match(e, ws) && !local.some((l) => l.id === e.id));
  console.log(`2) คลังเสริม: ${ext.length} รายการ (ต้อง get ก่อน)`); ext.slice(0, 15).forEach(show);
  const ov = /[a-z]/i.test(q) ? await openverse(q) : [];
  if (/[a-z]/i.test(q)) { console.log(`3) Openverse: ${ov.length} รายการ (ต้อง get ก่อน)`); ov.forEach(show); fs.writeFileSync('/tmp/find-sound-last.json', JSON.stringify(ov)); }
  else console.log('3) Openverse: ค้นด้วยคำอังกฤษ เช่น zombie, door creak');
  if (!a.length && !ext.length && !ov.length) console.log('ไม่เจอ → ใช้เสียงสังเคราะห์แทนได้: synth:whoosh hit boom pop riser beep ding tick heartbeat');
} else {
  const id = rest[0];
  if (local.some((e) => e.id === id)) { console.log(id + ' มีในคลังแล้ว ใช้ได้เลย'); process.exit(0); }
  let e = (await extCatalog()).find((x) => x.id === id), url;
  if (e) url = EXT + e.file;
  else {
    let last = []; try { last = JSON.parse(fs.readFileSync('/tmp/find-sound-last.json', 'utf8')); } catch {}
    e = last.find((x) => x.id === id); if (!e) { console.log('ไม่พบ ' + id + ' (ค้นหาก่อนแล้วค่อย get)'); process.exit(1); }
    url = e.url;
  }
  const music = (e.file || '').startsWith('music/') || /music|เพลง/.test(e.tags) && (e.dur || 0) > 15;
  const file = (music ? 'music/' : 'sfx/') + id + '.mp3';
  const r = await fetch(url, { signal: AbortSignal.timeout(60000) }); if (!r.ok) { console.log('โหลดไม่ได้ ' + r.status); process.exit(1); }
  fs.mkdirSync(path.join(ROOT, 'sounds', path.dirname(file)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'sounds', file), Buffer.from(await r.arrayBuffer()));
  local.push({ id, file, tags: e.tags, dur: e.dur, title: e.title, author: e.author, source: e.source, license: 'CC0' });
  fs.writeFileSync(CAT, JSON.stringify(local, null, 0).replace(/\},\{/g, '},\n{'));
  console.log(`โหลดแล้ว → sounds/${file}  ใช้ใน CLIP_SOUND ด้วย s:'${id}'`);
}
