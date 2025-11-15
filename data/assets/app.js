(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))i(a);new MutationObserver(a=>{for(const l of a)if(l.type==="childList")for(const p of l.addedNodes)p.tagName==="LINK"&&p.rel==="modulepreload"&&i(p)}).observe(document,{childList:!0,subtree:!0});function r(a){const l={};return a.integrity&&(l.integrity=a.integrity),a.referrerPolicy&&(l.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?l.credentials="include":a.crossOrigin==="anonymous"?l.credentials="omit":l.credentials="same-origin",l}function i(a){if(a.ep)return;a.ep=!0;const l=r(a);fetch(a.href,l)}})();const g=5e3,k="moto-drag/dev-board-boot-at",c=document.querySelector("#app"),M=`
  <div class="shell">
    <header class="hero">
      <div class="eyebrow">First-run wizard</div>
      <h1>Welcome, Moto-Drag admin</h1>
      <p>Give the track a name, set the lap plan, then calibrate sensors and sync the clock before riders line up.</p>
      <div class="status-pill" data-ref="connection">Board link ready</div>
    </header>

    <section class="grid">
      <article class="card">
        <h2>Track profile</h2>
        <p>These values live on the module and power the SPA right after flashing.</p>
        <form data-form="profile">
          <label>
            Track name
            <input
              required
              name="trackName"
              autocomplete="off"
              maxlength="30"
              placeholder="Tverskaya sprint"
            />
          </label>
          <label>
            Target laps
            <input
              required
              name="lapGoal"
              type="number"
              min="1"
              max="20"
              inputmode="numeric"
              placeholder="3"
            />
            <span class="hint">Use 1-20 laps; riders can still stop earlier.</span>
          </label>

          <button class="btn btn-primary" type="submit">
            Save to module
          </button>
          <div class="inline-status" data-state="idle" data-ref="profileStatus">Waiting for input…</div>
        </form>
      </article>

      <article class="card">
        <h2>Sensor calibration</h2>
        <p>Run this on the bike: the module samples both beams and stores light thresholds.</p>
        <div class="actions">
          <button class="btn btn-outline" type="button" data-action="calibrate">
            Start calibration
          </button>
          <div class="inline-status" data-state="idle" data-ref="calibrationStatus">
            Not started
          </div>
          <div class="meta" data-ref="calibrationMeta"></div>
        </div>
      </article>

      <article class="card">
        <h2>Clock sync</h2>
        <p>Send the phone’s current time so lap timestamps match reality even without Wi-Fi.</p>
        <div class="actions">
          <button class="btn btn-outline" type="button" data-action="sync-clock">
            Send current time
          </button>
          <div class="inline-status" data-state="idle" data-ref="clockStatus">
            Awaiting sync
          </div>
          <div class="meta" data-ref="clockMeta"></div>
        </div>
      </article>
    </section>

    <section class="progress">
      <h3>Launch checklist</h3>
      <ul class="progress-list">
        <li class="progress-item" data-progress="profile">
          <div class="progress-indicator"></div>
          Track profile saved
        </li>
        <li class="progress-item" data-progress="calibration">
          <div class="progress-indicator"></div>
          Sensor calibration captured
        </li>
        <li class="progress-item" data-progress="clock">
          <div class="progress-indicator"></div>
          Clock synced from phone
        </li>
      </ul>
    </section>

    <footer class="footer-cta">
      <button class="btn btn-primary btn-next" type="button" data-ref="nextStep" disabled>
        Continue to rider setup
      </button>
      <p class="hint footer-hint">Finish all tasks above to unlock the next step.</p>
    </footer>
  </div>
  <div class="toast" role="status" aria-live="polite"></div>
`;c.innerHTML=M;const T=(()=>{try{const t=localStorage.getItem(k);if(t&&Number.isFinite(Number(t)))return Number(t);const e=Date.now();return localStorage.setItem(k,String(e)),e}catch{return Date.now()}})(),o={profileForm:c.querySelector('[data-form="profile"]'),profileStatus:c.querySelector('[data-ref="profileStatus"]'),calibrationStatus:c.querySelector('[data-ref="calibrationStatus"]'),calibrationMeta:c.querySelector('[data-ref="calibrationMeta"]'),clockStatus:c.querySelector('[data-ref="clockStatus"]'),clockMeta:c.querySelector('[data-ref="clockMeta"]'),connectionPill:c.querySelector('[data-ref="connection"]'),toast:c.querySelector(".toast"),nextStep:c.querySelector('[data-ref="nextStep"]')},f={profile:c.querySelector('[data-progress="profile"]'),calibration:c.querySelector('[data-progress="calibration"]'),clock:c.querySelector('[data-progress="clock"]')},n={profile:{trackName:"",lapGoal:"",updatedAt:null},calibration:{completedAt:null},clock:{syncedAt:null,syncedMillis:null,hostCapturedAt:null}};C();o.profileForm.addEventListener("submit",x);o.profileForm.addEventListener("input",D);w("calibrate",N);w("sync-clock",v);window.addEventListener("online",b);window.addEventListener("offline",b);setInterval(()=>{A()},1e3);async function C(){s(o.profileStatus,"Loading from module…","idle"),await P(),L(),h(),u(),b(),v(!0)}function x(t){t.preventDefault();const e=new FormData(o.profileForm),r=String(e.get("trackName")||"").trim(),i=Number(e.get("lapGoal"));if(!r)return s(o.profileStatus,"Track name is required","error");if(!Number.isFinite(i)||i<1||i>20)return s(o.profileStatus,"Lap goal must be between 1 and 20","error");const a={trackName:r,lapGoal:i,updatedAt:Date.now()};s(o.profileStatus,"Saving…","idle"),o.profileForm.querySelector('button[type="submit"]').disabled=!0,S("/api/admin/setup",a).then(l=>{if(!l.ok)throw l.error;n.profile={trackName:r,lapGoal:i,updatedAt:a.updatedAt},s(o.profileStatus,"Profile saved on module","success"),d("Track profile saved"),u()}).catch(l=>{console.warn(l),s(o.profileStatus,"Failed to save profile","error"),d("Save failed — retry once the module is online","error")}).finally(()=>{o.profileForm.querySelector('button[type="submit"]').disabled=!1})}function D(t){const e=t.target;if(!(e instanceof HTMLInputElement))return;const{name:r,value:i}=e;r!=="trackName"&&r!=="lapGoal"||(n.profile={...n.profile,[r]:i},n.profile.updatedAt||s(o.profileStatus,"Draft not saved on module yet","idle"))}function N(){s(o.calibrationStatus,"Calibrating…","idle"),S("/api/sensors/calibrate",{startedAt:Date.now()}).then(t=>{if(!t.ok)throw t.error;n.calibration={completedAt:Date.now()},s(o.calibrationStatus,"Calibration stored","success"),h(),u(),d("Sensor calibration updated")}).catch(t=>{console.warn(t),s(o.calibrationStatus,"Calibration failed","error"),d("Could not reach sensors","error")})}function v(t=!1){const e=new Date,r=O(),i={epochMs:e.getTime(),millis:r,iso8601:e.toISOString(),tzOffsetMinutes:e.getTimezoneOffset()*-1};s(o.clockStatus,t?"Auto-sync in progress…":"Sending time…","idle"),S("/api/time/sync",i).then(a=>{if(!a.ok)throw a.error;const l=a.data||{};n.clock={syncedAt:l.syncedAt??i.epochMs,syncedMillis:l.syncedMillis??r,hostCapturedAt:l.hostCapturedAt??Date.now(),moduleTimeMs:l.moduleTimeMs??null,moduleMillis:l.moduleMillis??null},s(o.clockStatus,t?"Clock auto-synced":"Clock updated","success"),h(),u(),d(t?"Clock auto-synced":"Clock synchronized")}).catch(a=>{console.warn(a),s(o.clockStatus,"Time sync failed","error"),d("Time sync failed","error")})}function L(){if(o.profileForm.trackName.value=n.profile.trackName||"",o.profileForm.lapGoal.value=n.profile.lapGoal!==void 0&&n.profile.lapGoal!==null?n.profile.lapGoal:"",n.profile.updatedAt){const t=y(n.profile.updatedAt);s(o.profileStatus,`Last saved ${t}`,"success")}else(n.profile.trackName||n.profile.lapGoal)&&s(o.profileStatus,"Draft not saved on module yet","idle")}function h(){o.calibrationMeta.textContent=n.calibration.completedAt?`Last run ${y(n.calibration.completedAt)}`:"No calibration data yet.",A()}async function P(){try{const t=await G("/api/admin/state");n.profile={trackName:t.trackName??"",lapGoal:t.lapGoal??"",updatedAt:t.updatedAt??null},n.calibration={completedAt:t.calibrationAt??null},n.clock={syncedAt:t.clockSyncedAt??null,syncedMillis:t.clockSyncedMillis??null,hostCapturedAt:t.clockSyncedHostAt??null,moduleTimeMs:t.moduleTimeMs??null,moduleMillis:t.moduleMillis??null}}catch(t){console.warn(t),s(o.profileStatus,"Failed to load module state","error")}}function u(){const t=Number(n.profile.lapGoal),e=!!(n.profile.updatedAt&&n.profile.trackName&&t>=1),r=!!n.calibration.completedAt,i=!!n.clock.syncedAt;m(f.profile,e),m(f.calibration,r),m(f.clock,i),q(e&&r&&i)}function m(t,e){t.setAttribute("data-state",e?"done":"pending")}function s(t,e,r){t.dataset.state=r,t.textContent=e}function w(t,e){c.querySelectorAll(`[data-action="${t}"]`).forEach(i=>i.addEventListener("click",e))}function b(){if(!o.connectionPill)return;const t=navigator.onLine;o.connectionPill.dataset.state=t?"online":"offline",o.connectionPill.textContent=t?"Phone linked to module AP":"Offline mode (expected)"}function d(t,e="success"){o.toast.textContent=t,o.toast.dataset.tone=e,o.toast.dataset.visible="true",clearTimeout(d.timeout),d.timeout=setTimeout(()=>{o.toast.dataset.visible="false"},3200)}function q(t){if(!o.nextStep)return;o.nextStep.disabled=!t,o.nextStep.dataset.state=t?"ready":"locked";const e=o.nextStep.nextElementSibling;e&&e.classList.contains("footer-hint")&&(e.textContent=t?"Great! This will navigate to the rider setup page.":"Finish all tasks above to unlock the next step.")}function y(t){try{const e=new Date(t),r=e.toLocaleDateString(void 0,{month:"short",day:"numeric"}),i=e.toLocaleTimeString(void 0,{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1});return`${r} at ${i}`}catch{return new Date(t).toLocaleString()}}async function S(t,e){const r=new AbortController,i=setTimeout(()=>r.abort(),g);try{const a=await fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e),cache:"no-store",signal:r.signal});if(!a.ok){const l=await a.text();throw new Error(l||`HTTP ${a.status}`)}return{ok:!0,data:await F(a)}}catch(a){return{ok:!1,error:a}}finally{clearTimeout(i)}}function F(t){return t.headers.get("content-type")?.includes("application/json")?t.json():Promise.resolve({})}async function G(t){const e=new AbortController,r=setTimeout(()=>e.abort(),g);try{const i=await fetch(t,{method:"GET",cache:"no-store",signal:e.signal});if(!i.ok){const a=await i.text();throw new Error(a||`HTTP ${i.status}`)}return await i.json()}finally{clearTimeout(r)}}function O(){return Math.max(0,Date.now()-T)}function A(){if(!o.clockMeta)return;if(!n.clock.syncedAt){o.clockMeta.textContent="Clock has never been synced.";return}const t=E(),e=$(t?.epochMs??n.clock.syncedAt),r=[`Synced ${y(n.clock.syncedAt)}`];typeof t?.millis=="number"&&r.push(`${Math.round(t.millis)} ms`),o.clockMeta.innerHTML=`
    <div class="clock-readout">${e}</div>
    <div class="clock-hint">${r.join(" • ")}</div>
  `}function E(){if(!n.clock.syncedAt)return null;const t=typeof n.clock.hostCapturedAt=="number"?n.clock.hostCapturedAt:Date.now(),e=Math.max(0,Date.now()-t),r=n.clock.syncedAt+e,i=typeof n.clock.syncedMillis=="number"?n.clock.syncedMillis+e:null;return{epochMs:r,millis:i}}function $(t){try{return new Date(t).toLocaleTimeString(void 0,{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1})}catch{return"--:--:--"}}
