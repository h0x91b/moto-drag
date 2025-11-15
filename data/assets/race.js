import"./modulepreload-polyfill.js";const v=5e3,I=15e3,O=2e3,T="moto-drag/rider-name",i=document.querySelector("#app"),_=`
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
      <p class="track-occupant" data-ref="trackOccupant" hidden></p>
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
      <button class="btn btn-primary btn-return" type="button" data-action="return" hidden>Вернуться к ожиданию</button>
      <button class="btn btn-outline btn-reset" type="button" data-action="reset" disabled>Сброс</button>
    </footer>
  </div>
  <div class="toast" role="status" aria-live="polite"></div>
`;i.innerHTML=_;const e={shell:i.querySelector('[data-ref="shell"]'),trackName:i.querySelector('[data-ref="trackName"]'),lapGoal:i.querySelector('[data-ref="lapGoal"]'),lapGoalLabel:i.querySelector('[data-ref="lapGoalLabel"]'),timerValue:i.querySelector('[data-ref="timerValue"]'),timerStateLabel:i.querySelector('[data-ref="timerStateLabel"]'),trackOccupant:i.querySelector('[data-ref="trackOccupant"]'),statusMessage:i.querySelector('[data-ref="statusMessage"]'),linkStatus:i.querySelector('[data-ref="linkStatus"]'),lapsList:i.querySelector('[data-ref="lapsList"]'),nameInput:i.querySelector("#riderName"),readyBtn:i.querySelector('[data-action="ready"]'),resetBtn:i.querySelector('[data-action="reset"]'),returnBtn:i.querySelector('[data-action="return"]'),adminLink:i.querySelector('[data-action="goto-admin"]'),leaderboardLink:i.querySelector('[data-action="goto-leaderboard"]'),toast:i.querySelector(".toast")},a={admin:{trackName:"—",lapGoal:null},riderName:X(),ready:!1,timerDisplayMs:0,online:!1,currentRun:{laps:[]},trackLock:{locked:!1,riderName:null,lockedAt:null,startedAt:null,laps:[],currentTimerMs:0,snapshotAt:Date.now()},pendingResult:null,acknowledgedResultStamp:null};e.nameInput.value=a.riderName;e.nameInput.addEventListener("input",P);e.readyBtn.addEventListener("click",j);e.resetBtn.addEventListener("click",H);e.returnBtn.addEventListener("click",J);e.adminLink?.addEventListener("click",()=>B("/","Возвращаемся к настройкам…"));e.leaderboardLink?.addEventListener("click",()=>B("/leaderboard.html","Открываем лидерборд…"));window.addEventListener("online",()=>k(!0));window.addEventListener("offline",()=>k(!1));F();function F(){C(),g(0),S(),A(),setInterval(A,I),M(),setInterval(M,O),z()}function P(t){const n=t.target.value.slice(0,32);t.target.value=n,a.riderName=n.trim();try{localStorage.setItem(T,n)}catch{}}async function j(){if(u()){q();return}if(a.trackLock.locked){l("Трек уже занят — дождись окончания","error");return}const t=e.nameInput.value.trim();if(!t){l("Сначала укажи имя пилота","error"),e.nameInput.focus();return}a.riderName=t,e.readyBtn.disabled=!0,l("Бронируем трек…");try{const n=await G("/api/race/lock",{riderName:t});l("Трек забронирован — ждём стартовый луч","success"),m(n?.state)}catch(n){n?.status===409?(l("Трек уже занят — наблюдаем","error"),n.payload&&m(n.payload)):(console.warn("[Race] lock failed",n),l("Не удалось занять трек","error"))}finally{y()}}async function H(){if(!a.trackLock.locked){l("Трек уже свободен");return}if(!f()){l("Только активный пилот может сбросить заезд","error");return}e.resetBtn.disabled=!0,l("Останавливаем заезд…");try{const t=await G("/api/race/reset",{});l("Трек освобождён","success"),m(t?.state)}catch(t){console.warn("[Race] reset failed",t),l("Не удалось сбросить заезд","error")}finally{y()}}function J(){if(!u()){l("Активный заезд ещё не завершён","error");return}const t=E(a.pendingResult);t&&(a.acknowledgedResultStamp=t),q(),l("Можно готовиться к следующему старту","success")}function B(t,n){l(n??"Открываем страницу…"),window.location.assign(t)}async function A(){const t=await D("/api/admin/state");t&&(a.admin.trackName=t.trackName||"—",a.admin.lapGoal=Number.isFinite(t.lapGoal)?t.lapGoal:null,C())}async function M(){const t=await D("/api/race/status");t&&m(t)}function C(){e.trackName.textContent=`Трасса: ${a.admin.trackName}`,a.admin.lapGoal?(e.lapGoal.textContent=`Кругов: ${a.admin.lapGoal}`,e.lapGoalLabel.textContent=`${a.admin.lapGoal}`):(e.lapGoal.textContent="Кругов: —",e.lapGoalLabel.textContent="—")}function m(t={}){const n=Date.now(),r=Q(a.trackLock),s=a.trackLock.locked,o=f(),d=Array.isArray(t?.laps)?t.laps:[],c=U(t?.lastResult),N=E(c),b=!!N&&!!a.acknowledgedResultStamp&&a.acknowledgedResultStamp===N,w=c&&p(c.riderName)===p(a.riderName);a.trackLock={locked:!!t?.locked,riderName:t?.riderName||null,lockedAt:L(t?.lockedAt),startedAt:L(t?.startedAt),laps:d,lastLapMark:L(t?.lastLapMark),currentTimerMs:Number.isFinite(t?.currentTimerMs)?t.currentTimerMs:0,snapshotAt:n},a.trackLock.locked?(f()&&(a.acknowledgedResultStamp=null),a.pendingResult=null):w&&!b?a.pendingResult=c:s&&o&&!c&&!b?a.pendingResult=V(r):(!w||b)&&(a.pendingResult=null),a.trackLock.locked?a.currentRun.laps=d.slice():u()?a.currentRun.laps=a.pendingResult?.laps?.slice()||[]:a.currentRun.laps=[],a.ready=f()&&a.trackLock.locked,x(),y(),S()}function x(){if(!e.shell)return;const t=a.trackLock.locked||a.ready||u()&&!!a.pendingResult;e.shell.setAttribute("data-mode",t?"compact":"idle")}function y(){const t=a.trackLock.locked,n=f(),r=u(),s=a.trackLock.riderName||"Без имени";if(e.returnBtn&&(e.returnBtn.hidden=!0,e.returnBtn.disabled=!0),t){e.readyBtn&&(e.readyBtn.textContent=n?"Трек занят вами":"Трек занят",e.readyBtn.disabled=!0),e.timerStateLabel.textContent=n?"Сенсор ждёт старт":`Трек занят: ${s}`,e.statusMessage.textContent=n?"Переедь стартовую линию — модуль сам запустит таймер.":"Дождись окончания текущего заезда — кнопка станет активной автоматически.",e.resetBtn&&(e.resetBtn.disabled=!n);const o=(n?a.riderName:s)||"Без имени";h(n?`Вы на трассе: ${o}`:`Трек занят: ${o}`,n?"owner":"warning")}else if(r){e.readyBtn&&(e.readyBtn.textContent="Вернуться к ожиданию",e.readyBtn.disabled=!1),e.returnBtn&&(e.returnBtn.hidden=!1,e.returnBtn.disabled=!1),e.timerStateLabel.textContent="Заезд завершён",e.statusMessage.textContent="Посмотри на круги и вернись, когда готов к следующему старту.",e.resetBtn&&(e.resetBtn.disabled=!0);const o=a.pendingResult?.riderName||a.riderName;h(`Результат: ${o}`,"success")}else e.timerStateLabel.textContent="Ожидание сигнала",e.statusMessage.textContent="Займи трек только когда стоишь у старта.",e.resetBtn&&(e.resetBtn.disabled=!0),e.readyBtn&&(e.readyBtn.textContent="Занять трек",e.readyBtn.disabled=!1),h("","idle",{hidden:!0})}function h(t,n,r={}){if(!e.trackOccupant)return;e.trackOccupant.textContent=t||"",e.trackOccupant.dataset.tone=n||"idle";const s=typeof r.hidden=="boolean"?r.hidden:!t;e.trackOccupant.hidden=s}function f(){return a.trackLock.locked?p(a.trackLock.riderName)===p(a.riderName):!1}function p(t){return String(t||"").trim().toLowerCase()}function u(){return a.pendingResult?p(a.pendingResult.riderName)===p(a.riderName):!1}function q(){a.pendingResult=null,a.currentRun.laps=[],g(0),x(),y(),S()}function V(t){return{riderName:t?.riderName||a.riderName,laps:t?.laps?t.laps.slice():[],totalMs:W(t),finishedAt:Date.now()}}function U(t){return t?{riderName:t.riderName||null,laps:Array.isArray(t.laps)?t.laps.slice():[],totalMs:Number.isFinite(t.totalMs)?t.totalMs:0,finishedAt:t.finishedAt||Date.now()}:null}function E(t){return t?t.finishedAt?String(t.finishedAt):Number.isFinite(t.totalMs)?`ms:${t.totalMs}`:Array.isArray(t.laps)&&t.laps.length?`laps:${t.laps.join(",")}`:null:null}function S(){const t=a.currentRun.laps||[],n=u();if(!t.length){const r=a.trackLock.locked?`Заезд пилота ${a.trackLock.riderName||"без имени"} в процессе`:n?"Заезд завершён без кругов":"Кругов ещё нет";e.lapsList.innerHTML=`<li><span>${r}</span><strong>—</strong></li>`;return}e.lapsList.innerHTML="",t.forEach((r,s)=>{const o=document.createElement("li"),d=document.createElement("span");d.textContent=`Круг ${s+1}`;const c=document.createElement("strong");c.textContent=Z(r),o.append(d,c),e.lapsList.appendChild(o)})}function g(t){a.timerDisplayMs=t,e.timerValue.textContent=$(t)}function z(){const t=()=>{g(K()),window.requestAnimationFrame(t)};window.requestAnimationFrame(t)}function K(){if(a.trackLock.locked){if(typeof a.trackLock.startedAt!="number")return 0;const t=Number(a.trackLock.currentTimerMs)||0,n=a.trackLock.snapshotAt||Date.now(),r=Math.max(0,Date.now()-n);return t+r}return u()&&a.pendingResult?.totalMs||0}function k(t){a.online=t,e.linkStatus.dataset.state=t?"online":"offline",e.linkStatus.textContent=t?"Связь с модулем":"Нет связи с модулем"}async function D(t){const n=new AbortController,r=setTimeout(()=>n.abort(),v);try{const s=await fetch(t,{signal:n.signal});if(!s.ok)throw new Error(`Request failed (${s.status})`);const o=await s.json();return k(!0),o}catch(s){return k(!1),s?.name!=="AbortError"&&console.warn(`[Race] fetch failed for ${t}`,s),null}finally{clearTimeout(r)}}async function G(t,n){const r=new AbortController,s=setTimeout(()=>r.abort(),v);try{const o=await fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(n??{}),signal:r.signal}),d=await Y(o);if(!o.ok){const c=new Error(d?.error||`HTTP ${o.status}`);throw c.status=o.status,c.payload=d,c}return d}finally{clearTimeout(s)}}async function Y(t){return(t.headers.get("content-type")||"").includes("application/json")?t.json():{}}function L(t){if(t===null||typeof t>"u")return null;const n=Number(t);return Number.isFinite(n)?n:null}function Q(t){return t?{locked:t.locked,riderName:t.riderName,lockedAt:t.lockedAt,startedAt:t.startedAt,laps:t.laps?t.laps.slice():[],currentTimerMs:t.currentTimerMs||0,snapshotAt:t.snapshotAt||Date.now()}:{locked:!1,riderName:null,lockedAt:null,startedAt:null,laps:[],currentTimerMs:0,snapshotAt:Date.now()}}function W(t){if(!t)return 0;const n=Number(t.currentTimerMs)||0;if(!t.locked)return n;const r=t.snapshotAt||Date.now(),s=Math.max(0,Date.now()-r);return n+s}function X(){try{const t=localStorage.getItem(T);if(t)return t}catch{}return""}function $(t){const n=Math.floor(t),r=Math.floor(n/6e4),s=Math.floor(n%6e4/1e3),o=n%1e3;return`${String(r).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(o).padStart(3,"0")}`}function Z(t){if(!Number.isFinite(t))return"—";const n=Math.round(t*1e3);return $(n)}let R;function l(t,n="info"){e.toast&&(e.toast.textContent=t,e.toast.dataset.tone=n,e.toast.dataset.visible="true",clearTimeout(R),R=setTimeout(()=>{e.toast.dataset.visible="false"},2e3))}
