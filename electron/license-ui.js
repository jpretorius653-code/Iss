// ============================================================
//  ISS Weighbridge — licence screen
//
//  Deliberately rendered by the MAIN process, not the renderer. The
//  renderer can be swapped out through the override folder, so anything
//  drawn there could be replaced by a copy with the checks removed. This
//  screen is built into the process that actually enforces the licence.
// ============================================================
'use strict';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* status  — the object from License.status()
   request — the base64 request blob to show the customer
   message — optional error/notice line from a failed attempt */
function licenseHTML(status, request, message) {
  const s = status || {};
  const headline = {
    expired: 'This copy is not licensed',
    invalid: 'The licence on this PC is not valid',
    drift: 'Hardware has changed',
    grace: 'Trial period',
    licensed: 'Licensed',
  }[s.state] || 'Licence';

  const why = s.reason ? `<p class="why">${esc(s.reason)}</p>` : '';
  const warn = !s.keyReady
    ? `<div class="warn">This build was compiled without a licence key, so no licence can be accepted.
         PUBLIC_KEY_PEM in license.js is still the placeholder.</div>` : '';

  return `<!doctype html><html><head><meta charset="utf-8"><title>ISS Weighbridge — Licence</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:linear-gradient(160deg,#0E1B2E 0%,#14294A 55%,#1A3A6B 100%);
       color:#E8EEF6;font:14px 'Segoe UI',system-ui,sans-serif;height:100vh;
       display:flex;align-items:center;justify-content:center;padding:24px}
  .box{width:100%;max-width:620px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);
       border-left:4px solid #D9B45B;border-radius:14px;padding:28px 30px;box-shadow:0 18px 50px rgba(0,0,0,.45)}
  h1{margin:0 0 4px;font-size:21px;letter-spacing:.2px}
  .sub{color:#9DB2CC;font-size:13px;margin-bottom:20px}
  .why{background:rgba(210,74,54,.16);border:1px solid rgba(210,74,54,.5);color:#FFC9C0;
       padding:9px 12px;border-radius:8px;font-size:13px;margin:0 0 18px}
  .warn{background:rgba(200,136,26,.16);border:1px solid rgba(200,136,26,.55);color:#FFD79A;
        padding:9px 12px;border-radius:8px;font-size:12.5px;margin:0 0 18px;line-height:1.5}
  label{display:block;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;
        color:#8FA6C4;margin:0 0 6px}
  .id{font:700 20px 'Courier New',monospace;color:#D9B45B;letter-spacing:2px;
      background:rgba(0,0,0,.3);border:1px solid rgba(217,180,91,.35);border-radius:8px;padding:12px 14px}
  .blob{width:100%;height:74px;font:11px 'Courier New',monospace;color:#CFE0F5;background:rgba(0,0,0,.34);
        border:1px solid rgba(255,255,255,.16);border-radius:8px;padding:9px;resize:none;word-break:break-all}
  .row{display:flex;gap:9px;margin-top:9px;flex-wrap:wrap}
  button{border:none;border-radius:8px;padding:10px 16px;font-size:13px;font-weight:700;cursor:pointer}
  .gold{background:linear-gradient(180deg,#D9B45B,#B08A3E);color:#20180A}
  .ghost{background:rgba(255,255,255,.10);color:#DCE7F5;border:1px solid rgba(255,255,255,.2)}
  .sec{margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,.12)}
  .steps{color:#9DB2CC;font-size:12.5px;line-height:1.7;margin:0 0 16px;padding-left:18px}
  .foot{margin-top:22px;color:#6F86A5;font-size:11.5px;text-align:center;line-height:1.6}
  .ok{color:#7BD3A0}
</style></head><body>
<div class="box">
  <h1>${esc(headline)}</h1>
  <div class="sub">Industrial Scale Solutions &middot; Weigh Forward</div>
  ${warn}${why}
  ${message ? `<p class="why">${esc(message)}</p>` : ''}

  <label>Install ID for this computer</label>
  <div class="id">${esc(s.installId || '—')}</div>

  <div class="sec">
    <ol class="steps">
      <li>Send the request below to Industrial Scale Solutions.</li>
      <li>You will receive a <b>.isslic</b> file in return.</li>
      <li>Click <b>Load licence file</b> and pick it.</li>
    </ol>
    <label>Request</label>
    <textarea class="blob" id="req" readonly>${esc(request || '')}</textarea>
    <div class="row">
      <button class="ghost" onclick="copyReq()">Copy request</button>
      <button class="ghost" onclick="saveReq()">Save request to file</button>
      <button class="gold" onclick="loadLic()">Load licence file</button>
    </div>
    <div class="row"><span id="msg" class="ok"></span></div>
  </div>

  <div class="foot">
    Weighing is unavailable until this copy is licensed.<br>
    Industrial Scale Solutions &middot; 51 Wimbledon Street, eMalahleni
  </div>
</div>
<script>
  const { ipcRenderer } = require('electron');
  function say(t){ document.getElementById('msg').textContent = t; }
  function copyReq(){
    const el = document.getElementById('req');
    el.select(); document.execCommand('copy'); say('Request copied — paste it into WhatsApp or e-mail.');
  }
  async function saveReq(){ const r = await ipcRenderer.invoke('iss-lic-save-request'); if(r && r.path) say('Saved to ' + r.path); }
  async function loadLic(){
    const r = await ipcRenderer.invoke('iss-lic-import');
    if (r && r.ok) { say('Licence accepted — restarting.'); setTimeout(()=>ipcRenderer.invoke('iss-lic-restart'), 900); }
    else if (r && r.reason) say(r.reason);
  }
</script>
</body></html>`;
}

module.exports = { licenseHTML };
