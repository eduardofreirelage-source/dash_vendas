// =================================================================================
// SCRIPT ÚNICO, COMPLETO E CORRIGIDO (v3.4)
// =================================================================================

/* ===== Helpers ===== */
const $  = (id)=> document.getElementById(id);
const $$ = (sel,root=document)=> Array.from(root.querySelectorAll(sel));
const setStatus=(msg,cls)=>{const el=$('status'); if(!el) return; el.textContent=msg; el.style.color=(cls==='err'?'var(--down)':cls==='ok'?'var(--ok)':'var(--muted)');};
const fmt=(n)=> new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(+n||0);
const ptToNumber=(v)=>{ if(v==null) return 0; const s=String(v).trim().replace(/\./g,'').replace(',','.'); const n=parseFloat(s); return isNaN(n)?0:n; };
const todayStr=()=> new Date().toISOString().slice(0,10);
const weekDayPt=(iso)=> new Date(iso+'T00:00:00').toLocaleDateString('pt-BR',{weekday:'long'});

/* ===== Supabase ===== */
const SUPABASE_URL  = 'https://rqeagimulvgfecvuzubk.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZWFnaW11bHZnZmVjdnV6dWJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5NzkyMzUsImV4cCI6MjA3MjU1NTIzNX0.SeNHyHOlpqjm-QTl7KXq7YF-48fk5iOQCRgpangP4zU';
const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// Função de segurança para adicionar Event Listeners
function addSafeEventListener(id, event, handler) {
    const element = $(id);
    if (element) {
        element.addEventListener(event, handler);
    } else {
        console.warn(`Elemento com ID '${id}' não encontrado para adicionar evento '${event}'.`);
    }
}

/* ===== ROTEAMENTO POR ABAS ===== */
function setupRouting() {
  const mainTabsContainer = document.getElementById('main-tabs');
  const mainContents = document.querySelectorAll('.tab-content');
  
  const setupSubTabs = (containerId, contentSelector) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      const contents = document.querySelectorAll(contentSelector);
      
      container.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const subTabId = btn.dataset.subtab;

        container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        contents.forEach(content => {
          content.classList.toggle('active', content.id === 'sub-' + subTabId);
        });
      });
  };

  mainTabsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const tabId = btn.dataset.tab;

    mainTabsContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    mainContents.forEach(content => {
      content.classList.toggle('active', content.id === 'tab-' + tabId);
    });
  });
  
  setupSubTabs('cadastro-subtabs', '#tab-cadastros .subpage');
  setupSubTabs('estoque-subtabs', '#tab-estoque .subpage');
}


/* ===== Gemini API Integration ===== */
async function callGemini(prompt, button) {
    const originalButtonText = button.innerHTML;
    button.innerHTML = '✨ Gerando...';
    button.disabled = true;
    const apiKey = ""; // Será substituído pelo ambiente de execução
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }], };
    try {
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorBody}`);
        }
        const result = await response.json();
        const candidate = result.candidates?.[0];
        if (candidate && candidate.content?.parts?.[0]?.text) {
            return candidate.content.parts[0].text;
        } else {
            console.error('Unexpected API response structure:', result);
            throw new Error('Não foi possível extrair o texto da resposta da API.');
        }
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        setStatus('Erro na API Gemini: ' + error.message, 'err');
        return null;
    } finally {
        button.innerHTML = originalButtonText;
        button.disabled = false;
    }
}


/* ===== Estado PRATOS (lista/paginação) ===== */
let pratos=[], pratosPage=1; const PAGE_SIZE=10; let pratoEditId=null;
function renderPratos(){
  const term=$('pratos-search')?.value?.toLowerCase().trim()||'';
  const catF= $('pratos-cat-filter')?.value||'';
  const filtered=pratos.filter(p=>(!catF||String(p.categoria||'')===catF) && (!term||String(p.nome).toLowerCase().includes(term)));
  const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  if(pratosPage>totalPages) pratosPage=totalPages;
  const pageItems=filtered.slice((pratosPage-1)*PAGE_SIZE,(pratosPage-1)*PAGE_SIZE+PAGE_SIZE);
  const tb=$('tblPratos')?.querySelector('tbody'); 
  if(!tb) return;
  tb.innerHTML='';
  pageItems.forEach(p=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${p.nome}</td><td>${p.categoria||'—'}</td><td>${p.receitas ?? '—'}</td>
      <td>${p.ativo?'<span class="pill ok">Ativo</span>':'<span class="pill bad">Inativo</span>'}</td>
      <td class="row-actions"><button class="btn small" data-act="edit" data-id="${p.id}">Editar</button>
      <button class="btn small" data-act="toggle" data-id="${p.id}">${p.ativo?'Desativar':'Ativar'}</button>
      <button class="btn small" data-act="del" data-id="${p.id}">Excluir</button></td>`;
    tb.appendChild(tr);
  });
  if($('pratos-page-info')) $('pratos-page-info').textContent=`Página ${pratosPage}/${totalPages}`;
  if($('pratos-prev')) $('pratos-prev').disabled=pratosPage<=1; 
  if($('pratos-next')) $('pratos-next').disabled=pratosPage>=totalPages;
}

addSafeEventListener('pratos-prev', 'click', ()=>{ pratosPage=Math.max(1,pratosPage-1); renderPratos(); });
addSafeEventListener('pratos-next', 'click', ()=>{ pratosPage=pratosPage+1; renderPratos(); });
addSafeEventListener('pratos-search', 'input', ()=>{ pratosPage=1; renderPratos(); });
addSafeEventListener('pratos-cat-filter', 'change', ()=>{ pratosPage=1; renderPratos(); });

/* ===== CRUD PRATOS ===== */
addSafeEventListener('btnNovoPrato', 'click', ()=>{ 
    pratoEditId=null;
    $('prato-editor-container').style.display = 'block';
    $('prato-form-title').textContent='Novo prato'; 
    const form = $('prato-editor-container');
    form.querySelector('#prato-nome').value = '';
    form.querySelector('#prato-cat').value = 'PRATOS';
    form.querySelector('#prato-peso').value = '';
    form.querySelector('#prato-peso-un').value = 'g';
    form.querySelector('#prato-preco').value = '';
    form.querySelector('#prato-custo').value = '';
    form.querySelector('#prato-ultima').value = '';
    form.querySelector('#prato-descricao').value = '';
    form.querySelector('#prato-codigo-barras').value = '';
    form.querySelector('#prato-qrcode').value = '';
});
addSafeEventListener('btnCancelarPrato', 'click', ()=>{ 
    $('prato-editor-container').style.display = 'none';
});
addSafeEventListener('tblPratos', 'click', async e=>{
  const b=e.target.closest('button'); if(!b) return; const id=b.dataset.id, act=b.dataset.act;
  if(act==='edit'){ 
      const { data: p, error } = await supa.from('pratos').select('*').eq('id', id).single();
      if (error || !p) return setStatus('Prato não encontrado', 'err');
      
      pratoEditId=p.id; 
      $('prato-editor-container').style.display = 'block';
      $('prato-form-title').textContent='Editar prato'; 
      const form = $('prato-editor-container');
      form.querySelector('#prato-nome').value=p.nome||''; 
      form.querySelector('#prato-cat').value=p.categoria||'PRATOS'; 
      form.querySelector('#prato-peso').value=p.peso??''; 
      form.querySelector('#prato-peso-un').value=p.peso_un||'g'; 
      form.querySelector('#prato-preco').value=p.preco_venda??''; 
      form.querySelector('#prato-custo').value=p.custo??''; 
      form.querySelector('#prato-ultima').value=p.updated_at?new Date(p.updated_at).toLocaleString('pt-BR'):'—'; 
      form.querySelector('#prato-descricao').value = p.descricao || '';
      form.querySelector('#prato-codigo-barras').value = p.codigo_barras || '';
      form.querySelector('#prato-qrcode').value = p.qrcode || '';
    }
  if(act==='toggle'){ try{ const p=pratos.find(x=>String(x.id)===String(id)); const {error}=await supa.from('pratos').update({ativo:!p.ativo}).eq('id',id); if(error) throw error; await loadPratos(); }catch(ex){ alert(ex.message||ex); } }
  if(act==='del'){ if(!confirm('Excluir prato?')) return; try{ const {error}=await supa.from('pratos').delete().eq('id',id); if(error) throw error; await loadPratos(); }catch(ex){ alert(ex.message||ex); } }
});
addSafeEventListener('btnSalvarPrato', 'click', async ()=>{
  const form = $('prato-editor-container');
  const nome=form.querySelector('#prato-nome').value.trim(); if(!nome){ alert('Informe o nome do prato'); return; }
  const basePayload={ 
      nome, 
      categoria:form.querySelector('#prato-cat').value, 
      peso:ptToNumber(form.querySelector('#prato-peso').value), 
      peso_un:form.querySelector('#prato-peso-un').value, 
      preco_venda:form.querySelector('#prato-preco').value.trim(),
      descricao: form.querySelector('#prato-descricao').value.trim() || null
  };
  try{
    if(pratoEditId){ 
        const {error}=await supa.from('pratos').update(basePayload).eq('id',pratoEditId); 
        if(error) throw error; 
    } else { 
        const newBarcode = `BAR-${crypto.randomUUID()}`;
        const newQrcode = `QR-${crypto.randomUUID()}`;
        const insertPayload = {
            ...basePayload,
            codigo_barras: newBarcode,
            qrcode: newQrcode,
            ativo:true
        };
        const {error}=await supa.from('pratos').insert(insertPayload); 
        if(error) throw error; 
    }
    await loadPratos(); 
    $('btnCancelarPrato').click();
    setStatus('Prato salvo','ok');
  }catch(e){ setStatus(e.message||e,'err'); }
});

