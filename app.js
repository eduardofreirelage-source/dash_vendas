// =================================================================================
// SCRIPT DE DIAGNÓSTICO (v8.5-diag) - NÃO É A CORREÇÃO FINAL
// =================================================================================

console.log("[DIAGNOSTICO v8.5-diag] Script de diagnóstico iniciado.");

/* ===== Helpers com verificações de segurança ===== */
const $  = (id)=> document.getElementById(id);
const $$ = (sel,root=document)=> Array.from(root.querySelectorAll(sel));
const setStatus=(msg,cls)=>{
    const el=$('status'); if(!el) return;
    el.textContent=msg;
    const colorMap = { 'err': 'var(--down)', 'ok': 'var(--ok)', 'warn': 'var(--warn)' };
    if (el && el.style) {
        el.style.color = colorMap[cls] || 'var(--muted)';
    }
};
const fmt=(n, digits=3)=> new Intl.NumberFormat('pt-BR',{maximumFractionDigits:digits, minimumFractionDigits: digits}).format(+n||0);
const fmtMoney=(n)=> new Intl.NumberFormat('pt-BR',{style: 'currency', currency: 'BRL'}).format(+n||0);
const showEditor = (id) => { const el = $(id); if(el && el.style) el.style.display = 'block'; };
const hideEditor = (id) => { const el = $(id); if(el && el.style) el.style.display = 'none'; };

// ================================================================================
// >>>>> FUNÇÃO getFormData COM LOGS DE DIAGNÓSTICO <<<<<
// ================================================================================
const getFormData = (formId) => {
    console.log(`%c[DIAGNOSTICO] Iniciando getFormData para o form: #${formId}`, 'color: blue; font-weight: bold;');
    const form = $(formId);
    if (!form) {
        console.error(`[DIAGNOSTICO] ERRO CRÍTICO: Formulário #${formId} não foi encontrado no HTML!`);
        return {};
    }
    const obj = {};
    console.log(`[DIAGNOSTICO] Formulário encontrado. Iterando sobre ${form.elements.length} elementos.`);

    for (let element of form.elements) {
        if (!element.name || ['submit', 'button', 'fieldset', 'reset'].includes(element.type)) {
            continue;
        }

        // Log detalhado de cada elemento que está sendo processado
        console.log(`[DIAGNOSTICO] -> Processando: name="${element.name}", type="${element.type}", value="${element.value}"`);

        if (element.type === 'checkbox') {
            obj[element.name] = element.checked;
        } else if (element.type === 'number' || element.dataset.type === 'number') {
            if (element.value === "" || element.value === null) {
                obj[element.name] = null;
            } else {
                const numVal = parseFloat(element.value);
                obj[element.name] = isNaN(numVal) ? null : numVal;
            }
        } else if (element.type === 'radio') {
            if (element.checked) {
                obj[element.name] = element.value;
            }
        } else {
            obj[element.name] = element.value === "" ? null : element.value;
        }
    }
    
    if (obj.hasOwnProperty('id') && (obj.id === "" || obj.id === null)) {
        delete obj.id;
    }

    console.log('%c[DIAGNOSTICO] Objeto de dados final coletado:', 'color: green; font-weight: bold;', obj);
    return obj;
};


