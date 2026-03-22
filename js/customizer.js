// ── HHP_Customizer v3 — Fast init, smooth transitions, full overview customization ──
(function() {
  'use strict';

  // ══════════════════════════════════════
  //  WIDGET REGISTRY
  // ══════════════════════════════════════
  // fixed:true = always full width, no resize button shown
  var WIDGETS = {
    client: [
      { wid:'cw-stats',    icon:'📊', label:'My Stats',              size:'full',  preset:true,  fixed:false,  renderFn:'_rwClientStats' },
      { wid:'cw-upcoming', icon:'📅', label:'Upcoming Appointments', size:'half',  preset:true,  fixed:false, renderFn:'_rwClientUpcoming' },
      { wid:'cw-notif',    icon:'🔔', label:'Recent Notifications',  size:'half',  preset:true,  fixed:false, renderFn:'_rwClientNotif' },
      { wid:'cw-pets',     icon:'🐾', label:'My Pets',               size:'half',  preset:false, fixed:false, renderFn:'_rwClientPets' },
      { wid:'cw-tracking', icon:'🗺️', label:'Live Tracking',         size:'half',  preset:false, fixed:false, renderFn:'_rwClientTracking' },
      { wid:'cw-photos',   icon:'📸', label:'Photo Gallery',         size:'half',  preset:false, fixed:false, renderFn:'_rwClientPhotos' },
      { wid:'cw-reports',  icon:'📋', label:'Walk Reports',          size:'half',  preset:false, fixed:false, renderFn:'_rwClientReports' },
      { wid:'cw-reviews',  icon:'⭐', label:'My Reviews',            size:'half',  preset:false, fixed:false, renderFn:'_rwClientReviews' },
      { wid:'cw-msgs',     icon:'💬', label:'Messages',              size:'half',  preset:false, fixed:false, renderFn:'_rwClientMsgs' },
      { wid:'cw-billing',  icon:'💳', label:'Billing',               size:'half',  preset:false, fixed:false, renderFn:'_rwClientBilling' }
    ],
    staff: [
      { wid:'sw-stats',    icon:'📊', label:'My Stats',              size:'full',  preset:true,  fixed:false,  renderFn:'_rwStaffStats' },
      { wid:'sw-jobs',     icon:'🦮', label:"This Week's Jobs",      size:'full',  preset:true,  fixed:false, renderFn:'_rwStaffJobs' },
      { wid:'sw-clients',  icon:'👥', label:'My Clients',            size:'half',  preset:false, fixed:false, renderFn:'_rwStaffClients' },
      { wid:'sw-earnings', icon:'💰', label:'Earnings',              size:'half',  preset:false, fixed:false, renderFn:'_rwStaffEarnings' },
      { wid:'sw-msgs',     icon:'💬', label:'Messages',              size:'half',  preset:false, fixed:false, renderFn:'_rwStaffMsgs' },
      { wid:'sw-cal',      icon:'📆', label:'Calendar',              size:'half',  preset:false, fixed:false, renderFn:'_rwStaffCal' }
    ],
    owner: [
      { wid:'ow-banner',    icon:'👑', label:'Welcome Banner',        size:'full',  preset:true,  fixed:false,  renderFn:'_rwOwnerBanner' },
      { wid:'ow-alerts',    icon:'🔔', label:'Alerts & Messages',     size:'half',  preset:true,  fixed:false, renderFn:'_rwOwnerAlerts' },
      { wid:'ow-weekstats', icon:'📊', label:'This Week at a Glance', size:'half',  preset:true,  fixed:false, renderFn:'_rwOwnerWeekStats' },
      { wid:'ow-requests',  icon:'📋', label:'Booking Requests',      size:'full',  preset:true,  fixed:false,  renderFn:'_rwOwnerRequests' },
      { wid:'ow-today',     icon:'📅', label:"Today's Schedule",      size:'full',  preset:true,  fixed:false,  renderFn:'_rwOwnerToday' },
      { wid:'ow-clients',   icon:'👥', label:'All Clients',           size:'half',  preset:false, fixed:false, renderFn:'_rwOwnerClients' },
      { wid:'ow-staff',     icon:'🧑‍🤝‍🧑', label:'Staff Team',            size:'half',  preset:false, fixed:false, renderFn:'_rwOwnerStaff' },
      { wid:'ow-reviews',   icon:'⭐', label:'Reviews',               size:'half',  preset:false, fixed:false, renderFn:'_rwOwnerReviews' },
      { wid:'ow-payments',  icon:'💳', label:'Payments',              size:'half',  preset:false, fixed:false, renderFn:'_rwOwnerPayments' },
      { wid:'ow-deals',     icon:'🏷️', label:'Specials & Deals',      size:'half',  preset:false, fixed:false, renderFn:'_rwOwnerDeals' },
      { wid:'ow-photos',    icon:'🖼️', label:'Photos & Media',        size:'half',  preset:false, fixed:false, renderFn:'_rwOwnerPhotos' },
      { wid:'ow-activity',  icon:'📜', label:'Activity Log',          size:'half',  preset:false, fixed:false, renderFn:'_rwOwnerActivity' }
    ]
  };

  var _panelNav = {
    'cw-upcoming':"sTab('c','c-appts')",'cw-pets':"sTab('c','c-pets')",'cw-tracking':"sTab('c','c-track')",
    'cw-photos':"sTab('c','c-photos')",'cw-reports':"sTab('c','c-reports')",'cw-reviews':"sTab('c','c-reviews')",
    'cw-msgs':"sTab('c','c-msgs')",'cw-billing':"sTab('c','c-bill')",
    'sw-jobs':"sTab('s','s-jobs')",'sw-clients':"sTab('s','s-clients')",'sw-earnings':"sTab('s','s-earn')",
    'sw-msgs':"sTab('s','s-msgs')",'sw-cal':"sTab('s','s-cal')",
    'ow-requests':"sTab('o','o-sched')",'ow-clients':"sTab('o','o-clients')",'ow-staff':"sTab('o','o-staff')",
    'ow-reviews':"sTab('o','o-reviews')",'ow-payments':"sTab('o','o-payments')",'ow-deals':"sTab('o','o-deals')",
    'ow-photos':"sTab('o','o-photos')",'ow-activity':"sTab('o','o-activity')"
  };

  function _defaults(p) { return (WIDGETS[p]||[]).filter(function(w){return w.preset;}).map(function(w){return w.wid;}); }

  // ── STATE ──
  var _prefs = {}, _editMode = false, _saving = false;
  function _getSB(){ return window.HHP_Auth && window.HHP_Auth.supabase; }
  function _getUser(){ return window.HHP_Auth && window.HHP_Auth.currentUser; }
  function _getPortal(){
    if(!window.HHP_Auth||!window.HHP_Auth.currentUser) return null;
    var r=window.HHP_Auth.currentRole;
    return r==='owner'?'owner':r==='staff'?'staff':r==='client'?'client':null;
  }

  // ══════════════════════════════════════
  //  PREFS — Supabase load/save
  // ══════════════════════════════════════
  async function _loadPrefs(){
    var sb=_getSB(),u=_getUser(); if(!sb||!u) return;
    try{ var{data}=await sb.from('user_layout_prefs').select('*').eq('user_id',u.id);
      (data||[]).forEach(function(r){ _prefs[r.portal]={sidebar_order:r.sidebar_order||[],widgets:r.overview_widgets||[],sizes:(r.sidebar_order&&r.sidebar_order.__sizes)||{}}; });
    }catch(e){console.warn('Cust load:',e);}
  }

  async function _savePrefs(portal){
    if(_saving) return; _saving=true;
    var sb=_getSB(),u=_getUser(); if(!sb||!u){_saving=false;return;}
    var p=_prefs[portal]||{};
    try{
      var sd=Array.isArray(p.sidebar_order)?(p.sidebar_order).slice():[];
      if(p.sizes&&Object.keys(p.sizes).length) sd.__sizes=p.sizes;
      await sb.from('user_layout_prefs').upsert({user_id:u.id,portal:portal,sidebar_order:sd,overview_widgets:p.widgets||[],updated_at:new Date().toISOString()},{onConflict:'user_id,portal'});
    }catch(e){console.warn('Cust save:',e);}
    _saving=false;
  }

  function _getActive(p){return _prefs[p]&&_prefs[p].widgets&&_prefs[p].widgets.length>0?_prefs[p].widgets:_defaults(p);}
  function _getSize(p,wid){if(_prefs[p]&&_prefs[p].sizes&&_prefs[p].sizes[wid])return _prefs[p].sizes[wid];var d=(WIDGETS[p]||[]).find(function(w){return w.wid===wid;});return d?d.size:'half';}

  // ══════════════════════════════════════
  //  SIDEBAR: Edit/Save toggle + drag reorder
  // ══════════════════════════════════════
  var _sbEdit={active:false,portal:null,dragging:false,el:null,ph:null,offsetY:0,container:null};

  function _initSidebar(portal){
    var pgId=portal==='client'?'pg-client':portal==='staff'?'pg-staff':'pg-owner';
    var sidebar=document.querySelector('#'+pgId+' .sidebar');
    if(!sidebar||sidebar.getAttribute('data-cust-sb')) return;
    sidebar.setAttribute('data-cust-sb','1');

    // Inject Edit button at top of sidebar (after sidebar-user)
    var sidebarUser=sidebar.querySelector('.sidebar-user');
    var editBtn=document.createElement('button');
    editBtn.id='sb-edit-btn-'+portal;
    editBtn.className='sb-edit-toggle';
    editBtn.innerHTML='✏️ Edit';
    editBtn.style.cssText='display:block;width:calc(100% - 20px);margin:6px 10px 8px;padding:7px 0;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:rgba(255,255,255,0.7);font-size:0.78rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.2s;letter-spacing:0.02em';
    editBtn.addEventListener('mouseenter',function(){if(!_sbEdit.active){this.style.background='rgba(255,255,255,0.14)';this.style.color='#fff';}});
    editBtn.addEventListener('mouseleave',function(){if(!_sbEdit.active){this.style.background='rgba(255,255,255,0.08)';this.style.color='rgba(255,255,255,0.7)';}});
    editBtn.addEventListener('click',function(e){e.stopPropagation();_toggleSidebarEdit(portal);});
    if(sidebarUser&&sidebarUser.nextSibling){sidebar.insertBefore(editBtn,sidebarUser.nextSibling);}
    else{sidebar.appendChild(editBtn);}
  }

  function _toggleSidebarEdit(portal){
    _sbEdit.active=!_sbEdit.active;
    _sbEdit.portal=portal;
    var pgId=portal==='client'?'pg-client':portal==='staff'?'pg-staff':'pg-owner';
    var sidebar=document.querySelector('#'+pgId+' .sidebar');
    var btn=document.getElementById('sb-edit-btn-'+portal);
    var items=sidebar?sidebar.querySelectorAll('.sb-nav-group .sb-item'):[];

    if(_sbEdit.active){
      // Enter edit mode
      if(btn){btn.innerHTML='💾 Save';btn.style.background='var(--gold)';btn.style.color='#1a1a1a';btn.style.borderColor='var(--gold)';}
      // Prevent text selection in sidebar during edit mode
      if(sidebar){sidebar.style.userSelect='none';sidebar.style.webkitUserSelect='none';}
      items.forEach(function(item){
        // Add drag handle
        if(!item.querySelector('.sb-drag-handle')){
          var h=document.createElement('span');
          h.className='sb-drag-handle';
          h.innerHTML='☰';
          h.style.cssText='font-size:0.75rem;color:rgba(255,255,255,0.5);position:absolute;left:4px;top:50%;transform:translateY(-50%);pointer-events:none';
          item.style.position='relative';item.style.paddingLeft='22px';
          item.insertBefore(h,item.firstChild);
        }else{
          item.querySelector('.sb-drag-handle').style.display='';
        }
        // Visual cue: slight outline
        item.style.outline='1px dashed rgba(200,150,62,0.3)';
        item.style.outlineOffset='-1px';
        item.style.cursor='grab';
        // Store original onclick and disable navigation while editing
        if(!item.hasAttribute('data-orig-onclick')){
          item.setAttribute('data-orig-onclick',item.getAttribute('onclick')||'');
        }
        item.setAttribute('onclick','event.preventDefault();event.stopPropagation();');
        // Add drag listeners
        item._sbDown=function(e){if(e.button!==0)return;e.preventDefault();_sbStartDrag(item,e,portal);};
        item.addEventListener('pointerdown',item._sbDown);
      });
    }else{
      // Exit edit mode — save order, restore navigation
      if(btn){btn.innerHTML='✏️ Edit';btn.style.background='rgba(255,255,255,0.08)';btn.style.color='rgba(255,255,255,0.7)';btn.style.borderColor='rgba(255,255,255,0.15)';}
      if(sidebar){sidebar.style.userSelect='';sidebar.style.webkitUserSelect='';}
      // Collect new order from all groups
      var order=[];
      if(sidebar){sidebar.querySelectorAll('.sb-nav-group .sb-item').forEach(function(it){
        var orig=it.getAttribute('data-orig-onclick')||'';
        var m=orig.match(/sTab\([^,]+,'([^']+)'\)/);if(m)order.push(m[1]);
      });}
      if(!_prefs[portal])_prefs[portal]={sidebar_order:[],widgets:[],sizes:{}};
      _prefs[portal].sidebar_order=order;_savePrefs(portal);
      if(typeof toast==='function')toast('✓ Order saved');
      items.forEach(function(item){
        // Remove drag handle visibility
        var handle=item.querySelector('.sb-drag-handle');
        if(handle)handle.style.display='none';
        // Restore original onclick
        var orig=item.getAttribute('data-orig-onclick');
        if(orig){item.setAttribute('onclick',orig);}
        item.removeAttribute('data-orig-onclick');
        // Remove edit styling
        item.style.outline='';item.style.outlineOffset='';item.style.cursor='';
        // Remove drag listener
        if(item._sbDown){item.removeEventListener('pointerdown',item._sbDown);delete item._sbDown;}
      });
    }
  }

  function _sbStartDrag(el,e,portal){
    _sbEdit.dragging=true;_sbEdit.el=el;_sbEdit.container=el.parentElement;
    var r=el.getBoundingClientRect();_sbEdit.offsetY=e.clientY-r.top;
    var ph=document.createElement('div');
    ph.className='sb-drag-placeholder';
    ph.style.cssText='height:'+r.height+'px;background:rgba(200,150,62,0.12);border:1.5px dashed rgba(200,150,62,0.4);border-radius:6px;margin:2px 0';
    _sbEdit.ph=ph;el.parentElement.insertBefore(ph,el);
    el.style.cssText+=';position:fixed;left:'+r.left+'px;top:'+r.top+'px;width:'+r.width+'px;z-index:10000;box-shadow:0 6px 24px rgba(0,0,0,0.4);opacity:0.92;pointer-events:none;transform:scale(1.03);transition:none';
    document.addEventListener('pointermove',_sbOnMove);
    document.addEventListener('pointerup',_sbOnEnd);
  }

  function _sbOnMove(e){
    if(!_sbEdit.dragging)return;e.preventDefault();
    _sbEdit.el.style.top=(e.clientY-_sbEdit.offsetY)+'px';
    var sibs=Array.from(_sbEdit.container.querySelectorAll('.sb-item:not([style*="position:fixed"]):not([style*="position: fixed"]),.sb-drag-placeholder'));
    for(var i=0;i<sibs.length;i++){if(sibs[i]===_sbEdit.ph)continue;var mid=sibs[i].getBoundingClientRect().top+sibs[i].offsetHeight/2;if(e.clientY<mid){_sbEdit.container.insertBefore(_sbEdit.ph,sibs[i]);return;}}
    _sbEdit.container.appendChild(_sbEdit.ph);
  }

  function _sbOnEnd(){
    document.removeEventListener('pointermove',_sbOnMove);document.removeEventListener('pointerup',_sbOnEnd);
    if(!_sbEdit.dragging)return;
    if(_sbEdit.ph&&_sbEdit.ph.parentElement){_sbEdit.container.insertBefore(_sbEdit.el,_sbEdit.ph);_sbEdit.ph.remove();}
    ['position','left','top','width','z-index','box-shadow','opacity','pointer-events','transform','transition'].forEach(function(p){_sbEdit.el.style.removeProperty(p);});
    _sbEdit.el.style.position='relative';_sbEdit.el.style.cursor='grab';
    _sbEdit.dragging=false;_sbEdit.el=null;_sbEdit.ph=null;
  }

  function _applySidebarOrder(portal){
    if(!_prefs[portal]||!_prefs[portal].sidebar_order||_prefs[portal].sidebar_order.length===0) return;
    var pgId=portal==='client'?'pg-client':portal==='staff'?'pg-staff':'pg-owner';
    var groups=document.querySelectorAll('#'+pgId+' .sidebar .sb-nav-group');
    var order=_prefs[portal].sidebar_order;
    groups.forEach(function(g){
      var items=Array.from(g.querySelectorAll('.sb-item'));if(items.length<2)return;
      items.sort(function(a,b){var aM=(a.getAttribute('onclick')||'').match(/sTab\([^,]+,'([^']+)'\)/),bM=(b.getAttribute('onclick')||'').match(/sTab\([^,]+,'([^']+)'\)/);var aI=aM?order.indexOf(aM[1]):-1,bI=bM?order.indexOf(bM[1]):-1;if(aI===-1)aI=999;if(bI===-1)bI=999;return aI-bI;});
      items.forEach(function(it){g.appendChild(it);});
    });
  }

  // ══════════════════════════════════════
  //  OVERVIEW — setup + render
  // ══════════════════════════════════════
  function _getOverviewEl(p){return document.getElementById(p==='client'?'c-dash':p==='staff'?'s-sched':'o-overview');}

  function _setupOverview(portal){
    var el=_getOverviewEl(portal);
    if(!el||el.getAttribute('data-cust')) return;
    el.setAttribute('data-cust','1');

    // Keep the p-header, REMOVE everything else from DOM entirely
    // (not just hide — hidden elements with IDs cause duplicate ID conflicts
    // and data loaders populate the hidden originals instead of new widgets)
    var header=el.querySelector('.p-header');
    var toRemove=[];
    Array.from(el.children).forEach(function(child){
      if(child===header) return;
      toRemove.push(child);
    });
    toRemove.forEach(function(child){ el.removeChild(child); });

    // Toolbar
    var tb=document.createElement('div');
    tb.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:14px';
    tb.innerHTML='<div style="font-size:0.78rem;font-weight:700;color:var(--mid);text-transform:uppercase;letter-spacing:0.05em">📌 Your Overview</div>'+
      '<button id="cust-editbtn-'+portal+'" onclick="HHP_Customizer.toggleEdit()" style="background:none;border:1px solid var(--border);border-radius:8px;padding:5px 14px;font-size:0.78rem;font-weight:600;color:var(--mid);cursor:pointer;font-family:inherit;transition:all 0.2s">✏️ Customize</button>';

    // Widget grid
    var grid=document.createElement('div');
    grid.id='cust-grid-'+portal;
    grid.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:14px;opacity:0;transition:opacity 0.3s';

    el.appendChild(tb); el.appendChild(grid);
  }

  async function _renderWidgets(portal){
    var grid=document.getElementById('cust-grid-'+portal);
    if(!grid) return;
    var active=_getActive(portal), allW=WIDGETS[portal]||[];
    var html='';
    for(var i=0;i<active.length;i++){
      var w=allW.find(function(x){return x.wid===active[i];}); if(!w) continue;
      var size=_getSize(portal,w.wid);
      var renderer=_R[w.renderFn];
      var body='';
      if(renderer){try{body=await renderer();}catch(e){body='<div style="color:var(--mid);font-size:0.82rem">Could not load</div>';}}
      html+=_card(portal,w,body,size);
    }
    if(!html) html='<div style="grid-column:1/-1;padding:30px;text-align:center;color:var(--mid);font-size:0.85rem;background:var(--warm);border-radius:12px;border:1.5px dashed var(--border)">No widgets visible. Click <strong>✏️ Customize</strong> to add sections.</div>';
    grid.innerHTML=html;
    // Fade in
    requestAnimationFrame(function(){grid.style.opacity='1';});
  }

  function _card(portal,w,body,size){
    var full=size==='full', span=full?'grid-column:1/-1;':'';
    var otherSize=full?'half':'full', sIcon=full?'⊟':'⊞';
    var nav=_panelNav[w.wid]||'';
    var canResize=!w.fixed; // Don't show resize on fixed-size widgets
    return '<div class="cust-widget" data-wid="'+w.wid+'" style="'+span+'background:white;border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.04)">'+
      '<div style="display:flex;align-items:center;gap:8px;padding:12px 14px 0;user-select:none">'+
        '<span style="font-size:1.1rem">'+w.icon+'</span>'+
        '<span style="font-size:0.78rem;font-weight:700;color:var(--mid);text-transform:uppercase;letter-spacing:0.04em;flex:1">'+w.label+'</span>'+
        (canResize?'<button onclick="event.stopPropagation();HHP_Customizer.setSize(\''+portal+'\',\''+w.wid+'\',\''+otherSize+'\')" title="'+(full?'Shrink':'Expand full width')+'" style="background:none;border:none;cursor:pointer;font-size:1rem;color:var(--mid);padding:2px 4px;opacity:0.4;transition:opacity 0.15s" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0.4">'+sIcon+'</button>':'')+
        (nav?'<button onclick="event.stopPropagation();HHP_Customizer.detail(\''+portal+'\',\''+w.wid+'\')" title="Detail view" style="background:none;border:none;cursor:pointer;font-size:0.85rem;color:var(--mid);padding:2px 4px;opacity:0.4;transition:opacity 0.15s" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0.4">🔍</button>':'')+
        (nav?'<button onclick="event.stopPropagation();'+nav+'" title="Go to panel" style="background:none;border:none;cursor:pointer;font-size:0.7rem;color:var(--gold);font-weight:700;padding:2px 6px;opacity:0.5;transition:opacity 0.15s" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0.5">View →</button>':'')+
      '</div><div style="padding:10px 14px 14px">'+body+'</div></div>';
  }

  // ══════════════════════════════════════
  //  DETAIL SHEET
  // ══════════════════════════════════════
  function _detail(portal,wid){
    var ov=document.getElementById('cust-detail-ov');
    if(!ov){
      ov=document.createElement('div');ov.id='cust-detail-ov';
      ov.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9998;opacity:0;transition:opacity 0.25s';
      ov.onclick=function(e){if(e.target===ov)_closeDetail();};
      var sh=document.createElement('div');sh.id='cust-detail-sh';
      sh.style.cssText='position:fixed;bottom:0;left:0;right:0;max-height:80vh;background:white;border-radius:20px 20px 0 0;box-shadow:0 -8px 40px rgba(0,0,0,0.18);z-index:9999;overflow-y:auto;transform:translateY(100%);transition:transform 0.3s ease';
      sh.innerHTML='<div style="padding:10px 0 4px;text-align:center;cursor:pointer" onclick="HHP_Customizer.closeDetail()"><div style="width:40px;height:4px;background:#d0c8b8;border-radius:4px;margin:0 auto"></div></div><div id="cust-detail-body" style="padding:4px 20px 28px"></div>';
      ov.appendChild(sh);document.body.appendChild(ov);
    }
    var body=document.getElementById('cust-detail-body');
    var w=(WIDGETS[portal]||[]).find(function(x){return x.wid===wid;});
    if(!w){return;}
    body.innerHTML='<div style="text-align:center;padding:20px;color:var(--mid)">Loading...</div>';
    ov.style.display='block';
    requestAnimationFrame(function(){ov.style.opacity='1';document.getElementById('cust-detail-sh').style.transform='translateY(0)';});
    var fn=_D[w.renderFn]||_R[w.renderFn];
    if(fn) fn().then(function(h){
      body.innerHTML='<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px"><span style="font-size:1.5rem">'+w.icon+'</span><h3 style="font-family:\'Cormorant Garamond\',serif;font-size:1.3rem;margin:0">'+w.label+'</h3></div>'+h;
    });
  }

  function _closeDetail(){
    var ov=document.getElementById('cust-detail-ov');if(!ov)return;
    ov.style.opacity='0';var sh=document.getElementById('cust-detail-sh');if(sh)sh.style.transform='translateY(100%)';
    setTimeout(function(){ov.style.display='none';},300);
  }

  // ══════════════════════════════════════
  //  EDIT PICKER
  // ══════════════════════════════════════
  function _toggleEdit(){
    var portal=_getPortal();if(!portal)return;
    _editMode=!_editMode;
    var btn=document.getElementById('cust-editbtn-'+portal);
    if(_editMode){
      _buildPicker(portal);
      if(btn){btn.textContent='✓ Done';btn.style.background='var(--forest)';btn.style.color='white';btn.style.borderColor='var(--forest)';}
    }else{
      var ov=document.getElementById('cust-picker-ov');
      if(ov){ov.style.opacity='0';var s=document.getElementById('cust-picker-sh');if(s)s.style.transform='translateY(100%)';setTimeout(function(){if(ov.parentElement)ov.remove();},300);}
      if(btn){btn.textContent='✏️ Customize';btn.style.background='none';btn.style.color='var(--mid)';btn.style.borderColor='var(--border)';}
    }
  }

  function _buildPicker(portal){
    var old=document.getElementById('cust-picker-ov');if(old)old.remove();
    var active=_getActive(portal), allW=WIDGETS[portal]||[];
    var listHTML='';
    allW.forEach(function(w){
      var on=active.indexOf(w.wid)!==-1;
      listHTML+='<div onclick="HHP_Customizer.toggleW(\''+portal+'\',\''+w.wid+'\')" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;cursor:pointer;transition:background 0.15s;'+(on?'background:rgba(61,90,71,0.1);border:1.5px solid var(--forest)':'background:var(--warm);border:1.5px solid transparent')+'">'+
        '<div style="font-size:1.3rem;width:32px;text-align:center">'+w.icon+'</div>'+
        '<div style="flex:1"><div style="font-weight:700;font-size:0.9rem;color:var(--ink)">'+w.label+'</div></div>'+
        '<div style="width:40px;height:24px;border-radius:12px;background:'+(on?'var(--forest)':'#ccc')+';position:relative;flex-shrink:0">'+
          '<div style="width:20px;height:20px;border-radius:50%;background:white;position:absolute;top:2px;'+(on?'left:18px':'left:2px')+';transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></div>'+
        '</div></div>';
    });

    var ov=document.createElement('div');ov.id='cust-picker-ov';
    ov.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9998;opacity:0;transition:opacity 0.25s';
    ov.onclick=function(e){if(e.target===ov)_toggleEdit();};
    var sh=document.createElement('div');sh.id='cust-picker-sh';
    sh.style.cssText='position:fixed;bottom:0;left:0;right:0;max-height:80vh;background:white;border-radius:20px 20px 0 0;box-shadow:0 -8px 40px rgba(0,0,0,0.18);z-index:9999;overflow-y:auto;transform:translateY(100%);transition:transform 0.3s ease';
    sh.innerHTML=
      '<div style="padding:10px 0 4px;text-align:center;cursor:pointer" onclick="HHP_Customizer.toggleEdit()"><div style="width:40px;height:4px;background:#d0c8b8;border-radius:4px;margin:0 auto"></div></div>'+
      '<div style="padding:4px 20px 28px">'+
        '<h3 style="font-family:\'Cormorant Garamond\',serif;font-size:1.3rem;margin-bottom:4px">Customize Your Overview</h3>'+
        '<p style="font-size:0.82rem;color:var(--mid);margin-bottom:16px">Toggle sections on or off. Use ⊞/⊟ on widgets to resize them.</p>'+
        '<div style="display:flex;flex-direction:column;gap:8px">'+listHTML+'</div>'+
        '<div style="display:flex;gap:10px;margin-top:18px">'+
          '<button onclick="HHP_Customizer.resetLayout()" style="flex:1;padding:12px;background:var(--warm);border:1px solid var(--border);border-radius:10px;font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;color:var(--mid)">↩ Reset Defaults</button>'+
          '<button onclick="HHP_Customizer.toggleEdit()" style="flex:1;padding:12px;background:var(--forest);color:white;border:none;border-radius:10px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit">✓ Done</button>'+
        '</div>'+
      '</div>';
    ov.appendChild(sh);document.body.appendChild(ov);
    ov.style.display='block';
    requestAnimationFrame(function(){ov.style.opacity='1';sh.style.transform='translateY(0)';});
  }

  function _toggleWidget(portal,wid){
    var a=_getActive(portal).slice(),i=a.indexOf(wid);
    if(i!==-1)a.splice(i,1);else a.push(wid);
    if(!_prefs[portal])_prefs[portal]={sidebar_order:[],widgets:[],sizes:{}};
    _prefs[portal].widgets=a;_savePrefs(portal);
    _buildPicker(portal);_renderWidgets(portal).then(function(){_retrigger(_getPortal());});
  }

  function _resetLayout(){
    var p=_getPortal();if(!p)return;
    if(!_prefs[p])_prefs[p]={};
    _prefs[p].widgets=_defaults(p);_prefs[p].sizes={};
    _savePrefs(p);_renderWidgets(p).then(function(){_retrigger(p);});
    if(_editMode) _buildPicker(p);
    if(typeof toast==='function')toast('↩ Reset to defaults');
  }

  // ══════════════════════════════════════
  //  WIDGET RENDERERS (_R = summary, _D = detail)
  // ══════════════════════════════════════
  var _R={}, _D={};

  function _statRow(items){
    var h='<div style="display:flex;gap:8px;flex-wrap:wrap">';
    items.forEach(function(s){
      h+='<div style="flex:1;min-width:70px;background:var(--warm);border-radius:8px;padding:10px;text-align:center">'+
        '<div style="font-size:0.9rem">'+s.icon+'</div>'+
        '<div style="font-family:\'Cormorant Garamond\',serif;font-size:1.4rem;font-weight:700" id="'+s.id+'">—</div>'+
        '<div style="font-size:0.68rem;font-weight:600;color:var(--mid);text-transform:uppercase;letter-spacing:0.03em">'+s.label+'</div></div>';
    }); return h+'</div>';
  }

  function _bigNum(n,label){return '<div style="text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:2rem;font-weight:700">'+n+'</div><div style="font-size:0.75rem;color:var(--mid)">'+label+'</div></div>';}

  // ── CLIENT ──
  _R._rwClientStats=async function(){return _statRow([{icon:'📅',label:'Total Visits',id:'stat-totalVisits'},{icon:'🦮',label:'Walks Done',id:'stat-walksDone'},{icon:'📋',label:'Reports',id:'stat-avgRatingGiven'},{icon:'🐾',label:'Pets in Care',id:'stat-petsInCare'}]);};
  _R._rwClientUpcoming=async function(){
    var sb=_getSB(),u=_getUser();if(!sb||!u)return'<div style="color:var(--mid);font-size:0.82rem">No data</div>';
    try{var today=new Date().toISOString().split('T')[0];var{data}=await sb.from('booking_requests').select('service,preferred_date').eq('client_id',u.id).in('status',['accepted','confirmed']).gte('preferred_date',today).order('preferred_date').limit(4);
      if(!data||!data.length)return'<div style="color:var(--mid);font-size:0.82rem;padding:8px 0">No upcoming appointments</div>';
      return data.map(function(b){var d=new Date(b.preferred_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});return'<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="font-weight:600">'+b.service+'</span><span style="color:var(--mid)">'+d+'</span></div>';}).join('');
    }catch(e){return'';}
  };
  _R._rwClientNotif=async function(){return '<div id="clientDashNotifications" style="font-size:0.82rem;color:var(--mid);padding:4px 0">Loading...</div>';};
  _R._rwClientPets=async function(){var sb=_getSB(),u=_getUser();if(!sb||!u)return'';try{var{count}=await sb.from('pets').select('id',{count:'exact',head:true}).eq('owner_id',u.id);return _bigNum(count||0,'registered pets');}catch(e){return'';}};
  _R._rwClientTracking=async function(){return'<div style="font-size:0.82rem;color:var(--mid)">Track your pet\'s walk in real time when a service is active.</div>';};
  _R._rwClientPhotos=async function(){var sb=_getSB(),u=_getUser();if(!sb||!u)return'';try{var{count}=await sb.from('walk_photos').select('id',{count:'exact',head:true}).eq('client_id',u.id);return _bigNum(count||0,'photos from walks');}catch(e){return'';}};
  _R._rwClientReports=async function(){var sb=_getSB(),u=_getUser();if(!sb||!u)return'';try{var{count}=await sb.from('walk_reports').select('id',{count:'exact',head:true}).eq('client_id',u.id);return _bigNum(count||0,'reports received');}catch(e){return'';}};
  _R._rwClientReviews=async function(){var sb=_getSB(),u=_getUser();if(!sb||!u)return'';try{var{count}=await sb.from('reviews').select('id',{count:'exact',head:true}).eq('reviewer_id',u.id);return _bigNum(count||0,'reviews left');}catch(e){return'';}};
  _R._rwClientMsgs=async function(){return'<div style="font-size:0.82rem;color:var(--mid)">View conversations with your care provider.</div>';};
  _R._rwClientBilling=async function(){return'<div style="font-size:0.82rem;color:var(--mid)">Manage payment methods and receipts.</div>';};

  // ── STAFF ──
  _R._rwStaffStats=async function(){return _statRow([{icon:'📅',label:'This Week',id:'stat-staffThisWeek'},{icon:'✅',label:'All Time',id:'stat-staffAllTime'},{icon:'📋',label:'Reports Sent',id:'stat-staffYourRating'},{icon:'💰',label:'This Month',id:'stat-staffThisMonth'}]);};
  _R._rwStaffJobs=async function(){return '<div id="staffDashJobs" style="font-size:0.82rem;color:var(--mid);padding:4px 0">Loading jobs...</div>';};
  _R._rwStaffClients=async function(){var sb=_getSB();if(!sb)return'';try{var today=new Date().toISOString().split('T')[0];var{data}=await sb.from('booking_requests').select('contact_name').in('status',['accepted','confirmed']).gte('preferred_date',today).limit(50);var n=[];(data||[]).forEach(function(b){if(b.contact_name&&n.indexOf(b.contact_name)===-1)n.push(b.contact_name);});return _bigNum(n.length,'active clients');}catch(e){return'';}};
  _R._rwStaffEarnings=async function(){var sb=_getSB();if(!sb)return'';try{var{count}=await sb.from('booking_requests').select('id',{count:'exact',head:true}).eq('status','completed');return _bigNum(count||0,'jobs completed');}catch(e){return'';}};
  _R._rwStaffMsgs=async function(){return'<div style="font-size:0.82rem;color:var(--mid)">Messages from clients and owner.</div>';};
  _R._rwStaffCal=async function(){return'<div style="font-size:0.82rem;color:var(--mid)">View your schedule on a calendar.</div>';};

  // ── OWNER ──
  _R._rwOwnerBanner=async function(){
    return '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">'+
      '<div><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.3rem;font-weight:700;color:var(--ink)">Good morning, Rachel 🐾</div>'+
      '<div style="font-size:0.82rem;color:var(--mid)">Your business is growing beautifully.</div></div>'+
      '<button class="btn btn-gold btn-sm" onclick="openModal(\'announceModal\')">📢 Post Announcement</button></div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">'+
        '<div style="flex:1;min-width:55px;text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.3rem;font-weight:700" id="stat-activeClients">—</div><div style="font-size:0.62rem;color:var(--mid);text-transform:uppercase">Clients</div></div>'+
        '<div style="flex:1;min-width:55px;text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.3rem;font-weight:700" id="stat-newSignups">—</div><div style="font-size:0.62rem;color:var(--mid);text-transform:uppercase">Sign-ups</div></div>'+
        '<div style="flex:1;min-width:55px;text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.3rem;font-weight:700" id="stat-bookingsThisMonth">—</div><div style="font-size:0.62rem;color:var(--mid);text-transform:uppercase">This Month</div></div>'+
        '<div style="flex:1;min-width:55px;text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.3rem;font-weight:700" id="stat-avgRating">—</div><div style="font-size:0.62rem;color:var(--mid);text-transform:uppercase">Reports</div></div>'+
        '<div style="flex:1;min-width:55px;text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.3rem;font-weight:700" id="stat-todayJobs">—</div><div style="font-size:0.62rem;color:var(--mid);text-transform:uppercase">Today</div></div>'+
      '</div>';
  };
  _R._rwOwnerAlerts=async function(){return '<div id="hhpAlertsCard"><div style="font-weight:700;margin-bottom:10px">🔔 Alerts & Messages</div><div style="padding:8px;text-align:center;color:var(--mid);font-size:0.82rem">Loading...</div></div>';};
  _R._rwOwnerWeekStats=async function(){
    return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+
      '<div style="background:var(--gold-pale);border-radius:8px;padding:12px;text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.5rem;font-weight:700" id="stat-jobsThisWeek">—</div><div style="font-size:0.68rem;font-weight:600;color:var(--mid);text-transform:uppercase">Jobs This Week</div></div>'+
      '<div style="background:var(--forest-pale);border-radius:8px;padding:12px;text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.5rem;font-weight:700" id="stat-weekRevenue">—</div><div style="font-size:0.68rem;font-weight:600;color:var(--mid);text-transform:uppercase">Week Revenue</div></div>'+
      '<div style="background:var(--rose-pale);border-radius:8px;padding:12px;text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.5rem;font-weight:700" id="stat-newInquiries">—</div><div style="font-size:0.68rem;font-weight:600;color:var(--mid);text-transform:uppercase">New Inquiries</div></div>'+
      '<div style="background:#e0f2fe;border-radius:8px;padding:12px;text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.5rem;font-weight:700" id="stat-weekRating">—</div><div style="font-size:0.68rem;font-weight:600;color:var(--mid);text-transform:uppercase">Week Rating</div></div></div>';
  };
  _R._rwOwnerRequests=async function(){return '<div id="hhpAdminDashboard"><div style="font-weight:700;margin-bottom:10px">📋 Booking Requests</div><div style="padding:8px;text-align:center;color:var(--mid);font-size:0.82rem">Loading requests...</div></div>';};
  _R._rwOwnerToday=async function(){
    return '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><div style="font-size:0.78rem;color:var(--mid)" id="todayDateLabel">Loading...</div>'+
      '<button class="btn btn-outline btn-sm" onclick="sTab(\'o\',\'o-sched\')" style="font-size:0.75rem">Full Schedule</button></div>'+
      '<div id="ownerTodayScheduleList" style="display:flex;flex-direction:column;gap:8px"><div style="padding:12px;text-align:center;color:var(--mid);font-size:0.82rem">Loading schedule...</div></div>';
  };
  _R._rwOwnerClients=async function(){var sb=_getSB();if(!sb)return'';try{var{count}=await sb.from('profiles').select('id',{count:'exact',head:true}).eq('role','client');return _bigNum(count||0,'registered clients');}catch(e){return'';}};
  _R._rwOwnerStaff=async function(){var sb=_getSB();if(!sb)return'';try{var{count}=await sb.from('profiles').select('id',{count:'exact',head:true}).eq('role','staff').eq('is_active',true);return _bigNum(count||0,'active staff');}catch(e){return'';}};
  _R._rwOwnerReviews=async function(){var sb=_getSB();if(!sb)return'';try{var{data}=await sb.from('reviews').select('rating').limit(100);var avg=0;if(data&&data.length){avg=(data.reduce(function(a,r){return a+(r.rating||0);},0)/data.length).toFixed(1);}return _bigNum(data?data.length:0,(avg>0?avg+' avg rating':'no reviews yet'));}catch(e){return'';}};
  _R._rwOwnerPayments=async function(){var sb=_getSB();if(!sb)return'';try{var{count}=await sb.from('payments').select('id',{count:'exact',head:true}).eq('status','succeeded');return _bigNum(count||0,'payments received');}catch(e){return'';}};
  _R._rwOwnerDeals=async function(){var sb=_getSB();if(!sb)return'';try{var{data}=await sb.from('deals').select('name').eq('is_active',true);return _bigNum((data||[]).length,(data&&data.length?'active deals':'no active deals'));}catch(e){return'';}};
  _R._rwOwnerPhotos=async function(){var sb=_getSB();if(!sb)return'';try{var{count}=await sb.from('walk_photos').select('id',{count:'exact',head:true});return _bigNum(count||0,'total photos');}catch(e){return'';}};
  _R._rwOwnerActivity=async function(){return'<div style="font-size:0.82rem;color:var(--mid)">Recent activity across your business.</div>';};

  // ── DETAIL RENDERERS ──
  _D._rwClientUpcoming=async function(){
    var sb=_getSB(),u=_getUser();if(!sb||!u)return'No data';
    try{var today=new Date().toISOString().split('T')[0];var{data}=await sb.from('booking_requests').select('*').eq('client_id',u.id).in('status',['accepted','confirmed']).gte('preferred_date',today).order('preferred_date').limit(10);
      if(!data||!data.length)return'<div style="color:var(--mid);padding:16px 0">No upcoming appointments.</div>';
      return data.map(function(b){var d=new Date(b.preferred_date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});var t=(typeof fmt12h==='function')?fmt12h(b.preferred_time||b.time_slot||''):(b.preferred_time||'');return'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)"><div><div style="font-weight:700;font-size:0.9rem">'+b.service+'</div><div style="font-size:0.78rem;color:var(--mid)">'+d+(t?' · '+t:'')+'</div></div><div style="font-size:0.82rem;font-weight:600;color:var(--forest)">$'+(b.estimated_total||0).toFixed(2)+'</div></div>';}).join('');
    }catch(e){return'Could not load';}
  };
  _D._rwOwnerToday=async function(){
    var sb=_getSB();if(!sb)return'';
    try{var today=new Date().toISOString().split('T')[0];var{data}=await sb.from('booking_requests').select('*').in('status',['accepted','confirmed']).eq('preferred_date',today).order('preferred_time');
      if(!data||!data.length)return'<div style="padding:16px 0;color:var(--mid)">No services today.</div>';
      return data.map(function(b){var t=(typeof fmt12h==='function')?fmt12h(b.preferred_time||b.time_slot||''):(b.preferred_time||'');return'<div style="display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)"><div style="min-width:60px;font-weight:700;font-size:0.85rem;color:var(--gold)">'+t+'</div><div style="flex:1"><div style="font-weight:600;font-size:0.9rem">'+b.service+'</div><div style="font-size:0.78rem;color:var(--mid)">'+(b.contact_name||'Client')+(b.pet_names?' · '+b.pet_names:'')+'</div></div></div>';}).join('');
    }catch(e){return'';}
  };

  // ══════════════════════════════════════
  //  RE-TRIGGER DATA LOADERS
  // ══════════════════════════════════════
  // After widgets render, the DOM elements (stat IDs, containers) exist again.
  // Re-fire the existing data-loading functions so they populate.
  function _retrigger(portal){
    console.log('Customizer: retriggering data loaders for', portal);
    if(portal==='owner'){
      if(typeof window.loadDashboardStats==='function') try{window.loadDashboardStats();}catch(e){console.warn('retrigger loadDashboardStats:',e);}
      if(typeof window.loadOwnerTodaySchedule==='function') try{window.loadOwnerTodaySchedule();}catch(e){console.warn('retrigger loadOwnerTodaySchedule:',e);}
      if(window.HHP_BookingAdmin&&typeof window.HHP_BookingAdmin.init==='function') try{window.HHP_BookingAdmin.init();}catch(e){console.warn('retrigger BookingAdmin:',e);}
      if(window.HHP_Messaging&&typeof window.HHP_Messaging.loadAlertMessages==='function') try{window.HHP_Messaging.loadAlertMessages();}catch(e){console.warn('retrigger alerts:',e);}
    }else if(portal==='client'){
      if(typeof window.loadDashboardStats==='function') try{window.loadDashboardStats();}catch(e){console.warn('retrigger client stats:',e);}
    }else if(portal==='staff'){
      if(typeof window.loadDashboardStats==='function') try{window.loadDashboardStats();}catch(e){console.warn('retrigger staff stats:',e);}
      if(typeof window.loadStaffSchedule==='function') try{window.loadStaffSchedule();}catch(e){console.warn('retrigger staffSchedule:',e);}
    }
  }

  // ══════════════════════════════════════
  //  INIT — hooks into auth callback for speed
  // ══════════════════════════════════════
  var _initialized=false;

  async function init(){
    var portal=_getPortal();
    if(!portal) return;
    console.log('Customizer: init',portal);

    // Load prefs in parallel with DOM setup
    var prefsPromise=_loadPrefs();
    _setupOverview(portal);
    _initSidebar(portal);
    await prefsPromise;
    _applySidebarOrder(portal);

    // Render widgets, then retrigger data loaders after DOM is ready
    await _renderWidgets(portal);
    // Give DOM time to paint before firing data loaders to populate widget content
    setTimeout(function(){_retrigger(portal);},300);
    // Safety: retrigger again after a bit in case some loaders weren't ready yet
    setTimeout(function(){_retrigger(portal);},1500);
    console.log('Customizer: ready');
  }

  // Hook into auth callback system for fastest possible init
  function _hookAuth(){
    if(window._hhpAuthReady){
      // Auth already resolved — init immediately
      if(!_initialized&&_getPortal()){_initialized=true;init();}
    }else{
      // Register callback so we fire the instant auth resolves
      if(!window._hhpAuthCallbacks) window._hhpAuthCallbacks=[];
      window._hhpAuthCallbacks.push(function(){
        if(!_initialized&&_getPortal()){_initialized=true;init();}
      });
    }
  }

  // Try hooking immediately, and also after a short delay in case the callback array wasn't set up yet
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',_hookAuth);
  }else{
    _hookAuth();
  }
  // Safety fallback: if auth callback doesn't fire, poll briefly
  var _fallbackAttempts=0;
  function _fallback(){
    if(_initialized) return;
    if(window.HHP_Auth&&window.HHP_Auth.currentUser&&window.HHP_Auth.currentRole){_initialized=true;init();return;}
    if(_fallbackAttempts<15){_fallbackAttempts++;setTimeout(_fallback,400);}
  }
  setTimeout(_fallback,500);

  // ── PUBLIC API ──
  window.HHP_Customizer={
    init:function(){_initialized=false;init();},
    toggleEdit:_toggleEdit,
    toggleW:_toggleWidget,
    setSize:function(p,w,s){if(!_prefs[p])_prefs[p]={sidebar_order:[],widgets:[],sizes:{}};if(!_prefs[p].sizes)_prefs[p].sizes={};_prefs[p].sizes[w]=s;_savePrefs(p);_renderWidgets(p).then(function(){_retrigger(p);});},
    resetLayout:_resetLayout,
    detail:_detail,
    closeDetail:_closeDetail,
    refresh:function(){var p=_getPortal();if(p)_renderWidgets(p).then(function(){_retrigger(p);});}
  };

})();