/* ===== Import do Dashboard de Pratos ===== */
const DASHBOARD_PRATOS_SOURCE='vendas_pratos_pratos';
async function loadDash(){
  const tb=$('tblDash')?.querySelector('tbody'); if(!tb) return;
  tb.innerHTML='<tr><td colspan="4">Carregando…</td></tr>';
  try{
    let dash=null, err=null; ({data:dash, error:err}=await supa.from(DASHBOARD_PRATOS_SOURCE).select('prato,categoria')); if(err){ ({data:dash, error:err}=await supa.from(DASHBOARD_PRATOS_SOURCE).select('prato')); }
    if(err) throw err;
    const {data:pr}=await supa.from('pratos').select('id,nome'); const exist=new Set((pr||[]).map(p=>p.nome));
    const cat=$('dash-cat').value?.toUpperCase()||''; const term=$('dash-search').value?.toLowerCase().trim()||'';
    tb.innerHTML='';
    (dash||[]).filter(r=> (!cat||String(r.categoria||'').toUpperCase()===cat) && (!term||String(r.prato||'').toLowerCase().includes(term)) )
      .forEach(r=>{
        const already=exist.has(r.prato);
        const tr=document.createElement('tr');
        tr.innerHTML=`<td>${r.prato}</td><td>${r.categoria||'<span class="soft">N/D</span>'}</td>
          <td>${already?'<span class="pill">Já existe</span>':'<span class="pill">Falta importar</span>'}</td>
          <td>${already?'-':`<button class="btn small" data-import="${r.prato.replace(/"/g,'&quot;')}" data-cat="${(r.categoria||'PRATOS').replace(/"/g,'&quot;')}">Importar</button>`}</td>`;
        tb.appendChild(tr);
      });
  }catch(e){ tb.innerHTML='<tr><td colspan="4">Não foi possível ler a fonte do dashboard.</td></tr>'; }
}
addSafeEventListener('btnSyncAll', 'click', loadDash);

addSafeEventListener('btnImportAll', 'click', async (e) => {
    const btn = e.target;
    const importButtons = $$('#tblDash button[data-import]');
    if(importButtons.length === 0) {
        setStatus('Nenhum prato para importar na lista.', 'warn');
        return;
    }
    btn.disabled = true;
    btn.textContent = 'Importando...';
    let successCount = 0;
    for(const b of importButtons) {
        try {
            const {error}=await supa.from('pratos').insert({nome:b.dataset.import,categoria:b.dataset.cat||'PRATOS',ativo:true});
            if(error && !String(error.message||'').includes('duplicate')) throw error;
            successCount++;
        } catch(ex) {
            console.error(`Falha ao importar ${b.dataset.import}:`, ex);
        }
    }
    setStatus(`${successCount} de ${importButtons.length} pratos importados.`, 'ok');
    await loadPratos();
    await loadDash();
    btn.disabled = false;
    btn.textContent = 'Importar Visíveis';
});

document.addEventListener('click', e=>{
  const b=e.target.closest('#tblDash button[data-import]'); if(!b) return;
  (async ()=>{
    const {error}=await supa.from('pratos').insert({nome:b.dataset.import,categoria:b.dataset.cat||'PRATOS',ativo:true});
    if(error && !String(error.message||'').includes('duplicate')) return alert(error.message||error);
    await loadPratos(); await loadDash();
  })();
});

/* ===== Componentes ===== */
async function loadPratoCompTable(){
  const prato_id=$('cp-prato').value; 
  const tb=$('tblPrComp').querySelector('tbody'); 
  tb.innerHTML='';
  if(!prato_id) return;
  try{
    const {data, error}=await supa.from('prato_receitas').select('id,receita_id,qtd,unidade').eq('prato_id',prato_id);
    if(error) throw error;
    for(const row of (data||[])){
      const {data:rec}=await supa.from('receitas').select('nome').eq('id',row.receita_id).single();
      const tr=document.createElement('tr'); tr.innerHTML=`<td>${rec?.nome||'(removida)'}</td><td>${fmt(row.qtd)}</td><td>${row.unidade}</td><td class="row-actions"><button class="btn small" data-del="${row.id}">Remover</button></td>`;
      tb.appendChild(tr);
    }
  }catch(ex){ tb.innerHTML='<tr><td colspan="4">Erro ao listar</td></tr>'; }
}
addSafeEventListener('cp-prato', 'change', () => {
    const pratoId = $('cp-prato').value;
    const editor = $('componentes-editor');
    if (pratoId) {
        editor.style.display = 'block';
        loadPratoCompTable();
    } else {
        editor.style.display = 'none';
    }
});

addSafeEventListener('btnAddPrComp', 'click',async ()=>{
  const prato_id=$('cp-prato').value, receita_id=$('cp-receita').value, qtd=ptToNumber($('cp-qtd').value), unidade=$('cp-und').value, obs=$('cp-obs').value.trim()||null;
  if(!prato_id||!receita_id||!qtd){ return alert('Selecione prato/receita e informe quantidade'); }
  const {error}=await supa.from('prato_receitas').insert({prato_id,receita_id,qtd,unidade,obs});
  if(error && !String(error.message||'').includes('duplicate')) return alert(error.message||error);
  $('cp-qtd').value=''; $('cp-obs').value=''; await loadPratoCompTable();
});
document.addEventListener('click', async e=>{
  const b=e.target.closest('#tblPrComp button[data-del]'); if(!b) return;
  if(!confirm('Remover receita do prato?')) return;
  const {error}=await supa.from('prato_receitas').delete().eq('id',b.dataset.del);
  if(error) return alert(error.message||error);
  await loadPratoCompTable();
});

