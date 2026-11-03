(function(){
  "use strict";
  var MOODS=[{v:1,label:"Drained"},{v:2,label:"Low"},{v:3,label:"Okay"},{v:4,label:"Good"},{v:5,label:"Great"}];
  var KEY="walklog.v1", CIRC=2*Math.PI*86;
  var state={days:{},settings:{stepGoal:8000,waterGoal:8},cur:null,tab:"today",stripEnd:null,range:"week",month:null,weekStart:null,weight:{unit:"lb",goal:null,entries:[]}};
  var $=function(id){return document.getElementById(id)};

  /* ---------- dates & helpers ---------- */
  function keyOf(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
  function dateOf(k){var p=k.split("-").map(Number);return new Date(p[0],p[1]-1,p[2])}
  function addDays(k,n){var d=dateOf(k);d.setDate(d.getDate()+n);return keyOf(d)}
  function today(){return keyOf(new Date())}
  function blank(){return {steps:0,minutes:0,miles:0,mood:0,water:0,note:""}}
  function clean(d){d=d||{};return {steps:clampInt(d.steps,0,200000),minutes:clampInt(d.minutes,0,1440),miles:Math.max(0,Math.min(200,Math.round((Number(d.miles)||0)*100)/100)),mood:clampInt(d.mood,0,5),water:clampInt(d.water,0,30),note:String(d.note||"").slice(0,2000)}}
  function clampInt(v,lo,hi){v=Math.round(Number(v)||0);return Math.max(lo,Math.min(hi,v))}
  function day(k){var d=state.days[k];return d?Object.assign(blank(),d):blank()}
  function hasData(d){return !!d&&(d.steps>0||d.minutes>0||d.miles>0||d.mood>0||d.water>0||String(d.note||"").trim()!=="")}
  function fmt(n){return Math.round(n).toLocaleString()}
  function short(n){return n>=1000?(Math.round(n/100)/10)+"k":String(Math.round(n))}
  function moodName(v){var m=MOODS.find(function(x){return x.v===v});return m?m.label:""}
  function validKey(k){return /^\d{4}-\d{2}-\d{2}$/.test(k)}
  function weekStartOf(k){var d=dateOf(k);d.setDate(d.getDate()-d.getDay());return keyOf(d)}
  state.cur=today();state.stripEnd=today();state.month=today().slice(0,8)+"01";state.weekStart=weekStartOf(today());

  /* ---------- on-device storage ---------- */
  // Everything is saved in this browser on this device. Nothing is sent anywhere.
  function readJSON(k){try{return JSON.parse(localStorage.getItem(k)||"null")}catch(e){return null}}
  function writeJSON(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}
  function loadCache(){
    var r=readJSON(KEY);state.days={};state.settings={stepGoal:8000,waterGoal:8};
    if(r){
      Object.keys(r.days||{}).forEach(function(k){if(validKey(k))state.days[k]=clean(r.days[k])});
      if(r.settings)state.settings={stepGoal:clampInt(r.settings.stepGoal,500,100000)||8000,waterGoal:clampInt(r.settings.waterGoal,1,20)||8};
      state.weight=cleanWeight(r.weight);
    }
  }
  function cleanEntry(e){
    if(!e||typeof e.at!=="string"||!validKey(e.at.slice(0,10)))return null;
    var v=Number(e.v),u=e.u==="kg"?"kg":"lb";if(!isFinite(v)||v<=0||v>2000)return null;
    var tm=/^\d{2}:\d{2}$/.test(e.at.slice(11,16))?e.at.slice(11,16):"12:00";
    return {id:String(e.id||Date.now().toString(36)+Math.random().toString(36).slice(2,6)).slice(0,40),at:e.at.slice(0,10)+"T"+tm,v:Math.round(v*10)/10,u:u};
  }
  function cleanWeight(w){
    var out={unit:"lb",goal:null,entries:[]};if(!w||typeof w!=="object")return out;
    out.unit=w.unit==="kg"?"kg":"lb";
    if(w.goal&&isFinite(Number(w.goal.v))&&Number(w.goal.v)>0)out.goal={v:Math.round(Number(w.goal.v)*10)/10,u:w.goal.u==="kg"?"kg":"lb"};
    if(Array.isArray(w.entries))w.entries.slice(0,20000).forEach(function(e){var c=cleanEntry(e);if(c)out.entries.push(c)});
    return out;
  }
  function saveCache(){
    Object.keys(state.days).forEach(function(k){if(!hasData(state.days[k]))delete state.days[k]});
    var ok=writeJSON(KEY,{days:state.days,settings:state.settings,weight:state.weight});
    setSaved(ok?"Saved on this device":"Couldn't save. Your browser may be in private mode, or storage is full.");
    return ok;
  }
  function mergeOldAccountCopies(){
    // Entries made while the sign-in version was installed were kept on the phone under a
    // separate name. Fold them into the main log so nothing is lost, then tidy up.
    var moved=0;
    try{
      Object.keys(localStorage).filter(function(k){return k.indexOf("walklog.u.")===0}).forEach(function(k){
        var r=readJSON(k);
        if(r&&r.days)Object.keys(r.days).forEach(function(d){
          if(validKey(d)&&hasData(r.days[d])&&!hasData(state.days[d])){state.days[d]=clean(r.days[d]);moved++}
        });
        localStorage.removeItem(k);
      });
    }catch(e){}
    if(moved)saveCache();
  }
  function keepStorage(){
    // Ask the browser not to clear this app's saved data when space runs low.
    try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(function(){})}catch(e){}
  }

  /* ---------- status text ---------- */
  function setSaved(t){$("saved").textContent=t}

  /* ---------- editing ---------- */
  function toast(t){var el=$("toast");el.textContent=t;el.classList.add("show");clearTimeout(el._t);el._t=setTimeout(function(){el.classList.remove("show")},1800)}
  var localTimer=null;
  function changed(k){setSaved("Saving…");clearTimeout(localTimer);localTimer=setTimeout(saveCache,300)}
  window.addEventListener("pagehide",function(){if(localTimer){clearTimeout(localTimer);localTimer=null;saveCache()}});
  document.addEventListener("visibilitychange",function(){if(document.hidden&&localTimer){clearTimeout(localTimer);localTimer=null;saveCache()}});
  function edit(patch){var k=state.cur;state.days[k]=clean(Object.assign(day(k),patch));changed(k);renderToday();renderStrip();renderStreak()}
  function setVal(el,v){if(document.activeElement!==el&&el.value!==String(v))el.value=v}

  /* ---------- drawing helpers ---------- */
  function miniRing(pct,sel){
    var r=8,c=2*Math.PI*r,off=c*(1-Math.min(1,pct));
    return '<svg class="mini" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="'+r+'" fill="none" stroke="'+(sel?"currentColor":"var(--line)")+'" stroke-opacity="'+(sel?.3:1)+'" stroke-width="3"/>'+
      (pct>0?'<circle cx="10" cy="10" r="'+r+'" fill="none" stroke="'+(sel?"currentColor":"var(--steps)")+'" stroke-width="3" stroke-linecap="round" stroke-dasharray="'+c+'" stroke-dashoffset="'+off+'" transform="rotate(-90 10 10)"/>':'')+'</svg>';
  }
  function face(v){
    var c=(v-3)*3.2;
    return '<svg viewBox="0 0 40 40" aria-hidden="true"><circle class="face" cx="20" cy="20" r="17" fill="transparent" stroke="currentColor" stroke-width="2.4"/><circle cx="14" cy="16.5" r="2" fill="currentColor"/><circle cx="26" cy="16.5" r="2" fill="currentColor"/><path d="M12.5 '+(25-c/2)+' Q20 '+(25+c*1.2)+' 27.5 '+(25-c/2)+'" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
  }

  /* ---------- header + strip ---------- */
  function renderHeader(){
    var h=new Date().getHours();
    $("hello").textContent=(h<12?"Good morning":h<17?"Good afternoon":"Good evening");
    var k=state.cur,t=today(),titles={week:"Progress",weight:"Weight",history:"History",me:"Settings"};
    if(state.tab==="today")$("pageTitle").textContent=k===t?"Today":k===addDays(t,-1)?"Yesterday":dateOf(k).toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"});
    else $("pageTitle").textContent=titles[state.tab];
    $("stripWrap").hidden=state.tab!=="today";
  }
  function renderStrip(){
    var wrap=$("strip");wrap.innerHTML="";var t=today(),g=state.settings.stepGoal;
    for(var i=6;i>=0;i--){(function(k){
      var d=day(k),dt=dateOf(k),sel=k===state.cur;
      var b=document.createElement("button");b.className="sday"+(sel?" sel":"");b.disabled=k>t;
      b.setAttribute("aria-label",dt.toDateString());
      b.innerHTML='<span>'+dt.toLocaleDateString(undefined,{weekday:"narrow"})+'</span><b class="num">'+dt.getDate()+'</b>'+miniRing(g?d.steps/g:0,sel);
      b.onclick=function(){state.cur=k;renderAll()};
      wrap.appendChild(b);
    })(addDays(state.stripEnd,-i))}
    $("wkNext").disabled=state.stripEnd>=t;
  }
  function renderStreak(){
    var t=today(),s=0,k=day(t).steps>0?t:addDays(t,-1);
    while(day(k).steps>0){s++;k=addDays(k,-1)}
    $("streak").textContent=s;$("streakWord").textContent=s===1?"day":"days";
  }

  /* ---------- today ---------- */
  function renderToday(){
    var d=day(state.cur),g=state.settings;
    $("stepsNum").textContent=fmt(d.steps);$("stepsNum").classList.toggle("zero",!d.steps);
    $("stepsBtn").setAttribute("aria-label",fmt(d.steps)+" steps. Tap to enter your steps");
    setVal($("minutes"),d.minutes||"");setVal($("miles"),d.miles||"");setVal($("note"),d.note||"");
    var pct=g.stepGoal?Math.min(1,d.steps/g.stepGoal):0;
    $("ringVal").style.strokeDashoffset=CIRC*(1-pct);
    $("ofGoal").textContent="of "+fmt(g.stepGoal)+" steps";
    var left=g.stepGoal-d.steps;
    $("togo").textContent=d.steps===0?"Enter your steps to start":left>0?fmt(left)+" steps to go":"Goal reached";
    var mb=$("moods");
    if(!mb.children.length){MOODS.forEach(function(m){var b=document.createElement("button");b.className="mood";b.dataset.v=m.v;b.innerHTML=face(m.v)+'<span>'+m.label+'</span>';b.onclick=function(){var cur=day(state.cur).mood;edit({mood:cur===m.v?0:m.v})};mb.appendChild(b)})}
    Array.prototype.forEach.call(mb.children,function(b){b.setAttribute("aria-pressed",String(Number(b.dataset.v)===d.mood))});
    $("moodMeta").textContent=d.mood?moodName(d.mood):"";
    var wp=g.waterGoal?Math.min(1,d.water/g.waterGoal):0;
    $("gfill").setAttribute("y",String(84-84*wp*.92));
    $("wBig").innerHTML=d.water+' <span>/ '+g.waterGoal+' cups</span>';
    var dr=$("drops");dr.innerHTML="";
    for(var i=0;i<Math.max(g.waterGoal,d.water);i++){var x=document.createElement("i");if(i<d.water)x.className="on";dr.appendChild(x)}
  }

  /* ---------- week ---------- */
  function renderWeek(){
    var t=today(),g=state.settings,keys=[],thisWeek=weekStartOf(t);
    for(var i=0;i<7;i++)keys.push(addDays(state.weekStart,i));
    var past=keys.filter(function(k){return k<=t}),span=past.length||7;
    var tot=0,mi=0,hit=0,wS=0,wN=0,moods={};
    past.forEach(function(k){var d=day(k);tot+=d.steps;mi+=d.miles;if(d.steps>=g.stepGoal&&d.steps>0)hit++;if(hasData(state.days[k])){wS+=d.water;wN++}if(d.mood)moods[d.mood]=(moods[d.mood]||0)+1});
    $("sSteps").textContent=fmt(tot);$("sStepsAvg").textContent=fmt(tot/span)+" a day";
    $("sGoal").textContent=hit+"/"+span;$("sMiles").textContent=(Math.round(mi*10)/10)+" mi walked";
    $("sWater").textContent=wN?String(Math.round(wS/wN*10)/10):"—";
    var top=0,topN=0;Object.keys(moods).forEach(function(m){if(moods[m]>topN||(moods[m]===topN&&+m>top)){top=+m;topN=moods[m]}});
    $("sMood").textContent=top?moodName(top):"—";$("sMoodN").textContent=topN?topN+" of "+span+" days":"no check-ins yet";
    var f=function(k,o){return dateOf(k).toLocaleDateString(undefined,o||{month:"short",day:"numeric"})};
    var range=f(keys[0])+" – "+f(keys[6])+(dateOf(keys[6]).getFullYear()!==dateOf(t).getFullYear()?", "+dateOf(keys[6]).getFullYear():"");
    var isThis=state.weekStart===thisWeek,isLast=state.weekStart===addDays(thisWeek,-7);
    $("wLabel").textContent=isThis?"This week":isLast?"Last week":"Week of "+f(keys[0]);
    $("wRange").textContent=range;
    $("weekRange").textContent=isThis?"so far":"";
    $("wNext").disabled=state.weekStart>=thisWeek;
    $("wNow").hidden=isThis||isLast;
    var W=340,H=250,L=8,R=8,T=22,B=86;
    var max=Math.max(g.stepGoal,Math.max.apply(null,keys.map(function(k){return day(k).steps})))*1.08;
    var y=function(v){return T+(H-T-B)*(1-v/max)},base=y(0),slot=(W-L-R)/7,bw=Math.min(26,slot*.58);
    var s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Steps for '+range+'" font-family="Figtree,system-ui,sans-serif">';
    var gy=y(g.stepGoal);
    keys.forEach(function(k,i){
      var d=day(k),cx=L+slot*i+slot/2,top=y(d.steps),ok=d.steps>=g.stepGoal&&d.steps>0,future=k>t,dt=dateOf(k);
      s+='<rect x="'+(cx-bw/2)+'" y="'+T+'" width="'+bw+'" height="'+(base-T)+'" rx="'+(bw/2)+'" fill="var(--sunk)" fill-opacity="'+(future?.45:1)+'"/>';
      if(d.steps>0){var hh=Math.max(bw,base-top);s+='<rect x="'+(cx-bw/2)+'" y="'+(base-hh)+'" width="'+bw+'" height="'+hh+'" rx="'+(bw/2)+'" fill="var(--steps)" fill-opacity="'+(ok?1:.38)+'"/>';
        s+='<text x="'+cx+'" y="'+(base-hh-6)+'" text-anchor="middle" font-size="11" font-weight="700" fill="var(--ink)">'+short(d.steps)+'</text>'}
      s+='<text x="'+cx+'" y="'+(base+18)+'" text-anchor="middle" font-size="12" font-weight="700" fill="'+(k===t?"var(--ink)":"var(--muted)")+'" fill-opacity="'+(future?.5:1)+'">'+dt.toLocaleDateString(undefined,{weekday:"short"})+'</text>';
      if(!future){
        s+='<circle cx="'+cx+'" cy="'+(base+38)+'" r="7" fill="'+(d.mood?"var(--mood)":"none")+'" fill-opacity="'+(d.mood?(.25+d.mood*.15):0)+'" stroke="'+(d.mood?"var(--mood)":"var(--line)")+'" stroke-width="1.5"><title>Mood: '+(moodName(d.mood)||"not logged")+'</title></circle>';
        s+='<text x="'+cx+'" y="'+(base+66)+'" text-anchor="middle" font-size="12" font-weight="700" fill="'+(d.water?"var(--water)":"var(--line)")+'">'+(d.water||"·")+'</text>';
        s+='<rect class="hit" data-k="'+k+'" x="'+(cx-slot/2)+'" y="0" width="'+slot+'" height="'+H+'" fill="transparent"><title>'+dt.toDateString()+': '+fmt(d.steps)+' steps, '+d.water+' cups</title></rect>';
      }
    });
    s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+gy+'" y2="'+gy+'" stroke="var(--ink)" stroke-opacity=".5" stroke-width="1.2" stroke-dasharray="3 4" pointer-events="none"/>';
    s+='</svg>';
    $("chart").innerHTML=s;
    $("goalLegend").textContent="Goal "+short(g.stepGoal);
    $("chart").querySelectorAll(".hit").forEach(function(r){r.onclick=function(){openDay(r.getAttribute("data-k"))}});
  }
  $("wPrev").onclick=function(){state.weekStart=addDays(state.weekStart,-7);renderWeek()};
  $("wNext").onclick=function(){var n=addDays(state.weekStart,7);if(n<=weekStartOf(today())){state.weekStart=n;renderWeek()}};
  $("wNow").onclick=function(){state.weekStart=weekStartOf(today());renderWeek()};

  /* ---------- history ---------- */
  function renderHistory(){
    var ks=Object.keys(state.days).filter(function(k){return validKey(k)&&hasData(state.days[k])}).sort().reverse(),h=$("history"),g=state.settings.stepGoal;
    h.innerHTML="";
    if(!ks.length){h.innerHTML='<div class="empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--steps)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="2"/><path d="m7 21 3-6 3 2v5M10 15l1-6 4 3 3 1M11 9 8 10l-2 4"/></svg><b>No walks logged yet</b><span>Your days show up here once you log steps, mood, or water.</span><button class="btn" id="goToday">Log today</button></div>';
      $("goToday").onclick=function(){switchTab("today")};return}
    ks.slice(0,90).forEach(function(k){
      var d=day(k),dt=dateOf(k),bits=[];
      if(d.minutes)bits.push(d.minutes+" min");if(d.miles)bits.push(d.miles+" mi");if(d.water)bits.push(d.water+" cups");if(d.mood)bits.push(moodName(d.mood));
      var b=document.createElement("button");b.className="hrow";
      b.innerHTML=miniRing(g?d.steps/g:0,false)+'<div class="main"><b></b><small></small></div><div class="right"><b class="num"></b><span>steps</span></div>';
      b.querySelector(".main b").textContent=dt.toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"});
      b.querySelector(".main small").textContent=bits.join(" · ")||(d.note?d.note:"");
      b.querySelector(".right b").textContent=fmt(d.steps);
      b.onclick=function(){state.cur=k;var e=addDays(k,3);state.stripEnd=e>today()?today():e;switchTab("today")};
      h.appendChild(b);
    });
  }

  function renderMe(){setVal($("gSteps"),state.settings.stepGoal);setVal($("gWater"),state.settings.waterGoal)}
  function renderAll(){renderHeader();renderStrip();renderStreak();
    if(state.tab==="today")renderToday();if(state.tab==="week")renderProgress();if(state.tab==="weight")renderWeight();if(state.tab==="history")renderHistory();if(state.tab==="me")renderMe()}
  function switchTab(t){
    state.tab=t;["today","week","weight","history","me"].forEach(function(n){$("v-"+n).hidden=n!==t});
    document.querySelectorAll(".tab").forEach(function(b){if(b.dataset.tab===t)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")});
    try{sessionStorage.setItem("walklog.tab",t)}catch(e){}
    window.scrollTo(0,0);renderAll();
  }


  /* ---------- display mode + accent color ---------- */
  var WT=window.WalkTheme;
  function store(k,v){try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){}}
  function refreshLook(){
    WT.apply();
    var t=WT.getTheme(),dark=WT.isDark();
    document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){
      var forLight=(m.getAttribute("media")||"").indexOf("light")>=0;
      m.setAttribute("content",t==="light"?"#f3f4f1":t==="dark"?"#0f1113":(forLight?"#f3f4f1":"#0f1113"));
    });
    document.querySelectorAll("[data-theme-opt]").forEach(function(b){b.setAttribute("aria-pressed",String(b.dataset.themeOpt===t))});
    renderSwatches();
  }
  function renderSwatches(){
    var wrap=$("swatches"),cur=WT.getAccent(),mode=WT.isDark()?"dark":"light";
    wrap.innerHTML="";
    Object.keys(WT.ACCENTS).forEach(function(key){
      var a=WT.ACCENTS[key],c=a[mode];
      var b=document.createElement("button");b.className="swatch";b.setAttribute("aria-pressed",String(key===cur));b.setAttribute("aria-label",a.name);
      b.innerHTML='<i style="background:'+c[0]+'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="'+c[2]+'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg></i><span>'+a.name+'</span>';
      b.onclick=function(){store("walklog.accent",key==="green"?null:key);refreshLook()};
      wrap.appendChild(b);
    });
    $("accentName").textContent=WT.ACCENTS[cur].name;
  }
  document.querySelectorAll("[data-theme-opt]").forEach(function(b){b.onclick=function(){
    var t=b.dataset.themeOpt;store("walklog.theme",t==="system"?null:t);refreshLook();
  }});
  document.addEventListener("walklog:theme",refreshLook);
  refreshLook();

  /* ---------- pop-up sheets ---------- */
  var openSheetEl=null,lastFocus=null;
  function openSheet(id){
    closeSheet(true);
    var el=$(id);lastFocus=document.activeElement;el.hidden=false;openSheetEl=el;document.body.style.overflow="hidden";
    setTimeout(function(){var f=el.querySelector("[data-autofocus]")||el.querySelector(".x");if(f)try{f.focus()}catch(e){}},40);
  }
  function closeSheet(silent){
    if(!openSheetEl)return;openSheetEl.hidden=true;openSheetEl=null;document.body.style.overflow="";
    if(!silent&&lastFocus&&document.contains(lastFocus))try{lastFocus.focus()}catch(e){}
  }
  document.querySelectorAll("[data-close]").forEach(function(b){b.addEventListener("click",function(){closeSheet()})});
  document.addEventListener("keydown",function(e){if(e.key==="Escape"&&openSheetEl)closeSheet()});
  function dayLabel(k){var t=today();return k===t?"today":k===addDays(t,-1)?"yesterday":dateOf(k).toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"})}

  /* ---------- enter exact steps ---------- */
  function openSteps(){
    var d=day(state.cur);
    $("stepsFor").textContent="For "+dayLabel(state.cur);
    $("stepsIn").value=d.steps?String(d.steps):"";$("stepsErr").textContent="";
    openSheet("stepsSheet");
    setTimeout(function(){try{$("stepsIn").focus();$("stepsIn").select()}catch(e){}},60);
  }
  $("stepsBtn").onclick=openSteps;$("enterSteps").onclick=openSteps;
  function parseSteps(v){
    v=String(v||"").trim();
    if(/^\d{1,3}(\.\d{3})+$/.test(v))v=v.replace(/\./g,"");
    v=v.replace(/[\s,]/g,"");
    if(v==="")return 0;
    if(!/^\d+$/.test(v))return NaN;
    return parseInt(v,10);
  }
  $("stepsForm").addEventListener("submit",function(e){
    e.preventDefault();
    var n=parseSteps($("stepsIn").value);
    if(isNaN(n)){$("stepsErr").textContent="Use whole numbers only, like 7250.";return}
    if(n>200000){$("stepsErr").textContent="That's over 200,000 steps. Check the number and try again.";return}
    edit({steps:n});closeSheet();toast(n?fmt(n)+" steps saved":"Steps cleared");
  });

  /* ---------- day stats pop-up ---------- */
  var dayOpen=null;
  function bigRing(pct){
    var r=30,c=2*Math.PI*r,off=c*(1-Math.min(1,pct));
    return '<svg viewBox="0 0 76 76" aria-hidden="true"><circle cx="38" cy="38" r="'+r+'" fill="none" stroke="var(--steps-soft)" stroke-width="9"/>'+
      (pct>0?'<circle cx="38" cy="38" r="'+r+'" fill="none" stroke="var(--steps)" stroke-width="9" stroke-linecap="round" stroke-dasharray="'+c+'" stroke-dashoffset="'+off+'" transform="rotate(-90 38 38)"/>':'')+'</svg>';
  }
  function openDay(k){
    dayOpen=k;
    var d=day(k),g=state.settings,dt=dateOf(k),t=today(),logged=hasData(state.days[k]),wts=weightsOn(k);
    $("dayTitle").textContent=dt.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});
    $("daySub").textContent=k===t?"Today":k===addDays(t,-1)?"Yesterday":String(dt.getFullYear());
    var body=$("dayBody");body.innerHTML="";
    if(!logged){
      body.innerHTML='<p class="nothing">'+(wts.length?"No walk logged this day.":"Nothing logged for this day.")+'</p>';
      $("dayEdit").textContent="Log this day";
    } else {
      var pct=g.stepGoal?d.steps/g.stepGoal:0;
      var sub=d.steps>0&&d.steps>=g.stepGoal?"goal reached":Math.round(pct*100)+"% of your "+fmt(g.stepGoal)+" goal";
      body.innerHTML='<div class="stat-hero">'+bigRing(pct)+'<div><b class="num">'+fmt(d.steps)+'</b><span>steps · '+sub+'</span></div></div>'+
        '<div class="stat-grid">'+
          '<div class="stat"><span class="k">Time</span><span class="v num">'+(d.minutes?d.minutes+" min":"—")+'</span></div>'+
          '<div class="stat"><span class="k">Distance</span><span class="v num">'+(d.miles?d.miles+" mi":"—")+'</span></div>'+
          '<div class="stat"><span class="k">Water</span><span class="v num">'+d.water+'<small style="font-size:13px;color:var(--muted);font-family:var(--body);font-weight:500">of '+g.waterGoal+' cups</small></span></div>'+
          '<div class="stat"><span class="k">Mood</span><span class="v" id="dayMood">'+(d.mood?face(d.mood)+'<span></span>':"—")+'</span></div>'+
        '</div>';
      if(d.mood)$("dayMood").querySelector("span").textContent=moodName(d.mood);
      if(String(d.note||"").trim()){var n=document.createElement("p");n.className="stat-note";n.textContent=d.note;body.appendChild(n)}
      $("dayEdit").textContent="Edit this day";
    }
    if(wts.length){
      var lw=wts[wts.length-1],box=document.createElement("div");box.className="stat-grid";
      box.innerHTML='<div class="stat wide"><span class="k"><span class="wt-key">'+SCALE_SVG+'</span>Weight</span><span class="v num"></span></div>';
      box.querySelector(".v").textContent=fmtW(val(lw))+" "+unit()+" at "+stampOf(lw.at,false)+(wts.length>1?" ("+wts.length+" weigh-ins)":"");
      body.appendChild(box);
    }
    openSheet("daySheet");
  }
  $("dayEdit").onclick=function(){
    var k=dayOpen;if(!k)return;closeSheet(true);
    state.cur=k;var e=addDays(k,3);state.stripEnd=e>today()?today():e;switchTab("today");
  };

  /* ---------- progress: week / month ---------- */
  function renderProgress(){
    var w=state.range!=="month";
    $("r-week").hidden=!w;$("r-month").hidden=w;
    document.querySelectorAll("[data-range]").forEach(function(b){b.setAttribute("aria-pressed",String(b.dataset.range===state.range))});
    if(w)renderWeek();else renderMonth();
  }
  document.querySelectorAll("[data-range]").forEach(function(b){b.onclick=function(){
    state.range=b.dataset.range;try{sessionStorage.setItem("walklog.range",state.range)}catch(e){}renderProgress();
  }});
  function shiftMonth(n){var d=dateOf(state.month);state.month=keyOf(new Date(d.getFullYear(),d.getMonth()+n,1));renderMonth()}
  $("mPrev").onclick=function(){shiftMonth(-1)};
  $("mNext").onclick=function(){shiftMonth(1)};
  function renderMonth(){
    var ms=state.month,d0=dateOf(ms),y=d0.getFullYear(),m=d0.getMonth(),dim=new Date(y,m+1,0).getDate(),t=today(),g=state.settings.stepGoal;
    var thisMonth=t.slice(0,8)+"01";
    $("mTitle").textContent=d0.toLocaleDateString(undefined,{month:"long",year:"numeric"});
    $("mNext").disabled=ms>=thisMonth;
    var cal=$("cal");cal.innerHTML="";
    for(var w=0;w<7;w++){var h=document.createElement("div");h.className="wd";h.setAttribute("aria-hidden","true");h.textContent=new Date(2023,0,1+w).toLocaleDateString(undefined,{weekday:"narrow"});cal.appendChild(h)}
    for(var b=0;b<d0.getDay();b++){var bl=document.createElement("div");bl.className="cell blank";bl.setAttribute("aria-hidden","true");cal.appendChild(bl)}
    var logged=0,tot=0,goal=0,mi=0,wS=0,wDays={};
    state.weight.entries.forEach(function(e){wDays[e.at.slice(0,10)]=true});
    for(var i=1;i<=dim;i++){(function(i){
      var dt=new Date(y,m,i),k=keyOf(dt),dd=day(k),has=hasData(state.days[k]),future=k>t;
      var lvl=!has?"":(dd.steps>0&&dd.steps>=g)?"l3":dd.steps>=g/2?"l2":dd.steps>0?"l1":"l0";
      var c=document.createElement("button");c.className="cell"+(lvl?" "+lvl:"")+(k===t?" today":"");c.disabled=future;
      c.textContent=String(i);
      if(has&&dd.mood){var md=document.createElement("span");md.className="md";c.appendChild(md)}
      var wOn=wDays[k];if(wOn){var wt=document.createElement("span");wt.className="wt";wt.innerHTML=SCALE_SVG;c.appendChild(wt)}
      c.setAttribute("aria-label",dt.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"})+": "+(has?fmt(dd.steps)+" steps":"no walk logged")+(wOn?", weight logged":""));
      c.onclick=function(){openDay(k)};
      cal.appendChild(c);
      if(has){logged++;tot+=dd.steps;mi+=dd.miles;wS+=dd.water;if(dd.steps>0&&dd.steps>=g)goal++}
    })(i)}
    var span=ms===thisMonth?dateOf(t).getDate():dim;
    $("mDays").textContent=String(logged);
    $("mDaysSub").textContent=ms===thisMonth?"of "+span+(span===1?" day":" days")+" so far":"of "+dim+" days";
    $("mSteps").textContent=fmt(tot);$("mStepsSub").textContent=logged?fmt(tot/logged)+" avg per logged day":"no walks yet";
    $("mGoal").textContent=String(goal);$("mMiles").textContent=(Math.round(mi*10)/10)+" mi walked";
    $("mWater").textContent=logged?String(Math.round(wS/logged*10)/10):"—";
  }


  /* ---------- weight ---------- */
  var LB_PER_KG=2.20462,SCALE_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="4"/><path d="M8 10.5a4.5 4.5 0 0 1 8 0"/><path d="m12 10.5 1.6-2"/></svg>';
  var LIMITS={lb:[50,1000],kg:[22,455]};
  var wShown=30,wEditing=null,wRange="90";
  function unit(){return state.weight.unit}
  function conv(v,from,to){return from===to?v:(to==="kg"?v/LB_PER_KG:v*LB_PER_KG)}
  function r1(v){return Math.round(v*10)/10}
  function fmtW(v){var x=r1(v);return x.toLocaleString(undefined,{minimumFractionDigits:x%1?1:0,maximumFractionDigits:1})}
  function val(e){return conv(e.v,e.u,unit())}
  function sortedEntries(){return state.weight.entries.slice().sort(function(a,b){return a.at<b.at?-1:a.at>b.at?1:0})}
  function weightsOn(k){return sortedEntries().filter(function(e){return e.at.slice(0,10)===k})}
  function nowTime(){var d=new Date();return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0")}
  function stampOf(at,withDay){
    var d=new Date(at.slice(0,10)+"T"+(at.slice(11,16)||"12:00"));
    var t=d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});
    return withDay?d.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric",year:at.slice(0,4)!==today().slice(0,4)?"numeric":undefined})+" · "+t:t;
  }
  function parseWeight(s){
    s=String(s||"").trim().replace(",",".").replace(/\s+/g,"");
    if(!/^\d{1,4}(\.\d{0,2})?$/.test(s))return NaN;
    return parseFloat(s);
  }
  function checkWeight(n){
    var L=LIMITS[unit()];
    if(isNaN(n))return "Enter a number, like 165.4.";
    if(n<L[0]||n>L[1])return "Enter a weight between "+L[0]+" and "+L[1]+" "+unit()+".";
    return "";
  }

  function renderWeight(){
    var u=unit(),list=sortedEntries(),first=list[0],last=list[list.length-1],goal=state.weight.goal;
    document.querySelectorAll("[data-unit]").forEach(function(b){b.setAttribute("aria-pressed",String(b.dataset.unit===u))});
    $("wCur").innerHTML=last?fmtW(val(last))+"<small>"+u+"</small>":"—";
    $("wCurSub").textContent=last?"Logged "+stampOf(last.at,true):"No weigh-ins yet";
    var gv=goal?conv(goal.v,goal.u,u):null;
    $("wGoal").innerHTML=goal?fmtW(gv)+"<small>"+u+"</small>":"—";
    $("wGoalAct").textContent=goal?"Change goal":"Set your goal";
    // progress from starting weight to goal
    var showProg=!!(goal&&first&&last);
    $("wProg").hidden=!showProg;$("wStats").hidden=!first;
    if(first){
      var start=val(first),cur=val(last),ch=r1(cur-start);
      $("wStart").textContent=fmtW(start)+" "+u;
      $("wChange").textContent=(ch>0?"+":ch<0?"−":"")+fmtW(Math.abs(ch))+" "+u;
      if(goal){
        var losing=gv<=start,reached=losing?cur<=gv:cur>=gv,left=r1(Math.abs(cur-gv));
        $("wToGo").textContent=reached?"Reached":fmtW(left)+" "+u;
        var total=Math.abs(start-gv),done=losing?start-cur:cur-start,pct=total>0?Math.max(0,Math.min(1,done/total)):(reached?1:0);
        if(reached)pct=1;
        $("wBarFill").style.width=Math.round(pct*100)+"%";
        $("wBarLeft").innerHTML="<b>"+Math.round(pct*100)+"%</b> of the way";
        $("wBarRight").textContent=reached?"Goal reached":fmtW(left)+" "+u+" to go";
      } else $("wToGo").textContent="Set a goal";
    }
    renderWeightChart(list);
    // running log, newest first
    var wrap=$("wList");wrap.innerHTML="";
    $("wCount").textContent=list.length?list.length+(list.length===1?" entry":" entries"):"";
    if(!list.length){
      wrap.innerHTML='<div class="empty" style="padding:18px 8px"><b>No weigh-ins yet</b><span>Tap Log weight to add your first one. Each entry is saved with its date and time.</span></div>';
      $("wMore").hidden=true;return;
    }
    var rev=list.slice().reverse();
    rev.slice(0,wShown).forEach(function(e,i){
      var prev=rev[i+1],diff=prev?r1(val(e)-val(prev)):null;
      var b=document.createElement("button");b.className="wrow";
      b.innerHTML='<span class="ic">'+SCALE_SVG+'</span><span class="main"><b></b><small></small></span><span class="val"><b class="num"></b><small></small></span>';
      b.querySelector(".main b").textContent=dateOf(e.at.slice(0,10)).toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric",year:e.at.slice(0,4)!==today().slice(0,4)?"numeric":undefined});
      b.querySelector(".main small").textContent=stampOf(e.at,false);
      b.querySelector(".val b").textContent=fmtW(val(e))+" "+unit();
      b.querySelector(".val small").textContent=diff===null?"first entry":diff===0?"no change":(diff>0?"▲ ":"▼ ")+fmtW(Math.abs(diff));
      b.setAttribute("aria-label",b.querySelector(".main b").textContent+", "+b.querySelector(".main small").textContent+", "+b.querySelector(".val b").textContent+". Tap to edit");
      b.onclick=function(){openWeightSheet(e)};
      wrap.appendChild(b);
    });
    $("wMore").hidden=rev.length<=wShown;
  }
  $("wMore").onclick=function(){wShown+=30;renderWeight()};

  function renderWeightChart(list){
    var cutoff=wRange==="all"?"":addDays(today(),-Number(wRange));
    var pts=list.filter(function(e){return e.at.slice(0,10)>=cutoff});
    document.querySelectorAll("[data-wrange]").forEach(function(b){b.setAttribute("aria-pressed",String(b.dataset.wrange===wRange))});
    $("wTrendCard").hidden=list.length<2;
    if(list.length<2)return;
    if(pts.length<2){$("wChart").innerHTML='<p class="nothing">Not enough weigh-ins in this range yet. Try All.</p>';return}
    var u=unit(),goal=state.weight.goal,gv=goal?conv(goal.v,goal.u,u):null;
    var W=340,H=210,L=40,R=14,T=18,B=34;
    var ts=pts.map(function(e){return new Date(e.at.slice(0,10)+"T"+(e.at.slice(11,16)||"12:00")).getTime()});
    var vs=pts.map(val),lo=Math.min.apply(null,vs.concat(gv!=null?[gv]:[])),hi=Math.max.apply(null,vs.concat(gv!=null?[gv]:[]));
    var pad=Math.max(1,(hi-lo)*.15);lo=Math.floor(lo-pad);hi=Math.ceil(hi+pad);
    var t0=ts[0],t1=ts[ts.length-1],span=Math.max(1,t1-t0);
    var x=function(t){return L+(W-L-R)*(t-t0)/span},y=function(v){return T+(H-T-B)*(1-(v-lo)/(hi-lo))};
    var s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Weight trend" font-family="Figtree,system-ui,sans-serif">';
    for(var g=0;g<=3;g++){var gvv=lo+(hi-lo)*g/3,yy=y(gvv);
      s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'" stroke="var(--line)" stroke-width="1"/>';
      s+='<text x="'+(L-6)+'" y="'+(yy+4)+'" text-anchor="end" font-size="11" fill="var(--muted)">'+Math.round(gvv)+'</text>'}
    var line=pts.map(function(e,i){return (i?"L":"M")+x(ts[i]).toFixed(1)+" "+y(vs[i]).toFixed(1)}).join(" ");
    s+='<path d="'+line+" L"+x(t1).toFixed(1)+" "+(H-B)+" L"+x(t0).toFixed(1)+" "+(H-B)+' Z" fill="var(--steps)" fill-opacity=".12"/>';
    s+='<path d="'+line+'" fill="none" stroke="var(--steps)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    if(gv!=null){var gy=y(gv);s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+gy+'" y2="'+gy+'" stroke="var(--ink)" stroke-opacity=".55" stroke-width="1.3" stroke-dasharray="4 4"/>';
      s+='<text x="'+(W-R)+'" y="'+(gy-6)+'" text-anchor="end" font-size="11" font-weight="700" fill="var(--muted)">Goal '+fmtW(gv)+'</text>'}
    pts.forEach(function(e,i){var lastPt=i===pts.length-1;
      s+='<circle cx="'+x(ts[i])+'" cy="'+y(vs[i])+'" r="'+(lastPt?5.5:3)+'" fill="'+(lastPt?"var(--steps)":"var(--card)")+'" stroke="var(--steps)" stroke-width="2"><title>'+stampOf(e.at,true)+': '+fmtW(vs[i])+' '+u+'</title></circle>'});
    var lx=x(t1),ly=y(vs[vs.length-1]);
    s+='<text x="'+Math.min(lx,W-R)+'" y="'+(ly-11)+'" text-anchor="end" font-size="12" font-weight="700" fill="var(--ink)">'+fmtW(vs[vs.length-1])+'</text>';
    var df=function(t){return new Date(t).toLocaleDateString(undefined,{month:"short",day:"numeric"})};
    s+='<text x="'+L+'" y="'+(H-10)+'" font-size="11" fill="var(--muted)">'+df(t0)+'</text>';
    s+='<text x="'+(W-R)+'" y="'+(H-10)+'" text-anchor="end" font-size="11" fill="var(--muted)">'+df(t1)+'</text>';
    $("wChart").innerHTML=s+'</svg>';
  }
  document.querySelectorAll("[data-wrange]").forEach(function(b){b.onclick=function(){wRange=b.dataset.wrange;renderWeightChart(sortedEntries())}});
  document.querySelectorAll("[data-unit]").forEach(function(b){b.onclick=function(){state.weight.unit=b.dataset.unit;saveCache();renderWeight()}});

  // log / edit a weigh-in
  var wDelArmed=false,wDelT=null;
  function openWeightSheet(e){
    wEditing=e||null;wDelArmed=false;$("wsDelete").classList.remove("arm");$("wsDelete").textContent="Delete this entry";
    $("wsTitle").textContent=e?"Edit weigh-in":"Log weight";
    $("wsSub").textContent=e?"Change the weight, date, or time":"Saved with the date and time";
    $("wsUnit").textContent=unit();
    $("wsVal").value=e?fmtW(val(e)).replace(/,/g,""):"";
    $("wsDate").value=e?e.at.slice(0,10):today();$("wsDate").max=today();
    $("wsTime").value=e?(e.at.slice(11,16)||"12:00"):nowTime();
    $("wsErr").textContent="";$("wsDelete").hidden=!e;$("wsSave").textContent=e?"Save changes":"Save";
    openSheet("weightSheet");
    setTimeout(function(){try{$("wsVal").focus();$("wsVal").select()}catch(x){}},60);
  }
  $("wLogBtn").onclick=function(){openWeightSheet(null)};
  $("weightForm").addEventListener("submit",function(ev){
    ev.preventDefault();
    var n=parseWeight($("wsVal").value),msg=checkWeight(n);
    if(msg){$("wsErr").textContent=msg;return}
    var d=$("wsDate").value,tm=$("wsTime").value||"12:00";
    if(!validKey(d)){$("wsErr").textContent="Choose a date.";return}
    if(d>today()){$("wsErr").textContent="The date can't be in the future.";return}
    var at=d+"T"+tm;
    if(wEditing){wEditing.v=r1(n);wEditing.u=unit();wEditing.at=at}
    else state.weight.entries.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),at:at,v:r1(n),u:unit()});
    saveCache();closeSheet();renderWeight();toast(wEditing?"Weigh-in updated":"Weight saved");wEditing=null;
  });
  $("wsDelete").onclick=function(){
    var b=$("wsDelete");
    if(!wDelArmed){wDelArmed=true;b.classList.add("arm");b.textContent="Tap again to delete";clearTimeout(wDelT);wDelT=setTimeout(function(){wDelArmed=false;b.classList.remove("arm");b.textContent="Delete this entry"},4000);return}
    var id=wEditing&&wEditing.id;
    state.weight.entries=state.weight.entries.filter(function(x){return x.id!==id});
    wEditing=null;saveCache();closeSheet();renderWeight();toast("Weigh-in deleted");
  };

  // goal weight
  var gDelArmed=false;
  $("wGoalBtn").onclick=function(){
    var g=state.weight.goal;gDelArmed=false;$("gsRemove").classList.remove("arm");$("gsRemove").textContent="Remove goal";
    $("gsUnit").textContent=unit();$("gsVal").value=g?fmtW(conv(g.v,g.u,unit())).replace(/,/g,""):"";
    $("gsErr").textContent="";$("gsRemove").hidden=!g;
    openSheet("goalSheet");setTimeout(function(){try{$("gsVal").focus();$("gsVal").select()}catch(x){}},60);
  };
  $("goalForm").addEventListener("submit",function(ev){
    ev.preventDefault();
    var n=parseWeight($("gsVal").value),msg=checkWeight(n);
    if(msg){$("gsErr").textContent=msg;return}
    state.weight.goal={v:r1(n),u:unit()};saveCache();closeSheet();renderWeight();toast("Goal saved");
  });
  $("gsRemove").onclick=function(){
    var b=$("gsRemove");
    if(!gDelArmed){gDelArmed=true;b.classList.add("arm");b.textContent="Tap again to remove";return}
    state.weight.goal=null;saveCache();closeSheet();renderWeight();toast("Goal removed");
  };

  /* ---------- inputs ---------- */
  function num(v,dec){var n=dec?parseFloat(v):parseInt(v,10);return isFinite(n)&&n>0?n:0}
  $("minutes").addEventListener("input",function(e){edit({minutes:num(e.target.value)})});
  $("miles").addEventListener("input",function(e){edit({miles:num(e.target.value,true)})});
  $("note").addEventListener("input",function(e){edit({note:e.target.value})});
  document.querySelectorAll("[data-add]").forEach(function(b){b.onclick=function(){edit({steps:day(state.cur).steps+Number(b.dataset.add)});toast("+"+fmt(+b.dataset.add)+" steps")}});
  $("wPlus").onclick=function(){edit({water:day(state.cur).water+1})};
  $("wMinus").onclick=function(){edit({water:day(state.cur).water-1})};
  $("wkPrev").onclick=function(){state.stripEnd=addDays(state.stripEnd,-7);renderStrip()};
  $("wkNext").onclick=function(){var n=addDays(state.stripEnd,7);state.stripEnd=n>today()?today():n;renderStrip()};
  document.querySelectorAll(".tab").forEach(function(b){b.onclick=function(){switchTab(b.dataset.tab)}});
  function setGoal(kind,v){
    if(kind==="steps")state.settings.stepGoal=clampInt(v,500,100000);else state.settings.waterGoal=clampInt(v,1,20);
    saveCache();
    renderAll();
  }
  document.querySelectorAll("[data-g]").forEach(function(b){b.onclick=function(){var k=b.dataset.g,cur=k==="steps"?state.settings.stepGoal:state.settings.waterGoal;setGoal(k,cur+Number(b.dataset.d))}});
  $("gSteps").addEventListener("change",function(e){var v=num(e.target.value);if(v)setGoal("steps",v);else renderMe()});
  $("gWater").addEventListener("change",function(e){var v=num(e.target.value);if(v)setGoal("water",v);else renderMe()});
  var armed=false,armT=null;
  $("clear").onclick=function(){
    var b=$("clear");
    if(!armed){armed=true;b.classList.add("arm");b.textContent="Tap again to clear";clearTimeout(armT);armT=setTimeout(function(){armed=false;b.classList.remove("arm");b.textContent="Clear this day"},3500);return}
    armed=false;b.classList.remove("arm");b.textContent="Clear this day";
    state.days[state.cur]=blank();changed(state.cur);renderAll();toast("Day cleared");
  };

  /* ---------- backup ---------- */
  $("exportBtn").onclick=function(){
    var blob=new Blob([JSON.stringify({app:"walk-log",version:1,exported:new Date().toISOString(),days:state.days,settings:state.settings,weight:state.weight},null,2)],{type:"application/json"});
    var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="walk-log-backup-"+today()+".json";
    document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1000);
    $("backupMsg").textContent="Backup downloaded.";
  };
  $("importBtn").onclick=function(){$("importFile").click()};
  $("importFile").onchange=function(e){
    var f=e.target.files&&e.target.files[0];if(!f)return;
    if(f.size>5e6){$("backupMsg").textContent="That file is too large to be a Walk Log backup.";e.target.value="";return}
    var r=new FileReader();
    r.onload=function(){
      try{
        var data=JSON.parse(r.result);if(!data||typeof data.days!=="object")throw new Error();
        var n=0;Object.keys(data.days).forEach(function(k){if(validKey(k)&&hasData(data.days[k])){state.days[k]=clean(data.days[k]);n++}});
        if(data.settings&&data.settings.stepGoal){state.settings={stepGoal:clampInt(data.settings.stepGoal,500,100000),waterGoal:clampInt(data.settings.waterGoal,1,20)}}
        var wn=0;
        if(data.weight){
          var inW=cleanWeight(data.weight),have={};
          state.weight.entries.forEach(function(e){have[e.id]=true;have[e.at+"|"+e.v+e.u]=true});
          inW.entries.forEach(function(e){if(!have[e.id]&&!have[e.at+"|"+e.v+e.u]){state.weight.entries.push(e);wn++}});
          if(inW.goal&&!state.weight.goal)state.weight.goal=inW.goal;
        }
        saveCache();renderAll();$("backupMsg").textContent="Restored "+n+(n===1?" day":" days")+(wn?" and "+wn+(wn===1?" weigh-in.":" weigh-ins."):".");
      }catch(err){$("backupMsg").textContent="That file isn't a Walk Log backup. Choose the .json file you downloaded from this app."}
      e.target.value="";
    };
    r.readAsText(f);
  };

  /* ---------- boot ---------- */
  try{var st=sessionStorage.getItem("walklog.tab");if(st&&$("v-"+st))state.tab=st;var rg=sessionStorage.getItem("walklog.range");if(rg==="month")state.range="month"}catch(e){}
  loadCache();mergeOldAccountCopies();keepStorage();
  switchTab(state.tab);setSaved("Saved on this device");
  document.addEventListener("visibilitychange",function(){if(!document.hidden&&state.stripEnd!==today()&&state.cur===addDays(today(),-1)){state.cur=today();state.stripEnd=today();renderAll()}});
  if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){})})}
})();
