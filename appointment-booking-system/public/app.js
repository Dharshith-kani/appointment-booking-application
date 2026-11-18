const $ = (id) => document.getElementById(id);
const state = { token: localStorage.getItem("OpenSlot_token"), user: JSON.parse(localStorage.getItem("OpenSlot_user") || "null"),
  register:false, month:new Date(new Date().getFullYear(),new Date().getMonth(),1), selectedDate:null, selectedSlot:null, slots:[] };
const api = async (url, options={}) => {
  const headers = { "Content-Type":"application/json", ...(state.token ? {Authorization:`Bearer ${state.token}`} : {}), ...(options.headers||{}) };
  const response = await fetch(`/api${url}`, {...options, headers});
  const data = await response.json().catch(()=>({message:"Unexpected server response."}));
  if (!response.ok) throw new Error(data.message || "Request failed.");
  return data;
};
function toast(message, error=false){const el=$("toast");el.textContent=message;el.className=`toast show${error?" error":""}`;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.className="toast",3000);}
function setSession(data){state.token=data.token;state.user=data.user;localStorage.setItem("OpenSlot_token",state.token);localStorage.setItem("OpenSlot_user",JSON.stringify(state.user));showDashboard();}
function showAuth(){ $("authView").hidden=false;$("dashboardView").hidden=true; }
function showDashboard(){
  $("authView").hidden=true;$("dashboardView").hidden=false;
  const user=state.user;const initial=(user.name||"U").charAt(0).toUpperCase();
  $("profileName").textContent=user.name;$("profileRole").textContent=user.role==="admin"?"Administrator":"Member";
  $("avatar").textContent=initial;$("topAvatar").textContent=initial;
  $("topGreeting").textContent=`Good ${new Date().getHours()<12?"morning":new Date().getHours()<17?"afternoon":"evening"}, ${user.name.split(" ")[0]}`;
  $("todayLabel").textContent=new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
  if(user.role==="admin"){ $("navLinks").innerHTML='<button class="nav-link active" data-page="admin"><span>▦</span> Admin overview</button>';showPage("admin");loadAdmin();}
  else { $("navLinks").innerHTML='<button class="nav-link active" data-page="book"><span>▦</span> Book an appointment</button><button class="nav-link" data-page="history"><span>◷</span> My appointments</button>';showPage("book");loadSlots();}
}
function showPage(page){
  $("userBookPage").hidden=page!=="book";$("userHistoryPage").hidden=page!=="history";$("adminPage").hidden=page!=="admin";
  $("pageCrumb").textContent=page==="book"?"Book an appointment":page==="history"?"My appointments":"Admin overview";
  document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  if(page==="history")loadHistory();if(page==="book")renderCalendar();
}
$("navLinks").addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b)showPage(b.dataset.page);});
function renderAuthMode(){
  $("nameField").hidden=!state.register;
  $("authEyebrow").textContent=state.register?"GET STARTED":"WELCOME BACK";
  $("authTitle").textContent=state.register?"Create your account":"Sign in to OpenSlot";
  $("authSubtitle").textContent=state.register?"A more thoughtful way to manage your time.":"Your time, thoughtfully managed.";
  $("authSubmit").innerHTML=state.register?'Create account <span>→</span>':'Sign in <span>→</span>';
  $("switchAuth").innerHTML=state.register?'Already have an account? <button class="text-btn" id="toggleAuth" type="button">Sign in</button>':'New to OpenSlot? <button class="text-btn" id="toggleAuth" type="button">Create an account</button>';
}
$("switchAuth").addEventListener("click",e=>{if(e.target.id==="toggleAuth"){state.register=!state.register;renderAuthMode();}});
$("authForm").onsubmit=async e=>{e.preventDefault();try{const body={email:$("email").value,password:$("password").value};let url="/auth/login";if(state.register){body.name=$("name").value;url="/auth/register";}setSession(await api(url,{method:"POST",body:JSON.stringify(body)}));}catch(err){toast(err.message,true);}};
$("logoutBtn").onclick=()=>{state.token=null;state.user=null;localStorage.removeItem("OpenSlot_token");localStorage.removeItem("OpenSlot_user");showAuth();};
$("profileButton").onclick=()=>toast(`Signed in as ${state.user.email}`);
function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function prettyDate(date,opts={weekday:"long",day:"numeric",month:"long"}){return new Date(date+"T12:00:00").toLocaleDateString("en-IN",opts);}
async function loadSlots(){
 try{const data=await api("/slots");state.slots=data.slots;renderCalendar();}catch(e){toast(e.message,true);}
}
function renderCalendar(){
 const month=state.month;const year=month.getFullYear(),m=month.getMonth();$("monthLabel").textContent=month.toLocaleDateString("en-IN",{month:"long",year:"numeric"});
 const first=new Date(year,m,1),offset=(first.getDay()+6)%7,days=new Date(year,m+1,0).getDate(),today=dateKey(new Date());
 const available=new Set(state.slots.filter(s=>!s.booked).map(s=>s.date));let html="";
 for(let i=0;i<offset;i++)html+='<span></span>';
 for(let d=1;d<=days;d++){const date=dateKey(new Date(year,m,d));const isOld=date<today;const has=available.has(date);const selected=state.selectedDate===date;html+=`<button class="day ${has?"available":""} ${selected?"selected":""} ${date===today?"today":""}" data-date="${date}" ${isOld||!has?"disabled":""}>${d}</button>`;}
 $("calendarGrid").innerHTML=html;
}
$("calendarGrid").onclick=e=>{const b=e.target.closest("[data-date]");if(!b)return;state.selectedDate=b.dataset.date;state.selectedSlot=null;renderCalendar();renderSlots();};
function renderSlots(){
 const date=state.selectedDate;const slots=state.slots.filter(s=>s.date===date);$("selectedDateText").textContent=prettyDate(date,{weekday:"short",day:"numeric",month:"short"});
 $("bookingSummary").hidden=true;
 if(!slots.length){$("slotList").innerHTML='<div class="empty-state">No time slots available on this date.</div>';return;}
 $("slotList").innerHTML=slots.map(s=>`<button class="slot-btn ${state.selectedSlot?.id===s.id?"selected":""}" data-slot="${s.id}" ${s.booked?"disabled":""}><span>${s.start_time} – ${s.end_time}</span><small>${s.booked?"Booked":"Select"}</small></button>`).join("");
}
$("slotList").onclick=e=>{const b=e.target.closest("[data-slot]");if(!b)return;state.selectedSlot=state.slots.find(s=>s.id===Number(b.dataset.slot));renderSlots();$("bookingSummary").hidden=false;$("summaryTime").textContent=`${state.selectedSlot.start_time} – ${state.selectedSlot.end_time}`;};
$("prevMonth").onclick=()=>{const n=new Date(state.month);n.setMonth(n.getMonth()-1);if(n>=new Date(new Date().getFullYear(),new Date().getMonth(),1)){state.month=n;renderCalendar();}};
$("nextMonth").onclick=()=>{state.month=new Date(state.month.getFullYear(),state.month.getMonth()+1,1);renderCalendar();};
$("continueBooking").onclick=()=>{if(!state.selectedSlot)return;$("modalDateTime").textContent=`${prettyDate(state.selectedSlot.date)} · ${state.selectedSlot.start_time} – ${state.selectedSlot.end_time}`;$("bookingModal").hidden=false;};
$("closeModal").onclick=()=> $("bookingModal").hidden=true;
$("bookingModal").onclick=e=>{if(e.target.id==="bookingModal")$("bookingModal").hidden=true;};
$("confirmForm").onsubmit=async e=>{e.preventDefault();try{const data=await api("/appointments",{method:"POST",body:JSON.stringify({slotId:state.selectedSlot.id,reason:$("reason").value})});$("bookingModal").hidden=true;$("reason").value="";toast(data.message);state.selectedSlot=null;await loadSlots();}catch(err){toast(err.message,true);await loadSlots();}};
async function loadHistory(){
 try{const {appointments}=await api("/appointments/mine");$("historyCount").textContent=`${appointments.length} booking${appointments.length===1?"":"s"}`;
 if(!appointments.length){$("historyList").innerHTML='<div class="empty-state">You have no appointments yet.<br>Choose a date and book your first slot.</div>';return;}
 $("historyList").innerHTML=appointments.map(a=>`<div class="history-row"><div class="row-date"><b>${prettyDate(a.date,{day:"numeric",month:"short",year:"numeric"})}</b><small>${a.start_time} – ${a.end_time}</small></div><div class="row-info"><b>${a.reason||"Appointment"}</b><small>Booking #${a.id}</small></div><span class="status ${a.status}">${a.status}</span><div class="row-actions">${["pending","approved"].includes(a.status)?`<button class="mini-btn danger" data-cancel="${a.id}">Cancel</button>`:""}</div></div>`).join("");
 }catch(e){toast(e.message,true);}
}
$("historyList").onclick=async e=>{const b=e.target.closest("[data-cancel]");if(!b)return;if(!confirm("Cancel this appointment?"))return;try{const d=await api(`/appointments/${b.dataset.cancel}/cancel`,{method:"PATCH"});toast(d.message);loadHistory();}catch(err){toast(err.message,true);}};
async function loadAdmin(){
 try{
 const [{stats},{appointments},{slots}]=await Promise.all([api("/admin/overview"),api("/admin/appointments"),api("/slots")]);
 $("statTotal").textContent=stats.total;$("statPending").textContent=stats.pending;$("statApproved").textContent=stats.approved;$("statSlots").textContent=stats.slots;
 renderAdminAppointments(appointments);renderAdminSlots(slots);$("slotDate").min=dateKey(new Date());
 }catch(e){toast(e.message,true);}
}
function renderAdminAppointments(items){
 if(!items.length){$("adminAppointments").innerHTML='<div class="empty-state">No appointment requests yet.</div>';return;}
 $("adminAppointments").innerHTML=items.map(a=>`<div class="admin-row"><div class="row-info"><b>${a.name}</b><small>${a.email}</small><small>${prettyDate(a.date,{day:"numeric",month:"short"})} · ${a.start_time}</small></div><span class="status ${a.status}">${a.status}</span><div class="row-actions">${a.status==="pending"?`<button class="mini-btn" data-status="approved" data-id="${a.id}">Approve</button><button class="mini-btn danger" data-status="rejected" data-id="${a.id}">Reject</button>`:`<button class="mini-btn" data-status="pending" data-id="${a.id}">Reopen</button>`}</div></div>`).join("");
}
function renderAdminSlots(slots){
 const upcoming=slots.filter(s=>s.date>=dateKey(new Date()));
 if(!upcoming.length){$("adminSlots").innerHTML='<div class="empty-state">No upcoming availability.</div>';return;}
 $("adminSlots").innerHTML=upcoming.map(s=>`<div class="slot-admin-row"><div><b>${prettyDate(s.date,{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</b><small>${s.start_time} – ${s.end_time} ${s.booked?"· Booked":"· Available"}</small></div><button class="mini-btn danger" data-remove-slot="${s.id}">Remove</button></div>`).join("");
}
$("adminAppointments").onclick=async e=>{const b=e.target.closest("[data-status]");if(!b)return;try{const d=await api(`/admin/appointments/${b.dataset.id}`,{method:"PATCH",body:JSON.stringify({status:b.dataset.status})});toast(d.message);loadAdmin();}catch(err){toast(err.message,true);}};
$("adminSlots").onclick=async e=>{const b=e.target.closest("[data-remove-slot]");if(!b)return;if(!confirm("Remove this availability slot?"))return;try{const d=await api(`/admin/slots/${b.dataset.removeSlot}`,{method:"DELETE"});toast(d.message);loadAdmin();}catch(err){toast(err.message,true);}};
$("slotForm").onsubmit=async e=>{e.preventDefault();try{const d=await api("/admin/slots",{method:"POST",body:JSON.stringify({date:$("slotDate").value,startTime:$("startTime").value,endTime:$("endTime").value})});toast(d.message);$("slotForm").reset();$("startTime").value="09:00";$("endTime").value="09:30";loadAdmin();}catch(err){toast(err.message,true);}};
$("refreshAdmin").onclick=loadAdmin;
if(state.token&&state.user){api("/me").then(()=>showDashboard()).catch(()=>{state.token=null;state.user=null;localStorage.removeItem("OpenSlot_token");localStorage.removeItem("OpenSlot_user");showAuth();});}else showAuth();