/* ===== Receitas (cadastro) ===== */
let recEditId=null, draftItems=[];
async function refreshDraftRefs(){ const tipo=$('draft-tipo')?.value; if(!tipo) return; if(tipo==='INGREDIENTE') await fillOptionsFrom('ingredientes','draft-ref','id','nome',{ativo:true}); else await fillOptionsFrom('receitas','draft-ref','id','nome',{ativo:true}); }
function renderDraft(){ const tb=$('tblDraft')?.querySelector('tbody'); if(tb) {tb.innerHTML=''; draftItems.forEach((it,i)=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${it.tipo}</td><td>${it.nome}</td><td>${fmt(it.qtd)}</td><td>${it.unidade}</td><td>${fmt(it.perda_pct)}%</td><td class="row-actions"><button class="btn small" data-rm="${i}">Remover</button></td>`; tb.appendChild(tr); });} }
addSafeEventListener('draft-tipo', 'change', refreshDraftRefs);
document.addEventListener('click',e=>{ const b=e.target.closest('#tblDraft button[data-rm]'); if(!b) return; draftItems.splice(+b.dataset.rm,1); renderDraft(); });
addSafeEventListener('btnDraftAdd', 'click', async ()=>{ const tipo=$('draft-tipo').value, ref_id=$('draft-ref').value, qtd=ptToNumber($('draft-qtd').value), unidade=$('draft-und').value, perda_pct=ptToNumber($('draft-perda').value); if(!ref_id||!qtd) return alert('Selecione a referência e informe a quantidade'); let nome=''; if(tipo==='INGREDIENTE'){ const {data}=await supa.from('ingredientes').select('nome').eq('id',ref_id).single(); nome=data?.nome||''; } else { const {data}=await supa.from('receitas').select('nome').eq('id',ref_id).single(); nome=data?.nome||''; } draftItems.push({tipo,ref_id,nome,qtd,unidade,perda_pct}); $('draft-qtd').value=''; $('draft-perda').value='0'; renderDraft(); });
addSafeEventListener('btnDraftClear', 'click', ()=>{ draftItems=[]; renderDraft(); });

addSafeEventListener('btnSaveRec', 'click', async ()=>{
  const nome=$('rec-nome').value.trim(), rendimento_qtd=ptToNumber($('rec-rend-qtd').value), unidade_rendimento=$('rec-rend-und').value, perda_pct=ptToNumber($('rec-perda').value), obs=$('rec-obs').value.trim()||null, modo_preparo = $('rec-preparo').value.trim()||null;
  if(!nome||!rendimento_qtd) return alert('Informe nome e rendimento');
  const newBarcode = `BAR-${crypto.randomUUID()}`;
  const newQrcode = `QR-${crypto.randomUUID()}`;
  const payload = {
      nome, rendimento_qtd, unidade_rendimento, perda_pct, obs, modo_preparo,
      codigo_barras: newBarcode,
      qrcode: newQrcode
  };
  const {data:ins,error}=await supa.from('receitas').insert(payload).select('id').single(); if(error) return alert(error.message||error);
  if(draftItems.length){ const payload=draftItems.map(d=>({receita_id:ins.id,tipo:d.tipo,ref_id:d.ref_id,qtd:d.qtd,unidade:d.unidade,perda_pct:d.perda_pct})); const {error:err2}=await supa.from('receita_itens').insert(payload); if(err2) alert('Receita salva, erro ao salvar itens: '+(err2.message||err2)); }
  $('btnCancelRecEdit').click();
  await loadReceitas(); setStatus('Receita salva','ok');
});
addSafeEventListener('btnUpdateRec', 'click', async ()=>{ 
    if(!recEditId) return; 
    const nome=$('rec-nome').value.trim(), rendimento_qtd=ptToNumber($('rec-rend-qtd').value), unidade_rendimento=$('rec-rend-und').value, perda_pct=ptToNumber($('rec-perda').value), obs=$('rec-obs').value.trim()||null, modo_preparo = $('rec-preparo').value.trim()||null; 
    if(!nome||!rendimento_qtd) return alert('Informe nome e rendimento'); 
    const payload = {
        nome, rendimento_qtd, unidade_rendimento, perda_pct, obs, modo_preparo
    };
    const {error}=await supa.from('receitas').update(payload).eq('id',recEditId); 
    if(error) return alert(error.message||error); 
    await loadReceitas(); 
    setStatus('Receita atualizada','ok'); 
});
addSafeEventListener('btnCancelRecEdit', 'click', ()=>{ 
    recEditId=null; 
    $('recipe-editor-container').style.display = 'none';
    $('recipe-form-title').textContent = 'Nova Receita';
    $('rec-nome').value=''; 
    $('rec-rend-qtd').value=''; 
    $('rec-rend-und').value='g';
    $('rec-perda').value='0'; 
    $('rec-obs').value=''; 
    $('rec-preparo').value='';
    $('rec-codigo-barras').value = '';
    $('rec-qrcode').value = '';
    draftItems = [];
    renderDraft();
    
    $('btnSaveRec').style.display='inline-flex'; 
    $('btnUpdateRec').style.display='none'; 
});


async function fillOptionsFrom(table, selId, valKey, labelKey, whereEq){
  const sel=$(selId); if(!sel) return; sel.innerHTML='<option value="">Carregando…</option>';
  try{ let q=supa.from(table).select(`${valKey},${labelKey}`).order(labelKey,{ascending:true}); if(whereEq) Object.entries(whereEq).forEach(([k,v])=> q=q.eq(k,v)); const {data,error}=await q; if(error) throw error; sel.innerHTML='<option value="">Selecione</option>'; (data||[]).forEach(x=>{ const o=document.createElement('option'); o.value=x[valKey]; o.textContent=x[labelKey]; sel.appendChild(o); }); }catch(e){ sel.innerHTML='<option value="">(n/d)</option>'; }
}
async function loadReceitas(){
  const tb=$('tblRec')?.querySelector('tbody'); if(!tb) return;
  tb.innerHTML='<tr><td colspan="6">Carregando…</td></tr>';
  try{ const {data,error}=await supa.from('v_receitas_resumo').select('*').order('nome',{ascending:true}); if(error) throw error;
    tb.innerHTML=''; (data||[]).forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.nome}</td><td>${fmt(r.rendimento_qtd)} ${r.unidade_rendimento}</td><td>${r.itens}</td><td>${r.ativo?'<span class="pill ok">Ativo</span>':'<span class="pill bad">Inativo</span>'}</td><td class="row-actions"><button class="btn small" data-act="edit" data-id="${r.id}">Editar</button><button class="btn small" data-act="toggle" data-id="${r.id}">${r.ativo?'Desativar':'Ativar'}</button><button class="btn small" data-act="del" data-id="${r.id}">Excluir</button></td>`; tb.appendChild(tr); });
  }catch(e){ tb.innerHTML='<tr><td colspan="6">Crie a view v_receitas_resumo e adicione os campos de código</td></tr>'; }
  await fillOptionsFrom('pratos','cp-prato','id','nome',{ativo:true}); await fillOptionsFrom('receitas','cp-receita','id','nome',{ativo:true}); 
}
async function loadIngredientes(){
    const tb = $('tblIng')?.querySelector('tbody');
    if(!tb) return;
    tb.innerHTML = '<tr><td colspan="6">Carregando…</td></tr>';
    try {
        const { data, error } = await supa.from('v_ingredientes_detalhados').select('*').order('nome', { ascending: true });
        if (error) throw error;
        
        tb.innerHTML = '';
        (data || []).forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.nome}</td>
                <td>${r.categoria || '—'}</td>
                <td>${r.unidade_medida_sigla || '—'}</td>
                <td>R$ ${fmt(r.custo_unitario)}</td>
                <td>${r.ativo ? '<span class="pill ok">Ativo</span>' : '<span class="pill bad">Inativo</span>'}</td>
                <td class="row-actions">
                    <button class="btn small" data-act="edit" data-id="${r.id}">Editar</button>
                    <button class="btn small" data-act="toggle" data-id="${r.id}">${r.ativo ? 'Desativar' : 'Ativar'}</button>
                    <button class="btn small" data-act="del" data-id="${r.id}">Excluir</button>
                </td>`;
            tb.appendChild(tr);
        });
    } catch (e) {
        tb.innerHTML = '<tr><td colspan="6">Erro ao carregar. Verifique se a view `v_ingredientes_detalhados` foi criada.</td></tr>';
    }
}


/* ===== Unidades ===== */
function toBase(value,unit){ const u=(unit||'').toLowerCase(); if(u==='kg') return {v:value*1000,u:'g'}; if(u==='l') return {v:value*1000,u:'ml'}; if(u==='porcao') return {v:value,u:'un'}; return {v:value,u:(u==='ml'||u==='l')?'ml':(u==='kg'||u==='g')?'g':unit}; }

/* ===== PREVISÃO ===== */
async function preencherCategorias(){
  const sel=$('cat-filter'); if(!sel) return;
  sel.innerHTML='';
  const {data}=await supa.from('pratos').select('categoria').not('categoria','is',null);
  const cats=[...new Set((data||[]).map(x=>x.categoria||'OUTROS'))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  cats.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); });
}
async function obterUltimaDataVenda(){
  const {data,error}=await supa.from('vendas_pratos_view_only_pratos').select('data').order('data',{ascending:false}).limit(1).maybeSingle();
  if(error) return todayStr();
  return data?.data || todayStr();
}
async function calcularPrevisaoReal(){
  const win = Math.max(1, +$('win-dias').value||7);
  const proj = Math.max(1, +$('proj-dias').value||7);
  const refReal = await obterUltimaDataVenda();
  if($('prev-hint-top')) $('prev-hint-top').textContent = `Usando como referência a última data com lançamento: ${refReal} (${weekDayPt(refReal)}).`;

  setStatus('Calculando…','');
  if($('th-proj')) $('th-proj').textContent = `Qtd/Projeção (${proj} dias)`;
  if($('th-proj-prato')) $('th-proj-prato').textContent = `Projeção (${proj} dias)`;

  const fim = new Date(refReal);
  const ini = new Date(refReal); ini.setDate(fim.getDate()-(win-1));
  const isoIni = ini.toISOString().slice(0,10), isoFim = refReal;

  const {data:vendas,error:errV}=await supa
    .from('vendas_pratos_view_only_pratos')
    .select('data,prato,quantidade')
    .gte('data',isoIni).lte('data',isoFim);
  if(errV){ setStatus('Erro ao ler vendas: '+(errV.message||errV),'err'); return; }

  const {data:pratosTbl}=await supa.from('pratos').select('id,nome,categoria');
  const nomeToId = new Map((pratosTbl||[]).map(p=>[p.nome,p.id]));
  const nomeToCat= new Map((pratosTbl||[]).map(p=>[p.nome,p.categoria||'OUTROS']));
  const selCats = new Set(Array.from($('cat-filter').selectedOptions||[]).map(o=>o.value));
  const filtraCat = (pratoNome)=> selCats.size? selCats.has(nomeToCat.get(pratoNome)||'OUTROS') : true;

  const porPrato = new Map();
  (vendas||[]).forEach(v=>{
    if(!filtraCat(v.prato)) return;
    porPrato.set(v.prato,(porPrato.get(v.prato)||0)+(v.quantidade||0));
  });
  const mediaPratoDia = new Map([...porPrato.entries()].map(([p,tot])=> [p, tot / win] ));
  const pratoIds = [...mediaPratoDia.keys()].map(n=> nomeToId.get(n)).filter(Boolean);

  const tbResumo=$('tblResumoPratos')?.querySelector('tbody'); 
  if(tbResumo) {
    tbResumo.innerHTML='';
    [...mediaPratoDia.entries()]
        .map(([nome,md])=>({nome,cat:nomeToCat.get(nome)||'—', md, proj: md*proj}))
        .sort((a,b)=> a.nome.localeCompare(b.nome,'pt-BR'))
        .forEach(r=>{
        const tr=document.createElement('tr');
        tr.innerHTML=`<td>${r.nome}</td><td>${r.cat}</td><td>${fmt(r.md)}</td><td>${fmt(r.proj)}</td>`;
        tbResumo.appendChild(tr);
        });
  }

  let pratoReceitas=[];
  if(pratoIds.length){
    const {data:prc}=await supa.from('prato_receitas').select('prato_id,receita_id,qtd,unidade').in('prato_id',pratoIds);
    pratoReceitas = prc||[];
  }

  const recTotals = new Map();
  pratoReceitas.forEach(r=>{
    const pratoNome = (pratosTbl||[]).find(p=>p.id===r.prato_id)?.nome;
    if(!mediaPratoDia.has(pratoNome)) return;
    const mediaDia = mediaPratoDia.get(pratoNome) || 0;
    const add = mediaDia * (r.qtd||0);
    const prev = recTotals.get(r.receita_id) || {perDia:0,un:r.unidade||'g'};
    prev.perDia += add; prev.un = r.unidade||prev.un; recTotals.set(r.receita_id, prev);
  });

  const recIds=[...recTotals.keys()];
  let receitasMeta=new Map(), itensByRec=new Map();
  if(recIds.length){
    const {data:recMeta}=await supa.from('receitas').select('id,nome,unidade_rendimento,rendimento_qtd,perda_pct').in('id',recIds);
    receitasMeta = new Map((recMeta||[]).map(r=>[r.id,r]));
    const {data:itens}=await supa.from('receita_itens').select('id,receita_id,tipo,ref_id,qtd,unidade,perda_pct').in('receita_id',recIds);
    (itens||[]).forEach(it=>{ const arr=itensByRec.get(it.receita_id)||[]; arr.push(it); itensByRec.set(it.receita_id,arr); });
  }

  const tb=$('tblPrev')?.querySelector('tbody'); 
  if(tb){
    tb.innerHTML='';
    [...recTotals.entries()]
        .map(([id,agg])=>({id, nome: receitasMeta.get(id)?.nome || ('Receita #'+id), un: agg.un, dia: agg.perDia, proj: agg.perDia*proj}))
        .sort((a,b)=> a.nome.localeCompare(b.nome,'pt-BR'))
        .forEach(r=>{
        const tr=document.createElement('tr');
        tr.innerHTML=`<td>${r.nome}</td><td>${r.un}</td><td class="nowrap">${fmt(r.dia)}</td><td class="nowrap">${fmt(r.proj)}</td>`;
        tb.appendChild(tr);
        });
  }

  if($('kpi-dias')) $('kpi-dias').textContent = String(win);
  if($('kpi-pratos')) $('kpi-pratos').textContent = String(mediaPratoDia.size);
  if($('kpi-rec')) $('kpi-rec').textContent = String(recTotals.size);
  if($('prev-hint')) $('prev-hint').textContent = `Janela: ${isoIni} → ${isoFim} (média baseada em ${win} dia(s)). Projeção para ${proj} dia(s).`;

  setStatus('Pronto','ok');
}

/* ===== binds e handlers ===== */
addSafeEventListener('btnGeneratePreparo', 'click', async (e) => {
    if (draftItems.length === 0) {
        alert('Adicione pelo menos um item à grade antes de gerar o modo de preparo.');
        return;
    }
    const itemsText = draftItems.map(it => `- ${it.qtd} ${it.unidade} de ${it.nome}`).join('\n');
    const prompt = `Sou um chef de cozinha e estou criando uma ficha técnica. Com base nesta lista de ingredientes, gere um modo de preparo claro e conciso, em formato de passos numerados:\n\n${itemsText}\n\nModo de Preparo:`;
    const preparoText = await callGemini(prompt, e.target);
    if (preparoText) {
        $('rec-preparo').value = preparoText;
        setStatus('Modo de preparo gerado com sucesso!', 'ok');
    }
});
addSafeEventListener('btnGenerateDesc', 'click', async (e) => {
    if (!pratoEditId) {
        alert('Salve o prato primeiro ou selecione um prato existente para editar antes de gerar a descrição.');
        return;
    }
    setStatus('Buscando componentes do prato...');
    let componentesText = '';
    try {
        const { data, error } = await supa.from('prato_receitas').select('receitas(nome)').eq('prato_id', pratoEditId);
        if (error) throw error;
        if (!data || data.length === 0) {
            alert('Este prato não tem receitas associadas. Adicione componentes na aba "Componentes" primeiro.');
            setStatus('Pronto', 'ok');
            return;
        }
        componentesText = data.map(item => `- ${item.receitas.nome}`).join('\n');
    } catch (ex) {
        setStatus('Erro ao buscar componentes: ' + (ex.message || ex), 'err');
        return;
    }

    const prompt = `Para um cardápio de restaurante, crie um nome criativo e uma descrição de venda curta e apetitosa para um prato que é composto pelos seguintes itens:\n\n${componentesText}\n\nO resultado deve ser em JSON, com as chaves "nome" e "descricao".\n\nExemplo de saída:\n{\n  "nome": "Strogonoff Magnífico da Casa",\n  "descricao": "Suculentos cubos de frango ao molho cremoso de champignon, acompanhado de arroz soltinho e batata palha crocante."\n}`;
    
    const resultJsonString = await callGemini(prompt, e.target);

    if (resultJsonString) {
        try {
            const cleanedJsonString = resultJsonString.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanedJsonString);
            if (result.nome) $('prato-nome').value = result.nome;
            if (result.descricao) $('prato-descricao').value = result.descricao;
            setStatus('Nome e descrição gerados com sucesso!', 'ok');
        } catch (parseError) {
            console.error('Falha ao parsear JSON do Gemini:', parseError, 'Resposta crua:', resultJsonString);
            $('prato-descricao').value = resultJsonString;
            setStatus('Descrição gerada (formato inesperado).', 'warn');
        }
    }
});
addSafeEventListener('tblRec', 'click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const { act, id } = btn.dataset;

    if (act === 'toggle') {
        try {
            const { data: rec } = await supa.from('receitas').select('ativo').eq('id', id).single();
            if (!rec) throw new Error('Receita não encontrada');
            const { error } = await supa.from('receitas').update({ ativo: !rec.ativo }).eq('id', id);
            if (error) throw error;
            await loadReceitas();
        } catch (ex) { alert(ex.message || ex); }
    } else if (act === 'del') {
        if (!confirm('Excluir receita e todos os seus itens?')) return;
        try {
            const { error } = await supa.from('receitas').delete().eq('id', id);
            if (error) throw error;
            await loadReceitas();
        } catch (ex) { alert(ex.message || ex); }
    } else if (act === 'edit') {
         $('recipe-editor-container').style.display = 'block';
         $('recipe-editor-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
        try {
            const { data: rec, error } = await supa.from('receitas').select('*').eq('id', id).single();
            if (error) throw error;
            if (!rec) return;
            
            $('recipe-form-title').textContent = 'Editar Receita';
            recEditId = id;
            $('rec-nome').value = rec.nome || '';
            $('rec-rend-qtd').value = rec.rendimento_qtd || '';
            $('rec-rend-und').value = rec.unidade_rendimento || 'g';
            $('rec-perda').value = rec.perda_pct || 0;
            $('rec-obs').value = rec.obs || '';
            $('rec-preparo').value = rec.modo_preparo || '';
            $('rec-codigo-barras').value = rec.codigo_barras || '';
            $('rec-qrcode').value = rec.qrcode || '';

            setStatus('Carregando itens da receita...');
            const { data: items, error: itemsError } = await supa.from('receita_itens').select('*').eq('receita_id', id);
            if (itemsError) throw itemsError;

            const itemPromises = items.map(async (it) => {
                let nome = '—';
                if (it.tipo === 'INGREDIENTE') {
                    const { data: ing } = await supa.from('ingredientes').select('nome').eq('id', it.ref_id).single();
                    nome = ing?.nome || '(ingrediente removido)';
                } else {
                    const { data: subRec } = await supa.from('receitas').select('nome').eq('id', it.ref_id).single();
                    nome = subRec?.nome || '(receita removida)';
                }
                return { ...it, nome, ref_id: it.ref_id, qtd: it.qtd, unidade: it.unidade, perda_pct: it.perda_pct, tipo: it.tipo };
            });
            
            draftItems = await Promise.all(itemPromises);
            renderDraft();
            setStatus('Pronto', 'ok');

            $('btnSaveRec').style.display = 'none';
            $('btnUpdateRec').style.display = 'inline-flex';
            $('btnCancelRecEdit').style.display = 'inline-flex';
            $('rec-nome').focus();
        } catch (ex) { 
            alert(ex.message || ex); 
            setStatus('Erro ao carregar receita para edição.', 'err');
        }
    }
});
let ingEditId = null;
addSafeEventListener('tblIng', 'click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const { act, id } = btn.dataset;

    if (act === 'toggle') {
        try {
            const { data: ing, error: dbError } = await supa.from('ingredientes').select('ativo').eq('id', id).single();
            if (dbError || !ing) throw new Error('Ingrediente não encontrado');
            const { error } = await supa.from('ingredientes').update({ ativo: !ing.ativo }).eq('id', id);
            if (error) throw error;
            await loadIngredientes();
        } catch (ex) { alert(ex.message || ex); }
    } else if (act === 'del') {
        if (!confirm('Excluir ingrediente?')) return;
        try {
            const { error } = await supa.from('ingredientes').delete().eq('id', id);
            if (error) throw error;
            await loadIngredientes();
        } catch (ex) { alert(ex.message || ex); }
    } else if (act === 'edit') {
        try {
            const { data: ing, error } = await supa.from('v_ingredientes_detalhados').select('*').eq('id', id).single();
            if (error) throw error;
            if (!ing) return;

            $('ingrediente-editor-container').style.display = 'block';
            $('ingrediente-form-title').textContent = 'Editar Ingrediente';
            ingEditId = id;
            $('ing-nome').value = ing.nome || '';
            $('ing-categoria').value = ing.categoria || 'Alimentos';
            $('ing-custo').value = ing.custo_unitario || '';
            $('ing-obs').value = ing.obs || '';
            $('ing-codigo-barras').value = ing.codigo_barras || '';
            $('ing-qrcode').value = ing.qrcode || '';
            $('ing-estoque-min').value = ing.estoque_minimo || '';
            $('ing-estoque-max').value = ing.estoque_maximo || '';
            $('ing-unidade-medida').value = ing.unidade_medida_id || '';
            $('ing-local-armazenagem').value = ing.unidade_armazenagem_id || '';

            $('btnSaveIng').textContent = 'Salvar Alterações';
            $('btnCancelIngEdit').style.display = 'inline-flex';
            $('ing-nome').focus();
        } catch (ex) { alert(ex.message || ex); }
    }
});
addSafeEventListener('btnSaveIng', 'click', async () => {
    const nome = $('ing-nome').value.trim();
    if (!nome) return alert('O nome do ingrediente é obrigatório.');
    
    const payload = { 
        nome, 
        categoria: $('ing-categoria').value,
        custo_unitario: ptToNumber($('ing-custo').value), 
        obs: $('ing-obs').value.trim() || null,
        estoque_minimo: ptToNumber($('ing-estoque-min').value),
        estoque_maximo: ptToNumber($('ing-estoque-max').value),
        unidade_medida_id: $('ing-unidade-medida').value || null,
        unidade_armazenagem_id: $('ing-local-armazenagem').value || null,
    };

    try {
        if (ingEditId) {
            const { error } = await supa.from('ingredientes').update(payload).eq('id', ingEditId);
            if (error) throw error;
        } else {
            const newBarcode = `BAR-${crypto.randomUUID()}`;
            const newQrcode = `QR-${crypto.randomUUID()}`;
            const insertPayload = { 
                ...payload, 
                codigo_barras: newBarcode,
                qrcode: newQrcode,
                ativo: true 
            };
            const { error } = await supa.from('ingredientes').insert(insertPayload);
            if (error) throw error;
        }
        $('btnCancelIngEdit').click();
        await loadIngredientes();
        await loadEstoqueParams(); 
        await EstoqueModule.loadSaldos();
        setStatus('Ingrediente salvo.', 'ok');
    } catch (ex) { setStatus('Erro ao salvar ingrediente: ' + (ex.message || ex), 'err'); }
});
addSafeEventListener('btnCancelIngEdit', 'click', () => {
    ingEditId = null;
    $('ingrediente-editor-container').style.display = 'none';
    $('ingrediente-form-title').textContent = 'Novo Ingrediente';
    
    $('ing-nome').value = '';
    $('ing-categoria').value = 'Alimentos';
    $('ing-custo').value = '';
    $('ing-obs').value = '';
    $('ing-codigo-barras').value = '';
    $('ing-qrcode').value = '';
    $('ing-estoque-min').value = '';
    $('ing-estoque-max').value = '';
    $('ing-unidade-medida').value = '';
    $('ing-local-armazenagem').value = '';
    
    $('btnSaveIng').textContent = 'Salvar';
});
addSafeEventListener('btnShowNewRecipeForm', 'click', () => {
    if($('btnCancelRecEdit')) $('btnCancelRecEdit').click();
    if($('recipe-editor-container')) {
        $('recipe-editor-container').style.display = 'block';
        $('recipe-editor-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
});
addSafeEventListener('btnShowNewIngredienteForm', 'click', () => {
    if($('btnCancelIngEdit')) $('btnCancelIngEdit').click();
    if($('ingrediente-editor-container')) $('ingrediente-editor-container').style.display = 'block';
});
addSafeEventListener('btnCalcularPrev', 'click', calcularPrevisaoReal);
addSafeEventListener('btnExportPrev', 'click', ()=> alert('Exportar PDF: pronto para integrar.'));
async function backfillUniqueCodes(tableName) {
    try {
        const { data, error } = await supa.from(tableName).select('id, qrcode').is('qrcode', null);

        if (error) {
            if (error.code === '42P01') { 
                 console.warn(`Aviso: A tabela '${tableName}' não existe.`);
                 setStatus(`Aviso: Tabela '${tableName}' não encontrada.`, 'warn');
            } else if (error.code === '42703') { 
                 console.warn(`Aviso: A tabela '${tableName}' não possui as colunas 'codigo_barras' e/ou 'qrcode'.`);
                 setStatus(`Aviso: Tabela '${tableName}' não configurada para códigos.`, 'warn');
            } else {
                console.warn(`Não foi possível verificar códigos para ${tableName}. Erro: ${error.message}`);
            }
            return;
        }

        if (data && data.length > 0) {
            setStatus(`Atualizando ${data.length} registros antigos em ${tableName}...`, 'ok');
            
            for (const item of data) {
                 const newBarcode = `BAR-${crypto.randomUUID()}`;
                 const newQrcode = `QR-${crypto.randomUUID()}`;
                 const { error: updateError } = await supa.from(tableName)
                    .update({
                        codigo_barras: newBarcode,
                        qrcode: newQrcode
                    })
                    .eq('id', item.id);

                if (updateError) {
                    console.error(`Erro ao atualizar item ${item.id} na tabela ${tableName}:`, updateError);
                }
            }
            console.log(`${data.length} registros verificados em ${tableName}.`);
        }
    } catch (ex) {
        console.error(`Erro ao preencher códigos para ${tableName}:`, ex);
    }
}
async function loadPratos(){
  try{
    const {data,error} = await supa.from('v_pratos_resumo').select('*').order('nome',{ascending:true});
    if(error){ 
        setStatus('Erro ao carregar pratos: '+(error.message||error),'err');
        pratos=[]; renderPratos(); 
        return;
    }
    pratos=data||[]; renderPratos();
    await fillOptionsFrom('pratos','cp-prato','id','nome',{ativo:true});
  }catch(e){ pratos=[]; renderPratos(); setStatus('Não foi possível carregar pratos: '+(e.message||e),'err'); }
}

const EstoqueModule = {
    currentMovType: null,
    stream: null,
    
    init() {
        $$('.mov-actions .btn').forEach(btn => btn.addEventListener('click', (e) => this.showMovForm(e.currentTarget.dataset.movType)));
        addSafeEventListener('btnMovCancel', 'click', () => this.hideMovForm());
        addSafeEventListener('frmMov', 'submit', (e) => this.handleMovimentacao(e));
        addSafeEventListener('mov-item-tipo', 'change', () => this.populateItemsDropdown());
        addSafeEventListener('btnMovScan', 'click', () => this.toggleCamera());
        this.loadInitialData();
    },

    async loadInitialData() {
        await this.populateUnidadesDropdown();
        await this.populateItemsDropdown();
        await this.loadRecentMovs();
        await this.loadSaldos();
    },

    async populateUnidadesDropdown() {
        await fillOptionsFrom('unidades', 'mov-unidade-origem', 'id', 'nome');
        await fillOptionsFrom('unidades', 'mov-unidade-destino', 'id', 'nome');
        await fillOptionsFrom('unidades', 'filtro-unidade-estoque', 'id', 'nome');
    },
    
    async populateItemsDropdown() {
        const tipo = $('mov-item-tipo').value;
        const tabela = (tipo === 'ING') ? 'ingredientes' : 'receitas';
        await fillOptionsFrom(tabela, 'mov-item', 'id', 'nome', { ativo: true });
    },

    showMovForm(type) {
        this.currentMovType = type;
        const container = $('mov-form-container');
        container.style.display = 'block';
        $('frmMov').reset();
        $('mov-unidade-origem-group').style.display = 'none';
        $('mov-unidade-destino-group').style.display = 'none';
        $('mov-validade-group').style.display = 'none';
        $('mov-custo-group').style.display = 'none';
        $('mov-ajuste-sinal-group').style.display = 'none';
        switch(type) {
            case 'ENTRADA':
                $('mov-form-title').textContent = 'Registrar Entrada';
                $('mov-unidade-destino-group').style.display = 'block';
                $('mov-validade-group').style.display = 'block';
                $('mov-custo-group').style.display = 'block';
                $('btnMovSubmit').textContent = 'Registrar Entrada';
                break;
            case 'SAIDA':
                 $('mov-form-title').textContent = 'Registrar Saída';
                 $('mov-unidade-origem-group').style.display = 'block';
                 $('btnMovSubmit').textContent = 'Registrar Saída';
                 break;
            case 'TRANSFERENCIA':
                $('mov-form-title').textContent = 'Registrar Transferência';
                $('mov-unidade-origem-group').style.display = 'block';
                $('mov-unidade-destino-group').style.display = 'block';
                $('btnMovSubmit').textContent = 'Transferir';
                break;
            case 'AJUSTE':
                $('mov-form-title').textContent = 'Registrar Ajuste';
                $('mov-unidade-origem-group').style.display = 'block';
                $('mov-ajuste-sinal-group').style.display = 'block';
                $('btnMovSubmit').textContent = 'Ajustar';
                break;
        }
    },
    hideMovForm() {
        $('mov-form-container').style.display = 'none';
        this.stopCamera();
    },
    async handleMovimentacao(e) {
        e.preventDefault();
        const tipoMov = this.currentMovType;
        let rpcName = '';
        let payload = {};
        const item_tipo = $('mov-item-tipo').value;
        const item_id = $('mov-item').value;
        const qtd = ptToNumber($('mov-qtd').value);
        const un = $('mov-un').value;
        const doc = $('mov-doc').value || null;
        try {
            switch(tipoMov) {
                case 'ENTRADA':
                    rpcName = 'rpc_entrada';
                    payload = { p_unidade_id: $('mov-unidade-destino').value, p_item_tipo: item_tipo, p_item_id: item_id, p_lote: $('mov-lote').value || 'LOTE_PADRAO', p_qtd: qtd, p_un: un, p_validade: $('mov-validade').value || null, p_custo_unit: ptToNumber($('mov-custo').value), p_ref_doc: doc };
                    break;
                case 'SAIDA':
                    rpcName = 'rpc_saida';
                    payload = { p_unidade_id: $('mov-unidade-origem').value, p_item_tipo: item_tipo, p_item_id: item_id, p_qtd: qtd, p_un: un, p_ref_doc: doc, p_tipo_saida: 'SAIDA' };
                    break;
                case 'TRANSFERENCIA':
                    rpcName = 'rpc_transferencia';
                     payload = { p_origem_id: $('mov-unidade-origem').value, p_destino_id: $('mov-unidade-destino').value, p_item_tipo: item_tipo, p_item_id: item_id, p_qtd: qtd, p_un: un, p_lote: $('mov-lote').value || null, p_obs: doc };
                    break;
                case 'AJUSTE':
                    rpcName = 'rpc_ajuste_estoque';
                    const sinal = $('mov-ajuste-sinal').value;
                    payload = { p_unidade_id: $('mov-unidade-origem').value, p_item_tipo: item_tipo, p_item_id: item_id, p_lote: $('mov-lote').value || null, p_qtd: sinal === '+' ? qtd : -qtd, p_un: un, p_obs: doc };
                    break;
                default:
                    throw new Error("Tipo de movimentação desconhecido.");
            }
            if (!payload.p_unidade_id && !payload.p_origem_id) {
                alert('Unidade de origem/destino é obrigatória.'); return;
            }
            setStatus('Registrando movimentação...', '');
            const { data, error } = await supa.rpc(rpcName, payload);
            if (error) throw error;
            setStatus('Movimentação registrada com sucesso!', 'ok');
            this.hideMovForm();
            await this.loadRecentMovs();
            await this.loadSaldos();
        } catch(ex) {
            console.error('Erro na movimentação:', ex);
            setStatus('Erro ao registrar: ' + (ex.message || 'Verifique os dados'), 'err');
        }
    },
    toggleCamera() { if(this.stream) { this.stopCamera(); } else { this.startCamera(); } },
    startCamera() {
        const video = $('qr-video');
        video.style.display = 'block';
        $('btnMovScan').textContent = '📷 Parar Câmera';
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(stream => {
            this.stream = stream;
            video.srcObject = stream;
            video.setAttribute("playsinline", true);
            video.play();
            requestAnimationFrame(() => this.tick());
        }).catch(err => {
            console.error("Erro ao acessar a câmera: ", err);
            setStatus("Erro ao acessar a câmera.", "err");
            this.stopCamera();
        });
    },
    stopCamera() {
        if(this.stream) { this.stream.getTracks().forEach(track => track.stop()); }
        this.stream = null;
        $('qr-video').style.display = 'none';
        $('btnMovScan').textContent = '📷 Scan QR';
    },
    tick() {
        const video = $('qr-video');
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            const canvasElement = document.createElement('canvas');
            const canvas = canvasElement.getContext("2d");
            canvasElement.height = video.videoHeight;
            canvasElement.width = video.videoWidth;
            canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
            const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert", });
            if (code) {
                $('qr-result').textContent = `Código detectado: ${code.data}`;
                this.stopCamera();
            }
        }
        if(this.stream) { requestAnimationFrame(() => this.tick()); }
    },
    async loadRecentMovs() {
        const tb = $('tblMovRecentes')?.querySelector('tbody');
        if(!tb) return;
        tb.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
        try {
            const { data, error } = await supa.rpc('rpc_get_recent_movs', { p_limit: 20 });
            if(error) throw error;
            tb.innerHTML = '';
            data.forEach(mov => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${new Date(mov.ts).toLocaleTimeString('pt-BR')}</td><td>${mov.tipo}</td><td>${mov.item_nome || 'N/D'}</td><td>${mov.qtd}</td><td>${mov.unidade_nome || 'N/D'}</td>`;
                tb.appendChild(tr);
            });
        } catch(ex) {
            console.error(ex);
            tb.innerHTML = '<tr><td colspan="5">Erro ao carregar. Verifique se a RPC `rpc_get_recent_movs` foi criada (execute o SQL).</td></tr>';
        }
    },
    
    async loadSaldos() {
       const tbody = $('tblSaldo')?.querySelector('tbody');
       if (!tbody) return;
       tbody.innerHTML = '<tr><td colspan="6">Carregando saldos...</td></tr>';
       try {
           console.log("Iniciando loadSaldos...");
           const { data, error } = await supa.from('estoque_saldo').select(`
                saldo_atual,
                item_tipo,
                unidades ( nome ),
                ingredientes ( nome, estoque_minimo, estoque_maximo, unidades_medida(sigla) )
            `);

            // DEBUG: Exibe a resposta crua do Supabase no console
            console.log("Dados recebidos do Supabase:", data);
            console.error("Erro recebido do Supabase:", error);

           if (error) throw error;
           
            tbody.innerHTML = '';
            if (!data || data.length === 0) {
                console.warn("Nenhum dado de saldo encontrado para exibir.");
                tbody.innerHTML = '<tr><td colspan="6">Nenhum saldo encontrado.</td></tr>';
                return; // Interrompe a função se não houver dados
            }

           data.forEach(item => {
               if (!item.ingredientes) return; 
               const saldo = item.saldo_atual;
               const min = item.ingredientes.estoque_minimo;
               const max = item.ingredientes.estoque_maximo;
               let statusPill = '<span class="pill ok">OK</span>';
               if (min > 0 && saldo < min) statusPill = '<span class="pill warn">Abaixo Mín.</span>';
               if (saldo <= 0) statusPill = '<span class="pill bad">Crítico</span>';
               if (max > 0 && saldo > max) statusPill = '<span class="pill">Acima Máx.</span>';

               const tr = document.createElement('tr');
               tr.innerHTML = `
                   <td>${item.ingredientes.nome}</td>
                   <td>${item.item_tipo}</td>
                   <td>${item.unidades.nome}</td>
                   <td>${fmt(saldo)}</td>
                   <td>${item.ingredientes.unidades_medida?.sigla || 'N/D'}</td>
                   <td>${statusPill}</td>
               `;
               tbody.appendChild(tr);
           });
       } catch(e) {
           tbody.innerHTML = `<tr><td colspan="6">Erro ao carregar saldos. Verifique o console do navegador.</td></tr>`;
           console.error("Erro em loadSaldos:", e);
       }
    },
};

