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
      { wid:'cw-pets',     icon:'🐾', label:'My Pets',               size:'full',  preset:false, fixed:true,  renderFn:'_rwClientPets' },
      { wid:'cw-tracking', icon:'🗺️', label:'Live Tracking',         size:'full',  preset:false, fixed:true,  renderFn:'_rwClientTracking' },
      { wid:'cw-photos',   icon:'📸', label:'Photo Gallery',         size:'full',  preset:false, fixed:true,  renderFn:'_rwClientPhotos' },
      { wid:'cw-reports',  icon:'📋', label:'Walk Reports',          size:'half',  preset:false, fixed:false, renderFn:'_rwClientReports' },
      { wid:'cw-reviews',  icon:'⭐', label:'My Reviews',            size:'half',  preset:false, fixed:false, renderFn:'_rwClientReviews' },
      { wid:'cw-msgs',     icon:'💬', label:'Messages',              size:'half',  preset:false, fixed:false, renderFn:'_rwClientMsgs' },
      { wid:'cw-billing',  icon:'💳', label:'Billing',               size:'half',  preset:false, fixed:false, renderFn:'_rwClientBilling' }
    ],
    staff: [
      { wid:'sw-stats',    icon:'📊', label:'My Stats',              size:'full',  preset:true,  fixed:false,  renderFn:'_rwStaffStats' },
      { wid:'sw-jobs',     icon:'🦮', label:"This Week's Jobs",      size:'full',  preset:true,  fixed:false, renderFn:'_rwStaffJobs' },
      { wid:'sw-requests', icon:'📋', label:'Booking Requests',      size:'full',  preset:true,  fixed:true,  renderFn:'_rwStaffRequests' },
      { wid:'sw-clients',  icon:'👥', label:'My Clients',            size:'full',  preset:false, fixed:true,  renderFn:'_rwStaffClients' },
      { wid:'sw-earnings', icon:'💰', label:'Earnings',              size:'full',  preset:false, fixed:true,  renderFn:'_rwStaffEarnings' },
      { wid:'sw-msgs',     icon:'💬', label:'Messages',              size:'half',  preset:false, fixed:false, renderFn:'_rwStaffMsgs' },
      { wid:'sw-cal',      icon:'📆', label:'Calendar',              size:'half',  preset:false, fixed:false, renderFn:'_rwStaffCal' }
    ],
    owner: [
      { wid:'ow-banner',    icon:'👑', label:'Welcome Banner',        size:'full',  preset:true,  fixed:false,  renderFn:'_rwOwnerBanner' },
      { wid:'ow-alerts',    icon:'🔔', label:'Alerts & Messages',     size:'half',  preset:true,  fixed:false, renderFn:'_rwOwnerAlerts' },
      { wid:'ow-weekstats', icon:'📊', label:'This Week at a Glance', size:'full',  preset:true,  fixed:true,  renderFn:'_rwOwnerWeekStats' },
      { wid:'ow-requests',  icon:'📋', label:'Booking Requests',      size:'full',  preset:true,  fixed:true,  renderFn:'_rwOwnerRequests' },
      { wid:'ow-today',     icon:'📅', label:"Today's Schedule",      size:'full',  preset:true,  fixed:true,  renderFn:'_rwOwnerToday' },
      { wid:'ow-clients',   icon:'👥', label:'All Clients',           size:'half',  preset:false, fixed:false, renderFn:'_rwOwnerClients' },
      { wid:'ow-staff',     icon:'🧑‍🤝‍🧑', label:'Staff Team',            size:'full',  preset:false, fixed:true,  renderFn:'_rwOwnerStaff' },
      { wid:'ow-reviews',   icon:'⭐', label:'Reviews',               size:'half',  preset:false, fixed:false, renderFn:'_rwOwnerReviews' },
      { wid:'ow-payments',  icon:'💳', label:'Payments',              size:'half',  preset:false, fixed:false, renderFn:'_rwOwnerPayments' },
      { wid:'ow-deals',     icon:'🏷️', label:'Specials & Deals',      size:'half',  preset:false, fixed:false, renderFn:'_rwOwnerDeals' },
      { wid:'ow-photos',    icon:'🖼️', label:'Photos & Media',        size:'full',  preset:false, fixed:true,  renderFn:'_rwOwnerPhotos' },
      { wid:'ow-activity',  icon:'📜', label:'Activity Log',          size:'full',  preset:false, fixed:true,  renderFn:'_rwOwnerActivity' }
    ]
  };

  var _panelNav = {
    'cw-upcoming':"sTab('c','c-appts')",'cw-notif':"sTab('c','c-msgs')",'cw-pets':"sTab('c','c-pets')",'cw-tracking':"sTab('c','c-track')",
    'cw-photos':"sTab('c','c-photos')",'cw-reports':"sTab('c','c-reports')",'cw-reviews':"sTab('c','c-reviews')",
    'cw-msgs':"sTab('c','c-msgs')",'cw-billing':"sTab('c','c-bill')",
    'sw-jobs':"sTab('s','s-jobs')",'sw-requests':"sTab('s','s-requests')",'sw-clients':"sTab('s','s-clients')",'sw-earnings':"sTab('s','s-earn')",
    'sw-msgs':"sTab('s','s-msgs')",'sw-cal':"sTab('s','s-cal')",
    'ow-requests':"sTab('o','o-requests')",'ow-clients':"sTab('o','o-clients')",'ow-staff':"sTab('o','o-staff')",
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
      (data||[]).forEach(function(r){
        var ow=r.overview_widgets||[];
        // overview_widgets can be {wids:[...],sizes:{...}} or just an array
        var wids=Array.isArray(ow)?ow:(ow.wids||[]);
        var sizes=(!Array.isArray(ow)&&ow.sizes)?ow.sizes:{};
        _prefs[r.portal]={sidebar_order:r.sidebar_order||[],widgets:wids,sizes:sizes};
      });
    }catch(e){console.warn('Cust load:',e);}
  }

  async function _savePrefs(portal){
    if(_saving) return; _saving=true;
    var sb=_getSB(),u=_getUser(); if(!sb||!u){_saving=false;return;}
    var p=_prefs[portal]||{};
    try{
      var sd=Array.isArray(p.sidebar_order)?(p.sidebar_order).slice():[];
      // Store widgets + sizes together as an object
      var ow={wids:p.widgets||[],sizes:p.sizes||{}};
      await sb.from('user_layout_prefs').upsert({user_id:u.id,portal:portal,sidebar_order:sd,overview_widgets:ow,updated_at:new Date().toISOString()},{onConflict:'user_id,portal'});
    }catch(e){console.warn('Cust save:',e);}
    _saving=false;
  }

  function _getActive(p){return _prefs[p]&&_prefs[p].widgets&&_prefs[p].widgets.length>0?_prefs[p].widgets:_defaults(p);}
  function _getSize(p,wid){var d=(WIDGETS[p]||[]).find(function(w){return w.wid===wid;});if(d&&d.fixed)return d.size;if(_prefs[p]&&_prefs[p].sizes&&_prefs[p].sizes[wid])return _prefs[p].sizes[wid];return d?d.size:'half';}

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

  // Skeleton placeholder for a widget body based on size
  function _skeletonFor(wid,size){
    if(window.HHP_Skeleton){
      if(wid.indexOf('-stats')>-1||wid.indexOf('-weekstats')>-1||wid.indexOf('-banner')>-1) return HHP_Skeleton.stats(size==='full'?4:2);
      if(size==='full') return HHP_Skeleton.cards(3);
      return HHP_Skeleton.lines(2);
    }
    return '<div style="height:40px;background:var(--warm);border-radius:6px;animation:hhpShimmer 1.5s ease infinite"></div>';
  }

  // Render widgets with instant skeletons, then fill async
  async function _renderWidgets(portal){
    var grid=document.getElementById('cust-grid-'+portal);
    if(!grid) return;
    var active=_getActive(portal), allW=WIDGETS[portal]||[];

    // Phase 1: show skeleton placeholders instantly
    var html='';
    for(var i=0;i<active.length;i++){
      var w=allW.find(function(x){return x.wid===active[i];}); if(!w) continue;
      var size=_getSize(portal,w.wid);
      html+=_card(portal,w,_skeletonFor(w.wid,size),size);
    }
    if(!html) html='<div style="grid-column:1/-1;padding:30px;text-align:center;color:var(--mid);font-size:0.85rem;background:var(--warm);border-radius:12px;border:1.5px dashed var(--border)">No widgets visible. Click <strong>✏️ Customize</strong> to add sections.</div>';
    grid.innerHTML=html;
    requestAnimationFrame(function(){grid.style.opacity='1';});

    // Phase 2: fill each widget async in parallel (no waiting sequentially)
    active.forEach(function(wid){
      var w=allW.find(function(x){return x.wid===wid;}); if(!w) return;
      var size=_getSize(portal,w.wid);
      var renderer=_R[w.renderFn];
      if(!renderer) return;
      (async function(){
        try{
          var body=await renderer(size);
          var el=grid.querySelector('[data-wid="'+wid+'"] .cw-body');
          if(el) el.innerHTML=body;
        }catch(e){
          var el=grid.querySelector('[data-wid="'+wid+'"] .cw-body');
          if(el) el.innerHTML='<div style="color:var(--mid);font-size:0.82rem">Could not load</div>';
        }
      })();
    });
  }

  // Refresh a single widget in-place (for realtime updates)
  function _refreshWidget(portal,wid){
    var grid=document.getElementById('cust-grid-'+portal);
    if(!grid) return;
    var allW=WIDGETS[portal]||[];
    var w=allW.find(function(x){return x.wid===wid;});
    if(!w) return;
    var size=_getSize(portal,w.wid);
    var renderer=_R[w.renderFn];
    if(!renderer) return;
    (async function(){
      try{
        var body=await renderer(size);
        var el=grid.querySelector('[data-wid="'+wid+'"] .cw-body');
        if(el) el.innerHTML=body;
      }catch(e){}
    })();
  }

  // Refresh all widgets for a portal
  function _refreshAll(portal){
    var active=_getActive(portal);
    active.forEach(function(wid){ _refreshWidget(portal,wid); });
  }

  function _card(portal,w,body,size){
    var full=size==='full', span=full?'grid-column:1/-1;':'';
    var otherSize=full?'half':'full', sIcon=full?'⊟':'⊞';
    var nav=_panelNav[w.wid]||'';
    var canResize=!w.fixed; // Don't show resize on fixed-size widgets
    return '<div class="cust-widget" data-wid="'+w.wid+'" style="'+span+'background:white;border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.04)">'+
      '<div style="display:flex;align-items:center;gap:8px;padding:12px 14px 0;user-select:none">'+
        (nav?'<a href="javascript:void(0)" onclick="event.stopPropagation();'+nav+'" style="display:flex;align-items:center;gap:8px;flex:1;text-decoration:none;cursor:pointer;transition:opacity 0.15s" onmouseenter="this.style.opacity=0.7" onmouseleave="this.style.opacity=1">':'<div style="display:flex;align-items:center;gap:8px;flex:1">')+
        '<span style="font-size:1.1rem">'+w.icon+'</span>'+
        '<span style="font-size:0.78rem;font-weight:700;color:var(--mid);text-transform:uppercase;letter-spacing:0.04em">'+w.label+'</span>'+
        (nav?'</a>':'</div>')+
        (canResize?'<button onclick="event.stopPropagation();HHP_Customizer.setSize(\''+portal+'\',\''+w.wid+'\',\''+otherSize+'\')" title="'+(full?'Shrink':'Expand full width')+'" style="background:none;border:none;cursor:pointer;font-size:1rem;color:var(--mid);padding:2px 4px;opacity:0.4;transition:opacity 0.15s" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0.4">'+sIcon+'</button>':'')+
        (nav?'<button onclick="event.stopPropagation();HHP_Customizer.detail(\''+portal+'\',\''+w.wid+'\')" title="Detail view" style="background:none;border:none;cursor:pointer;font-size:0.85rem;color:var(--mid);padding:2px 4px;opacity:0.4;transition:opacity 0.15s" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0.4">🔍</button>':'')+
        (nav?'<button onclick="event.stopPropagation();'+nav+'" title="Go to panel" style="background:none;border:none;cursor:pointer;font-size:0.7rem;color:var(--gold);font-weight:700;padding:2px 6px;opacity:0.5;transition:opacity 0.15s" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0.5">View →</button>':'')+
      '</div><div class="cw-body" style="padding:10px 14px 14px">'+body+'</div></div>';
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
      sh.style.cssText='position:fixed;bottom:0;left:0;right:0;max-height:80vh;background:white;border-radius:20px 20px 0 0;box-shadow:0 -8px 40px rgba(0,0,0,0.18);z-index:9999;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding-bottom:env(safe-area-inset-bottom,20px);transform:translateY(100%);transition:transform 0.3s ease';
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
    // Build ordered list: active widgets first (in order), then inactive ones
    var ordered=[];
    active.forEach(function(wid){var w=allW.find(function(x){return x.wid===wid;});if(w)ordered.push(w);});
    allW.forEach(function(w){if(active.indexOf(w.wid)===-1)ordered.push(w);});

    var listHTML='';
    ordered.forEach(function(w){
      var on=active.indexOf(w.wid)!==-1;
      listHTML+='<div class="cust-pick-item" data-wid="'+w.wid+'" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:10px;transition:background 0.15s,box-shadow 0.15s;'+(on?'background:rgba(61,90,71,0.1);border:1.5px solid var(--forest)':'background:var(--warm);border:1.5px solid transparent')+'">'+
        '<span class="cust-pick-drag" style="cursor:grab;touch-action:none;font-size:1rem;color:var(--mid);user-select:none;padding:0 2px">☰</span>'+
        '<div style="font-size:1.3rem;width:32px;text-align:center">'+w.icon+'</div>'+
        '<div style="flex:1;cursor:pointer" onclick="HHP_Customizer.toggleW(\''+portal+'\',\''+w.wid+'\')"><div style="font-weight:700;font-size:0.9rem;color:var(--ink)">'+w.label+'</div></div>'+
        '<div onclick="HHP_Customizer.toggleW(\''+portal+'\',\''+w.wid+'\')" style="width:40px;height:24px;border-radius:12px;background:'+(on?'var(--forest)':'#ccc')+';position:relative;flex-shrink:0;cursor:pointer">'+
          '<div style="width:20px;height:20px;border-radius:50%;background:white;position:absolute;top:2px;'+(on?'left:18px':'left:2px')+';transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></div>'+
        '</div></div>';
    });

    var ov=document.createElement('div');ov.id='cust-picker-ov';
    ov.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9998;opacity:0;transition:opacity 0.25s';
    ov.onclick=function(e){if(e.target===ov)_toggleEdit();};
    var sh=document.createElement('div');sh.id='cust-picker-sh';
    sh.style.cssText='position:fixed;bottom:0;left:0;right:0;max-height:80vh;background:white;border-radius:20px 20px 0 0;box-shadow:0 -8px 40px rgba(0,0,0,0.18);z-index:9999;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding-bottom:env(safe-area-inset-bottom,20px);transform:translateY(100%);transition:transform 0.3s ease';
    sh.innerHTML=
      '<div id="cust-drag-handle" style="padding:16px 0 8px;text-align:center;cursor:grab;touch-action:none" onclick="HHP_Customizer.toggleEdit()"><div style="width:56px;height:6px;background:#c0b8a8;border-radius:6px;margin:0 auto"></div></div>'+
      '<div style="padding:4px 20px 28px">'+
        '<h3 style="font-family:\'Cormorant Garamond\',serif;font-size:1.3rem;margin-bottom:4px">Customize Your Overview</h3>'+
        '<p style="font-size:0.82rem;color:var(--mid);margin-bottom:16px">Toggle sections on or off. Hold ☰ and drag to reorder.</p>'+
        '<div id="cust-pick-list" style="display:flex;flex-direction:column;gap:8px">'+listHTML+'</div>'+
        '<div style="display:flex;gap:10px;margin-top:18px">'+
          '<button onclick="HHP_Customizer.resetLayout()" style="flex:1;padding:12px;background:var(--warm);border:1px solid var(--border);border-radius:10px;font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;color:var(--mid)">↩ Reset Defaults</button>'+
          '<button onclick="HHP_Customizer.toggleEdit()" style="flex:1;padding:12px;background:var(--forest);color:white;border:none;border-radius:10px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit">✓ Done</button>'+
        '</div>'+
      '</div>';
    ov.appendChild(sh);document.body.appendChild(ov);
    ov.style.display='block';
    requestAnimationFrame(function(){ov.style.opacity='1';sh.style.transform='translateY(0)';});

    // ── Drag-to-close on the handle ──
    var handle=document.getElementById('cust-drag-handle');
    if(handle){
      var startY=0,currentY=0,dragging=false;
      function onDragStart(e){
        dragging=true;startY=e.touches?e.touches[0].clientY:e.clientY;currentY=0;
        sh.style.transition='none';handle.style.cursor='grabbing';
      }
      function onDragMove(e){
        if(!dragging)return;
        var y=(e.touches?e.touches[0].clientY:e.clientY)-startY;
        if(y<0)y=0;
        currentY=y;sh.style.transform='translateY('+y+'px)';
        ov.style.opacity=String(Math.max(0,1-y/300));
      }
      function onDragEnd(){
        if(!dragging)return;dragging=false;
        sh.style.transition='transform 0.3s ease';handle.style.cursor='grab';
        if(currentY>100){_toggleEdit();}
        else{sh.style.transform='translateY(0)';ov.style.opacity='1';}
      }
      handle.addEventListener('touchstart',onDragStart,{passive:true});
      handle.addEventListener('touchmove',onDragMove,{passive:true});
      handle.addEventListener('touchend',onDragEnd);
      handle.addEventListener('mousedown',onDragStart);
      document.addEventListener('mousemove',onDragMove);
      document.addEventListener('mouseup',onDragEnd);
    }

    // ── Widget reorder drag ──
    _initPickerDrag(portal);
  }

  function _initPickerDrag(portal){
    var list=document.getElementById('cust-pick-list');if(!list)return;
    var drag={active:false,el:null,ph:null,offsetY:0,scrollEl:null};
    var items=list.querySelectorAll('.cust-pick-item');

    function getY(e){return e.touches?e.touches[0].clientY:e.clientY;}

    function onStart(e){
      if(drag.active)return;
      var item=e.target.closest('.cust-pick-item');if(!item)return;
      // Only start drag from the handle
      if(!e.target.classList.contains('cust-pick-drag'))return;
      e.preventDefault();
      drag.active=true;drag.el=item;
      var r=item.getBoundingClientRect();
      drag.offsetY=getY(e)-r.top;
      drag.scrollEl=document.getElementById('cust-picker-sh');
      // Create placeholder
      var ph=document.createElement('div');
      ph.className='cust-pick-ph';
      ph.style.cssText='height:'+r.height+'px;border-radius:10px;background:rgba(61,90,71,0.08);border:2px dashed var(--forest);margin-bottom:0;transition:height 0.15s';
      drag.ph=ph;
      item.parentElement.insertBefore(ph,item);
      // Float the item
      item.style.position='fixed';
      item.style.left=r.left+'px';
      item.style.top=r.top+'px';
      item.style.width=r.width+'px';
      item.style.zIndex='10000';
      item.style.boxShadow='0 8px 30px rgba(0,0,0,0.18)';
      item.style.opacity='0.95';
      item.style.pointerEvents='none';
      item.style.transition='box-shadow 0.2s';
    }

    function onMove(e){
      if(!drag.active||!drag.el)return;
      e.preventDefault();
      var y=getY(e);
      drag.el.style.top=(y-drag.offsetY)+'px';
      // Find insertion point
      var siblings=Array.from(list.querySelectorAll('.cust-pick-item:not([style*="position:fixed"]):not([style*="position: fixed"]),.cust-pick-ph'));
      for(var i=0;i<siblings.length;i++){
        if(siblings[i]===drag.ph)continue;
        var sr=siblings[i].getBoundingClientRect();
        var mid=sr.top+sr.height/2;
        if(y<mid){siblings[i].parentElement.insertBefore(drag.ph,siblings[i]);return;}
      }
      // Past all items — append
      if(siblings.length){var last=siblings[siblings.length-1];if(last&&last.parentElement)last.parentElement.insertBefore(drag.ph,last.nextSibling);}
    }

    function onEnd(){
      if(!drag.active||!drag.el)return;
      // Place item where placeholder is
      if(drag.ph&&drag.ph.parentElement){drag.ph.parentElement.insertBefore(drag.el,drag.ph);drag.ph.remove();}
      // Reset styles
      ['position','left','top','width','z-index','box-shadow','opacity','pointer-events','transition'].forEach(function(p){drag.el.style.removeProperty(p);});
      drag.active=false;drag.el=null;drag.ph=null;
      // Save new order
      _savePickerOrder(portal);
    }

    list.addEventListener('mousedown',onStart);
    list.addEventListener('touchstart',onStart,{passive:false});
    document.addEventListener('mousemove',onMove);
    document.addEventListener('touchmove',onMove,{passive:false});
    document.addEventListener('mouseup',onEnd);
    document.addEventListener('touchend',onEnd);
  }

  function _savePickerOrder(portal){
    var list=document.getElementById('cust-pick-list');if(!list)return;
    var items=list.querySelectorAll('.cust-pick-item');
    var active=_getActive(portal);
    var newOrder=[];
    items.forEach(function(item){
      var wid=item.getAttribute('data-wid');
      if(active.indexOf(wid)!==-1) newOrder.push(wid);
    });
    if(!_prefs[portal])_prefs[portal]={sidebar_order:[],widgets:[],sizes:{}};
    _prefs[portal].widgets=newOrder;
    _savePrefs(portal);
    _renderWidgets(portal).then(function(){_retrigger(_getPortal());});
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
  //  Each renderer receives size ('half'|'full')
  //  half = small/compact widget, full = big/expanded widget
  // ══════════════════════════════════════
  var _R={}, _D={};

  // Helper: stat row — full shows all items expanded, half shows compact 2-col
  function _statRow(items,size){
    if(size==='half'){
      // Small: compact 2-col grid, just number + label, no icon
      var h='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
      items.forEach(function(s){
        h+='<div style="background:var(--warm);border-radius:6px;padding:6px 8px;text-align:center">'+
          '<div style="font-family:\'Cormorant Garamond\',serif;font-size:1.1rem;font-weight:700" id="'+s.id+'">—</div>'+
          '<div style="font-size:0.6rem;font-weight:600;color:var(--mid);text-transform:uppercase">'+s.label+'</div></div>';
      }); return h+'</div>';
    }
    // Full: spacious row with icons
    var h='<div style="display:flex;gap:10px;flex-wrap:wrap">';
    items.forEach(function(s){
      h+='<div style="flex:1;min-width:80px;background:var(--warm);border-radius:10px;padding:14px 10px;text-align:center">'+
        '<div style="font-size:1.1rem;margin-bottom:4px">'+s.icon+'</div>'+
        '<div style="font-family:\'Cormorant Garamond\',serif;font-size:1.6rem;font-weight:700" id="'+s.id+'">—</div>'+
        '<div style="font-size:0.72rem;font-weight:600;color:var(--mid);text-transform:uppercase;letter-spacing:0.03em;margin-top:2px">'+s.label+'</div></div>';
    }); return h+'</div>';
  }

  function _bigNum(n,label,size){
    if(size==='full'){
      return '<div style="text-align:center;padding:8px 0"><div style="font-family:\'Cormorant Garamond\',serif;font-size:2.4rem;font-weight:700">'+n+'</div><div style="font-size:0.82rem;color:var(--mid);margin-top:2px">'+label+'</div></div>';
    }
    return '<div style="text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.5rem;font-weight:700;line-height:1.2">'+n+'</div><div style="font-size:0.65rem;color:var(--mid)">'+label+'</div></div>';
  }

  // ── CLIENT ──
  _R._rwClientStats=async function(sz){return _statRow([{icon:'📅',label:'Total Visits',id:'stat-totalVisits'},{icon:'🦮',label:'Walks Done',id:'stat-walksDone'},{icon:'📋',label:'Reports',id:'stat-avgRatingGiven'},{icon:'🐾',label:'Pets in Care',id:'stat-petsInCare'}],sz);};

  _R._rwClientUpcoming=async function(sz){
    var sb=_getSB(),u=_getUser();if(!sb||!u)return'<div style="color:var(--mid);font-size:0.82rem">No data</div>';
    var lim=sz==='full'?8:2;
    try{var today=new Date().toISOString().split('T')[0];var{data}=await sb.from('booking_requests').select('id,service,preferred_date,preferred_time,scheduled_date,scheduled_time,estimated_total,status,pet_names').eq('client_id',u.id).in('status',['accepted','confirmed','modified','payment_hold']).gte('preferred_date',today).order('preferred_date').limit(lim);
      if(!data||!data.length)return'<div style="color:var(--mid);font-size:0.82rem;padding:8px 0">No upcoming appointments</div>';
      if(sz==='full'){
        return data.map(function(b){var d=new Date(b.preferred_date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});var t=(typeof fmt12h==='function')?fmt12h(b.preferred_time||''):(b.preferred_time||'');var tcBanner='';if(b.status==='modified'&&b.scheduled_date){var nd=new Date(b.scheduled_date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});var nt=b.scheduled_time?((typeof fmt12h==='function')?fmt12h(b.scheduled_time):b.scheduled_time):'';tcBanner='<div style="background:#fff8e1;border:1px solid #e67e22;border-radius:6px;padding:6px 8px;margin-bottom:6px;font-size:0.75rem"><span style="font-weight:700;color:#bf5d00">⏰ Time Change:</span> '+nd+(nt?' at '+nt:'')+' <a href="javascript:void(0)" onclick="event.stopPropagation();sTab(\'c\',\'c-appts\')" style="color:#e67e22;font-weight:700;margin-left:4px">Review</a></div>';}var _wSLabel=b.status==='accepted'?'Confirmed':b.status==='modified'?'Time Change':b.status==='payment_hold'?'Payment Needed':b.status==='confirmed'?'Confirmed':'Pending';var _wSColor=b.status==='modified'?'#e67e22':b.status==='payment_hold'?'#c62828':'var(--forest)';var _wPaidBadge=(b.status==='accepted'||b.status==='confirmed')?'<span style="font-size:0.6rem;color:#155724;font-weight:700">PAID</span>':'';return tcBanner+'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);font-size:0.85rem"><div style="flex:1"><div style="font-weight:700">'+b.service+(b.status==='modified'?' <a href="javascript:void(0)" onclick="event.stopPropagation();sTab(\'c\',\'c-appts\')" style="color:#e67e22;font-weight:700;font-size:0.78rem;text-decoration:underline">(Request Time Change)</a>':'')+'</div><div style="font-size:0.75rem;color:var(--mid)">'+d+(t?' · '+t:'')+(b.pet_names?' · '+b.pet_names:'')+'</div></div><div style="text-align:right"><div style="font-weight:600;color:'+_wSColor+'">$'+(b.estimated_total||0).toFixed(2)+'</div><div style="font-size:0.65rem;color:'+_wSColor+';text-transform:uppercase">'+_wSLabel+'</div>'+_wPaidBadge+'</div></div>';}).join('');
      }
      return data.map(function(b){var d=new Date(b.preferred_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});if(b.status==='modified'){return'<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:0.78rem"><span style="font-weight:600;color:#e67e22">⏰ '+b.service+' <a href="javascript:void(0)" onclick="event.stopPropagation();sTab(\'c\',\'c-appts\')" style="color:#e67e22;text-decoration:underline;font-weight:700">(Request Time Change)</a></span><span style="color:var(--mid)">'+d+'</span></div>';}var _cSLabel=b.status==='accepted'||b.status==='confirmed'?'Confirmed':'';return'<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:0.78rem"><span style="font-weight:600">'+b.service+(_cSLabel?' <span style="color:var(--forest);font-size:0.68rem;font-weight:700">'+_cSLabel+'</span>':'')+'</span><span style="color:var(--mid)">'+d+'</span></div>';}).join('');
    }catch(e){return'';}
  };

  _R._rwClientNotif=async function(sz){
    var sb=_getSB(),u=_getUser();if(!sb||!u)return'<div style="color:var(--mid);font-size:0.82rem">No notifications</div>';
    try{
      var lim=sz==='full'?4:2;
      var{data}=await sb.from('messages').select('id,body,sender_name,created_at').eq('is_alert',true).eq('recipient_id',u.id).order('created_at',{ascending:false}).limit(lim);
      if(!data||!data.length) return '<div style="color:var(--mid);font-size:0.82rem;padding:8px 0">No new notifications</div>';
      return data.map(function(n){
        var d=new Date(n.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'});
        return '<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:0.82rem;cursor:pointer" onclick="sTab(\'c\',\'c-msgs\')">'+
          '<div style="display:flex;justify-content:space-between"><span style="font-weight:600">'+(n.sender_name||'Alert')+'</span><span style="color:var(--mid);font-size:0.7rem">'+d+'</span></div>'+
          '<div style="color:var(--mid);font-size:0.75rem;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(n.body||'').substring(0,80)+'</div></div>';
      }).join('');
    }catch(e){return'<div style="color:var(--mid);font-size:0.82rem">Could not load notifications</div>';}
  };

  _R._rwClientPets=async function(sz){
    var sb=_getSB(),u=_getUser();if(!sb||!u)return'';
    if(sz!=='full') return _bigNum(0,'pets',sz);
    try{
      var{data}=await sb.from('pets').select('id,name,species,breed,photo_url').eq('owner_id',u.id).order('name').limit(10);
      if(!data||!data.length)return'<div style="color:var(--mid);font-size:0.85rem;padding:12px 0;text-align:center">No pets registered yet</div>';
      return data.map(function(p){
        var avatar=p.avatar_url?'<img src="'+p.avatar_url+'" style="width:100%;height:100%;object-fit:cover" loading="lazy">':(p.species==='cat'?'🐱':'🐶');
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.15s" onmouseover="this.style.background=\'rgba(0,0,0,0.02)\'" onmouseout="this.style.background=\'\'">'+
          '<div style="width:40px;height:40px;border-radius:50%;background:var(--gold-pale);display:flex;align-items:center;justify-content:center;font-size:1rem;overflow:hidden;flex-shrink:0">'+avatar+'</div>'+
          '<div style="flex:1"><div style="font-weight:700;font-size:0.9rem">'+p.name+'</div><div style="font-size:0.72rem;color:var(--mid)">'+(p.breed||p.species||'Pet')+'</div></div></div>';
      }).join('');
    }catch(e){return'';}
  };

  _R._rwClientTracking=async function(sz){
    var sb=_getSB(),u=_getUser();if(!sb||!u)return'';
    if(sz==='full'){
      try{var today=new Date().toISOString().split('T')[0];var{data}=await sb.from('booking_requests').select('service,preferred_time,status').eq('client_id',u.id).eq('preferred_date',today).in('status',['accepted','confirmed','in_progress']).limit(3);
        var h='<div style="font-size:0.85rem;color:var(--mid);margin-bottom:10px">Track your pet\'s walk in real time when a service is active.</div>';
        if(data&&data.length){h+='<div style="font-weight:600;font-size:0.8rem;margin-bottom:6px">Today\'s Services:</div>';data.forEach(function(b){var t=(typeof fmt12h==='function')?fmt12h(b.preferred_time||''):(b.preferred_time||'');h+='<div style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid var(--border);font-size:0.82rem;cursor:pointer;transition:background 0.15s;border-radius:6px" '+(b.status==='in_progress'?'onclick="sTab(\'c\',\'c-track\')"':'')+'  onmouseover="this.style.background=\'rgba(0,0,0,0.02)\'" onmouseout="this.style.background=\'\'"><span style="font-weight:600">'+b.service+'</span><span style="color:var(--forest);font-weight:600">'+(t||b.status)+'</span></div>';});}
        else{h+='<div style="color:var(--mid);font-size:0.8rem;font-style:italic">No services scheduled today</div>';}
        return h;
      }catch(e){return'';}
    }
    return'<div style="font-size:0.75rem;color:var(--mid)">Live GPS tracking</div>';
  };

  _R._rwClientPhotos=async function(sz){
    var sb=_getSB(),u=_getUser();if(!sb||!u)return'';
    try{
      if(sz==='full'){
        var{data}=await sb.from('walk_photos').select('photo_url,caption,created_at').eq('client_id',u.id).order('created_at',{ascending:false}).limit(6);
        var{count}=await sb.from('walk_photos').select('id',{count:'exact',head:true}).eq('client_id',u.id);
        var h=_bigNum(count||0,'photos from walks',sz);
        if(data&&data.length){h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:10px">';data.forEach(function(p){h+='<div style="aspect-ratio:1;border-radius:6px;overflow:hidden;background:var(--warm);cursor:pointer;transition:transform 0.15s" onclick="sTab(\'c\',\'c-photos\')" onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'scale(1)\'">'+(p.photo_url?'<img src="'+p.photo_url+'" style="width:100%;height:100%;object-fit:cover" loading="lazy">':'<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:1.2rem">📷</div>')+'</div>';});h+='</div>';h+='<div style="margin-top:12px;text-align:center"><a href="javascript:sTab(\'c\',\'c-photos\')" style="color:var(--forest);font-weight:600;font-size:0.85rem;text-decoration:none;cursor:pointer">View All Photos →</a></div>';}
        return h;
      }
      var{count}=await sb.from('walk_photos').select('id',{count:'exact',head:true}).eq('client_id',u.id);
      return _bigNum(count||0,'photos',sz);
    }catch(e){return'';}
  };

  _R._rwClientReports=async function(sz){
    var sb=_getSB(),u=_getUser();if(!sb||!u)return'';
    try{
      if(sz==='full'){
        var{data}=await sb.from('service_reports').select('*').eq('client_id',u.id).order('created_at',{ascending:false}).limit(4);
        var{count}=await sb.from('service_reports').select('id',{count:'exact',head:true}).eq('client_id',u.id);
        var{count:_unreadFull}=await sb.from('service_reports').select('id',{count:'exact',head:true}).eq('client_id',u.id).is('client_read_at',null);
        // Inject header badge for full size too
        setTimeout(function(){
          var cardEl=document.querySelector('[data-wid="cw-reports"]');
          if(cardEl){
            var oldBadge=cardEl.querySelector('.cw-hdr-badge');if(oldBadge)oldBadge.remove();
            if(_unreadFull>0){
              var labelSpan=cardEl.querySelector('[style*="text-transform:uppercase"]');
              if(labelSpan){
                var b=document.createElement('span');b.className='cw-hdr-badge';
                b.style.cssText='background:#e74c3c;color:white;font-size:0.55rem;font-weight:700;border-radius:50%;min-width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;margin-left:6px;line-height:1;padding:0 4px';
                b.textContent=Math.min(_unreadFull,9);
                labelSpan.parentNode.insertBefore(b,labelSpan.nextSibling);
              }
            }
          }
        },50);
        var h=_bigNum(count||0,'reports received',sz);
        if(data&&data.length){h+='<div style="margin-top:10px">';data.forEach(function(r){var d=new Date(r.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'});var isNew=!r.client_read_at;h+='<div style="position:relative;padding:8px;margin-bottom:6px;border-bottom:1px solid var(--border);font-size:0.8rem;cursor:pointer;border-radius:6px;transition:background 0.15s" onclick="sTab(\'c\',\'c-reports\')" onmouseover="this.style.background=\'rgba(0,0,0,0.02)\'" onmouseout="this.style.background=\'\'"><div style="display:flex;justify-content:space-between"><span style="font-weight:600">'+(r.service||'Walk')+'</span><span style="color:var(--mid)">'+d+'</span></div>'+((r.personal_note||r.notes)?'<div style="color:var(--mid);font-size:0.75rem;margin-top:2px">'+(r.personal_note||r.notes).substring(0,60)+((r.personal_note||r.notes).length>60?'...':'')+'</div>':'')+
          (isNew?'<span style="position:absolute;top:-4px;right:-4px;background:#e74c3c;color:white;font-size:0.55rem;font-weight:700;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center">+1</span>':'')+'</div>';});h+='</div>';h+='<div style="margin-top:12px;text-align:center"><a href="javascript:sTab(\'c\',\'c-reports\')" style="color:var(--forest);font-weight:600;font-size:0.85rem;text-decoration:none;cursor:pointer">View All Reports →</a></div>';}
        return h;
      }
      var{count}=await sb.from('service_reports').select('id',{count:'exact',head:true}).eq('client_id',u.id);
      var{count:unreadCount}=await sb.from('service_reports').select('id',{count:'exact',head:true}).eq('client_id',u.id).is('client_read_at',null);
      // Inject badge into widget card header (next to title)
      setTimeout(function(){
        var cardEl=document.querySelector('[data-wid="cw-reports"]');
        if(cardEl){
          var oldBadge=cardEl.querySelector('.cw-hdr-badge');if(oldBadge)oldBadge.remove();
          if(unreadCount>0){
            var labelSpan=cardEl.querySelector('[style*="text-transform:uppercase"]');
            if(labelSpan){
              var b=document.createElement('span');b.className='cw-hdr-badge';
              b.style.cssText='background:#e74c3c;color:white;font-size:0.55rem;font-weight:700;border-radius:50%;min-width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;margin-left:6px;line-height:1;padding:0 4px';
              b.textContent=Math.min(unreadCount,9);
              labelSpan.parentNode.insertBefore(b,labelSpan.nextSibling);
            }
          }
        }
      },50);
      return _bigNum(count||0,'reports',sz);
    }catch(e){return'';}
  };

  _R._rwClientReviews=async function(sz){
    var sb=_getSB(),u=_getUser();if(!sb||!u)return'';
    try{
      var lim=sz==='full'?4:2;
      var{data}=await sb.from('reviews').select('rating,comment,created_at').eq('reviewer_id',u.id).order('created_at',{ascending:false}).limit(lim);
      if(sz==='full'){
        var h=_bigNum(data?data.length:0,'reviews left',sz);
        if(data&&data.length){h+='<div style="margin-top:10px">';data.forEach(function(r){var d=new Date(r.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'});h+='<div style="padding:8px;margin-bottom:6px;border-bottom:1px solid var(--border);font-size:0.8rem;cursor:pointer;border-radius:6px;transition:background 0.15s" onclick="sTab(\'c\',\'c-reviews\')" onmouseover="this.style.background=\'rgba(0,0,0,0.02)\'" onmouseout="this.style.background=\'\'"><div style="display:flex;justify-content:space-between"><span>'+('⭐'.repeat(Math.round(r.rating||0)))+'</span><span style="color:var(--mid);font-size:0.72rem">'+d+'</span></div>'+(r.comment?'<div style="color:var(--mid);font-size:0.75rem;margin-top:2px">"'+r.comment.substring(0,70)+(r.comment.length>70?'...':'')+'"</div>':'')+'</div>';});h+='</div>';}
        return h;
      }
      return data.map(function(r){
        return '<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:0.78rem;cursor:pointer" onclick="sTab(\'c\',\'c-reviews\')">'+
          '<div style="display:flex;justify-content:space-between"><span>'+('⭐'.repeat(Math.round(r.rating||0)))+'</span><span style="color:var(--mid);font-size:0.7rem">'+new Date(r.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})+'</span></div></div>';
      }).join('');
    }catch(e){return'';}
  };

  _R._rwClientMsgs=async function(sz){
    var sb=_getSB(),u=_getUser();if(!sb||!u)return'';
    try{
      var lim=sz==='full'?8:2;
      // Get all recent messages
      var{data}=await sb.from('messages').select('body,sender_name,created_at,is_read').or('sender_id.eq.'+u.id+',recipient_id.eq.'+u.id).order('created_at',{ascending:false}).limit(lim);
      // Get unread count separately
      var{count:unreadCount}=await sb.from('messages').select('id',{count:'exact',head:true}).eq('recipient_id',u.id).eq('is_read',false);
      unreadCount=unreadCount||0;
      if(sz==='full'){
        var h='<div style="font-weight:600;font-size:0.82rem;margin-bottom:8px;display:flex;justify-content:space-between">Recent Messages'+
          (unreadCount>0?'<span style="background:#e74c3c;color:white;font-size:0.65rem;font-weight:700;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center">'+Math.min(unreadCount,9)+'</span>':'')+'</div>';
        if(data&&data.length){data.forEach(function(m){var d=new Date(m.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'});h+='<div style="padding:6px;margin-bottom:4px;border-bottom:1px solid var(--border);font-size:0.8rem;cursor:pointer;border-radius:6px;transition:background 0.15s" onclick="sTab(\'c\',\'c-msgs\')" onmouseover="this.style.background=\'rgba(0,0,0,0.02)\'" onmouseout="this.style.background=\'\'"><div style="display:flex;justify-content:space-between"><span style="font-weight:600">'+(m.sender_name||'Unknown')+'</span><span style="color:var(--mid);font-size:0.7rem">'+d+'</span></div><div style="color:var(--mid);font-size:0.75rem;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+((m.body||'').substring(0,80))+'</div></div>';});}
        else{h+='<div style="color:var(--mid);font-size:0.8rem">No messages yet</div>';}
        return h;
      }
      var h='<div style="position:relative">';
      if(data&&data.length){data.forEach(function(m){var d=new Date(m.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'});h+='<div style="padding:6px;margin-bottom:4px;border-bottom:1px solid var(--border);font-size:0.78rem;cursor:pointer;border-radius:4px;transition:background 0.15s" onclick="sTab(\'c\',\'c-msgs\')" onmouseover="this.style.background=\'rgba(0,0,0,0.02)\'" onmouseout="this.style.background=\'\'"><div style="display:flex;justify-content:space-between"><span style="font-weight:600;font-size:0.76rem">'+(m.sender_name||'Unknown')+'</span><span style="color:var(--mid);font-size:0.65rem">'+d+'</span></div><div style="color:var(--mid);font-size:0.72rem;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+((m.body||'').substring(0,70))+'</div></div>';});}else{h+='<div style="color:var(--mid);font-size:0.78rem">No messages</div>';}
      if(unreadCount>0){h+='<span style="position:absolute;top:-4px;right:-4px;background:#e74c3c;color:white;font-size:0.55rem;font-weight:700;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center">+'+Math.min(unreadCount,9)+'</span>';}
      return h+'</div>';
    }catch(e){return'<div style="font-size:0.75rem;color:var(--mid)">Messages</div>';}
  };

  _R._rwClientBilling=async function(sz){
    var sb=_getSB(),u=_getUser();if(!sb||!u)return'';
    try{
      var lim=sz==='full'?8:2;
      var{data}=await sb.from('payments').select('amount,created_at,status').eq('client_id',u.id).order('created_at',{ascending:false}).limit(lim);
      var h='<div style="font-weight:600;font-size:0.82rem;margin-bottom:8px">Payment History</div>';
      if(data&&data.length){data.forEach(function(p){var d=new Date(p.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'});var st=p.status==='succeeded'?'✅':'⏳';h+='<div style="display:flex;justify-content:space-between;padding:6px;margin-bottom:4px;font-size:0.78rem;border-bottom:1px solid var(--border);cursor:pointer;border-radius:4px;transition:background 0.15s" onclick="sTab(\'c\',\'c-bill\')" onmouseover="this.style.background=\'rgba(0,0,0,0.02)\'" onmouseout="this.style.background=\'\'"><span>'+st+' '+d+'</span><span style="font-weight:600;color:var(--forest)">$'+((p.amount||0)).toFixed(2)+'</span></div>';});}
      else{h+='<div style="color:var(--mid);font-size:0.8rem">No payments yet</div>';}
      h+='<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)"><a href="javascript:sTab(\'c\',\'c-bill\')" style="color:var(--forest);font-weight:600;font-size:0.78rem;text-decoration:none;cursor:pointer">💳 Manage Card on File</a></div>';
      return h;
    }catch(e){return'<div style="color:var(--mid);font-size:0.82rem">Payment history</div>';}
  };

  // ── STAFF ──
  _R._rwStaffStats=async function(sz){return _statRow([{icon:'📅',label:'This Week',id:'stat-staffThisWeek'},{icon:'✅',label:'All Time',id:'stat-staffAllTime'},{icon:'📋',label:'Reports Sent',id:'stat-staffYourRating'},{icon:'💰',label:'This Month',id:'stat-staffThisMonth'}],sz);};

  _R._rwStaffJobs=async function(sz){
    var sb=_getSB();if(!sb)return'';
    if(sz==='full'){
      try{
        var today=new Date();var startOfWeek=new Date(today);startOfWeek.setDate(today.getDate()-today.getDay());
        var endOfWeek=new Date(startOfWeek);endOfWeek.setDate(startOfWeek.getDate()+6);
        var{data}=await sb.from('booking_requests').select('service,preferred_date,preferred_time,contact_name,pet_names,status').in('status',['accepted','confirmed','in_progress']).gte('preferred_date',startOfWeek.toISOString().split('T')[0]).lte('preferred_date',endOfWeek.toISOString().split('T')[0]).order('preferred_date').order('preferred_time').limit(10);
        if(!data||!data.length) return '<div id="staffDashJobs" style="color:var(--mid);font-size:0.85rem;padding:12px 0;text-align:center">No jobs this week</div>';
        var h='';data.forEach(function(b){var d=new Date(b.preferred_date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});var t=(typeof fmt12h==='function')?fmt12h(b.preferred_time||''):(b.preferred_time||'');
          h+='<div style="display:flex;gap:10px;padding:8px;margin-bottom:4px;border-bottom:1px solid var(--border);font-size:0.82rem;cursor:pointer;border-radius:6px;transition:background 0.15s" onclick="sTab(\'s\',\'s-jobs\')" onmouseover="this.style.background=\'rgba(0,0,0,0.02)\'" onmouseout="this.style.background=\'\'"><div style="min-width:50px;color:var(--gold);font-weight:700;font-size:0.78rem">'+d.split(',')[0]+'</div><div style="flex:1"><div style="font-weight:700">'+b.service+'</div><div style="font-size:0.72rem;color:var(--mid)">'+(b.contact_name||'Client')+(b.pet_names?' · '+b.pet_names:'')+(t?' · '+t:'')+'</div></div><div style="font-size:0.68rem;color:var(--forest);font-weight:600;text-transform:uppercase">'+b.status+'</div></div>';
        });
        return '<div id="staffDashJobs">'+h+'</div>';
      }catch(e){return '<div id="staffDashJobs" style="color:var(--mid);font-size:0.82rem">Could not load</div>';}
    }
    // Small: just count
    var sb2=_getSB();if(!sb2)return'';
    try{var today=new Date();var startOfWeek=new Date(today);startOfWeek.setDate(today.getDate()-today.getDay());var endOfWeek=new Date(startOfWeek);endOfWeek.setDate(startOfWeek.getDate()+6);
      var{count}=await sb2.from('booking_requests').select('id',{count:'exact',head:true}).in('status',['accepted','confirmed','in_progress']).gte('preferred_date',startOfWeek.toISOString().split('T')[0]).lte('preferred_date',endOfWeek.toISOString().split('T')[0]);
      return '<div id="staffDashJobs">'+_bigNum(count||0,'jobs this week',sz)+'</div>';
    }catch(e){return '<div id="staffDashJobs" style="color:var(--mid);font-size:0.78rem">Loading...</div>';}
  };

  _R._rwStaffRequests=async function(sz){
    if(sz!=='full') return'<div style="font-size:0.75rem;color:var(--mid)">Booking requests</div>';
    var sb=_getSB();if(!sb){
      return '<div style="padding:8px;text-align:center;color:var(--mid);font-size:0.85rem">Loading...</div>';
    }
    try{
      var user=_getUser();
      var query=sb.from('booking_requests').select('id,service,contact_name,preferred_date,preferred_time,status,pet_names,estimated_total').order('created_at',{ascending:false}).limit(50);
      // Staff: filter by assigned clients
      if(user){
        try{
          var{data:sa}=await sb.from('staff_assignments').select('client_id').eq('staff_id',user.id);
          var cids=(sa||[]).map(function(a){return a.client_id;}).filter(Boolean);
          if(cids.length>0) query=query.in('client_id',cids);
        }catch(e){}
      }
      var{data}=await query;
      var h='<div><div style="margin-bottom:10px"><select id="staff-req-filter" onchange="HHP_Customizer.refresh()" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:0.8rem;background:white;cursor:pointer"><option value="pending">Pending (Default)</option><option value="accepted">Accepted</option><option value="in_progress">In Progress</option><option value="completed">Completed</option><option value="declined">Declined</option></select></div>';
      var filter=document.getElementById('staff-req-filter')?document.getElementById('staff-req-filter').value:'pending';
      var filtered=(data||[]).filter(function(b){return b.status===filter;});
      if(filtered&&filtered.length){filtered.slice(0,4).forEach(function(b){var d=new Date(b.preferred_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});var t=(typeof fmt12h==='function')?fmt12h(b.preferred_time||''):(b.preferred_time||'');var sCol=b.status==='pending'?'#c8963e':b.status==='in_progress'?'var(--forest)':'var(--mid)';
        h+='<div style="display:flex;gap:8px;padding:8px;margin-bottom:6px;border-bottom:1px solid var(--border);font-size:0.8rem;cursor:pointer;border-radius:6px;transition:background 0.15s" onclick="sTab(\'s\',\'s-requests\')" onmouseover="this.style.background=\'rgba(0,0,0,0.02)\'" onmouseout="this.style.background=\'\'"><div style="flex:1"><div style="font-weight:700">'+b.service+'</div><div style="font-size:0.72rem;color:var(--mid)">'+(b.contact_name||'Client')+(b.pet_names?' · '+b.pet_names:'')+'</div></div><div style="text-align:right;white-space:nowrap"><div style="font-size:0.72rem;color:var(--mid)">'+d+(t?' '+t:'')+'</div><div style="font-size:0.68rem;font-weight:700;color:'+sCol+';text-transform:uppercase;margin-top:2px">'+b.status+'</div>'+(b.estimated_total?'<div style="font-size:0.72rem;color:var(--forest);font-weight:600;margin-top:2px">$'+b.estimated_total.toFixed(2)+'</div>':'')+'</div></div>';});}
      else{h+='<div style="padding:12px 0;text-align:center;color:var(--mid);font-size:0.82rem">No '+filter+' requests</div>';}
      return h+'</div>';
    }catch(e){
      return '<div style="padding:8px;text-align:center;color:var(--mid);font-size:0.85rem">Error loading</div>';
    }
  };

  _R._rwStaffClients=async function(sz){
    var sb=_getSB();if(!sb)return'';
    if(sz!=='full') return _bigNum(0,'clients',sz);
    try{var today=new Date().toISOString().split('T')[0];var{data}=await sb.from('booking_requests').select('contact_name,contact_email,pet_names,service').in('status',['accepted','confirmed']).gte('preferred_date',today).limit(50);
      var clients={};(data||[]).forEach(function(b){if(b.contact_name&&!clients[b.contact_name])clients[b.contact_name]={name:b.contact_name,pets:b.pet_names||'',service:b.service||''};});
      var n=Object.values(clients);
      var h=_bigNum(n.length,'active clients',sz);
      if(n.length){h+='<div style="margin-top:10px">';n.slice(0,6).forEach(function(c){h+='<div style="display:flex;justify-content:space-between;padding:8px;margin-bottom:4px;border-bottom:1px solid var(--border);font-size:0.8rem;cursor:pointer;border-radius:6px;transition:background 0.15s" onclick="sTab(\'s\',\'s-clients\')" onmouseover="this.style.background=\'rgba(0,0,0,0.02)\'" onmouseout="this.style.background=\'\'"><div><span style="font-weight:600">'+c.name+'</span>'+(c.pets?'<span style="color:var(--mid);font-size:0.72rem"> · '+c.pets+'</span>':'')+'</div><div style="font-size:0.72rem;color:var(--mid)">'+c.service+'</div></div>';});h+='</div>';}
      return h;
    }catch(e){return'';}
  };

  _R._rwStaffEarnings=async function(sz){
    var sb=_getSB();if(!sb)return'';
    if(sz!=='full') return _bigNum(0,'completed',sz);
    try{
      var{count}=await sb.from('booking_requests').select('id',{count:'exact',head:true}).eq('status','completed');
      var h=_bigNum(count||0,'jobs completed',sz);
      var{data}=await sb.from('booking_requests').select('service,estimated_total,preferred_date').eq('status','completed').order('preferred_date',{ascending:false}).limit(5);
      if(data&&data.length){var totalEarned=data.reduce(function(a,b){return a+(b.estimated_total||0);},0);
        h+='<div style="margin-top:8px;text-align:center;font-size:0.82rem;color:var(--forest);font-weight:700">$'+totalEarned.toFixed(2)+' recent earnings</div>';
        h+='<div style="margin-top:8px">';data.forEach(function(b){var d=new Date(b.preferred_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});h+='<div style="display:flex;justify-content:space-between;padding:6px;margin-bottom:2px;font-size:0.78rem;border-bottom:1px solid var(--border);border-radius:4px">'+b.service+' <span style="color:var(--mid);font-size:0.7rem">'+d+'</span><span style="font-weight:600;color:var(--forest);margin-left:8px">$'+(b.estimated_total||0).toFixed(2)+'</span></div>';});h+='</div>';}
      return h;
    }catch(e){return'';}
  };

  _R._rwStaffMsgs=async function(sz){
    var sb=_getSB(),u=_getUser();if(!sb||!u)return'';
    try{
      var lim=sz==='full'?8:2;
      // Get all recent messages
      var{data}=await sb.from('messages').select('body,sender_name,created_at,is_read').or('sender_id.eq.'+u.id+',recipient_id.eq.'+u.id).order('created_at',{ascending:false}).limit(lim);
      // Get unread count separately
      var{count:unreadCount}=await sb.from('messages').select('id',{count:'exact',head:true}).eq('recipient_id',u.id).eq('is_read',false);
      unreadCount=unreadCount||0;
      if(sz==='full'){
        var h='<div style="font-weight:600;font-size:0.82rem;margin-bottom:8px;display:flex;justify-content:space-between">Recent Messages'+
          (unreadCount>0?'<span style="background:#e74c3c;color:white;font-size:0.65rem;font-weight:700;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center">'+Math.min(unreadCount,9)+'</span>':'')+'</div>';
        if(data&&data.length){data.forEach(function(m){var d=new Date(m.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'});h+='<div style="padding:6px;margin-bottom:4px;border-bottom:1px solid var(--border);font-size:0.8rem;cursor:pointer;border-radius:6px;transition:background 0.15s" onclick="sTab(\'s\',\'s-msgs\')" onmouseover="this.style.background=\'rgba(0,0,0,0.02)\'" onmouseout="this.style.background=\'\'"><div style="display:flex;justify-content:space-between"><span style="font-weight:600">'+(m.sender_name||'Unknown')+'</span><span style="color:var(--mid);font-size:0.7rem">'+d+'</span></div><div style="color:var(--mid);font-size:0.75rem;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(m.body||'').substring(0,80)+'</div></div>';});}
        else{h+='<div style="color:var(--mid);font-size:0.8rem">No messages yet</div>';}
        return h;
      }
      var h='<div style="position:relative">';
      if(data&&data.length){data.forEach(function(m){var d=new Date(m.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'});h+='<div style="padding:6px;margin-bottom:4px;border-bottom:1px solid var(--border);font-size:0.78rem;cursor:pointer;border-radius:4px;transition:background 0.15s" onclick="sTab(\'s\',\'s-msgs\')" onmouseover="this.style.background=\'rgba(0,0,0,0.02)\'" onmouseout="this.style.background=\'\'"><div style="display:flex;justify-content:space-between"><span style="font-weight:600;font-size:0.76rem">'+(m.sender_name||'Unknown')+'</span><span style="color:var(--mid);font-size:0.65rem">'+d+'</span></div><div style="color:var(--mid);font-size:0.72rem;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+((m.body||'').substring(0,70))+'</div></div>';});}else{h+='<div style="color:var(--mid);font-size:0.78rem">No messages</div>';}
      if(unreadCount>0){h+='<span style="position:absolute;top:-4px;right:-4px;background:#e74c3c;color:white;font-size:0.55rem;font-weight:700;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center">+'+Math.min(unreadCount,9)+'</span>';}
      return h+'</div>';
    }catch(e){return'<div style="font-size:0.75rem;color:var(--mid)">Messages</div>';}
  };

  _R._rwStaffCal=async function(sz){
    var sb=_getSB();if(!sb)return'';
    if(sz==='full'){
      try{
        var today=new Date();
        var firstDay=new Date(today.getFullYear(),today.getMonth(),1);
        var lastDay=new Date(today.getFullYear(),today.getMonth()+1,0);
        var monthStart=new Date(firstDay);monthStart.setDate(firstDay.getDate()-firstDay.getDay());
        var monthEnd=new Date(lastDay);monthEnd.setDate(lastDay.getDate()+(6-lastDay.getDay()));
        var monthStr=firstDay.toLocaleDateString('en-US',{month:'long',year:'numeric'});
        var{data}=await sb.from('booking_requests').select('preferred_date').in('status',['accepted','confirmed','in_progress']).gte('preferred_date',monthStart.toISOString().split('T')[0]).lte('preferred_date',monthEnd.toISOString().split('T')[0]);
        var jobDates={};(data||[]).forEach(function(b){jobDates[b.preferred_date]=true;});
        var h='<div style="font-weight:600;font-size:0.85rem;margin-bottom:10px">'+monthStr+'</div>';
        h+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:10px">';
        var dayLabels=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        dayLabels.forEach(function(d){h+='<div style="text-align:center;font-weight:600;font-size:0.7rem;color:var(--mid);padding:4px 0">'+d+'</div>';});
        for(var d=new Date(monthStart);d<=monthEnd;d.setDate(d.getDate()+1)){
          var dateStr=d.toISOString().split('T')[0];
          var hasJob=jobDates[dateStr];
          var isToday=dateStr===today.toISOString().split('T')[0];
          var isCurrentMonth=d.getMonth()===today.getMonth();
          h+='<div style="position:relative;aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:6px;font-size:0.75rem;font-weight:600;cursor:pointer;transition:background 0.15s;background:'+(isCurrentMonth?'var(--warm)':'rgba(0,0,0,0.02)')+';border:'+(isToday?'2px solid var(--gold)':'1px solid var(--border)')+';color:'+(isCurrentMonth?'var(--ink)':'var(--mid)')+';" onclick="sTab(\'s\',\'s-cal\')" onmouseover="this.style.background=\'rgba(0,0,0,0.05)\'" onmouseout="this.style.background=\''+(isCurrentMonth?'var(--warm)':'rgba(0,0,0,0.02)')+'\'">'+d.getDate()+(hasJob?'<span style="position:absolute;width:4px;height:4px;background:var(--forest);border-radius:50%;margin-top:14px"></span>':'')+'</div>';
        }
        h+='</div>';
        return h;
      }catch(e){return'<div style="color:var(--mid);font-size:0.82rem">Calendar view</div>';}
    }
    // Small: week view with job info
    try{
      var today=new Date();var startOfWeek=new Date(today);startOfWeek.setDate(today.getDate()-today.getDay());
      var endOfWeek=new Date(startOfWeek);endOfWeek.setDate(startOfWeek.getDate()+6);
      var{data:weekJobs}=await sb.from('booking_requests').select('preferred_date,service,preferred_time').in('status',['accepted','confirmed','in_progress']).gte('preferred_date',startOfWeek.toISOString().split('T')[0]).lte('preferred_date',endOfWeek.toISOString().split('T')[0]).order('preferred_date').order('preferred_time');
      var jobsByDay={};(weekJobs||[]).forEach(function(b){if(!jobsByDay[b.preferred_date])jobsByDay[b.preferred_date]=[];jobsByDay[b.preferred_date].push(b);});
      var dayLabels=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      var h='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">';
      for(var i=0;i<7;i++){
        var d=new Date(startOfWeek);d.setDate(startOfWeek.getDate()+i);
        var dateStr=d.toISOString().split('T')[0];
        var isToday=dateStr===today.toISOString().split('T')[0];
        var jobs=jobsByDay[dateStr]||[];
        h+='<div style="text-align:center;padding:3px 1px;border-radius:6px;cursor:pointer;background:'+(isToday?'rgba(61,90,71,0.1)':'var(--warm)')+';border:'+(isToday?'1.5px solid var(--forest)':'1px solid var(--border)')+'" onclick="sTab(\'s\',\'s-cal\')">';
        h+='<div style="font-size:0.6rem;font-weight:700;color:var(--mid)">'+dayLabels[i]+'</div>';
        h+='<div style="font-size:0.75rem;font-weight:700">'+d.getDate()+'</div>';
        if(jobs.length){h+='<div style="width:5px;height:5px;background:var(--forest);border-radius:50%;margin:2px auto 0"></div>';}
        h+='</div>';
      }
      h+='</div>';
      return h;
    }catch(e){return'<div style="font-size:0.75rem;color:var(--mid)">Schedule</div>';}
  };

  // ── OWNER ──
  _R._rwOwnerBanner=async function(sz){
    var _bH=new Date().getHours();
    var _bGreet=_bH<12?'Good morning':_bH<17?'Good afternoon':'Good evening';
    var _bName='Rachel';
    try{if(window.HHP_Auth&&HHP_Auth.currentUser&&HHP_Auth.currentUser.profile&&HHP_Auth.currentUser.profile.full_name)_bName=HHP_Auth.currentUser.profile.full_name.split(' ')[0];}catch(e){}
    if(sz==='half'){
      // Small: greeting + 3 key stats + announcement button
      return '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px">'+
        '<div style="flex:1"><div style="font-family:\'Cormorant Garamond\',serif;font-size:0.95rem;font-weight:700;color:var(--ink)">'+_bGreet+', '+_bName+' 🐾</div></div>'+
        '<button class="btn btn-gold btn-sm" onclick="openModal(\'announceModal\')" style="padding:4px 8px;font-size:0.7rem;white-space:nowrap;flex-shrink:0">📢</button></div>'+
        '<div style="display:flex;gap:5px;flex-wrap:wrap">'+
          '<div style="flex:1;min-width:45px;text-align:center;background:var(--warm);border-radius:6px;padding:5px;cursor:pointer" onclick="sTab(\'o\',\'o-clients\')" style="transition:background 0.15s" onmouseover="this.style.background=\'rgba(0,0,0,0.05)\'" onmouseout="this.style.background=\'var(--warm)\'"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1rem;font-weight:700" id="stat-activeClients">—</div><div style="font-size:0.55rem;color:var(--mid);text-transform:uppercase">Clients</div></div>'+
          '<div style="flex:1;min-width:45px;text-align:center;background:var(--warm);border-radius:6px;padding:5px;cursor:pointer" onclick="sTab(\'o\',\'o-activity\')" style="transition:background 0.15s" onmouseover="this.style.background=\'rgba(0,0,0,0.05)\'" onmouseout="this.style.background=\'var(--warm)\'"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1rem;font-weight:700" id="stat-avgRating">—</div><div style="font-size:0.55rem;color:var(--mid);text-transform:uppercase">Reports</div></div>'+
          '<div style="flex:1;min-width:45px;text-align:center;background:var(--warm);border-radius:6px;padding:5px;cursor:pointer" onclick="sTab(\'o\',\'o-activity\')" style="transition:background 0.15s" onmouseover="this.style.background=\'rgba(0,0,0,0.05)\'" onmouseout="this.style.background=\'var(--warm)\'"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1rem;font-weight:700" id="stat-todayJobs">—</div><div style="font-size:0.55rem;color:var(--mid);text-transform:uppercase">Today</div></div>'+
        '</div>';
    }
    // Full: greeting + announcement button + 4 key stats (Clients, Sign-ups, Reports, Today)
    return '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">'+
      '<div><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.3rem;font-weight:700;color:var(--ink)">'+_bGreet+', '+_bName+' 🐾</div>'+
      '<div style="font-size:0.82rem;color:var(--mid)">Your business is growing beautifully.</div></div>'+
      '<button class="btn btn-gold btn-sm" onclick="openModal(\'announceModal\')">📢 Post Announcement</button></div>'+
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">'+
        '<div style="flex:1;min-width:60px;text-align:center;background:var(--warm);border-radius:8px;padding:10px;cursor:pointer;transition:background 0.15s" onclick="sTab(\'o\',\'o-clients\')" onmouseover="this.style.background=\'rgba(0,0,0,0.05)\'" onmouseout="this.style.background=\'var(--warm)\'"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.4rem;font-weight:700" id="stat-activeClients">—</div><div style="font-size:0.65rem;color:var(--mid);text-transform:uppercase">Clients</div></div>'+
        '<div style="flex:1;min-width:60px;text-align:center;background:var(--warm);border-radius:8px;padding:10px;cursor:pointer;transition:background 0.15s" onclick="sTab(\'o\',\'o-activity\')" onmouseover="this.style.background=\'rgba(0,0,0,0.05)\'" onmouseout="this.style.background=\'var(--warm)\'"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.4rem;font-weight:700" id="stat-newSignups">—</div><div style="font-size:0.65rem;color:var(--mid);text-transform:uppercase">Sign-ups</div></div>'+
        '<div style="flex:1;min-width:60px;text-align:center;background:var(--warm);border-radius:8px;padding:10px;cursor:pointer;transition:background 0.15s" onclick="sTab(\'o\',\'o-activity\')" onmouseover="this.style.background=\'rgba(0,0,0,0.05)\'" onmouseout="this.style.background=\'var(--warm)\'"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.4rem;font-weight:700" id="stat-avgRating">—</div><div style="font-size:0.65rem;color:var(--mid);text-transform:uppercase">Reports</div></div>'+
        '<div style="flex:1;min-width:60px;text-align:center;background:var(--warm);border-radius:8px;padding:10px;cursor:pointer;transition:background 0.15s" onclick="sTab(\'o\',\'o-sched\')" onmouseover="this.style.background=\'rgba(0,0,0,0.05)\'" onmouseout="this.style.background=\'var(--warm)\'"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.4rem;font-weight:700" id="stat-todayJobs">—</div><div style="font-size:0.65rem;color:var(--mid);text-transform:uppercase">Today</div></div>'+
      '</div>';
  };

  _R._rwOwnerAlerts=async function(sz){
    var sb=_getSB();if(!sb){
      return '<div id="hhpAlertsCard"><div style="font-size:0.75rem;color:var(--mid)">Loading...</div></div>';
    }
    try{
      var lim=sz==='full'?4:2;
      var{data:alerts}=await sb.from('messages').select('body,sender_name,created_at').eq('is_alert',true).order('created_at',{ascending:false}).limit(lim);
      var{data:messages}=await sb.from('messages').select('body,sender_name,created_at').eq('is_alert',false).order('created_at',{ascending:false}).limit(lim);
      if(sz==='full'){
        var h='<div id="hhpAlertsCard">';
        if(alerts&&alerts.length){h+='<div style="font-weight:600;font-size:0.82rem;margin-bottom:6px;color:#e74c3c">🔔 Alerts</div>';alerts.forEach(function(a){var d=new Date(a.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'});h+='<div style="padding:6px;margin-bottom:4px;border-bottom:1px solid var(--border);font-size:0.8rem;cursor:pointer;border-radius:4px;transition:background 0.15s" onclick="sTab(\'o\',\'o-msgs\')" onmouseover="this.style.background=\'rgba(0,0,0,0.02)\'" onmouseout="this.style.background=\'\'"><div style="display:flex;justify-content:space-between"><span style="font-weight:600">'+(a.sender_name||'Alert')+'</span><span style="color:var(--mid);font-size:0.7rem">'+d+'</span></div><div style="color:var(--mid);font-size:0.75rem;margin-top:2px">'+a.body.substring(0,80)+(a.body.length>80?'...':'')+'</div></div>';});}
        if(messages&&messages.length){h+='<div style="font-weight:600;font-size:0.82rem;margin-top:10px;margin-bottom:6px">💬 Messages</div>';messages.forEach(function(m){var d=new Date(m.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'});h+='<div style="padding:6px;margin-bottom:4px;border-bottom:1px solid var(--border);font-size:0.8rem;cursor:pointer;border-radius:4px;transition:background 0.15s" onclick="sTab(\'o\',\'o-msgs\')" onmouseover="this.style.background=\'rgba(0,0,0,0.02)\'" onmouseout="this.style.background=\'\'"><div style="display:flex;justify-content:space-between"><span style="font-weight:600">'+(m.sender_name||'Message')+'</span><span style="color:var(--mid);font-size:0.7rem">'+d+'</span></div><div style="color:var(--mid);font-size:0.75rem;margin-top:2px">'+m.body.substring(0,80)+(m.body.length>80?'...':'')+'</div></div>';});}
        if((!alerts||!alerts.length)&&(!messages||!messages.length)){h+='<div style="padding:16px 0;text-align:center;color:var(--mid);font-size:0.82rem">No alerts or messages</div>';}
        return h+'</div>';
      }
      // Small: last 2 alerts + last 2 messages
      var h='<div id="hhpAlertsCard">';
      if(alerts&&alerts.length){h+='<div style="font-weight:600;font-size:0.78rem;margin-bottom:4px;color:#e74c3c">🔔 Alerts</div>';alerts.forEach(function(a){h+='<div style="padding:4px;margin-bottom:2px;font-size:0.75rem;cursor:pointer;border-radius:3px;transition:background 0.15s" onclick="sTab(\'o\',\'o-msgs\')" onmouseover="this.style.background=\'rgba(0,0,0,0.02)\'" onmouseout="this.style.background=\'\'">'+a.sender_name+'</div>';});}
      if(messages&&messages.length){h+='<div style="font-weight:600;font-size:0.78rem;margin-top:6px;margin-bottom:4px;color:var(--forest)">💬 Messages</div>';messages.forEach(function(m){h+='<div style="padding:4px;margin-bottom:2px;font-size:0.75rem;cursor:pointer;border-radius:3px;transition:background 0.15s" onclick="sTab(\'o\',\'o-msgs\')" onmouseover="this.style.background=\'rgba(0,0,0,0.02)\'" onmouseout="this.style.background=\'\'">'+m.sender_name+'</div>';});}
      if((!alerts||!alerts.length)&&(!messages||!messages.length)){h+='<div style="color:var(--mid);font-size:0.75rem">All clear</div>';}
      return h+'</div>';
    }catch(e){
      return '<div id="hhpAlertsCard"><div style="font-size:0.75rem;color:var(--mid)">Error loading</div></div>';
    }
  };

  _R._rwOwnerWeekStats=async function(sz){
    if(sz!=='full') return'<div style="font-size:0.75rem;color:var(--mid)">Weekly snapshot</div>';
    var sb=_getSB();
    var jobs='—',rev='—',inq='—',rpts='—';
    if(sb){
      try{
        var today=new Date();today.setHours(0,0,0,0);
        var sow=new Date(today);sow.setDate(today.getDate()-today.getDay());
        var eow=new Date(sow);eow.setDate(eow.getDate()+6);
        var ws=sow.toISOString().split('T')[0],we=eow.toISOString().split('T')[0];
        var{count:jc}=await sb.from('booking_requests').select('*',{count:'exact',head:true}).gte('preferred_date',ws).lte('preferred_date',we).in('status',['accepted','confirmed','completed']);
        jobs=jc||0;
        var{data:pw}=await sb.from('payments').select('amount').gte('created_at',ws).lte('created_at',we+'T23:59:59');
        if(pw&&pw.length){var t=pw.reduce(function(a,p){return a+(p.amount||0);},0);rev='$'+(t*0.85).toFixed(0);}else{rev='$0';}
        var{count:ic}=await sb.from('booking_requests').select('*',{count:'exact',head:true}).gte('created_at',ws).lte('created_at',we+'T23:59:59');
        inq=ic||0;
        var{count:rc}=await sb.from('service_reports').select('*',{count:'exact',head:true}).gte('created_at',ws).lte('created_at',we+'T23:59:59');
        rpts=rc||0;
      }catch(e){console.warn('Week stats:',e);}
    }
    return '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:space-between">'+
      '<div style="flex:1;min-width:70px;background:var(--gold-pale);border-radius:8px;padding:10px;text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.4rem;font-weight:700" id="stat-jobsThisWeek">'+jobs+'</div><div style="font-size:0.62rem;font-weight:600;color:var(--mid);text-transform:uppercase">Jobs</div></div>'+
      '<div style="flex:1;min-width:70px;background:var(--forest-pale);border-radius:8px;padding:10px;text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.4rem;font-weight:700" id="stat-weekRevenue">'+rev+'</div><div style="font-size:0.62rem;font-weight:600;color:var(--mid);text-transform:uppercase">Revenue</div></div>'+
      '<div style="flex:1;min-width:70px;background:var(--rose-pale);border-radius:8px;padding:10px;text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.4rem;font-weight:700" id="stat-newInquiries">'+inq+'</div><div style="font-size:0.62rem;font-weight:600;color:var(--mid);text-transform:uppercase">Inquiries</div></div>'+
      '<div style="flex:1;min-width:70px;background:#e0f2fe;border-radius:8px;padding:10px;text-align:center"><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.4rem;font-weight:700" id="stat-weekRating">'+rpts+'</div><div style="font-size:0.62rem;font-weight:600;color:var(--mid);text-transform:uppercase">Reports</div></div></div>';
  };

  _R._rwOwnerRequests=async function(sz){
    if(sz!=='full') return'<div style="font-size:0.75rem;color:var(--mid)">Booking requests</div>';
    var sb=_getSB();if(!sb){
      return '<div id="hhpAdminDashboard"><div style="padding:8px;text-align:center;color:var(--mid);font-size:0.85rem">Loading...</div></div>';
    }
    try{
      var{data}=await sb.from('booking_requests').select('id,service,contact_name,preferred_date,preferred_time,status,pet_names,estimated_total').order('created_at',{ascending:false}).limit(50);
      var h='<div id="hhpAdminDashboard"><div style="margin-bottom:10px"><select id="req-filter" onchange="HHP_Customizer.refresh()" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:0.8rem;background:white;cursor:pointer"><option value="pending">Pending (Default)</option><option value="accepted">Accepted</option><option value="in_progress">In Progress</option><option value="completed">Completed</option><option value="declined">Declined</option></select></div>';
      var filter=document.getElementById('req-filter')?document.getElementById('req-filter').value:'pending';
      var filtered=(data||[]).filter(function(b){return b.status===filter;});
      if(filtered&&filtered.length){filtered.slice(0,4).forEach(function(b){var d=new Date(b.preferred_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});var t=(typeof fmt12h==='function')?fmt12h(b.preferred_time||''):(b.preferred_time||'');var sCol=b.status==='pending'?'#c8963e':b.status==='in_progress'?'var(--forest)':'var(--mid)';
        h+='<div style="display:flex;gap:8px;padding:8px;margin-bottom:6px;border-bottom:1px solid var(--border);font-size:0.8rem;cursor:pointer;border-radius:6px;transition:background 0.15s" onclick="sTab(\'o\',\'o-requests\')" onmouseover="this.style.background=\'rgba(0,0,0,0.02)\'" onmouseout="this.style.background=\'\'"><div style="flex:1"><div style="font-weight:700">'+b.service+'</div><div style="font-size:0.72rem;color:var(--mid)">'+(b.contact_name||'Client')+(b.pet_names?' · '+b.pet_names:'')+'</div></div><div style="text-align:right;white-space:nowrap"><div style="font-size:0.72rem;color:var(--mid)">'+d+(t?' '+t:'')+'</div><div style="font-size:0.68rem;font-weight:700;color:'+sCol+';text-transform:uppercase;margin-top:2px">'+b.status+'</div>'+(b.estimated_total?'<div style="font-size:0.72rem;color:var(--forest);font-weight:600;margin-top:2px">$'+b.estimated_total.toFixed(2)+'</div>':'')+'</div></div>';});}
      else{h+='<div style="padding:12px 0;text-align:center;color:var(--mid);font-size:0.82rem">No '+filter+' requests</div>';}
      return h+'</div>';
    }catch(e){
      return '<div id="hhpAdminDashboard"><div style="padding:8px;text-align:center;color:var(--mid);font-size:0.85rem">Error loading</div></div>';
    }
  };

  _R._rwOwnerToday=async function(sz){
    if(sz!=='full') return'<div style="font-size:0.75rem;color:var(--mid)">Today\'s schedule</div>';
    var sb=_getSB();if(!sb){
      return '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><div style="font-size:0.82rem;color:var(--mid)" id="todayDateLabel">Loading...</div></div>'+
        '<div id="ownerTodayScheduleList" style="display:flex;flex-direction:column;gap:6px;min-height:60px"><div style="padding:12px;text-align:center;color:var(--mid);font-size:0.82rem">Loading...</div></div>';
    }
    try{var today=new Date().toISOString().split('T')[0];var{data}=await sb.from('booking_requests').select('service,preferred_time,contact_name,pet_names,status').in('status',['accepted','confirmed','in_progress','payment_hold']).eq('preferred_date',today).order('preferred_time');
      var h='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><div style="font-size:0.85rem;color:var(--mid);font-weight:600" id="todayDateLabel">'+new Date().toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})+'</div>'+
        '<button class="btn btn-outline btn-sm" onclick="sTab(\'o\',\'o-sched\')" style="font-size:0.75rem;padding:4px 8px">Full Schedule →</button></div>';
      if(data&&data.length){
        h+='<div id="ownerTodayScheduleList" style="display:flex;flex-direction:column;gap:6px">';var count=0;data.forEach(function(b){if(count<4){var t=(typeof fmt12h==='function')?fmt12h(b.preferred_time||''):(b.preferred_time||'');h+='<div style="display:flex;gap:10px;align-items:center;padding:8px;border-bottom:1px solid var(--border);font-size:0.82rem;cursor:pointer;border-radius:6px;transition:background 0.15s" onclick="sTab(\'o\',\'o-sched\')" onmouseover="this.style.background=\'rgba(0,0,0,0.02)\'" onmouseout="this.style.background=\'\'"><div style="min-width:50px;font-weight:700;color:var(--gold);font-size:0.8rem">'+t+'</div><div style="flex:1"><div style="font-weight:600">'+b.service+'</div><div style="font-size:0.72rem;color:var(--mid)">'+(b.contact_name||'Client')+(b.pet_names?' · '+b.pet_names:'')+'</div></div></div>';count++;} });if(data.length>4){h+='<div style="padding:6px;text-align:center;color:var(--forest);font-size:0.78rem;font-weight:600;cursor:pointer" onclick="sTab(\'o\',\'o-sched\')">+'+( data.length-4)+' more →</div>';}h+='</div>';}else{h+='<div id="ownerTodayScheduleList" style="padding:12px;text-align:center;color:var(--mid);font-size:0.82rem">No services scheduled today</div>';}
      return h;
    }catch(e){return'<div style="color:var(--mid);font-size:0.82rem">Error loading today\'s schedule</div>';}
  };

  _R._rwOwnerClients=async function(sz){
    var sb=_getSB();if(!sb)return'';
    try{
      var[clientsRes,petsRes]=await Promise.all([
        sb.from('profiles').select('id,user_id,full_name,phone,pet_names,avatar_url').eq('role','client').order('full_name',{ascending:true}),
        sb.from('pets').select('id,name,species,breed,photo_url,owner_id')
      ]);
      var clients=clientsRes.data||[];
      var allPets=petsRes.data||[];
      // Fallback: if direct query failed, try RPC function
      if((!allPets||!allPets.length)&&!petsRes.error){
        try{var rpc=await sb.rpc('get_all_pets');if(rpc.data&&rpc.data.length)allPets=rpc.data;}catch(e){}
      }
      // Index pets by owner_id
      var petsByOwner={};
      allPets.forEach(function(p){if(!petsByOwner[p.owner_id])petsByOwner[p.owner_id]=[];petsByOwner[p.owner_id].push(p);});
      var totalCount=clients.length;
      if(sz==='full'){
        var lim=8;
        var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span style="font-family:\'Cormorant Garamond\',serif;font-size:1.4rem;font-weight:700">'+totalCount+'</span><span style="font-size:0.75rem;color:var(--mid)">registered clients</span></div>';
        h+='<div style="display:flex;flex-direction:column;gap:2px">';
        clients.slice(0,lim).forEach(function(c){
          var uid='oc-'+c.id;
          var cPets=petsByOwner[c.user_id]||[];
          var petStr=cPets.map(function(p){return p.name;}).join(', ')||c.pet_names||'';
          var avatar=c.avatar_url?'<img src="'+c.avatar_url+'" style="width:100%;height:100%;object-fit:cover" loading="lazy">':'<span style="font-size:0.9rem">👤</span>';
          h+='<div>';
          h+='<div style="display:flex;align-items:center;gap:10px;padding:8px 6px;border-radius:8px;transition:background 0.15s;user-select:none" onmouseover="this.style.background=\'rgba(0,0,0,0.03)\'" onmouseout="this.style.background=\'\'">';
          h+='<div style="width:36px;height:36px;border-radius:50%;background:var(--gold-pale);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">'+avatar+'</div>';
          h+='<div style="flex:1;min-width:0;cursor:pointer" onclick="sTab(\'o\',\'o-clients\')"><div style="font-weight:700;font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink);transition:color 0.15s" onmouseover="this.style.color=\'var(--forest)\'" onmouseout="this.style.color=\'var(--ink)\'">'+c.full_name+'</div>';
          h+='<div style="font-size:0.7rem;color:var(--mid)">'+(c.phone||'No phone')+(petStr?' · '+petStr:'')+'</div></div>';
          // Arrow always shows — toggles pet dropdown or lazy-loads
          h+='<span style="font-size:0.75rem;color:var(--mid);cursor:pointer;padding:4px 8px;border-radius:4px;transition:all 0.15s" id="'+uid+'-arrow" onclick="HHP_Customizer.togglePets(\''+uid+'\',\''+c.user_id+'\')" onmouseover="this.style.background=\'rgba(200,150,62,0.15)\'" onmouseout="this.style.background=\'\'">▼</span>';
          h+='</div>';
          // Pet dropdown container
          if(cPets.length){
            // Pre-rendered pets
            var petHtml='';
            cPets.forEach(function(pet){
              var petAvatar=pet.photo_url?'<img src="'+pet.photo_url+'" style="width:100%;height:100%;object-fit:cover" loading="lazy">':(pet.species==='cat'?'🐱':'🐶');
              petHtml+='<div style="display:flex;align-items:center;gap:8px;padding:5px 4px;border-radius:6px;cursor:pointer;transition:background 0.15s;font-size:0.8rem" onclick="event.stopPropagation();HHP_Customizer.openPetProfile(\''+pet.id+'\')" onmouseover="this.style.background=\'rgba(200,150,62,0.08)\'" onmouseout="this.style.background=\'\'">';
              petHtml+='<div style="width:26px;height:26px;border-radius:50%;background:var(--warm);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;font-size:0.7rem">'+petAvatar+'</div>';
              petHtml+='<div style="flex:1"><span style="font-weight:600">'+pet.name+'</span><span style="color:var(--mid);font-size:0.7rem;margin-left:4px">'+(pet.breed||pet.species||'')+'</span></div>';
              petHtml+='<span style="font-size:0.65rem;color:var(--forest);font-weight:600">View →</span>';
              petHtml+='</div>';
            });
            h+='<div id="'+uid+'" style="display:none;margin-left:46px;margin-bottom:4px;border-left:2px solid var(--gold-pale);padding-left:10px" data-loaded="1">'+petHtml+'</div>';
          } else {
            // Empty container — will be lazy-loaded on arrow click
            h+='<div id="'+uid+'" style="display:none;margin-left:46px;margin-bottom:4px;border-left:2px solid var(--gold-pale);padding-left:10px"></div>';
          }
          h+='</div>';
        });
        h+='</div>';
        if(totalCount>lim){h+='<div style="margin-top:8px;text-align:center"><a href="javascript:sTab(\'o\',\'o-clients\')" style="color:var(--forest);font-weight:600;font-size:0.78rem;text-decoration:none">View all '+totalCount+' clients →</a></div>';}
        return h;
      }
      // Small: count + mini list
      var h=_bigNum(totalCount,'clients',sz);
      h+='<div style="margin-top:6px">';
      (clients||[]).slice(0,3).forEach(function(c){
        h+='<div style="font-size:0.72rem;padding:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer" onclick="sTab(\'o\',\'o-clients\')">'+c.full_name+'</div>';
      });
      if(totalCount>3) h+='<div style="font-size:0.65rem;color:var(--forest);cursor:pointer;margin-top:2px" onclick="sTab(\'o\',\'o-clients\')">+'+(totalCount-3)+' more →</div>';
      h+='</div>';
      return h;
    }catch(e){return'';}
  };

  // Lazy-load pets when arrow is clicked
  async function _togglePets(uid,ownerUserId){
    var el=document.getElementById(uid);
    var ar=document.getElementById(uid+'-arrow');
    if(!el){console.warn('[togglePets] No element found for id:',uid);return;}
    if(el.style.display!=='none'){
      // Collapse
      el.style.display='none';
      if(ar)ar.textContent='▼';
      return;
    }
    // Expand
    el.style.display='block';
    if(ar)ar.textContent='▲';
    // If already loaded (has pet cards), just show
    if(el.getAttribute('data-loaded')==='1')return;
    // Fetch pets for this client
    el.innerHTML='<div style="font-size:0.75rem;color:var(--mid);padding:4px 0">Loading pets...</div>';
    var sb=_getSB();
    if(!sb){el.innerHTML='<div style="font-size:0.75rem;color:var(--mid);padding:4px 0;font-style:italic">Could not load</div>';return;}
    try{
      // First try direct query
      var{data:pets,error}=await sb.from('pets').select('id,name,species,breed,photo_url,owner_id').eq('owner_id',ownerUserId).order('name');
      // Fallback: try RPC if direct query returned empty
      if((!pets||!pets.length)&&!error){
        try{
          var rpc=await sb.rpc('get_all_pets');
          if(rpc.data&&rpc.data.length){
            pets=rpc.data.filter(function(p){return p.owner_id===ownerUserId;});
          }
        }catch(e){}
      }
      if(error)console.warn('Pet load error:',error);
      if(!pets||!pets.length){
        el.innerHTML='<div style="font-size:0.75rem;color:var(--mid);padding:4px 0;font-style:italic">No pets registered</div>';
        el.setAttribute('data-loaded','1');
        return;
      }
      var h='';
      pets.forEach(function(pet){
        var petAvatar=pet.photo_url?'<img src="'+pet.photo_url+'" style="width:100%;height:100%;object-fit:cover" loading="lazy">':(pet.species==='cat'?'🐱':'🐶');
        h+='<div style="display:flex;align-items:center;gap:8px;padding:5px 4px;border-radius:6px;cursor:pointer;transition:background 0.15s;font-size:0.8rem" onclick="event.stopPropagation();HHP_Customizer.openPetProfile(\''+pet.id+'\')" onmouseover="this.style.background=\'rgba(200,150,62,0.08)\'" onmouseout="this.style.background=\'\'">';
        h+='<div style="width:26px;height:26px;border-radius:50%;background:var(--warm);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;font-size:0.7rem">'+petAvatar+'</div>';
        h+='<div style="flex:1"><span style="font-weight:600">'+pet.name+'</span><span style="color:var(--mid);font-size:0.7rem;margin-left:4px">'+(pet.breed||pet.species||'')+'</span></div>';
        h+='<span style="font-size:0.65rem;color:var(--forest);font-weight:600">View →</span>';
        h+='</div>';
      });
      el.innerHTML=h;
      el.setAttribute('data-loaded','1');
    }catch(e){
      console.warn('Pet fetch failed:',e);
      el.innerHTML='<div style="font-size:0.75rem;color:var(--mid);padding:4px 0;font-style:italic">Could not load pets</div>';
    }
  }
  _R._rwOwnerStaff=async function(sz){
    if(sz!=='full') return _bigNum(0,'staff',sz);
    var sb=_getSB();if(!sb)return'';
    try{var{data}=await sb.from('profiles').select('id,full_name,is_active').eq('role','staff').order('created_at',{ascending:false});
      var active=(data||[]).filter(function(s){return s.is_active;});
      var h=_bigNum(active.length,'active staff',sz);
      if(active.length){h+='<div style="margin-top:10px">';active.slice(0,4).forEach(function(s){h+='<div style="display:flex;align-items:center;gap:8px;padding:8px;margin-bottom:4px;border-bottom:1px solid var(--border);font-size:0.82rem;cursor:pointer;border-radius:6px;transition:background 0.15s" onclick="sTab(\'o\',\'o-staff\')" onmouseover="this.style.background=\'rgba(0,0,0,0.02)\'" onmouseout="this.style.background=\'\'"><span style="font-weight:700;color:var(--forest)">✅</span><span style="font-weight:600">'+s.full_name+'</span></div>';});h+='</div>';}
      return h;
    }catch(e){return'';}
  };
  _R._rwOwnerReviews=async function(sz){
    var sb=_getSB();if(!sb)return'';
    try{var lim=sz==='full'?3:1;var{data}=await sb.from('reviews').select('rating,comment,reviewer_name').order('created_at',{ascending:false}).limit(lim);
      var avg=0;if(data&&data.length){avg=(data.reduce(function(a,r){return a+(r.rating||0);},0)/data.length).toFixed(1);}
      if(sz==='full'){
        var h=_bigNum(data?data.length:0,(avg>0?avg+' avg rating':'no reviews yet'),sz);
        if(data&&data.length){h+='<div style="margin-top:10px">';data.forEach(function(r){h+='<div style="padding:8px;margin-bottom:6px;border-bottom:1px solid var(--border);font-size:0.78rem;cursor:pointer;border-radius:6px;transition:background 0.15s" onclick="sTab(\'o\',\'o-reviews\')" onmouseover="this.style.background=\'rgba(0,0,0,0.02)\'" onmouseout="this.style.background=\'\'"><div style="font-weight:600;margin-bottom:4px">'+('⭐'.repeat(Math.round(r.rating||0)))+' '+(r.reviewer_name||'Client')+'</div>'+(r.comment?'<div style="color:var(--mid);font-size:0.75rem">"'+r.comment.substring(0,100)+(r.comment.length>100?'...':'')+'"</div>':'')+'</div>';});h+='</div>';}
        return h;
      }
      return data.map(function(r){
        return '<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:0.78rem;cursor:pointer" onclick="sTab(\'o\',\'o-reviews\')">'+
          '<div style="display:flex;justify-content:space-between;align-items:center"><span>'+('⭐'.repeat(Math.round(r.rating||0)))+'</span><span style="color:var(--mid);font-size:0.7rem">'+(r.reviewer_name||'Client')+'</span></div></div>';
      }).join('');
    }catch(e){return'';}
  };
  _R._rwOwnerPayments=async function(sz){
    var sb=_getSB();if(!sb)return'';
    try{var{count}=await sb.from('payments').select('id',{count:'exact',head:true}).eq('status','succeeded');
      if(sz==='full'){
        var h=_bigNum(count||0,'payments received',sz);
        var{data}=await sb.from('payments').select('amount,created_at,status').eq('status','succeeded').order('created_at',{ascending:false}).limit(4);
        if(data&&data.length){h+='<div style="margin-top:10px">';data.forEach(function(p){var d=new Date(p.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'});h+='<div style="display:flex;justify-content:space-between;padding:6px;margin-bottom:4px;font-size:0.78rem;border-bottom:1px solid var(--border);cursor:pointer;border-radius:4px;transition:background 0.15s" onclick="sTab(\'o\',\'o-payments\')" onmouseover="this.style.background=\'rgba(0,0,0,0.02)\'" onmouseout="this.style.background=\'\'"><span style="color:var(--mid)">'+d+'</span><span style="font-weight:600;color:var(--forest)">$'+((p.amount||0)).toFixed(2)+'</span></div>';});h+='</div>';h+='<div style="margin-top:10px;text-align:center"><a href="javascript:sTab(\'o\',\'o-payments\')" style="color:var(--forest);font-weight:600;font-size:0.78rem;text-decoration:none;cursor:pointer">View All Payments →</a></div>';}
        return h;
      }
      var{data}=await sb.from('payments').select('amount,created_at').eq('status','succeeded').order('created_at',{ascending:false}).limit(2);
      return data.map(function(p){
        var d=new Date(p.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'});
        return '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.75rem;border-bottom:1px solid var(--border);cursor:pointer" onclick="sTab(\'o\',\'o-payments\')"><span style="color:var(--mid)">'+d+'</span><span style="font-weight:600;color:var(--forest)">$'+((p.amount||0)).toFixed(2)+'</span></div>';
      }).join('');
    }catch(e){return'';}
  };
  _R._rwOwnerDeals=async function(sz){
    var sb=_getSB();if(!sb)return'';
    try{var{data}=await sb.from('deals').select('id,name,discount_value,discount_type,is_active').eq('is_active',true);
      if(sz==='full'){
        var h=_bigNum((data||[]).length,(data&&data.length?'active deals':'no active deals'),sz);
        if(data&&data.length){h+='<div style="margin-top:10px">';data.forEach(function(dl){var disc=dl.discount_type==='percent'?dl.discount_value+'% off':'$'+dl.discount_value+' off';h+='<div style="display:flex;justify-content:space-between;padding:6px;margin-bottom:4px;font-size:0.78rem;border-bottom:1px solid var(--border);cursor:pointer;border-radius:4px;transition:background 0.15s" onclick="sTab(\'o\',\'o-deals\')" onmouseover="this.style.background=\'rgba(0,0,0,0.02)\'" onmouseout="this.style.background=\'\'"><span style="font-weight:600">'+dl.name+'</span><span style="color:var(--forest);font-weight:600">'+disc+'</span></div>';});h+='</div>';}
        return h;
      }
      return _bigNum((data||[]).length,'deals',sz);
    }catch(e){return'';}
  };
  _R._rwOwnerPhotos=async function(sz){
    if(sz!=='full') return _bigNum(0,'photos',sz);
    var sb=_getSB();if(!sb)return'';
    try{
      var{data}=await sb.from('walk_photos').select('photo_url,caption').order('created_at',{ascending:false}).limit(12);
      var{count}=await sb.from('walk_photos').select('id',{count:'exact',head:true});
      var h=_bigNum(count||0,'total photos uploaded',sz);
      if(data&&data.length){h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px">';data.forEach(function(p){h+='<div style="aspect-ratio:1;border-radius:8px;overflow:hidden;background:var(--warm);cursor:pointer;transition:transform 0.15s" onclick="sTab(\'o\',\'o-photos\')" onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'scale(1)\'">'+(p.photo_url?'<img src="'+p.photo_url+'" style="width:100%;height:100%;object-fit:cover;display:block" loading="lazy">':'<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:1.5rem">📷</div>')+'</div>';});h+='</div>';h+='<div style="margin-top:12px;text-align:center"><a href="javascript:sTab(\'o\',\'o-photos\')" style="color:var(--forest);font-weight:600;font-size:0.85rem;text-decoration:none;cursor:pointer">View Full Gallery →</a></div>';}
      return h;
    }catch(e){return'';}
  };
  _R._rwOwnerActivity=async function(sz){
    var sb=_getSB();if(!sb)return'<div style="font-size:0.82rem;color:var(--mid)">Sign in to view activity</div>';
    try{
      var activities=[];
      var maxItems=sz==='full'?8:5;
      // Fetch recent bookings
      var{data:bookings}=await sb.from('booking_requests').select('id,service,contact_name,created_at,status').order('created_at',{ascending:false}).limit(4);
      (bookings||[]).forEach(function(b){
        var statusIcon=b.status==='accepted'?'✅ ':b.status==='canceled'?'❌ ':'';
        activities.push({type:'booking',label:(b.contact_name||'Client')+' — '+statusIcon+(b.service||'Booking'),date:b.created_at});
      });
      // Fetch recent payments
      var{data:payments}=await sb.from('payments').select('amount,client_email,created_at').order('created_at',{ascending:false}).limit(3);
      (payments||[]).forEach(function(p){activities.push({type:'payment',label:'Payment $'+(parseFloat(p.amount)||0).toFixed(2)+(p.client_email?' — '+p.client_email:''),date:p.created_at});});
      // Fetch recent signups
      var{data:signups}=await sb.from('profiles').select('full_name,created_at').eq('role','client').order('created_at',{ascending:false}).limit(2);
      (signups||[]).forEach(function(s){activities.push({type:'signup',label:(s.full_name||'New client')+' signed up',date:s.created_at});});
      // Fetch recent messages (grouped by day)
      var{data:recentMsgs}=await sb.from('messages').select('sender_id,created_at').order('created_at',{ascending:false}).limit(20);
      if(recentMsgs&&recentMsgs.length){
        var msgDays={};
        recentMsgs.forEach(function(m){var day=new Date(m.created_at).toDateString();if(!msgDays[day])msgDays[day]={count:0,date:m.created_at};msgDays[day].count++;});
        Object.values(msgDays).slice(0,2).forEach(function(d){activities.push({type:'message',label:d.count+' message'+(d.count>1?'s':'')+' exchanged',date:d.date});});
      }
      // Fetch recent service reports
      var{data:reports}=await sb.from('service_reports').select('service,pet_name,created_at').order('created_at',{ascending:false}).limit(2);
      (reports||[]).forEach(function(r){activities.push({type:'report',label:'Report: '+(r.service||'Service')+(r.pet_name?' ('+r.pet_name+')':''),date:r.created_at});});

      activities.sort(function(a,b){return new Date(b.date)-new Date(a.date);});

      if(!activities.length) return'<div style="padding:12px;text-align:center;color:var(--mid);font-size:0.82rem">No recent activity yet.</div>';

      var h='';
      h+='<div style="display:flex;flex-direction:column;gap:2px">';
      activities.slice(0,maxItems).forEach(function(a){
        var d=new Date(a.date).toLocaleDateString('en-US',{month:'short',day:'numeric'});
        var icons={booking:'📋',payment:'💳',signup:'👤',message:'💬',report:'📄'};
        var icon=icons[a.type]||'📌';
        h+='<div style="display:flex;gap:8px;padding:7px 4px;border-bottom:1px solid var(--border);font-size:0.78rem;cursor:pointer;border-radius:4px;transition:background 0.15s" onclick="sTab(\'o\',\'o-activity\')" onmouseover="this.style.background=\'rgba(0,0,0,0.03)\'" onmouseout="this.style.background=\'\'">';
        h+='<span style="font-size:0.95rem;flex-shrink:0;margin-top:1px">'+icon+'</span>';
        h+='<div style="flex:1;min-width:0"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+a.label+'</div>';
        h+='<div style="color:var(--mid);font-size:0.68rem">'+d+'</div></div></div>';
      });
      h+='</div>';
      h+='<div style="margin-top:8px;text-align:center"><a href="javascript:sTab(\'o\',\'o-activity\')" style="color:var(--forest);font-weight:600;font-size:0.78rem;text-decoration:none;cursor:pointer">View Full Activity Log →</a></div>';
      return h;
    }catch(e){console.warn('Activity widget error:',e);return'<div style="font-size:0.82rem;color:var(--mid)">Could not load activity</div>';}
  };

  // ── DETAIL RENDERERS ──
  _D._rwClientUpcoming=async function(){
    var sb=_getSB(),u=_getUser();if(!sb||!u)return'No data';
    try{var today=new Date().toISOString().split('T')[0];var{data}=await sb.from('booking_requests').select('*').eq('client_id',u.id).in('status',['accepted','confirmed','modified','payment_hold']).gte('preferred_date',today).order('preferred_date').limit(10);
      if(!data||!data.length)return'<div style="color:var(--mid);padding:16px 0">No upcoming appointments.</div>';
      return data.map(function(b){var d=new Date(b.preferred_date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});var t=(typeof fmt12h==='function')?fmt12h(b.preferred_time||b.time_slot||''):(b.preferred_time||'');return'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)"><div><div style="font-weight:700;font-size:0.9rem">'+b.service+'</div><div style="font-size:0.78rem;color:var(--mid)">'+d+(t?' · '+t:'')+'</div></div><div style="font-size:0.82rem;font-weight:600;color:var(--forest)">$'+(b.estimated_total||0).toFixed(2)+'</div></div>';}).join('');
    }catch(e){return'Could not load';}
  };
  _D._rwOwnerToday=async function(){
    var sb=_getSB();if(!sb)return'';
    try{var today=new Date().toISOString().split('T')[0];var{data}=await sb.from('booking_requests').select('*').in('status',['accepted','confirmed','in_progress','payment_hold']).eq('preferred_date',today).order('preferred_time');
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

    // Kick off preload in background (parallel data fetch)
    if(window.HHP_Preload) HHP_Preload.forPortal(portal);

    // Load prefs in parallel with DOM setup
    var prefsPromise=_loadPrefs();
    _setupOverview(portal);
    _initSidebar(portal);
    await prefsPromise;
    _applySidebarOrder(portal);

    // Render widgets with skeletons first, then fill async
    await _renderWidgets(portal);
    // Give DOM time to paint before firing data loaders to populate widget content
    setTimeout(function(){_retrigger(portal);},300);
    // Safety: retrigger again after a bit in case some loaders weren't ready yet
    setTimeout(function(){_retrigger(portal);},1500);

    // Register realtime callbacks to auto-refresh widgets on data changes
    _hookRealtime(portal);

    console.log('Customizer: ready');
  }

  // Map tables to widgets that need refreshing
  var _tableWidgets={
    booking_requests:{owner:['ow-requests','ow-today','ow-weekstats','ow-banner','ow-activity'],staff:['sw-requests','sw-jobs','sw-stats','sw-cal'],client:['cw-upcoming','cw-stats']},
    messages:{owner:['ow-alerts'],staff:['sw-msgs'],client:['cw-notif','cw-msgs']},
    deals:{owner:['ow-deals'],staff:[],client:[]},
    announcements:{owner:[],staff:[],client:[]},
    payments:{owner:['ow-payments','ow-weekstats'],staff:['sw-earnings'],client:['cw-billing']},
    reviews:{owner:['ow-reviews'],staff:[],client:['cw-reviews']},
    pets:{owner:['ow-clients'],staff:[],client:['cw-pets']},
    profiles:{owner:['ow-clients','ow-staff'],staff:['sw-clients'],client:[]}
  };

  function _hookRealtime(portal){
    if(!window.HHP_Realtime) return;
    // Listen to all table changes and refresh the relevant widgets
    HHP_Realtime.on('*', function(table){
      var wids=(_tableWidgets[table]||{})[portal]||[];
      wids.forEach(function(wid){ _refreshWidget(portal,wid); });
      // Also retrigger stat loaders (they populate by element ID)
      setTimeout(function(){_retrigger(portal);},200);
    });
    console.log('[RT] Customizer hooked for',portal);
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

  // ── PET PROFILE MODAL ──
  async function _openPetProfile(petId){
    var sb=_getSB();if(!sb||!petId)return;
    try{
      var{data:pet}=await sb.from('pets').select('*').eq('id',petId).single();
      if(!pet){if(typeof toast==='function')toast('Pet not found');return;}
      // Get owner info
      var ownerName='';
      if(pet.owner_id){var{data:owner}=await sb.from('profiles').select('full_name').eq('user_id',pet.owner_id).single();if(owner)ownerName=owner.full_name;}
      // Build modal
      var old=document.getElementById('pet-profile-modal');if(old)old.remove();
      var ov=document.createElement('div');ov.id='pet-profile-modal';
      ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9998;opacity:0;transition:opacity 0.25s;display:flex;align-items:flex-end;justify-content:center';
      ov.onclick=function(e){if(e.target===ov){ov.style.opacity='0';sh.style.transform='translateY(100%)';setTimeout(function(){ov.remove();},300);}};
      var sh=document.createElement('div');
      sh.style.cssText='width:100%;max-width:500px;max-height:80vh;background:white;border-radius:20px 20px 0 0;box-shadow:0 -8px 40px rgba(0,0,0,0.18);overflow-y:auto;padding:0 0 env(safe-area-inset-bottom,20px);transform:translateY(100%);transition:transform 0.3s ease';
      var avatar=pet.photo_url?'<img src="'+pet.photo_url+'" style="width:100%;height:100%;object-fit:cover">':'<span style="font-size:2.5rem">'+(pet.species==='cat'?'🐱':'🐶')+'</span>';
      var age='';
      if(pet.birthday){var bd=new Date(pet.birthday);var now=new Date();var years=now.getFullYear()-bd.getFullYear();var months=now.getMonth()-bd.getMonth();if(months<0){years--;months+=12;}age=years>0?years+' yr'+(years>1?'s':'')+(months>0?' '+months+' mo':''):months+' mo';}
      sh.innerHTML=
        '<div style="padding:12px 0 4px;text-align:center;cursor:pointer" onclick="this.closest(\'#pet-profile-modal\').style.opacity=\'0\';this.closest(\'#pet-profile-modal\').querySelector(\'div:last-child\').style.transform=\'translateY(100%)\';setTimeout(function(){var m=document.getElementById(\'pet-profile-modal\');if(m)m.remove();},300)"><div style="width:40px;height:4px;background:#d0c8b8;border-radius:4px;margin:0 auto"></div></div>'+
        '<div style="padding:0 24px 24px">'+
          '<div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">'+
            '<div style="width:70px;height:70px;border-radius:50%;background:var(--gold-pale);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">'+avatar+'</div>'+
            '<div><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.5rem;font-weight:700">'+pet.name+'</div>'+
              (ownerName?'<div style="font-size:0.82rem;color:var(--mid)">Owner: <span style="font-weight:600;color:var(--ink)">'+ownerName+'</span></div>':'')+
            '</div>'+
          '</div>'+
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">'+
            _petInfoTile('Species',pet.species||'—')+
            _petInfoTile('Breed',pet.breed||'—')+
            _petInfoTile('Sex',pet.sex||'—')+
            _petInfoTile('Age',age||'—')+
            _petInfoTile('Weight',(pet.weight?pet.weight+' lbs':'—'))+
            _petInfoTile('Color',pet.color||'—')+
          '</div>'+
          (pet.temperament?'<div style="margin-bottom:12px"><div style="font-weight:700;font-size:0.78rem;color:var(--mid);text-transform:uppercase;margin-bottom:4px">Temperament</div><div style="font-size:0.85rem;color:var(--ink);background:var(--warm);padding:10px;border-radius:8px">'+pet.temperament+'</div></div>':'')+
          (pet.special_needs?'<div style="margin-bottom:12px"><div style="font-weight:700;font-size:0.78rem;color:var(--mid);text-transform:uppercase;margin-bottom:4px">Special Needs</div><div style="font-size:0.85rem;color:var(--ink);background:#fef3c7;padding:10px;border-radius:8px">'+pet.special_needs+'</div></div>':'')+
          (pet.vet_info?'<div style="margin-bottom:12px"><div style="font-weight:700;font-size:0.78rem;color:var(--mid);text-transform:uppercase;margin-bottom:4px">Vet Info</div><div style="font-size:0.85rem;color:var(--ink);background:var(--warm);padding:10px;border-radius:8px">'+pet.vet_info+'</div></div>':'')+
          (pet.notes?'<div style="margin-bottom:12px"><div style="font-weight:700;font-size:0.78rem;color:var(--mid);text-transform:uppercase;margin-bottom:4px">Notes</div><div style="font-size:0.85rem;color:var(--ink);background:var(--warm);padding:10px;border-radius:8px">'+pet.notes+'</div></div>':'')+
        '</div>';
      ov.appendChild(sh);document.body.appendChild(ov);
      requestAnimationFrame(function(){ov.style.opacity='1';sh.style.transform='translateY(0)';});
    }catch(e){console.warn('Pet profile error:',e);if(typeof toast==='function')toast('Could not load pet profile');}
  }
  function _petInfoTile(label,value){
    return '<div style="background:var(--warm);border-radius:8px;padding:8px 10px"><div style="font-size:0.65rem;font-weight:700;color:var(--mid);text-transform:uppercase;margin-bottom:2px">'+label+'</div><div style="font-size:0.88rem;font-weight:600;color:var(--ink)">'+value+'</div></div>';
  }

  // ── PUBLIC API ──
  window.HHP_Customizer={
    init:function(){_initialized=false;init();},
    toggleEdit:_toggleEdit,
    toggleW:_toggleWidget,
    setSize:function(p,w,s){
      if(!_prefs[p])_prefs[p]={sidebar_order:[],widgets:[],sizes:{}};
      if(!_prefs[p].sizes)_prefs[p].sizes={};
      _prefs[p].sizes[w]=s;_savePrefs(p);
      // Re-render just the one widget that changed size, not the entire grid
      var grid=document.getElementById('cust-grid-'+p);
      if(!grid){_renderWidgets(p).then(function(){_retrigger(p);});return;}
      var el=grid.querySelector('[data-wid="'+w+'"]');
      var wDef=(WIDGETS[p]||[]).find(function(x){return x.wid===w;});
      if(!el||!wDef){_renderWidgets(p).then(function(){_retrigger(p);});return;}
      var renderer=_R[wDef.renderFn];
      if(!renderer){return;}
      renderer(s).then(function(body){
        var tmp=document.createElement('div');
        tmp.innerHTML=_card(p,wDef,body,s);
        var newCard=tmp.firstChild;
        el.replaceWith(newCard);
        // Re-trigger data loaders so dynamic IDs inside the new card get populated
        setTimeout(function(){_retrigger(p);},200);
      });
    },
    resetLayout:_resetLayout,
    detail:_detail,
    closeDetail:_closeDetail,
    openPetProfile:_openPetProfile,
    togglePets:_togglePets,
    refresh:function(){var p=_getPortal();if(p)_renderWidgets(p).then(function(){_retrigger(p);});},
    refreshWidget:function(wid){var p=_getPortal();if(p)_refreshWidget(p,wid);},
    refreshAll:function(){var p=_getPortal();if(p){_refreshAll(p);setTimeout(function(){_retrigger(p);},200);}},
    // Mobile drawer edit mode — reorder portal sidebar items only
    _toggleSidebarEditMobile:function(portal,drawer){
      var btn=document.getElementById('mob-sb-edit-btn');
      // ONLY target portal sidebar items, NOT Switch View buttons
      var items=drawer?drawer.querySelectorAll('.hhp-drawer-portal-item'):[];
      if(!items.length)return;
      var isEditing=btn&&btn.getAttribute('data-editing')==='1';

      if(isEditing){
        // ── SAVE & EXIT ──
        if(btn){btn.setAttribute('data-editing','0');btn.textContent='✏️ Edit Order';btn.style.background='#f5f0e8';btn.style.color='#5c3d1e';btn.style.borderColor='#d4c4ad';}
        var order=[];
        if(drawer){drawer.querySelectorAll('.hhp-drawer-portal-item[data-panel]').forEach(function(it){order.push(it.getAttribute('data-panel'));});}
        if(order.length){
          if(!_prefs[portal])_prefs[portal]={sidebar_order:[],widgets:[],sizes:{}};
          _prefs[portal].sidebar_order=order;_savePrefs(portal);
          _applySidebarOrder(portal);
        }
        // Clean up edit styling
        items.forEach(function(it){
          var h=it.querySelector('.mob-drag-handle');if(h)h.remove();
          it.style.outline='';it.style.cursor='';it.style.userSelect='';it.style.webkitUserSelect='';it.style.touchAction='';
          if(it._mobDown){it.removeEventListener('pointerdown',it._mobDown);delete it._mobDown;}
          // Re-enable click navigation
          it.style.pointerEvents='';
        });
        // Remove the global move/end listeners if lingering
        if(drawer._mobMoveHandler){document.removeEventListener('pointermove',drawer._mobMoveHandler);delete drawer._mobMoveHandler;}
        if(drawer._mobEndHandler){document.removeEventListener('pointerup',drawer._mobEndHandler);delete drawer._mobEndHandler;}
        if(typeof toast==='function')toast('✓ Order saved');
      }else{
        // ── ENTER EDIT MODE ──
        if(btn){btn.setAttribute('data-editing','1');btn.textContent='💾 Save Order';btn.style.background='#c8963e';btn.style.color='#fff';btn.style.borderColor='#c8963e';}

        // Shared drag state — only one item can be dragged at a time
        var drag={active:false,el:null,ph:null,offsetY:0};

        // Global move handler (shared)
        function onMove(ev){
          if(!drag.active||!drag.el)return;ev.preventDefault();
          drag.el.style.top=(ev.clientY-drag.offsetY)+'px';
          // Find drop position among portal items + placeholder
          var targets=Array.from(drawer.querySelectorAll('.hhp-drawer-portal-item:not([style*="position:fixed"]):not([style*="position: fixed"]),.mob-drag-ph'));
          for(var j=0;j<targets.length;j++){
            if(targets[j]===drag.ph)continue;
            var mid=targets[j].getBoundingClientRect().top+targets[j].offsetHeight/2;
            if(ev.clientY<mid){targets[j].parentElement.insertBefore(drag.ph,targets[j]);return;}
          }
          // Past all items — append placeholder at end
          var lastItem=targets[targets.length-1];
          if(lastItem&&lastItem.parentElement)lastItem.parentElement.insertBefore(drag.ph,lastItem.nextSibling);
        }

        // Global end handler (shared)
        function onEnd(){
          if(!drag.active||!drag.el)return;
          // Place the dragged item where the placeholder is
          if(drag.ph&&drag.ph.parentElement){drag.ph.parentElement.insertBefore(drag.el,drag.ph);drag.ph.remove();}
          // Reset inline drag styles
          ['position','left','top','width','z-index','box-shadow','opacity','pointer-events','background','transform'].forEach(function(p2){drag.el.style.removeProperty(p2);});
          drag.el.style.outline='1px dashed #d4c4ad';drag.el.style.cursor='grab';
          drag.active=false;drag.el=null;drag.ph=null;
        }

        // Store handlers on drawer so we can clean up on save
        drawer._mobMoveHandler=onMove;drawer._mobEndHandler=onEnd;
        document.addEventListener('pointermove',onMove);
        document.addEventListener('pointerup',onEnd);

        items.forEach(function(it){
          // Add drag handle icon
          if(!it.querySelector('.mob-drag-handle')){
            var h=document.createElement('span');h.className='mob-drag-handle';h.innerHTML='☰ ';
            h.style.cssText='color:#8c6b4a;margin-right:8px;font-size:0.95rem;flex-shrink:0';
            it.insertBefore(h,it.firstChild);
          }
          it.style.outline='1px dashed #d4c4ad';it.style.cursor='grab';
          it.style.userSelect='none';it.style.webkitUserSelect='none';it.style.touchAction='none';

          // Disable click navigation while editing (clicks shouldn't open panels)
          it.style.pointerEvents='auto';

          it._mobDown=function(e){
            // Don't start a new drag if one is already active
            if(drag.active)return;
            e.preventDefault();e.stopPropagation();
            drag.active=true;drag.el=it;
            var r=it.getBoundingClientRect();drag.offsetY=e.clientY-r.top;
            // Create placeholder
            var ph=document.createElement('div');ph.className='mob-drag-ph';
            ph.style.cssText='height:'+r.height+'px;background:rgba(200,150,62,0.1);border:1.5px dashed rgba(200,150,62,0.4);border-radius:8px;margin:2px 20px';
            drag.ph=ph;it.parentElement.insertBefore(ph,it);
            // Float the dragged item
            it.style.position='fixed';it.style.left=r.left+'px';it.style.top=r.top+'px';
            it.style.width=r.width+'px';it.style.zIndex='10000';
            it.style.boxShadow='0 8px 28px rgba(0,0,0,0.25)';it.style.opacity='0.95';
            it.style.background='#fff';it.style.transform='scale(1.02)';
            it.style.pointerEvents='none';
          };
          it.addEventListener('pointerdown',it._mobDown);
        });
      }
    }
  };

})();
