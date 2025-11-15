(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))i(n);new MutationObserver(n=>{for(const s of n)if(s.type==="childList")for(const f of s.addedNodes)f.tagName==="LINK"&&f.rel==="modulepreload"&&i(f)}).observe(document,{childList:!0,subtree:!0});function a(n){const s={};return n.integrity&&(s.integrity=n.integrity),n.referrerPolicy&&(s.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?s.credentials="include":n.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function i(n){if(n.ep)return;n.ep=!0;const s=a(n);fetch(n.href,s)}})();const S="moto-drag-admin",w="moto-drag-calibration",T="moto-drag-clock-sync",L=5e3,l=document.querySelector("#app"),A=window.sessionStorage,q=`
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
            Save &amp; continue
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
            <span data-ref="clockPreview"></span>
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
`;l.innerHTML=q;const o={profileForm:l.querySelector('[data-form="profile"]'),profileStatus:l.querySelector('[data-ref="profileStatus"]'),calibrationStatus:l.querySelector('[data-ref="calibrationStatus"]'),calibrationMeta:l.querySelector('[data-ref="calibrationMeta"]'),clockStatus:l.querySelector('[data-ref="clockStatus"]'),clockMeta:l.querySelector('[data-ref="clockMeta"]'),clockPreviewTargets:Array.from(l.querySelectorAll('[data-ref="clockPreview"]')),connectionPill:l.querySelector('[data-ref="connection"]'),toast:l.querySelector(".toast"),nextStep:l.querySelector('[data-ref="nextStep"]')},m={profile:l.querySelector('[data-progress="profile"]'),calibration:l.querySelector('[data-progress="calibration"]'),clock:l.querySelector('[data-progress="clock"]')},r={profile:b(S,{trackName:"",lapGoal:"",updatedAt:null}),calibration:b(w,{completedAt:null}),clock:b(T,{syncedAt:null})};O();g();u();C();v();P(!0);o.profileForm.addEventListener("submit",N);o.profileForm.addEventListener("input",D);x("calibrate",M);x("sync-clock",P);window.addEventListener("online",v);window.addEventListener("offline",v);setInterval(C,1e3);function N(t){t.preventDefault();const e=new FormData(o.profileForm),a=String(e.get("trackName")||"").trim(),i=Number(e.get("lapGoal"));if(!a)return c(o.profileStatus,"Track name is required","error");if(!Number.isFinite(i)||i<1||i>20)return c(o.profileStatus,"Lap goal must be between 1 and 20","error");const n={trackName:a,lapGoal:i,updatedAt:Date.now()};c(o.profileStatus,"Saving…","idle"),o.profileForm.querySelector('button[type="submit"]').disabled=!0,k("/api/admin/setup",n).then(s=>{if(!s.ok)throw s.error;r.profile={trackName:a,lapGoal:String(i),updatedAt:n.updatedAt},p(S,r.profile),c(o.profileStatus,"Profile saved on module","success"),d("Track profile saved"),u()}).catch(s=>{console.warn(s),c(o.profileStatus,"Failed to save profile","error"),d("Save failed — retry once the module is online","error")}).finally(()=>{o.profileForm.querySelector('button[type="submit"]').disabled=!1})}function D(t){const e=t.target;if(!(e instanceof HTMLInputElement))return;const{name:a,value:i}=e;a!=="trackName"&&a!=="lapGoal"||(r.profile={...r.profile,[a]:i},p(S,r.profile),r.profile.updatedAt||c(o.profileStatus,"Draft stored locally (not saved on module)","idle"))}function M(){c(o.calibrationStatus,"Calibrating…","idle"),k("/api/sensors/calibrate",{startedAt:Date.now()}).then(t=>{if(!t.ok)throw t.error;r.calibration={completedAt:Date.now()},p(w,r.calibration),c(o.calibrationStatus,"Calibration stored","success"),g(),u(),d("Sensor calibration updated")}).catch(t=>{console.warn(t),c(o.calibrationStatus,"Calibration failed","error"),d("Could not reach sensors","error")})}function P(t=!1){const e=new Date,a={epochMs:e.getTime(),iso8601:e.toISOString(),tzOffsetMinutes:e.getTimezoneOffset()*-1};c(o.clockStatus,t?"Auto-sync in progress…":"Sending time…","idle"),k("/api/time/sync",a).then(i=>{if(!i.ok)throw i.error;r.clock={syncedAt:Date.now()},p(T,r.clock),c(o.clockStatus,t?"Clock auto-synced":"Clock updated","success"),g(),u(),d(t?"Clock auto-synced":"Clock synchronized")}).catch(i=>{console.warn(i),c(o.clockStatus,"Time sync failed","error"),d("Time sync failed","error")})}function O(){if(o.profileForm.trackName.value=r.profile.trackName||"",o.profileForm.lapGoal.value=r.profile.lapGoal!==void 0&&r.profile.lapGoal!==null?r.profile.lapGoal:"",r.profile.updatedAt){const t=y(r.profile.updatedAt);c(o.profileStatus,`Last saved ${t}`,"success")}else(r.profile.trackName||r.profile.lapGoal)&&c(o.profileStatus,"Draft stored locally (not saved on module)","idle")}function g(){o.calibrationMeta.textContent=r.calibration.completedAt?`Last run ${y(r.calibration.completedAt)}`:"No calibration data yet.",o.clockMeta.textContent=r.clock.syncedAt?`Synced ${y(r.clock.syncedAt)}`:"Clock has never been synced."}function u(){const t=!!(r.profile.trackName&&r.profile.lapGoal),e=!!r.calibration.completedAt,a=!!r.clock.syncedAt;h(m.profile,t),h(m.calibration,e),h(m.clock,a),E(t&&e&&a)}function h(t,e){t.setAttribute("data-state",e?"done":"pending")}function c(t,e,a){t.dataset.state=a,t.textContent=e}function C(){if(!o.clockPreviewTargets.length)return;const e=new Date().toLocaleTimeString(void 0,{hour:"2-digit",minute:"2-digit",hour12:!1});o.clockPreviewTargets.forEach(a=>{a.textContent=`(${e})`})}function x(t,e){l.querySelectorAll(`[data-action="${t}"]`).forEach(i=>i.addEventListener("click",e))}function v(){if(!o.connectionPill)return;const t=navigator.onLine;o.connectionPill.dataset.state=t?"online":"offline",o.connectionPill.textContent=t?"Phone linked to module AP":"Offline mode (expected)"}function d(t,e="success"){o.toast.textContent=t,o.toast.dataset.tone=e,o.toast.dataset.visible="true",clearTimeout(d.timeout),d.timeout=setTimeout(()=>{o.toast.dataset.visible="false"},3200)}function E(t){if(!o.nextStep)return;o.nextStep.disabled=!t,o.nextStep.dataset.state=t?"ready":"locked";const e=o.nextStep.nextElementSibling;e&&e.classList.contains("footer-hint")&&(e.textContent=t?"Great! This will navigate to the rider setup page.":"Finish all tasks above to unlock the next step.")}function b(t,e){try{const a=A.getItem(t);return a?JSON.parse(a):e}catch{return e}}function p(t,e){try{A.setItem(t,JSON.stringify(e))}catch{}}function y(t){try{const e=new Date(t),a=e.toLocaleDateString(void 0,{month:"short",day:"numeric"}),i=e.toLocaleTimeString(void 0,{hour:"2-digit",minute:"2-digit"});return`${a} at ${i}`}catch{return new Date(t).toLocaleString()}}async function k(t,e){if(G())return await I(500),{ok:!0,mocked:!0};const a=new AbortController,i=setTimeout(()=>a.abort(),L);try{const n=await fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e),cache:"no-store",signal:a.signal});if(!n.ok){const s=await n.text();throw new Error(s||`HTTP ${n.status}`)}return{ok:!0,data:await F(n)}}catch(n){return{ok:!1,error:n}}finally{clearTimeout(i)}}function F(t){return t.headers.get("content-type")?.includes("application/json")?t.json():Promise.resolve({})}function G(){const t=window.location.hostname;return t==="localhost"||t==="127.0.0.1"}function I(t){return new Promise(e=>setTimeout(e,t))}