function setupGenericCrud(config) {
    const { tabId, table, formId, editorId, btnShowId, btnCancelId, loadFn, formTitle, entityName } = config;
    addSafeEventListener(btnShowId, 'click', () => {
        const editor = $(editorId);
        const form = $(formId);
        const title = $(`${tabId}-form-title`);
        if(form) {
            form.reset();
            if(form.id) form.id.value = '';
        }
        if(title) title.textContent = `Nova ${formTitle}`;
        if(editor) editor.style.display = 'block';
    });
    addSafeEventListener(btnCancelId, 'click', () => {
        const editor = $(editorId);
        if(editor) editor.style.display = 'none';
    });
    addSafeEventListener(formId, 'submit', async (ev) => {
        ev.preventDefault();
        const f = ev.target;
        const formData = new FormData(f);
        const payload = Object.fromEntries(formData.entries());
        if(payload.fator) payload.fator = Number(payload.fator);
        payload.ativo = f.ativo.checked;
        const id = payload.id;
        delete payload.id;
        const q = id ? supa.from(table).update(payload).eq('id', id) : supa.from(table).insert(payload);
        const { error } = await q;
        if(error){ setStatus(error.message || error, 'err'); return; }
        setStatus(`${entityName} salvo(a) com sucesso!`, 'ok');
        const cancelButton = $(btnCancelId);
        if(cancelButton) cancelButton.click();
        if(loadFn) await loadFn();
    });
}
function createTableActions(onEdit) {
    const td = document.createElement('td');
    td.className = 'row-actions';
    const btnEdit = document.createElement('button');
    btnEdit.textContent = 'Editar';
    btnEdit.className = 'btn small';
    btnEdit.onclick = onEdit;
    td.appendChild(btnEdit);
    return td;
}
async function loadUM(){
    const { data, error } = await supa.from('unidades_medida').select('*').order('nome', { ascending: true });
    if (error) return setStatus('Tabela unidades_medida não encontrada', 'err');
    const tbody = $('tbl-um')?.querySelector('tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    (data || []).forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${r.sigla||''}</td><td>${r.nome||''}</td><td>${r.codigo||''}</td><td>${r.base||''}</td><td>${r.fator||''}</td><td>${r.ativo?'<span class="pill ok">Ativo</span>':'<span class="pill bad">Inativo</span>'}</td>`;
        tr.appendChild(createTableActions(() => {
            const f = $('form-um');
            f.id.value = r.id; f.sigla.value=r.sigla||''; f.nome.value=r.nome||''; f.codigo.value=r.codigo||'';
            f.base.value=r.base||'un'; f.fator.value=r.fator||1; f.ativo.checked=!!r.ativo;
            $('um-form-title').textContent = 'Editar Unidade de Medida';
            $('um-editor-container').style.display = 'block';
        }));
        tbody.appendChild(tr);
    });
}
async function loadUnidades(){
    const { data, error } = await supa.from('unidades').select('*').order('nome', { ascending: true });
    if (error) return setStatus('Tabela unidades não encontrada', 'err');
    const tbody = $('tbl-unidades')?.querySelector('tbody');
    if(!tbody) return;
    tbody.innerHTML='';
    (data || []).forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${r.nome||''}</td><td>${r.ativo?'<span class="pill ok">Ativo</span>':'<span class="pill bad">Inativo</span>'}</td>`;
        tr.appendChild(createTableActions(() => {
            const f = $('form-unidades');
            f.id.value=r.id; f.nome.value=r.nome||''; f.ativo.checked=!!r.ativo;
            $('unidades-form-title').textContent = 'Editar Unidade (destino)';
            $('unidades-editor-container').style.display = 'block';
        }));
        tbody.appendChild(tr);
    });
}
async function loadCategorias(){
    const { data, error } = await supa.from('categorias').select('*').order('nome', { ascending: true });
    if (error) return setStatus('Tabela categorias não encontrada', 'err');
    const tbody = $('tbl-categorias')?.querySelector('tbody');
    if(!tbody) return;
    tbody.innerHTML='';
    (data || []).forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${r.nome||''}</td><td>${r.tipo||''}</td><td>${r.ativo?'<span class="pill ok">Ativo</span>':'<span class="pill bad">Inativo</span>'}</td>`;
        tr.appendChild(createTableActions(() => {
            const f = $('form-categorias');
            f.id.value=r.id; f.nome.value=r.nome||''; f.tipo.value=r.tipo||'INGREDIENTE'; f.ativo.checked=!!r.ativo;
            $('categorias-form-title').textContent = 'Editar Categoria';
            $('categorias-editor-container').style.display = 'block';
        }));
        tbody.appendChild(tr);
    });
}
let itemTiposTableName = null;
async function detectAndLoadItemTipos(){
    if (!itemTiposTableName) {
        for (const t of ['item_tipos', 'tipos_item']){
            const { error } = await supa.from(t).select('id', { count: 'exact', head: true });
            if (!error) {
                itemTiposTableName = t;
                if($('itemtipos-warning')) $('itemtipos-warning').hidden = true;
                break;
            }
        }
    }
    if (!itemTiposTableName) {
        if($('itemtipos-warning')) $('itemtipos-warning').hidden = false;
        return;
    }
    const { data, error } = await supa.from(itemTiposTableName).select('*').order('nome', { ascending: true });
    if (error) return setStatus(`Erro ao ler ${itemTiposTableName}`, 'err');
    const tbody = $('tbl-itemtipos')?.querySelector('tbody');
    if(!tbody) return;
    tbody.innerHTML='';
    (data || []).forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${r.nome||''}</td><td>${r.ativo?'<span class="pill ok">Ativo</span>':'<span class="pill bad">Inativo</span>'}</td>`;
        tr.appendChild(createTableActions(() => {
            const f = $('form-itemtipos');
            f.id.value=r.id; f.nome.value=r.nome||''; f.ativo.checked=!!r.ativo;
            $('itemtipos-form-title').textContent = 'Editar Tipo de Item';
            $('itemtipos-editor-container').style.display = 'block';
        }));
        tbody.appendChild(tr);
    });
}

async function loadEstoqueParams() {
    const tbody = $('tbl-estoque-params')?.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6">Carregando parâmetros...</td></tr>';
    try {
        const { data, error } = await supa.from('v_ingredientes_detalhados').select('*').order('nome', { ascending: true });
        if (error) throw error;
        
        tbody.innerHTML = '';
        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.nome}</td>
                <td>${fmt(item.estoque_minimo)}</td>
                <td>${fmt(item.estoque_maximo)}</td>
                <td>${item.unidade_medida_sigla || 'N/D'}</td>
                <td>${item.unidade_armazenagem_nome || 'N/D'}</td>
                <td class="row-actions">
                    <button class="btn small btn-edit-param" data-id="${item.id}">Editar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="6">Erro ao carregar parâmetros.</td></tr>';
        console.error(e);
    }
}

async function populateStockFilters() {
    await fillOptionsFrom('categorias', 'filtro-categoria-estoque', 'nome', 'nome', { tipo: 'INGREDIENTE' });
}

document.addEventListener('click', (e) => {
    if (e.target.matches('.btn-edit-param')) {
        const id = e.target.dataset.id;
        $('main-tabs').querySelector('[data-tab="cadastros"]').click();
        $('cadastro-subtabs').querySelector('[data-subtab="ingredientes"]').click();
        
        const editButton = $(`tblIng`)?.querySelector(`button[data-act="edit"][data-id="${id}"]`);
        if (editButton) {
            editButton.click();
            const editor = $('ingrediente-editor-container');
            if(editor) editor.scrollIntoView({ behavior: 'smooth' });
        }
    }
});

async function init(){
  try{
    setupRouting();
    
    setupGenericCrud({ tabId: 'um', table: 'unidades_medida', formId: 'form-um', editorId: 'um-editor-container', btnShowId: 'btnShowNewUmForm', btnCancelId: 'btnCancelUmEdit', loadFn: loadUM, formTitle: 'Unidade de Medida', entityName: 'Unidade de medida' });
    setupGenericCrud({ tabId: 'unidades', table: 'unidades', formId: 'form-unidades', editorId: 'unidades-editor-container', btnShowId: 'btnShowNewUnidadesForm', btnCancelId: 'btnCancelUnidadesEdit', loadFn: loadUnidades, formTitle: 'Unidade (destino)', entityName: 'Unidade' });
    setupGenericCrud({ tabId: 'categorias', table: 'categorias', formId: 'form-categorias', editorId: 'categorias-editor-container', btnShowId: 'btnShowNewCategoriasForm', btnCancelId: 'btnCancelCategoriasEdit', loadFn: loadCategorias, formTitle: 'Categoria', entityName: 'Categoria' });
    
    addSafeEventListener('btnShowNewItemTiposForm', 'click', () => { if($('itemtipos-editor-container')){$('itemtipos-editor-container').style.display = 'block'; if($('form-itemtipos')){$('form-itemtipos').reset(); $('form-itemtipos').id.value = '';}} });
    addSafeEventListener('btnCancelItemTiposEdit', 'click', () => { if($('itemtipos-editor-container')) $('itemtipos-editor-container').style.display = 'none'; });
    addSafeEventListener('form-itemtipos', 'submit', async(ev) => {
        ev.preventDefault();
        if(!itemTiposTableName){ setStatus('Crie a tabela item_tipos ou tipos_item no banco para editar.','err'); return; }
        const f = ev.target;
        const payload = { id: f.id.value||undefined, nome: f.nome.value?.trim(), ativo: f.ativo.checked };
        const q = payload.id ? supa.from(itemTiposTableName).update(payload).eq('id', payload.id) : supa.from(itemTiposTableName).insert(payload);
        const { error } = await q;
        if(error){ setStatus(error.message||error, 'err'); return; }
        setStatus('Tipo de item salvo', 'ok');
        if($('btnCancelItemTiposEdit')) $('btnCancelItemTiposEdit').click();
        await detectAndLoadItemTipos();
    });

    const mapLoaders = {
      'pratos': loadPratos,
      'ingredientes': loadIngredientes,
      'um': loadUM,
      'unidades': loadUnidades,
      'categorias': loadCategorias,
      'item-tipos': detectAndLoadItemTipos,
      'estoque-param': loadEstoqueParams,
      'estoque-visao': EstoqueModule.loadSaldos,
    };
    document.querySelectorAll('.subtabs [data-subtab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sub = btn.getAttribute('data-subtab');
        if(mapLoaders[sub]) mapLoaders[sub]();
      });
    });

    await fillOptionsFrom('unidades_medida', 'ing-unidade-medida', 'id', 'sigla');
    await fillOptionsFrom('unidades', 'ing-local-armazenagem', 'id', 'nome');

    await backfillUniqueCodes('pratos');
    await backfillUniqueCodes('receitas');
    await backfillUniqueCodes('ingredientes');
    await loadPratos(); 
    await loadReceitas(); 
    await loadIngredientes(); 
    await preencherCategorias();
    await populateStockFilters();
    await loadDash?.();
    EstoqueModule.init();
    setStatus('Pronto','ok');
  }catch(e){ 
    console.error("Erro fatal na inicialização:", e);
    setStatus(e.message||e,'err'); 
  }
}
document.addEventListener('DOMContentLoaded',init);
