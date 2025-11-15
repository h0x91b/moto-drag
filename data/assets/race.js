import"./modulepreload-polyfill.js";const S=5e3,q=15e3,E=2e3,v="moto-drag/rider-name",n=document.querySelector("#app"),x=`
  <div class="race-shell" data-mode="idle" data-ref="shell">
    <header class="race-hero" data-section="hero">
      <div class="eyebrow">Moto-Drag</div>
      <h1>
        Режим гонки
      </h1>
      <p>
        Введите имя, подкатите к стартовой полосе и держите телефон рядом — модуль сам запустит таймер, когда пересечёте луч.
      </p>
      <div class="track-overview">
        <div class="track-meta">
          <span data-ref="trackName">Трасса — —</span>
          <span data-ref="lapGoal">Кругов: —</span>
        </div>
        <div class="status-pill" data-ref="linkStatus" data-state="offline">Нет связи с модулем</div>
      </div>
      <div class="quick-links" data-section="nav">
        <button type="button" class="link-btn" data-action="goto-admin">Настройки модуля</button>
        <button type="button" class="link-btn" data-action="goto-leaderboard">Лидерборд</button>
      </div>
    </header>

    <section class="card rider-card" data-section="rider">
      <h2>Имя пилота</h2>
      <p>Сохранится на устройстве и появится в логах, когда модуль начнёт принимать данные о заезде.</p>
      <div class="name-input-group">
        <label for="riderName">Имя / позывной</label>
        <input
          id="riderName"
          maxlength="32"
          placeholder="Например: Арсений"
          autocomplete="off"
          inputmode="text"
        />
      </div>
      <div class="controls">
        <button class="btn btn-primary" type="button" data-action="ready">Занять трек</button>
      </div>
    </section>

    <section class="card timer-card" data-section="timer">
      <h2>Лайв-таймер</h2>
      <div class="timer-face">
        <div class="timer-display" data-ref="timerValue">00:00.000</div>
      </div>
      <div class="lap-status">
        <span>Цель: <strong data-ref="lapGoalLabel">—</strong></span>
        <span data-ref="timerStateLabel">Ожидание сигнала</span>
      </div>
      <p class="hint" data-ref="statusMessage">Займи трек только когда стоишь у старта.</p>
    </section>

    <section class="card last-ride" data-section="history">
      <h3>Круги текущего заезда</h3>
      <p>Как только модуль пришлёт времена, они появятся ниже — держите телефон рядом с треком.</p>
      <ul class="laps-list" data-ref="lapsList"></ul>
    </section>

    <footer class="compact-footer" data-section="footer">
      <button class="btn btn-outline btn-reset" type="button" data-action="reset" disabled>Сброс</button>
    </footer>
  </div>
  <div class="toast" role="status" aria-live="polite"></div>
`;n.innerHTML=x;const a={shell:n.querySelector('[data-ref="shell"]'),trackName:n.querySelector('[data-ref="trackName"]'),lapGoal:n.querySelector('[data-ref="lapGoal"]'),lapGoalLabel:n.querySelector('[data-ref="lapGoalLabel"]'),timerValue:n.querySelector('[data-ref="timerValue"]'),timerStateLabel:n.querySelector('[data-ref="timerStateLabel"]'),statusMessage:n.querySelector('[data-ref="statusMessage"]'),linkStatus:n.querySelector('[data-ref="linkStatus"]'),lapsList:n.querySelector('[data-ref="lapsList"]'),nameInput:n.querySelector("#riderName"),readyBtn:n.querySelector('[data-action="ready"]'),resetBtn:n.querySelector('[data-action="reset"]'),adminLink:n.querySelector('[data-action="goto-admin"]'),leaderboardLink:n.querySelector('[data-action="goto-leaderboard"]'),toast:n.querySelector(".toast")},r={admin:{trackName:"—",lapGoal:null},riderName:O(),ready:!1,timerDisplayMs:0,online:!1,currentRun:{laps:[]},trackLock:{locked:!1,riderName:null,laps:[],currentTimerMs:0,snapshotAt:Date.now()}};a.nameInput.value=r.riderName;a.nameInput.addEventListener("input",I);a.readyBtn.addEventListener("click",R);a.resetBtn.addEventListener("click",B);a.adminLink?.addEventListener("click",()=>w("/","Возвращаемся к настройкам…"));a.leaderboardLink?.addEventListener("click",()=>w("/leaderboard.html","Открываем лидерборд…"));window.addEventListener("online",()=>u(!0));window.addEventListener("offline",()=>u(!1));G();function G(){N(),M(0),g(),k(),setInterval(k,q),y(),setInterval(y,E),D()}function I(t){const e=t.target.value.slice(0,32);t.target.value=e,r.riderName=e.trim();try{localStorage.setItem(v,e)}catch{}}async function R(){if(r.trackLock.locked){i("Трек уже занят — дождись окончания","error");return}const t=a.nameInput.value.trim();if(!t){i("Сначала укажи имя пилота","error"),a.nameInput.focus();return}r.riderName=t,a.readyBtn.disabled=!0,i("Бронируем трек…");try{const e=await A("/api/race/lock",{riderName:t});i("Трек забронирован — ждём стартовый луч"),d(e?.state)}catch(e){e?.status===409?(i("Трек уже занят — наблюдаем","error"),e.payload&&d(e.payload)):(console.warn("[Race] lock failed",e),i("Не удалось занять трек","error"))}finally{p()}}async function B(){if(!r.trackLock.locked){i("Трек уже свободен");return}if(!f()){i("Только активный пилот может сбросить заезд","error");return}a.resetBtn.disabled=!0,i("Останавливаем заезд…");try{const t=await A("/api/race/reset",{});i("Трек освобождён"),d(t?.state)}catch(t){console.warn("[Race] reset failed",t),i("Не удалось сбросить заезд","error")}finally{p()}}function w(t,e){i(e??"Открываем страницу…"),window.location.assign(t)}async function k(){const t=await T("/api/admin/state");t&&(r.admin.trackName=t.trackName||"—",r.admin.lapGoal=Number.isFinite(t.lapGoal)?t.lapGoal:null,N())}async function y(){const t=await T("/api/race/status");t&&d(t)}function N(){a.trackName.textContent=`Трасса: ${r.admin.trackName}`,r.admin.lapGoal?(a.lapGoal.textContent=`Кругов: ${r.admin.lapGoal}`,a.lapGoalLabel.textContent=`${r.admin.lapGoal}`):(a.lapGoal.textContent="Кругов: —",a.lapGoalLabel.textContent="—")}function d(t={}){const e=Date.now();r.trackLock={locked:!!t.locked,riderName:t.riderName||null,lockedAt:h(t.lockedAt),startedAt:h(t.startedAt),laps:Array.isArray(t.laps)?t.laps:[],currentTimerMs:Number.isFinite(t.currentTimerMs)?t.currentTimerMs:0,snapshotAt:e},r.currentRun.laps=r.trackLock.laps,r.ready=f()&&r.trackLock.locked,$(),p(),g()}function $(){a.shell&&a.shell.setAttribute("data-mode",r.ready?"compact":"idle")}function p(){const t=r.trackLock.locked,e=f(),s=r.trackLock.riderName||"Без имени";a.readyBtn&&(a.readyBtn.textContent=t?e?"Трек занят вами":"Трек занят":"Занять трек",a.readyBtn.disabled=t),t?(a.timerStateLabel.textContent=e?"Сенсор ждёт старт":`Трек занят: ${s}`,a.statusMessage.textContent=e?"Переедь стартовую линию — модуль сам запустит таймер.":"Дождись окончания текущего заезда — кнопка станет активной автоматически.",a.resetBtn&&(a.resetBtn.disabled=!e)):(a.timerStateLabel.textContent="Ожидание сигнала",a.statusMessage.textContent="Займи трек только когда стоишь у старта.",a.resetBtn&&(a.resetBtn.disabled=!0))}function f(){return r.trackLock.locked?b(r.trackLock.riderName)===b(r.riderName):!1}function b(t){return String(t||"").trim().toLowerCase()}function g(){const t=r.currentRun.laps||[];if(!t.length){const e=r.trackLock.locked?`Заезд пилота ${r.trackLock.riderName||"без имени"} в процессе`:"Кругов ещё нет";a.lapsList.innerHTML=`<li><span>${e}</span><strong>—</strong></li>`;return}a.lapsList.innerHTML="",t.forEach((e,s)=>{const o=document.createElement("li"),l=document.createElement("span");l.textContent=`Круг ${s+1}`;const c=document.createElement("strong");c.textContent=P(e),o.append(l,c),a.lapsList.appendChild(o)})}function M(t){r.timerDisplayMs=t,a.timerValue.textContent=C(t)}function D(){const t=()=>{M(_()),window.requestAnimationFrame(t)};window.requestAnimationFrame(t)}function _(){if(!r.trackLock.locked)return 0;const t=Number(r.trackLock.currentTimerMs)||0,e=r.trackLock.snapshotAt||Date.now(),s=Math.max(0,Date.now()-e);return t+s}function u(t){r.online=t,a.linkStatus.dataset.state=t?"online":"offline",a.linkStatus.textContent=t?"Связь с модулем":"Нет связи с модулем"}async function T(t){const e=new AbortController,s=setTimeout(()=>e.abort(),S);try{const o=await fetch(t,{signal:e.signal});if(!o.ok)throw new Error(`Request failed (${o.status})`);const l=await o.json();return u(!0),l}catch(o){return u(!1),o?.name!=="AbortError"&&console.warn(`[Race] fetch failed for ${t}`,o),null}finally{clearTimeout(s)}}async function A(t,e){const s=new AbortController,o=setTimeout(()=>s.abort(),S);try{const l=await fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e??{}),signal:s.signal}),c=await F(l);if(!l.ok){const m=new Error(c?.error||`HTTP ${l.status}`);throw m.status=l.status,m.payload=c,m}return c}finally{clearTimeout(o)}}async function F(t){return(t.headers.get("content-type")||"").includes("application/json")?t.json():{}}function h(t){const e=Number(t);return Number.isFinite(e)?e:null}function O(){try{const t=localStorage.getItem(v);if(t)return t}catch{}return""}function C(t){const e=Math.floor(t),s=Math.floor(e/6e4),o=Math.floor(e%6e4/1e3),l=e%1e3;return`${String(s).padStart(2,"0")}:${String(o).padStart(2,"0")}.${String(l).padStart(3,"0")}`}function P(t){if(!Number.isFinite(t))return"—";const e=Math.round(t*1e3);return C(e)}let L;function i(t,e="info"){a.toast&&(a.toast.textContent=t,a.toast.dataset.tone=e,a.toast.dataset.visible="true",clearTimeout(L),L=setTimeout(()=>{a.toast.dataset.visible="false"},2e3))}
