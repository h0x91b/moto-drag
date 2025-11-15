import"./modulepreload-polyfill.js";const k=5e3,S="moto-drag/dev-board-boot-at",s=document.querySelector("#app"),A=`
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
`;s.innerHTML=A;const M=(()=>{try{const t=localStorage.getItem(S);if(t&&Number.isFinite(Number(t)))return Number(t);const e=Date.now();return localStorage.setItem(S,String(e)),e}catch{return Date.now()}})(),o={profileForm:s.querySelector('[data-form="profile"]'),profileStatus:s.querySelector('[data-ref="profileStatus"]'),calibrationStatus:s.querySelector('[data-ref="calibrationStatus"]'),calibrationMeta:s.querySelector('[data-ref="calibrationMeta"]'),clockStatus:s.querySelector('[data-ref="clockStatus"]'),clockMeta:s.querySelector('[data-ref="clockMeta"]'),connectionPill:s.querySelector('[data-ref="connection"]'),toast:s.querySelector(".toast"),nextStep:s.querySelector('[data-ref="nextStep"]')},p={profile:s.querySelector('[data-progress="profile"]'),calibration:s.querySelector('[data-progress="calibration"]'),clock:s.querySelector('[data-progress="clock"]')},a={profile:{trackName:"",lapGoal:"",updatedAt:null},calibration:{completedAt:null},clock:{syncedAt:null,syncedMillis:null,hostCapturedAt:null}};T();o.profileForm.addEventListener("submit",C);o.profileForm.addEventListener("input",x);g("calibrate",D);g("sync-clock",v);o.nextStep?.addEventListener("click",P);window.addEventListener("online",h);window.addEventListener("offline",h);setInterval(()=>{w()},1e3);async function T(){l(o.profileStatus,"Loading from module…","idle"),await L(),N(),m(),u(),h(),v(!0)}function C(t){t.preventDefault();const e=new FormData(o.profileForm),n=String(e.get("trackName")||"").trim(),i=Number(e.get("lapGoal"));if(!n)return l(o.profileStatus,"Track name is required","error");if(!Number.isFinite(i)||i<1||i>20)return l(o.profileStatus,"Lap goal must be between 1 and 20","error");const r={trackName:n,lapGoal:i,updatedAt:Date.now()};l(o.profileStatus,"Saving…","idle"),o.profileForm.querySelector('button[type="submit"]').disabled=!0,y("/api/admin/setup",r).then(c=>{if(!c.ok)throw c.error;a.profile={trackName:n,lapGoal:i,updatedAt:r.updatedAt},l(o.profileStatus,"Profile saved on module","success"),d("Track profile saved"),u()}).catch(c=>{console.warn(c),l(o.profileStatus,"Failed to save profile","error"),d("Save failed — retry once the module is online","error")}).finally(()=>{o.profileForm.querySelector('button[type="submit"]').disabled=!1})}function x(t){const e=t.target;if(!(e instanceof HTMLInputElement))return;const{name:n,value:i}=e;n!=="trackName"&&n!=="lapGoal"||(a.profile={...a.profile,[n]:i},a.profile.updatedAt||l(o.profileStatus,"Draft not saved on module yet","idle"))}function D(){l(o.calibrationStatus,"Calibrating…","idle"),y("/api/sensors/calibrate",{startedAt:Date.now()}).then(t=>{if(!t.ok)throw t.error;a.calibration={completedAt:Date.now()},l(o.calibrationStatus,"Calibration stored","success"),m(),u(),d("Sensor calibration updated")}).catch(t=>{console.warn(t),l(o.calibrationStatus,"Calibration failed","error"),d("Could not reach sensors","error")})}function v(t=!1){const e=new Date,n=E(),i={epochMs:e.getTime(),millis:n,iso8601:e.toISOString(),tzOffsetMinutes:e.getTimezoneOffset()*-1};l(o.clockStatus,t?"Auto-sync in progress…":"Sending time…","idle"),y("/api/time/sync",i).then(r=>{if(!r.ok)throw r.error;const c=r.data||{};a.clock={syncedAt:c.syncedAt??i.epochMs,syncedMillis:c.syncedMillis??n,hostCapturedAt:c.hostCapturedAt??Date.now(),moduleTimeMs:c.moduleTimeMs??null,moduleMillis:c.moduleMillis??null},l(o.clockStatus,t?"Clock auto-synced":"Clock updated","success"),m(),u(),d(t?"Clock auto-synced":"Clock synchronized")}).catch(r=>{console.warn(r),l(o.clockStatus,"Time sync failed","error"),d("Time sync failed","error")})}function N(){if(o.profileForm.trackName.value=a.profile.trackName||"",o.profileForm.lapGoal.value=a.profile.lapGoal!==void 0&&a.profile.lapGoal!==null?a.profile.lapGoal:"",a.profile.updatedAt){const t=b(a.profile.updatedAt);l(o.profileStatus,`Last saved ${t}`,"success")}else(a.profile.trackName||a.profile.lapGoal)&&l(o.profileStatus,"Draft not saved on module yet","idle")}function m(){o.calibrationMeta.textContent=a.calibration.completedAt?`Last run ${b(a.calibration.completedAt)}`:"No calibration data yet.",w()}async function L(){try{const t=await G("/api/admin/state");a.profile={trackName:t.trackName??"",lapGoal:t.lapGoal??"",updatedAt:t.updatedAt??null},a.calibration={completedAt:t.calibrationAt??null},a.clock={syncedAt:t.clockSyncedAt??null,syncedMillis:t.clockSyncedMillis??null,hostCapturedAt:t.clockSyncedHostAt??null,moduleTimeMs:t.moduleTimeMs??null,moduleMillis:t.moduleMillis??null}}catch(t){console.warn(t),l(o.profileStatus,"Failed to load module state","error")}}function u(){const t=Number(a.profile.lapGoal),e=!!(a.profile.updatedAt&&a.profile.trackName&&t>=1),n=!!a.calibration.completedAt,i=!!a.clock.syncedAt;f(p.profile,e),f(p.calibration,n),f(p.clock,i),q(e&&n&&i)}function f(t,e){t.setAttribute("data-state",e?"done":"pending")}function l(t,e,n){t.dataset.state=n,t.textContent=e}function g(t,e){s.querySelectorAll(`[data-action="${t}"]`).forEach(i=>i.addEventListener("click",e))}function h(){if(!o.connectionPill)return;const t=navigator.onLine;o.connectionPill.dataset.state=t?"online":"offline",o.connectionPill.textContent=t?"Phone linked to module AP":"Offline mode (expected)"}function d(t,e="success"){o.toast.textContent=t,o.toast.dataset.tone=e,o.toast.dataset.visible="true",clearTimeout(d.timeout),d.timeout=setTimeout(()=>{o.toast.dataset.visible="false"},3200)}function q(t){if(!o.nextStep)return;o.nextStep.disabled=!t,o.nextStep.dataset.state=t?"ready":"locked";const e=o.nextStep.nextElementSibling;e&&e.classList.contains("footer-hint")&&(e.textContent=t?"Great! This will navigate to the rider setup page.":"Finish all tasks above to unlock the next step.")}function P(){o.nextStep?.disabled||(d("Открываем страницу гонки…"),window.location.assign("/race.html"))}function b(t){try{const e=new Date(t),n=e.toLocaleDateString(void 0,{month:"short",day:"numeric"}),i=e.toLocaleTimeString(void 0,{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1});return`${n} at ${i}`}catch{return new Date(t).toLocaleString()}}async function y(t,e){const n=new AbortController,i=setTimeout(()=>n.abort(),k);try{const r=await fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e),cache:"no-store",signal:n.signal});if(!r.ok){const c=await r.text();throw new Error(c||`HTTP ${r.status}`)}return{ok:!0,data:await F(r)}}catch(r){return{ok:!1,error:r}}finally{clearTimeout(i)}}function F(t){return t.headers.get("content-type")?.includes("application/json")?t.json():Promise.resolve({})}async function G(t){const e=new AbortController,n=setTimeout(()=>e.abort(),k);try{const i=await fetch(t,{method:"GET",cache:"no-store",signal:e.signal});if(!i.ok){const r=await i.text();throw new Error(r||`HTTP ${i.status}`)}return await i.json()}finally{clearTimeout(n)}}function E(){return Math.max(0,Date.now()-M)}function w(){if(!o.clockMeta)return;if(!a.clock.syncedAt){o.clockMeta.textContent="Clock has never been synced.";return}const t=$(),e=B(t?.epochMs??a.clock.syncedAt),n=[`Synced ${b(a.clock.syncedAt)}`];typeof t?.millis=="number"&&n.push(`${Math.round(t.millis)} ms`),o.clockMeta.innerHTML=`
    <div class="clock-readout">${e}</div>
    <div class="clock-hint">${n.join(" • ")}</div>
  `}function $(){if(!a.clock.syncedAt)return null;const t=typeof a.clock.hostCapturedAt=="number"?a.clock.hostCapturedAt:Date.now(),e=Math.max(0,Date.now()-t),n=a.clock.syncedAt+e,i=typeof a.clock.syncedMillis=="number"?a.clock.syncedMillis+e:null;return{epochMs:n,millis:i}}function B(t){try{return new Date(t).toLocaleTimeString(void 0,{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1})}catch{return"--:--:--"}}