/* ===================== CONFIGURAÇÃO DA API ===================== */
const SUPABASE_URL  = 'https://tykdmxaqvqwskpmdiekw.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2RteGFxdnF3c2twbWRpZWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyOTg2NDYsImV4cCI6MjA3Mjg3NDY0Nn0.XojR4nVx_Hr4FtZa1eYi3jKKSVVPokG23jrJtm8_3ps';
var supa;
if (!window.supabase) {
    console.error("Biblioteca Supabase não carregada!");
    setStatus("Erro: Biblioteca Supabase não carregada.", "err");
} else {
    try {
        supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    } catch (e) {
        console.error("Falha ao inicializar o cliente Supabase:", e);
        setStatus("Erro: Falha ao conectar com o banco de dados.", "err");
    }
}
function addSafeEventListener(id, event, handler) {
    const element = $(id);
    if (element) { element.addEventListener(event, handler); }
}
/* ===== ROTEAMENTO POR ABAS ===== */
function setupRouting() {
  const mainTabsContainer = $('main-tabs');
  if (!mainTabsContainer) return;
  const mainContents = $$('.tab-content');
  const setupSubTabs = (containerId, contentSelector) => {
      const container = $(containerId);
      if (!container) return;
      const contents = $$(contentSelector);
      container.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn || !btn.dataset.subtab) return;
        const subTabId = btn.dataset.subtab;
        if (containerId !== 'estoque-subtabs') {
            $$('.editor-container').forEach(ed => hideEditor(ed.id));
        }
        $$('button', container).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        contents.forEach(content => content.classList.toggle('active', content.id === 'sub-' + subTabId));
      });
  };
  mainTabsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || !btn.dataset.tab) return;
    const tabId = btn.dataset.tab;
    $$('button', mainTabsContainer).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mainContents.forEach(content => content.classList.toggle('active', content.id === 'tab-' + tabId));
  });
  setupSubTabs('cadastro-subtabs', '#tab-cadastros .subpage');
  setupSubTabs('estoque-subtabs', '#tab-estoque .subpage');
}
/* ===== FUNÇÕES DE CARREGAMENTO (LOADERS) ===== */
async function fillOptionsFrom(table, selId, valKey, labelKey, whereEq, allowEmpty = true){
  const sel=$(selId);
  if(!sel) return;
  if (sel.options.length > (allowEmpty ? 1 : 0) && !sel.dataset.loading && !sel.dataset.forceReload) return;
  sel.dataset.loading = true;
  delete sel.dataset.forceReload;
  const previousHTML = sel.innerHTML;
  if (sel.options.length === 0 || allowEmpty) sel.innerHTML='<option value="">Carregando…</option>';
  try{
    let query=supa.from(table).select(`${valKey},${labelKey}`).order(labelKey,{ascending:true});
    if(whereEq) Object.entries(whereEq).forEach(([k,v])=> query=query.eq(k,v));
    const {data,error}=await query;
    if(error) throw error;
    sel.innerHTML = allowEmpty ? '<option value="">Selecione</option>' : '';
    (data||[]).forEach(x=>{ const o=document.createElement('option'); o.value=x[valKey]; o.textContent=x[labelKey]; sel.appendChild(o); });
  }catch(e){
    console.error(`Erro ao carregar options para ${selId}:`, e);
    sel.innerHTML= previousHTML || '<option value="">(Erro)</option>';
  } finally {
      delete sel.dataset.loading;
  }
}
/* ===== MÓDULO GENÉRICO DE CRUD ===== */
const GenericCRUD = {
    async loadTable(table, tableId, columns, actions = true, view = null) {
        const tb = $(tableId)?.querySelector('tbody');
        if (!tb) return;
        const source = view || table;
        let orderCol = columns.includes('nome') ? 'nome' : (columns.includes('data_hora') ? 'data_hora' : columns[0]);
        const ascending = !columns.includes('data_hora');
        tb.innerHTML = `<tr><td colspan="${columns.length + (actions ? 1 : 0)}">Carregando…</td></tr>`;
        try {
            const { data, error } = await supa.from(source).select('*').order(orderCol, { ascending: ascending }).limit(500);
            if (error) throw error;
            tb.innerHTML = '';
            if (!data || data.length === 0) {
                tb.innerHTML = `<tr><td colspan="${columns.length + (actions ? 1 : 0)}" style="text-align:center; padding: 20px;">Nenhum registro encontrado.</td></tr>`;
                return;
            }
            data.forEach(item => {
                const tr = document.createElement('tr');
                columns.forEach(col => {
                    const td = document.createElement('td');
                    if (col === 'ativo') {
                        td.innerHTML = item.ativo ? '<span class="pill ok">Ativo</span>' : '<span class="pill bad">Inativo</span>';
                    } else if (col.includes('custo') || col.includes('preco')) {
                         td.textContent = fmtMoney(item[col]);
                    } else if (col === 'data_hora') {
                        td.textContent = new Date(item[col]).toLocaleString('pt-BR');
                    }
                    else {
                        td.textContent = item[col] || '—';
                    }
                    tr.appendChild(td);
                });
                if (actions) {
                    const tdActions = document.createElement('td');
                    tdActions.className = 'row-actions';
                    const toggleBtn = item.hasOwnProperty('ativo') ? `<button class="btn small" data-act="toggle" data-id="${item.id}">${item.ativo ? 'Desativar' : 'Ativar'}</button>` : '';
                    tdActions.innerHTML = `<button class="btn small" data-act="edit" data-id="${item.id}">Editar</button>${toggleBtn}`;
                    tr.appendChild(tdActions);
                }
                tb.appendChild(tr);
            });
        } catch (e) {
            console.error(`Erro ao carregar ${table}:`, e);
            tb.innerHTML = `<tr><td colspan="${columns.length + (actions ? 1 : 0)}">Erro ao carregar.</td></tr>`;
        }
    },
    showForm(editorId, formId, titleId, titleText, data = null) {
        const form = $(formId);
        if (!form) return;
        form.reset();
        if ($(titleId)) $(titleId).textContent = titleText;
        if (data) {
            Object.keys(data).forEach(key => {
                const input = form.elements[key];
                if (input) {
                    if (input.type === 'checkbox') input.checked = data[key];
                    else input.value = data[key] || '';
                }
            });
            const idInput = form.querySelector('input[name="id"]');
            if (idInput) idInput.value = data.id || '';
        } else {
            const idInput = form.querySelector('input[name="id"]');
            if (idInput) idInput.value = '';
            if (form.elements['ativo'] && form.elements['ativo'].type === 'checkbox') {
                form.elements['ativo'].checked = true;
            }
        }
        showEditor(editorId);
    },
    async save(e, table, editorId, refreshCallback) {
        e.preventDefault();
        const form = e.target;
        if (form && typeof form.checkValidity === 'function' && !form.checkValidity()) {
            setStatus('Por favor, preencha todos os campos obrigatórios.', 'err');
            if (typeof form.reportValidity === 'function') form.reportValidity();
            return;
        }
        const data = getFormData(e.target.id);
        const id = data.id;
        if (id) delete data.id;
        setStatus(`Salvando...`);
        try {
            const { error } = id ? await supa.from(table).update(data).eq('id', id) : await supa.from(table).insert([data]);
            if (error) throw error;
            setStatus(`Registro salvo com sucesso!`, 'ok');
            hideEditor(editorId);
            if (refreshCallback) refreshCallback();
        } catch (err) {
            console.error(`Erro ao salvar ${table}:`, err);
            setStatus(err.code === '23505' ? 'Erro: Já existe um registro com estes dados.' : `Erro: ${err.message}`, 'err');
        }
    },
    async toggle(table, id, refreshCallback) {
        setStatus('Atualizando status...');
        try {
            const { data, error: selectError } = await supa.from(table).select('ativo').eq('id', id).single();
            if (selectError || !data) throw new Error(selectError?.message || "Registro não encontrado.");
            const { error } = await supa.from(table).update({ ativo: !data.ativo }).eq('id', id);
            if (error) throw error;
            setStatus('Status atualizado.', 'ok');
            if (refreshCallback) refreshCallback();
        } catch (err) {
            console.error(`Erro ao alternar status em ${table}:`, err);
            setStatus(`Erro: ${err.message}`, 'err');
        }
    },
    async handleTableClick(e, table, editorId, formId, titleId, refreshCallback) {
        const btn = e.target.closest('button');
        if (!btn) return;
        const { act: action, id } = btn.dataset;
        if (action === 'toggle') {
            this.toggle(table, id, refreshCallback);
        } else if (action === 'edit') {
            if (table === 'pratos') hideEditor('prato-import-container');
            try {
                const { data, error } = await supa.from(table).select('*').eq('id', id).single();
                if (error) throw error;
                this.showForm(editorId, formId, titleId, `Editar Registro`, data);
            } catch (err) {
                setStatus(`Erro ao carregar dados: ${err.message}`, 'err');
            }
        }
    }
};
// ... O restante do código (todos os módulos e a inicialização) continua o mesmo da versão v8.4 ...
// A única alteração é na função getFormData no topo do arquivo.
// O restante do arquivo foi omitido aqui para não ser repetitivo, mas deve ser mantido no seu app.js.
// ... (COLE O RESTANTE DO CÓDIGO v8.4 AQUI) ...
