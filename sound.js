// sound.js — ระบบเสียงของคลิป: เพลงพื้นหลัง + เสียงประกอบ (SFX) + เสียงพากย์ AI ให้ตรงจังหวะภาพ
// ไม่ต้องแก้ไฟล์นี้ ; หน้าคลิปแค่ตั้ง window.CLIP_SOUND = { music, sfx, voice } (ดู CLAUDE.md)
(function () {
  const SR = 48000;
  const ROOT = new URL('./', document.currentScript.src).href; // โฟลเดอร์ที่ sound.js อยู่ (ราก repo)
  const dctx = new OfflineAudioContext(2, SR, SR); // ใช้ถอดรหัสไฟล์เสียงอย่างเดียว
  const S = (window.SOUND = { lines: [], buffer: null, status: '', missing: [] });
  let catalog = null, mixed = null;

  const decode = (ab) => new Promise((ok, no) => dctx.decodeAudioData(ab, ok, no));
  async function getCatalog() {
    if (!catalog) catalog = fetch(ROOT + 'sounds/catalog.json').then((r) => r.json()).catch(() => []);
    return catalog;
  }
  const cache = {};
  async function loadSound(name) {
    if (name.startsWith('synth:')) return synth(name.slice(6));
    let url = name;
    if (!/[./]/.test(name)) { // ชื่อในคลัง เช่น 'zombie_groan'
      const e = (await getCatalog()).find((x) => x.id === name);
      if (!e) throw new Error('ไม่มีเสียงชื่อ ' + name + ' ในคลัง');
      url = 'sounds/' + e.file;
    }
    const full = new URL(url, ROOT).href;
    if (!cache[full]) cache[full] = fetch(full).then((r) => { if (!r.ok) throw new Error('ไม่พบไฟล์ ' + url); return r.arrayBuffer(); }).then(decode);
    return cache[full];
  }

  // ---------- เสียงสังเคราะห์ (ไม่ต้องมีไฟล์) : synth:whoosh hit boom pop riser beep ding tick heartbeat ----------
  async function synth(kind) {
    const len = { whoosh: .7, hit: .5, boom: 1.6, pop: .12, riser: 2.2, beep: .2, ding: 1, tick: .05, heartbeat: .9 }[kind];
    if (!len) throw new Error('ไม่มีเสียงสังเคราะห์ ' + kind);
    const c = new OfflineAudioContext(1, Math.ceil(len * SR), SR), out = c.createGain();
    out.connect(c.destination);
    const noise = () => { const b = c.createBuffer(1, c.length, SR), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; return s; };
    const env = (g, a, peak, d) => { g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(peak, a); g.gain.exponentialRampToValueAtTime(.001, a + d); };
    const tone = (type, f0, f1, t, a, d, v) => { const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + a + d); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.001, t + a + d); o.connect(g).connect(out); o.start(t); o.stop(t + a + d + .02); };
    if (kind === 'whoosh' || kind === 'riser') {
      const n = noise(), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'bandpass'; f.Q.value = 1.2;
      if (kind === 'whoosh') { f.frequency.setValueAtTime(300, 0); f.frequency.exponentialRampToValueAtTime(2800, .35); f.frequency.exponentialRampToValueAtTime(400, len); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(.9, .3); g.gain.linearRampToValueAtTime(0, len); }
      else { f.frequency.setValueAtTime(200, 0); f.frequency.exponentialRampToValueAtTime(6000, len); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(.7, len - .05); g.gain.linearRampToValueAtTime(0, len); tone('sawtooth', 110, 880, 0, len - .1, .08, .12); }
      n.connect(f).connect(g).connect(out); n.start();
    } else if (kind === 'hit' || kind === 'boom') {
      tone('sine', kind === 'boom' ? 90 : 160, 35, 0, .005, len - .05, 1);
      const n = noise(), g = c.createGain(), f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'boom' ? 900 : 2500; env(g, .003, .6, kind === 'boom' ? .8 : .15); n.connect(f).connect(g).connect(out); n.start();
    } else if (kind === 'pop') tone('sine', 500, 1400, 0, .004, .09, .8);
    else if (kind === 'beep') tone('square', 880, 880, 0, .005, .17, .25);
    else if (kind === 'ding') { tone('sine', 1320, 1320, 0, .003, .95, .5); tone('sine', 2640, 2640, 0, .003, .5, .15); }
    else if (kind === 'tick') { const n = noise(), g = c.createGain(), f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3000; env(g, .001, .8, .03); n.connect(f).connect(g).connect(out); n.start(); }
    else if (kind === 'heartbeat') { tone('sine', 70, 45, 0, .01, .15, 1); tone('sine', 65, 40, .28, .01, .18, .8); }
    return c.startRendering();
  }

  // ---------- เสียงพากย์ AI (Gemini TTS ฟรี ใช้คีย์ของผู้ใช้เอง เก็บในเครื่อง) ----------
  const MODELS = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts', 'gemini-2.5-flash-preview-tts'];
  S.key = () => localStorage.getItem('gemini_key') || '';
  S.setKey = (k) => localStorage.setItem('gemini_key', (k || '').trim());
  const idb = () => new Promise((ok, no) => { const r = indexedDB.open('clip-voice', 1); r.onupgradeneeded = () => r.result.createObjectStore('v'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  async function idbGet(k) { try { const db = await idb(); return await new Promise((ok) => { const q = db.transaction('v').objectStore('v').get(k); q.onsuccess = () => ok(q.result); q.onerror = () => ok(null); }); } catch (e) { return null; } }
  async function idbPut(k, v) { try { const db = await idb(); db.transaction('v', 'readwrite').objectStore('v').put(v, k); } catch (e) {} }
  function pcmToBuffer(ab) { // Gemini ส่ง PCM 16-bit 24kHz mono (หรือ WAV)
    const v = new DataView(ab), n = ab.byteLength >> 1, b = dctx.createBuffer(1, n, 24000), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = v.getInt16(i * 2, true) / 32768;
    return b;
  }
  function trim(b) { // ตัดเงียบหัวท้าย
    const d = b.getChannelData(0); let s = 0, e = d.length - 1;
    while (s < e && Math.abs(d[s]) < .01) s++; while (e > s && Math.abs(d[e]) < .01) e--;
    s = Math.max(0, s - b.sampleRate * .03 | 0); e = Math.min(d.length - 1, e + b.sampleRate * .08 | 0);
    const o = dctx.createBuffer(1, e - s + 1, b.sampleRate); o.getChannelData(0).set(d.subarray(s, e + 1)); return o;
  }
  async function tts(line) {
    const voice = line.voice || 'Kore', text = (line.style ? line.style + ': ' : '') + line.text, id = voice + '|' + text;
    let raw = await idbGet(id);
    if (!raw) {
      const key = S.key(); if (!key) return null;
      for (const m of MODELS) {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }),
        }).catch(() => null);
        const j = r && (await r.json().catch(() => null));
        const d = j?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
        if (d) { raw = Uint8Array.from(atob(d), (ch) => ch.charCodeAt(0)).buffer; break; }
        if (r && r.status === 400 && /API key/i.test(JSON.stringify(j))) throw new Error('คีย์ Gemini ไม่ถูกต้อง');
      }
      if (!raw) throw new Error('สร้างเสียงพากย์ไม่สำเร็จ (โควตาหมด/เน็ต) ลองใหม่ภายหลัง');
      idbPut(id, raw);
    }
    const head = new TextDecoder().decode(new Uint8Array(raw, 0, 4));
    return trim(head === 'RIFF' ? await decode(raw.slice(0)) : pcmToBuffer(raw));
  }

  // ---------- โหลดทุกเสียง + จัดเวลา ----------
  // voice: [{t:วินาที (ไม่ใส่ = ต่อจากประโยคก่อน), text, voice:'Kore'|'Puck'|'Charon'|..., style:'พูดตื่นเต้น', file:'voice/x.mp3', vol}]
  // เสียงพากย์ที่เซิร์ฟเวอร์ทำให้อัตโนมัติ (บน cloud เรียก TTS ไม่ได้) — voice/auto.json = { "<เสียง>|<style>|<ข้อความ>": "voice/auto/xxx.mp3" }
  // มีในนี้ = ใช้ไฟล์เลย ไม่ต้องใส่คีย์ ; ยังไม่มี = ใช้คีย์ Gemini ในเครื่อง (ถ้ามี) — ไฟล์มาเองภายใน ~5 นาทีหลัง Merge
  let autoMap = null;
  const autoKey = (l) => (l.voice || 'Kore') + '|' + (l.style || '') + '|' + l.text;
  async function auto() { if (!autoMap) autoMap = fetch(ROOT + 'voice/auto.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})); return autoMap; }
  S.autoFile = async (l) => (await auto())[autoKey(l)] || '';
  S.prepare = async function (onMsg = () => {}) {
    const cfg = window.CLIP_SOUND || {};
    S.missing = []; const warn = (m) => { S.missing.push(m); console.warn(m); };
    const lines = (cfg.voice || []).map((l) => ({ ...l }));
    let prevEnd = 0, noVoice = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]; onMsg('เตรียมเสียงพากย์ ' + (i + 1) + '/' + lines.length);
      try { const af = l.file ? '' : await S.autoFile(l); l.buf = l.file ? await loadSound(l.file) : af ? await loadSound(af) : await tts(l); } catch (e) { warn(e.message); l.buf = null; }
      if (!l.buf) noVoice++;
      l.dur = l.buf ? l.buf.duration : Math.max(1.2, l.text.length * .09); // ไม่มีเสียง = ประมาณจากความยาวข้อความ
      if (l.t == null) l.t = prevEnd + (i ? .25 : .3);
      l.end = l.t + l.dur; prevEnd = l.end;
      if (i && l.t < lines[i - 1].end - .05) warn(`ประโยค ${i + 1} เริ่มก่อนประโยค ${i} พูดจบ ${(lines[i - 1].end - l.t).toFixed(1)} วิ`);
    }
    S.lines = lines; S.noVoice = noVoice;
    const sfx = [];
    for (const e of cfg.sfx || []) { try { sfx.push({ ...e, buf: await loadSound(e.s) }); } catch (er) { warn(er.message); } }
    let music = null;
    if (cfg.music) { try { music = { ...cfg.music, buf: await loadSound(cfg.music.s) }; } catch (er) { warn(er.message); } }
    return { lines, sfx, music };
  };

  // ผสมทุกอย่างเป็นเสียงก้อนเดียวยาว end วินาที (ใช้ทั้งตอนเล่นและตอนบันทึก MP4 → ตรงกันเป๊ะ)
  S.mix = async function (end, onMsg) {
    const { lines, sfx, music } = await S.prepare(onMsg);
    onMsg && onMsg('กำลังผสมเสียง…');
    const c = new OfflineAudioContext(2, Math.ceil(end * SR), SR);
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -6; comp.ratio.value = 12; comp.attack.value = .003; comp.release.value = .15;
    comp.connect(c.destination);
    const play = (buf, t, vol, opt = {}) => { const s = c.createBufferSource(), g = c.createGain(); s.buffer = buf; s.loop = !!opt.loop; if (opt.rate) s.playbackRate.value = opt.rate; g.gain.value = vol; s.connect(g).connect(comp); s.start(Math.max(0, t), opt.offset || 0, opt.dur); return g; };
    if (music) {
      const v = music.vol ?? .35, g = play(music.buf, music.t || 0, v, { loop: music.loop !== false, offset: music.offset });
      const a = g.gain, fi = music.fadeIn ?? .5, fo = music.fadeOut ?? 1.5, duck = v * (music.duck ?? .4), t0 = music.t || 0;
      a.setValueAtTime(0, t0); a.linearRampToValueAtTime(v, t0 + fi);
      for (const l of lines) if (l.buf) { a.setValueAtTime(v, Math.max(t0 + fi, l.t - .15)); a.linearRampToValueAtTime(duck, l.t); a.setValueAtTime(duck, l.end); a.linearRampToValueAtTime(v, l.end + .3); } // ลดเพลงตอนพากย์
      a.setValueAtTime(a.value, Math.max(0, end - fo)); a.linearRampToValueAtTime(0, end);
    }
    for (const e of sfx) play(e.buf, e.t, e.vol ?? .8, { dur: e.dur, rate: e.rate, offset: e.offset });
    for (const l of lines) if (l.buf) play(l.buf, l.t, l.vol ?? 1);
    S.buffer = mixed = await c.startRendering();
    return mixed;
  };

  S.has = () => { const c = window.CLIP_SOUND; return !!(c && (c.music || (c.sfx && c.sfx.length) || (c.voice && c.voice.length))); };
  // ประโยคพากย์ที่กำลังพูดตอนเวลา t (ใช้วาดซับให้ตรงเสียง) ; ก่อน prepare ใช้เวลาจาก CLIP_SOUND ตรงๆ
  S.say = function (t) {
    const ls = S.lines.length ? S.lines : (window.CLIP_SOUND?.voice || []).map((l, i, a) => ({ ...l, end: l.end ?? (a[i + 1]?.t ?? l.t + 3) }));
    return ls.find((l) => t >= l.t && t < l.end + .35) || null;
  };
})();
