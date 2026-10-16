(() => {
'use strict';
const $ = selector => document.querySelector(selector);
const feedback = msg => {$('#adminFeedback').textContent=msg;};
let currentId=null,books=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const csrf=()=>{const value=document.cookie.split('; ').find(p=>p.startsWith('novel_csrf='));return value?decodeURIComponent(value.slice(11)):'';};
async function api(path,method='GET',body=null){
 const headers={'Accept':'application/json',...(body?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{'X-CSRF-Token':csrf()}:{})};
 const resp=await fetch('/api'+path,{method,headers,body:body?JSON.stringify(body):null,credentials:'same-origin'});
 const result=await resp.json().catch(()=>({}));
 if(!resp.ok)throw Error(typeof result.detail==='string'?result.detail:'Không thể thực hiện thao tác');
 return result;
}
async function load(){
 try{
 const user=await api('/auth/me');if(user.role!=='admin')throw Error('Tài khoản không có quyền quản trị. Liên hệ người vận hành máy chủ.');
 $('#studio').classList.remove('hidden');
 const data=await api('/books?limit=100');books=data.items;
 $('#bookSelect').innerHTML=books.map(b=>'<option value="'+esc(b.id)+'">'+esc(b.title)+'</option>').join('');
 $('#bookRows').innerHTML=books.map(b=>'<div class="chapter-item"><span>'+esc(b.title)+' · '+esc(b.id)+'</span><button class="outline-btn" type="button" data-edit="'+esc(b.id)+'">Sửa</button></div>').join('');
 document.querySelectorAll('[data-edit]').forEach(btn=>btn.onclick=()=>edit(btn.dataset.edit));
 feedback('Đã tải '+books.length+' truyện. Nội dung lưu vào SQLite, không sửa dữ liệu mẫu.');
 }catch(e){feedback(e.message);}
}
async function edit(id){
 try{
 const book=await api('/books/'+encodeURIComponent(id));currentId=id;
 for(const name of ['id','title','author','description','cover','status'])$('#bookForm').elements[name].value=book[name]||'';
 $('#bookForm').elements.genres.value=book.genres.join(', ');
 $('#bookForm').elements.id.readOnly=true;
 window.scrollTo({top:0,behavior:'smooth'});
 feedback('Đang chỉnh sửa: '+book.title);
 }catch(e){feedback(e.message);}
}
$('#resetBook').onclick=()=>{currentId=null;$('#bookForm').reset();$('#bookForm').elements.id.readOnly=false;};
$('#bookForm').onsubmit=async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget);
 const payload=Object.fromEntries(['id','title','author','description','cover','status'].map(name=>[name,String(f.get(name)||'').trim()]));
 payload.genres=String(f.get('genres')||'').split(',').map(x=>x.trim()).filter(Boolean);
 try{await api('/admin/books'+(currentId?'/'+encodeURIComponent(currentId):''),currentId?'PUT':'POST',payload);feedback('Đã lưu truyện thành công');currentId=null;$('#bookForm').reset();$('#bookForm').elements.id.readOnly=false;await load();}catch(e){feedback(e.message);}
};
$('#chapterForm').onsubmit=async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget);const id=String(f.get('book_id')||'');
 try{await api('/admin/books/'+encodeURIComponent(id)+'/chapters','PUT',{number:Number(f.get('number')),title:String(f.get('title')),markdown:String(f.get('markdown'))});feedback('Đã lưu chương '+f.get('number'));}catch(e){feedback(e.message);}
};
$('#deleteChapter').onclick=async()=>{
 const f=new FormData($('#chapterForm'));const id=String(f.get('book_id')||'');const number=Number(f.get('number'));
 if(!id||!Number.isInteger(number)||!confirm('Xóa vĩnh viễn chương '+number+'?'))return;
 try{await api('/admin/books/'+encodeURIComponent(id)+'/chapters/'+number,'DELETE');feedback('Đã xóa chương '+number);}catch(e){feedback(e.message);}
};
load();
})();