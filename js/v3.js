(() => {
'use strict';
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = (v) => {try {const u=new URL(v); return u.protocol === 'https:' ? u.href : '';}catch{return '';}};
const state = { user:null, library:[], theme:localStorage.getItem('novel-v3-theme') || 'dark', books:[], total:0, book:null, chapter:null, query:'',genre:'', sort:'updated' };
let renderRequest = 0;
const app = $('#app');
const route = () => decodeURIComponent(location.hash.slice(1) || '/').split('/').filter(Boolean);
const link = (book, num) => '#/read/' + encodeURIComponent(book) + '/' + encodeURIComponent(num);
const cover = b => {const url=safeUrl(b.cover);return '<div class="cover">'+(url?'<img loading="lazy" src="'+esc(url)+'" alt="Bìa '+esc(b.title)+'">':'<div class="cover-fallback">'+esc(b.title)+'</div>')+'<span class="pill">'+esc(b.status)+'</span></div>';};
const card = b => '<a class="book-card" href="#/book/'+encodeURIComponent(b.id)+'">'+cover(b)+'<h3 class="book-title">'+esc(b.title)+'</h3><div class="book-meta">'+esc(b.author)+' · '+Number(b.chapter_count||0)+' chương</div><div class="tag-row">'+(b.genres||[]).slice(0,2).map(g=>'<span class="tag">'+esc(g)+'</span>').join('')+'</div></a>';
function toast(message){const el=$('#toast');el.textContent=message;el.classList.remove('hidden');clearTimeout(toast.timeout);toast.timeout=setTimeout(()=>el.classList.add('hidden'),3500);}
function getCsrf(){const part=document.cookie.split('; ').find(v=>v.startsWith('novel_csrf='));return part?decodeURIComponent(part.slice('novel_csrf='.length)):'';}
async function request(path, options={}){
 const method=options.method||'GET';
 const headers={'Accept':'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(method==='GET'?{}:{'X-CSRF-Token':getCsrf()})};
 const res=await fetch('/api'+path,{credentials:'same-origin',...options,headers:{...headers,...options.headers}});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw new Error(typeof data.detail==='string'?data.detail:'Yêu cầu thất bại ('+res.status+')');
 return data;
}
async function loadUser(){try{state.user=await request('/auth/me');state.library=await request('/me/library');}catch{state.user=null;state.library=[];}updateHeader();}
function updateHeader(){$('#authButton').textContent=state.user?state.user.email:'Đăng nhập';$('#logoutButton').classList.toggle('hidden',!state.user);}
function placeholder(label){app.innerHTML='<div class="page"><p class="back-link"><a href="#/">← Trang chủ</a></p><div class="empty">'+esc(label)+'</div></div>';}
async function showHome(){
 const seq=++renderRequest;
 app.innerHTML='<div class="loading">Đang tải các câu chuyện…</div>';
 try{
   const search=new URLSearchParams({q:state.query,genre:state.genre,sort:state.sort,limit:'100'});
   const data=await request('/books?'+search);
   if(seq!==renderRequest)return;
   state.books=data.items;state.total=data.total;
   const genres=[...new Set(data.items.flatMap(b=>b.genres||[]))].sort();
   app.innerHTML='<div class="page"><section class="hero"><div><span class="eyebrow">KHÔNG GIAN CỦA NHỮNG CÂU CHUYỆN</span><h1>Mở một trang sách.<br>Chạm ngàn thế giới.</h1><p>Thả mình vào những cuộc phiêu lưu không giới hạn, khám phá tác phẩm yêu thích và lưu lại hành trình đọc của riêng bạn.</p><div class="hero-buttons"><a href="#/" class="primary-btn" id="exploreHero">Khám phá ngay ↗</a><a href="#/library" class="ghost-btn">Thư viện của tôi</a></div></div><div class="hero-quote" aria-hidden="true"><div class="quote-book"><span>✦</span><strong>Every story<br>begins here</strong></div></div></section><section id="catalog"><div class="section-head"><h2>Khám phá truyện hay</h2><span class="muted">'+data.total+' tác phẩm</span></div><div class="search-row"><label class="search-box"><input id="search" type="search" aria-label="Tìm truyện, tác giả" placeholder="Tìm tên truyện hoặc tác giả..." value="'+esc(state.query)+'"></label><select class="filter-select" id="genre" aria-label="Lọc thể loại"><option value="">Mọi thể loại</option>'+genres.map(g=>'<option '+(g===state.genre?'selected':'')+' value="'+esc(g)+'">'+esc(g)+'</option>').join('')+'</select><select class="filter-select" id="sort" aria-label="Sắp xếp"><option value="updated" '+(state.sort==='updated'?'selected':'')+'>Mới cập nhật</option><option value="popular" '+(state.sort==='popular'?'selected':'')+'>Phổ biến</option><option value="title" '+(state.sort==='title'?'selected':'')+'>Tên A–Z</option></select></div><div class="section-head"><span class="muted">Chọn một câu chuyện để bắt đầu</span></div><div class="book-grid" id="bookGrid">'+(data.items.length?data.items.map(card).join(''):'<p class="empty">Không tìm thấy truyện phù hợp.</p>')+'</div></section></div>';
   let timer;$('#search').addEventListener('input',e=>{const val=e.target.value;clearTimeout(timer);timer=setTimeout(()=>{state.query=val;showHome();},350);});
   $('#genre').addEventListener('change',e=>{state.genre=e.target.value;showHome();});
   $('#sort').addEventListener('change',e=>{state.sort=e.target.value;showHome();});
 }catch(err){if(seq===renderRequest)placeholder('Không thể tải danh mục: '+err.message);}
}
async function showBook(id){
 const seq=++renderRequest;app.innerHTML='<div class="loading">Đang tải thông tin…</div>';
 try{
  const b=await request('/books/'+encodeURIComponent(id));if(seq!==renderRequest)return;state.book=b;
  let saved=state.library.some(item=>item.id===b.id);let number=b.chapters[0]?.number;
  let progress=null;if(state.user)try{progress=await request('/me/progress/'+encodeURIComponent(id));}catch{}
  if(seq!==renderRequest)return;
  app.innerHTML='<div class="page"><a class="back-link" href="#/">← Quay lại khám phá</a><section class="detail">'+cover(b)+'<div><span class="eyebrow">LIGHT NOVEL · '+b.chapter_count+' CHƯƠNG</span><h1>'+esc(b.title)+'</h1><span class="muted">Tác giả: '+esc(b.author)+'</span><div class="tag-row">'+b.genres.map(g=>'<span class="tag">'+esc(g)+'</span>').join('')+'</div><div class="detail-info"><div><span class="muted">Trạng thái</span><strong>'+esc(b.status)+'</strong></div><div><span class="muted">Lượt xem giới thiệu</span><strong>'+Number(b.views).toLocaleString('vi-VN')+'</strong></div></div><div class="detail-buttons">'+(number?'<a class="primary-btn" href="'+link(b.id,progress.chapter_number||number)+'">'+(progress.chapter_number?'Đọc tiếp':'Bắt đầu đọc')+' ↗</a>':'')+'<button class="outline-btn" type="button" id="followBtn">'+(saved?'♥ Đang theo dõi':'♡ Theo dõi')+'</button></div><p class="detail-description">'+esc(b.description)+'</p></div></section><section><div class="section-head"><h2>Danh sách chương</h2><span class="muted">'+b.chapters.length+' chương</span></div><div class="chapter-list">'+(b.chapters.length?b.chapters.map(ch=>'<a class="chapter-item" href="'+link(b.id,ch.number)+'"><strong>'+esc(ch.title)+'</strong><span>Chương '+ch.number+' ↗</span></a>').join(''):'<div class="empty">Truyện chưa có chương.</div>')+'</div></section></div>';
  $('#followBtn').onclick=async()=>{if(!state.user){openAuth();return;}try{await request('/me/library/'+encodeURIComponent(b.id),{method:saved?'DELETE':'PUT'});await loadUser();saved=!saved;$('#followBtn').textContent=saved?'♥ Đang theo dõi':'♡ Theo dõi';toast(saved?'Đã thêm vào thư viện':'Đã bỏ theo dõi');}catch(e){toast(e.message);}};
 }catch(err){if(seq===renderRequest)placeholder(err.message);}
}
async function showReader(bookId,num){
 const seq=++renderRequest;app.innerHTML='<div class="loading">Đang mở chương truyện…</div>';
 try{
 const [b,ch]=await Promise.all([request('/books/'+encodeURIComponent(bookId)),request('/books/'+encodeURIComponent(bookId)+'/chapters/'+num)]);
 if(seq!==renderRequest)return;
 const chapters=b.chapters,idx=chapters.findIndex(x=>x.number===ch.number);if(idx<0)throw new Error('Chương không tồn tại');
 const key='novel-reader-settings';let settings={};try{settings=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{}
 const theme=['light','sepia','dark'].includes(settings.theme)?settings.theme:'dark';
 const size=Number.isInteger(settings.size)?Math.min(26,Math.max(14,settings.size)):18;
 const markdown=typeof window.markdownit==='function'?window.markdownit({html:false,linkify:false,typographer:true}).render(ch.markdown):'<pre>'+esc(ch.markdown)+'</pre>';
 app.innerHTML='<div class="reader-shell"><a href="#/book/'+encodeURIComponent(bookId)+'" class="back-link">← '+esc(b.title)+'</a><div class="reader-head"><div><span class="eyebrow">CHƯƠNG '+ch.number+' / '+chapters.length+'</span><h2>'+esc(ch.title)+'</h2></div><div class="reader-toolbar"><label for="readerTheme" class="muted">Nền</label><select id="readerTheme"><option value="dark">Tối</option><option value="sepia">Giấy</option><option value="light">Sáng</option></select><label class="muted" for="readerSize">Chữ</label><select id="readerSize">'+[14,16,18,20,22,24,26].map(n=>'<option value="'+n+'">'+n+'px</option>').join('')+'</select></div></div><article class="reading-surface '+theme+'" id="readingSurface"><h1>'+esc(ch.title)+'</h1><div class="chapter-body" id="chapterBody" style="font-size:'+size+'px">'+markdown+'</div></article><div class="reader-nav"><button class="outline-btn" id="prevBtn" '+(idx===0?'disabled':'')+'>← Chương trước</button><button class="primary-btn" id="nextBtn" '+(idx===chapters.length-1?'disabled':'')+'>Chương tiếp →</button></div></div>';
 $('#readerTheme').value=theme;$('#readerSize').value=size;
 function save(){localStorage.setItem(key,JSON.stringify({theme:$('#readerTheme').value,size:Number($('#readerSize').value)}));}
 $('#readerTheme').onchange=e=>{const el=$('#readingSurface');el.classList.remove('dark','light','sepia');el.classList.add(e.target.value);save();};
 $('#readerSize').onchange=e=>{$('#chapterBody').style.fontSize=e.target.value+'px';save();};
 $('#prevBtn').onclick=()=>{if(idx>0)location.hash=link(bookId,chapters[idx-1].number);};
 $('#nextBtn').onclick=()=>{if(idx+1<chapters.length)location.hash=link(bookId,chapters[idx+1].number);};
 if(state.user)request('/me/progress/'+encodeURIComponent(bookId),{method:'PUT',body:JSON.stringify({chapter_number:ch.number})}).catch(()=>{});
 window.scrollTo({top:0});
 }catch(err){if(seq===renderRequest)placeholder(err.message);}
}
async function showLibrary(){
 const seq=++renderRequest;if(!state.user){placeholder('Đăng nhập để lưu và đồng bộ thư viện đọc của bạn.');const btn=document.createElement('button');btn.className='primary-btn';btn.textContent='Đăng nhập';btn.onclick=openAuth;app.querySelector('.empty').append(btn);return;}
 app.innerHTML='<div class="loading">Đang tải thư viện cá nhân…</div>';
 try{const items=await request('/me/library');if(seq!==renderRequest)return;state.library=items;app.innerHTML='<div class="page"><div class="section-head"><h2>Thư viện của tôi</h2><span class="muted">'+items.length+' truyện đã lưu</span></div>'+(items.length?'<div class="book-grid">'+items.map(card).join('')+'</div>':'<div class="empty">Chưa có truyện được theo dõi. <a href="#/">Khám phá ngay ↗</a></div>')+'</div>';}catch(e){if(seq===renderRequest)placeholder(e.message);}
}
function openAuth(){const d=$('#authDialog');$('#authError').textContent='';d.showModal();}
let mode='login';
$('#authButton').onclick=()=>{if(state.user){location.hash='#/library';return;}openAuth();};
$('#closeAuth').onclick=()=>$('#authDialog').close();
$('#authSwitch').onclick=()=>{mode=mode==='login'?'register':'login';$('#authTitle').textContent=mode==='login'?'Đăng nhập':'Tạo tài khoản';$('#authSubmit').textContent=$('#authTitle').textContent;$('#authSwitch').textContent=mode==='login'?'Chưa có tài khoản? Đăng ký':'Đã có tài khoản? Đăng nhập';$('#authError').textContent='';};
$('#authForm').onsubmit=async(e)=>{e.preventDefault();const f=new FormData(e.currentTarget);const submit=$('#authSubmit');submit.disabled=true;try{await request('/auth/'+mode,{method:'POST',body:JSON.stringify({email:f.get('email'),password:f.get('password')})});$('#authDialog').close();e.currentTarget.reset();await loadUser();await navigate();toast('Chào mừng bạn đến Novel Atelier!');}catch(err){$('#authError').textContent=err.message;}finally{submit.disabled=false;}};
$('#logoutButton').onclick=async()=>{try{await request('/auth/logout',{method:'POST'});}catch(e){toast(e.message);return;}state.user=null;state.library=[];updateHeader();location.hash='#/';navigate();};
$('#themeToggle').onclick=()=>{state.theme=state.theme==='dark'?'light':'dark';document.body.classList.toggle('light',state.theme==='light');localStorage.setItem('novel-v3-theme',state.theme);$('#themeToggle').textContent=state.theme==='light'?'☀':'☾';};
document.body.classList.toggle('light',state.theme==='light');$('#themeToggle').textContent=state.theme==='light'?'☀':'☾';
async function navigate(){const r=route();$('#navExplore').classList.toggle('active',!r.length);$('#navLibrary').classList.toggle('active',r[0]==='library');if(!r.length)return showHome();if(r[0]==='book'&&r.length===2)return showBook(r[1]);if(r[0]==='read'&&r.length===3&&/^[0-9]+$/.test(r[2]))return showReader(r[1],Number(r[2]));if(r[0]==='library')return showLibrary();placeholder('Đường dẫn không tồn tại.');}
window.addEventListener('hashchange',navigate);
loadUser().then(navigate);
})();