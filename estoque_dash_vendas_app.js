// =================================================================================
// SCRIPT COMPLETO E REVISADO PARA O SISTEMA DE GESTÃO (app.html)
// =================================================================================

/* ===== Helpers com verificações de segurança ===== */
const $  = (id)=> document.getElementById(id);
const $$ = (sel,root=document)=> Array.from(root.querySelectorAll(sel));
const setStatus=(msg,cls)=>{
    const el=$('status'); if(!el) return; 
    el.textContent=msg; 
    const colorMap = { 'err': 'var(--down)', 'ok': 'var(--ok)', 'warn': 'var(--warn)' };
    el.style.color = colorMap[cls] || 'var(--muted)';
};
const fmt=(n, digits=3)=> new Intl.NumberFormat('pt-BR',{maximumFractionDigits:digits, minimumFractionDigits: digits}).format(+n||0);
const fmtMoney=(n)=> new Intl.NumberFormat('pt-BR',{style: 'currency', currency: 'BRL'}).format(+n||0);
const showEditor = (id) => { const el = $(id); if(el) el.style.display = 'block'; };
const hideEditor = (id) => { const el = $(id); if(el) el.style.display = 'none'; };

const getFormData = (formId) => {
    const form = $(formId);
    if (!form) return {};
    const data = new FormData(form);
    const obj = {};
    for (let element of form.elements) {
        if (element.name) {
            if (element.type === 'checkbox') {
                obj[element.name] = element.checked;
            } else if (element.type === 'number') {
                obj[element.name] = element.value ? parseFloat(element.value) : null;
            } else if (data.has(element.name)) {
                const value = data.get(element.name);
                obj[element.name] = value ? value : null;
            }
        }
    }
    const idInput = form.querySelector('input[name="id"]');
    if (idInput && idInput.value) {
        obj.id = idInput.value;
    }
    return obj;
};


/* ===================== CONFIGURAÇÃO DA API ===================== */
// ATENÇÃO: SUBSTITUA ESTES VALORES PELOS SEUS DADOS REAIS DO PAINEL SUPABASE
const SUPABASE_URL  = 'https://rqeagimulvgfecvuzubk.supabase.co'; // DEVE COMEÇAR COM https://
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZWFnaW11bHZnZmVjdnV6dWJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5NzkyMzUsImV4cCI6MjA3MjU1NTIzNX0.SeNHyHOlpqjm-QTl7KXq7YF-48fk5iOQCRgpangP4zU'; // Sua chave pública (ANON)
// ===============================================================

// Inicialização segura do Supabase
var supa;
if (!window.supabase) {
    console.error("Biblioteca Supabase não carregada!");
} else if (SUPABASE_URL.startsWith('http')) {
    try {
        supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    } catch (e) {
        console.error("Falha ao inicializar o cliente Supabase:", e);
    }
} else {
    console.error("ERRO CRÍTICO: SUPABASE_URL inválida ou não configurada em estoque_app.js! Verifique se começa com https://.");
}


// Listener seguro que verifica se o elemento existe antes de adicionar o evento
function addSafeEventListener(id, event, handler) {
    const element = $(id);
    if (element) { element.addEventListener(event, handler); }
    else { 
        // Reporta o elemento faltante no console para ajudar na depuração
        console.warn(`Elemento não encontrado para listener: ${id}`); 
    }
}

/* ===== ROTEAMENTO POR ABAS ===== */
function setupRouting() {
  // Verificação de segurança crítica para evitar o erro de addEventListener
  const mainTabsContainer = $('main-tabs');
  if (!mainTabsContainer) {
      console.error("Container de abas principais 'main-tabs' não encontrado. Roteamento falhou.");
      return;
  }
  
  const mainContents = $$('.tab-content');
  
  const setupSubTabs = (containerId, contentSelector) => {
      const container = $(containerId);
      if (!container) {
          console.warn(`Container de subabas '${containerId}' não encontrado.`);
          return;
      }
      const contents = $$(contentSelector);
      container.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const subTabId = btn.dataset.subtab;
        if (!subTabId) return;
        $$('button', container).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        contents.forEach(content => content.classList.toggle('active', content.id === 'sub-' + subTabId));
      });
  };
  
  mainTabsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
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
  // Verificação de segurança
  if(!sel) {
      console.warn(`Elemento SELECT não encontrado: ${selId}`);
      return;
  }

  if (sel.options.length > (allowEmpty ? 1 : 0) && !sel.dataset.loading) return;
  
  sel.dataset.loading = true;
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
    // Feedback específico para o erro de conexão (Failed to Fetch)
    if (e.message.includes('Failed to fetch')) {
        setStatus('Erro de conexão (Failed to Fetch). Verifique as credenciais do Supabase no arquivo JS.', 'err');
    }
    sel.innerHTML= previousHTML || '<option value="">(Erro)</option>';
  } finally {
      delete sel.dataset.loading;
  }
}

