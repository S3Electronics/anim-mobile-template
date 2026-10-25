// player.js — ปุ่ม ▶ เล่น / ⬇ บันทึกเป็น MP4 (ภาพ+เสียง) / 🔑 เสียงพากย์ AI  — ไม่ต้องแก้ไฟล์นี้
// หน้าคลิปต้องมี <canvas width=1080 height=1920>, window.END (วินาที), window.render(t) ; เสียงตั้งที่ window.CLIP_SOUND
(function () {
  const FPS = 30, cv = document.querySelector('canvas'), END = () => window.END || 20;
  const ui = document.createElement('div');
  // ★ครั้งแรก: ต้องใส่คีย์ Gemini ก่อน (26 ต.ค. user สั่ง) — ยังไม่มีคีย์ = ซ่อนปุ่มเล่น/บันทึก ; คีย์เก็บใน localStorage เครื่องนี้เท่านั้น
  ui.innerHTML = `<div id="pl-gate" hidden><b>ก่อนเริ่ม: ใส่คีย์เสียงพากย์ (ทำครั้งเดียว)</b>
  <ol><li>เปิด <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> ล็อกอิน Google</li><li>กด <b>Create API key</b> แล้วกดคัดลอก (ฟรี)</li><li>วางในช่องนี้ แล้วกดบันทึก</li></ol>
  <input id="pl-gkey" type="password" placeholder="AIza…" autocomplete="off" autocapitalize="off" spellcheck="false"><button id="pl-gsave">บันทึกคีย์</button>
  <small>คีย์เก็บในเบราว์เซอร์เครื่องนี้เท่านั้น ไม่ขึ้น GitHub · ห้ามแปะคีย์ในแชทกับ Claude</small><div id="pl-gerr"></div></div>
  <div id="pl-main"><div class="pl-row"><button id="pl-play">▶ เล่น</button><button id="pl-rec" class="rec">⬇ บันทึกเป็น MP4</button></div>
  <div class="pl-row" id="pl-voice-row" hidden><button id="pl-key" class="key">🔑 เสียงพากย์ AI</button></div><div id="pl-st"></div></div>`;
  const css = document.createElement('style');
  css.textContent = `.pl-row{display:flex;gap:8px;margin:10px auto 0;width:min(92vw,360px)}.pl-row button{flex:1;padding:12px;border-radius:12px;border:1px solid #0a84ff;background:transparent;color:#0a84ff;font:600 15px -apple-system,sans-serif}
  .pl-row button.rec{border-color:#ff453a;color:#ff453a}.pl-row button.key{border-color:#30d158;color:#30d158}#pl-st{width:min(92vw,360px);margin:8px auto;font:13px -apple-system,sans-serif;color:#999;text-align:center;min-height:18px}
  #pl-gate{width:min(92vw,360px);margin:12px auto 0;padding:14px 16px;border-radius:14px;background:#1c1c1e;font:15px/1.5 -apple-system,sans-serif;color:#eee;box-sizing:border-box}#pl-gate ol{margin:8px 0 10px;padding-left:20px}#pl-gate a{color:#0a84ff}
  #pl-gate input{width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1px solid #3a3a3c;background:#000;color:#fff;font:16px -apple-system,sans-serif}#pl-gate button{width:100%;margin-top:8px;padding:12px;border-radius:12px;border:0;background:#30d158;color:#000;font:700 16px -apple-system,sans-serif}
  #pl-gate small{display:block;margin-top:8px;color:#8e8e93;font-size:12px}#pl-gerr{color:#ff453a;font-size:13px;margin-top:6px;min-height:16px}
  a.pl-dl{display:block;text-align:center;color:#30d158;margin:8px;font:16px -apple-system,sans-serif}`;
  document.head.appendChild(css); cv.after(ui);
  const $ = (id) => document.getElementById(id), st = (m) => ($('pl-st').textContent = m);
  const hasVoice = () => !!(window.CLIP_SOUND?.voice?.some((l) => !l.file));
  // ประโยคที่ยังไม่มีไฟล์และเซิร์ฟเวอร์ยังไม่ทำให้ → ค่อยโชว์ช่องคีย์
  (async () => { const L = (window.CLIP_SOUND?.voice || []).filter((l) => !l.file); for (const l of L) if (!(await SOUND.autoFile(l))) { $('pl-voice-row').hidden = false; break; } })();
  const ready = document.fonts.ready.then(() => window.render(0));
  const gate = (on) => { $('pl-gate').hidden = !on; $('pl-main').hidden = on; };
  gate(!window.SOUND?.key());
  $('pl-gsave').onclick = async () => {
    const k = $('pl-gkey').value.trim(), er = (m) => ($('pl-gerr').textContent = m);
    if (!/^AIza[0-9A-Za-z_-]{30,}$/.test(k)) return er('คีย์ต้องขึ้นต้น AIza… ลองคัดลอกใหม่');
    er(''); $('pl-gsave').disabled = true; $('pl-gsave').textContent = 'กำลังตรวจคีย์…';
    try {   // ตรวจว่าคีย์ใช้ได้จริง (ขอรายชื่อโมเดล ไม่เสียโควตาพากย์)
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=' + encodeURIComponent(k));
      if (r.status === 400 || r.status === 403) throw new Error('bad');
    } catch (e) { if (e.message === 'bad') { er('คีย์นี้ใช้ไม่ได้ ลองสร้างใหม่ที่ aistudio.google.com/apikey'); $('pl-gsave').disabled = false; $('pl-gsave').textContent = 'บันทึกคีย์'; return; } }
    window.SOUND.setKey(k); $('pl-gkey').value = ''; gate(false); st('บันทึกคีย์แล้ว ✓ กด ▶ เล่น ได้เลย');
  };

  $('pl-key').onclick = () => {
    const k = prompt('วางคีย์ Gemini API (ฟรี สร้างที่ aistudio.google.com/apikey)\nคีย์เก็บในมือถือเครื่องนี้เท่านั้น ไม่ถูกส่งขึ้น GitHub', window.SOUND.key());
    if (k != null) { window.SOUND.setKey(k); st(k ? 'บันทึกคีย์แล้ว กด ▶ เล่น เพื่อฟังเสียงพากย์' : 'ลบคีย์แล้ว'); }
  };
  function report() {
    const S = window.SOUND, m = [];
    if (S.noVoice) m.push(S.key() ? `เสียงพากย์ยังไม่ได้ ${S.noVoice} ประโยค` : 'ยังไม่มีเสียงพากย์ AI: กด 🔑 ใส่คีย์ Gemini ฟรี (ตอนนี้ใช้เสียงอ่านของเครื่องแทน แต่ไม่ติดไปใน MP4)');
    if (S.missing.length) m.push(S.missing.slice(0, 2).join(' · '));
    return m.join(' · ');
  }

  // ---------- เล่น ----------
  let actx, playing = null;
  $('pl-play').onclick = async () => {
    await ready;
    if (playing) { playing.stop(); return; }
    let src = null, t0 = performance.now(), clock = () => (performance.now() - t0) / 1000;
    if (window.SOUND?.has()) {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)(); await actx.resume(); // ต้องสร้างตอนกดปุ่ม (iPhone)
      try { const buf = await window.SOUND.mix(END(), st); src = actx.createBufferSource(); src.buffer = buf; src.connect(actx.destination); src.start(); const a0 = actx.currentTime; clock = () => actx.currentTime - a0; }
      catch (e) { st('เสียงมีปัญหา: ' + e.message); }
    }
    st(window.SOUND ? report() : ''); $('pl-play').textContent = '■ หยุด';
    const spoken = new Set(); let stop = false;
    playing = { stop: () => { stop = true; } };
    (function f() {
      const t = clock();
      window.render(Math.min(t, END()));
      for (const l of window.SOUND?.lines || []) if (!l.buf && t >= l.t && !spoken.has(l) && window.speechSynthesis) { // ไม่มีเสียง AI → ให้เครื่องอ่านแทน (เช็คจังหวะ)
        spoken.add(l); const u = new SpeechSynthesisUtterance(l.text); u.lang = 'th-TH'; speechSynthesis.speak(u);
      }
      if (t < END() && !stop) requestAnimationFrame(f);
      else { try { src && src.stop(); } catch (e) {} speechSynthesis?.cancel(); playing = null; $('pl-play').textContent = '▶ เล่น'; }
    })();
  };

  // ---------- บันทึก MP4 ----------
  $('pl-rec').onclick = async () => {
    await ready; if (playing) playing.stop();
    const end = END(), S = window.SOUND;
    let audio = null;
    if (S?.has()) { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); await actx.resume(); try { audio = await S.mix(end, st); } catch (e) { st('เสียงมีปัญหา: ' + e.message); } }
    const msg = S ? report() : '';
    try { await fast(end, audio); }
    catch (e) { console.warn('fast path', e); await realtime(end, audio); }
    if (msg) st($('pl-st').textContent + ' · ' + msg);
  };

  const aacCfg = { codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 };
  async function fast(end, audio) { // WebCodecs: เร็วกว่าเวลาจริง
    if (!window.VideoEncoder) throw 'no VideoEncoder';
    const cfg = { codec: 'avc1.640028', width: 1080, height: 1920, bitrate: 6e6, framerate: FPS };
    if (!(await VideoEncoder.isConfigSupported(cfg)).supported) throw 'no h264';
    if (audio && !(window.AudioEncoder && (await AudioEncoder.isConfigSupported(aacCfg)).supported)) throw 'no aac encoder';
    const mux = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: 'avc', width: 1080, height: 1920 },
      audio: audio ? { codec: 'aac', numberOfChannels: 2, sampleRate: 48000 } : undefined, fastStart: 'in-memory' });
    let err = null;
    const enc = new VideoEncoder({ output: (c, m) => mux.addVideoChunk(c, m), error: (e) => (err = e) }); enc.configure(cfg);
    const n = Math.round(end * FPS);
    for (let i = 0; i < n; i++) {
      while (enc.encodeQueueSize > 2) await new Promise((r) => setTimeout(r, 5)); // รอ encoder ไม่ให้เฟรมกองจนแรมเต็ม (มือถือรีโหลดเอง)
      window.render(i / FPS);
      const fr = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / FPS), duration: Math.round(1e6 / FPS) }); enc.encode(fr, { keyFrame: i % 60 === 0 }); fr.close();
      if (i % 15 === 0) { st('กำลังสร้างภาพ ' + Math.round(i / n * 100) + '%'); await new Promise((r) => setTimeout(r, 0)); }
      if (err) throw err;
    }
    await enc.flush();
    if (audio) {
      st('กำลังใส่เสียง…');
      const aenc = new AudioEncoder({ output: (c, m) => mux.addAudioChunk(c, m), error: (e) => (err = e) }); aenc.configure(aacCfg);
      const L = audio.getChannelData(0), R = audio.numberOfChannels > 1 ? audio.getChannelData(1) : L, step = 4800;
      for (let i = 0; i < audio.length; i += step) {
        const k = Math.min(step, audio.length - i), d = new Float32Array(k * 2); d.set(L.subarray(i, i + k), 0); d.set(R.subarray(i, i + k), k);
        const ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: k, numberOfChannels: 2, timestamp: Math.round(i / 48000 * 1e6), data: d });
        while (aenc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5));
        aenc.encode(ad); ad.close();
      }
      await aenc.flush(); if (err) throw err;
    }
    mux.finalize(); done(new Blob([mux.target.buffer], { type: 'video/mp4' }), 'clip.mp4');
  }

  function realtime(end, audio) { // เครื่องที่ไม่รองรับ → อัดแบบเวลาจริง (รอเท่าความยาวคลิป)
    return new Promise((resolve) => {
      const ty = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find((x) => MediaRecorder.isTypeSupported(x));
      const stream = cv.captureStream(FPS); let src = null, clock;
      if (audio) { const dst = actx.createMediaStreamDestination(); src = actx.createBufferSource(); src.buffer = audio; src.connect(dst); dst.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr)); }
      st('เครื่องนี้ใช้โหมดอัดสด รอ ' + Math.ceil(end) + ' วินาที ห้ามสลับแอป…');
      const r = new MediaRecorder(stream, { mimeType: ty, videoBitsPerSecond: 8e6 }), ch = [];
      r.ondataavailable = (x) => ch.push(x.data);
      r.onstop = () => { done(new Blob(ch, { type: ty }), ty.includes('mp4') ? 'clip.mp4' : 'clip.webm'); resolve(); };
      window.render(0); r.start();
      if (src) { src.start(); const a0 = actx.currentTime; clock = () => actx.currentTime - a0; } else { const p0 = performance.now(); clock = () => (performance.now() - p0) / 1000; }
      (function f() { const t = clock(); window.render(Math.min(t, end)); if (t < end) requestAnimationFrame(f); else setTimeout(() => r.stop(), 150); })();
    });
  }

  function done(b, n) {
    st('เสร็จแล้ว ' + (b.size / 1048576).toFixed(1) + ' MB');
    document.querySelectorAll('a.pl-dl').forEach((a) => a.remove());
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = n; a.className = 'pl-dl'; a.textContent = 'แตะเพื่อบันทึก ' + n; ui.appendChild(a);
    window.RESULT = { n, size: b.size, blob: b };
  }
})();