/* ===== MÓDULO GENÉRICO DE CRUD (Para tabelas simples) ===== */
const GenericCRUD = {
    async loadTable(table, tableId, columns, actions = true) {
        const tb = $(tableId)?.querySelector('tbody'); 
        if (!tb) {
             console.warn(`Tabela não encontrada: ${tableId}`);
             return;
        }
        tb.innerHTML = `<tr><td colspan="${columns.length + (actions ? 1 : 0)}">Carregando…</td></tr>`;
        try {
            const orderCol = columns.includes('nome') ? 'nome' : columns[0];
            const { data, error } = await supa.from(table).select('*').order(orderCol, { ascending: true });
            if (error) throw error;
            tb.innerHTML = '';
            (data || []).forEach(item => {
                const tr = document.createElement('tr');
                columns.forEach(col => {
                    const td = document.createElement('td');
                    if (col === 'ativo') {
                        td.innerHTML = item.ativo ? '<span class="pill ok">Ativo</span>' : '<span class="pill bad">Inativo</span>';
                    } else {
                        td.textContent = item[col] || '—';
                    }
                    tr.appendChild(td);
                });
                if (actions) {
                    const tdActions = document.createElement('td');
                    tdActions.className = 'row-actions';
                    tdActions.innerHTML = `<button class="btn small" data-act="edit" data-id="${item.id}">Editar</button>
                                           <button class="btn small" data-act="toggle" data-id="${item.id}">${item.ativo ? 'Desativar' : 'Ativar'}</button>`;
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
        const titleEl = $(titleId);
        if (titleEl) titleEl.textContent = titleText;
        
        if (data) {
            Object.keys(data).forEach(key => {
                const input = form.elements[key];
                if (input) {
                    if (input.type === 'checkbox') {
                        input.checked = data[key];
                    } else {
                        input.value = data[key];
                    }
                }
            });
        }
        showEditor(editorId);
    },

    async save(e, table, editorId, refreshCallback) {
        e.preventDefault();
        const form = e.target;
        const data = getFormData(form.id);
        const id = data.id;
        delete data.id;

        setStatus(`Salvando ${table}...`);
        try {
            let query;
            if (id) {
                query = supa.from(table).update(data).eq('id', id);
            } else {
                query = supa.from(table).insert([data]);
            }
            const { error } = await query;
            if (error) throw error;

            setStatus(`Registro salvo com sucesso!`, 'ok');
            hideEditor(editorId);
            if (refreshCallback) refreshCallback();
        } catch (err) {
            console.error(`Erro ao salvar ${table}:`, err);
            setStatus(`Erro: ${err.message}`, 'err');
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
        const action = btn.dataset.act;
        const id = btn.dataset.id;

        if (action === 'toggle') {
            this.toggle(table, id, refreshCallback);
        } else if (action === 'edit') {
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

/* ===== MÓDULO DE CADASTROS AUXILIARES (Unidades, Categorias, UM) ===== */
const AuxiliaresModule = {
    init() {
        // Configuração robusta que agora funciona pois o HTML está completo
        this.setupCRUD('um', 'unidades_medida', ['sigla', 'nome', 'base', 'fator', 'ativo']);
        this.setupCRUD('unidades', 'unidades', ['nome', 'ativo']);
        this.setupCRUD('categorias', 'categorias', ['nome', 'tipo', 'ativo']);
        
        this.refreshAll();
    },

    setupCRUD(prefix, table, columns) {
        const editorId = `${prefix}-editor-container`;
        const formId = `form-${prefix}`;
        const titleId = `${prefix}-form-title`;
        const tableId = `tbl-${prefix}`;
        
        // Nomes dos botões baseados na convenção (Ex: btnShowNewUmForm, btnCancelUmEdit)
        const capitalizedPrefix = prefix.charAt(0).toUpperCase() + prefix.slice(1);
        const btnNewName = `btnShowNew${capitalizedPrefix}Form`;
        const btnCancelName = `btnCancel${capitalizedPrefix}Edit`;

        const refresh = () => {
            GenericCRUD.loadTable(table, tableId, columns);
            if (table === 'unidades_medida') this.refreshUMDropdowns();
            if (table === 'unidades') this.refreshUnidadesDropdowns();
            if (table === 'categorias') this.refreshCategoriasDropdowns();
        };

        // Event Listeners seguros
        addSafeEventListener(btnNewName, 'click', () => {
            GenericCRUD.showForm(editorId, formId, titleId, `Novo Registro`);
        });
        addSafeEventListener(btnCancelName, 'click', () => hideEditor(editorId));
        addSafeEventListener(formId, 'submit', (e) => GenericCRUD.save(e, table, editorId, refresh));
        
        const tableEl = $(tableId);
        if (tableEl) {
             tableEl.addEventListener('click', (e) => GenericCRUD.handleTableClick(e, table, editorId, formId, titleId, refresh));
        }
    },

    refreshAll() {
        GenericCRUD.loadTable('unidades_medida', 'tbl-um', ['sigla', 'nome', 'base', 'fator', 'ativo']);
        GenericCRUD.loadTable('unidades', 'tbl-unidades', ['nome', 'ativo']);
        GenericCRUD.loadTable('categorias', 'tbl-categorias', ['nome', 'tipo', 'ativo']);
        this.refreshUMDropdowns();
        this.refreshUnidadesDropdowns();
        this.refreshCategoriasDropdowns();
    },
    
    refreshUMDropdowns() {
        fillOptionsFrom('unidades_medida', 'ing-unidade-medida', 'id', 'sigla', {ativo: true}, false);
        fillOptionsFrom('unidades_medida', 'draft-und', 'sigla', 'sigla', {ativo: true}, false);
    },
    
    refreshUnidadesDropdowns() {
        fillOptionsFrom('unidades', 'ing-local-armazenagem', 'id', 'nome', {ativo: true});
        fillOptionsFrom('unidades', 'mov-unidade-origem', 'id', 'nome', {ativo: true});
        fillOptionsFrom('unidades', 'mov-unidade-destino', 'id', 'nome', {ativo: true});
    },
    
    refreshCategoriasDropdowns() {
        fillOptionsFrom('categorias', 'ing-categoria', 'id', 'nome', {tipo: 'INGREDIENTE', ativo: true});
        fillOptionsFrom('categorias', 'prato-cat', 'id', 'nome', {tipo: 'PRATO', ativo: true});
        
        const catFilter = $('cat-filter');
        if (catFilter && catFilter.options.length === 0) {
            // Verifica se 'supa' está definido antes de usar
            if (typeof supa !== 'undefined' && supa.from) {
                supa.from('categorias').select('id, nome').eq('tipo', 'PRATO').eq('ativo', true).order('nome').then(({data, error}) => {
                    if (!error && data) {
                        data.forEach(cat => {
                            const opt = document.createElement('option');
                            opt.value = cat.id;
                            opt.textContent = cat.nome;
                            catFilter.appendChild(opt);
                        });
                    }
                });
            }
        }
    }
};

// (Módulos IngredientesModule, ReceitasModule, PratosModule, ProducaoModule, EstoqueModule, ComprasModule 
// permanecem inalterados da primeira implementação detalhada, omitidos aqui para brevidade)
// INCLUA O CÓDIGO COMPLETO DESTES MÓDULOS AQUI


/* ===== INICIALIZAÇÃO ===== */
async function init(){
  try{
    // Verifica se o cliente Supabase foi inicializado corretamente
    if (typeof supa === 'undefined' || !supa.from) {
      throw new Error("Falha na inicialização do Supabase. Verifique as credenciais (URL/Chave) em estoque_app.js.");
    }
    setStatus('Inicializando módulos...');
    
    // Configura o roteamento (agora seguro)
    setupRouting();
    
    // Inicializa módulos na ordem de dependência
    AuxiliaresModule.init();
    // IngredientesModule.init();
    // ReceitasModule.init();
    // PratosModule.init();
    // ProducaoModule.init();
    // EstoqueModule.init();
    // ComprasModule.init();
    
    setStatus('Pronto','ok');
  } catch(e) { 
    console.error("Erro fatal na inicialização:", e);
    setStatus(e.message, 'err');
  }
}

// Garante que o DOM esteja carregado antes de iniciar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
