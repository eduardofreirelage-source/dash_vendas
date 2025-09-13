// =================================================================================
// SCRIPT COMPLETO E REVISADO (v6.0 - Verificação Imediata de Cache)
// =================================================================================

// ESTA LINHA É CRUCIAL PARA VERIFICAR O CACHE
console.log("[DIAGNOSTICO v6.0] Script Iniciado. Se você vê esta mensagem, o cache foi limpo corretamente.");


/* ===== Helpers com verificações de segurança ===== */
const $  = (id)=> document.getElementById(id);
const $$ = (sel,root=document)=> Array.from(root.querySelectorAll(sel));
const setStatus=(msg,cls)=>{
    const el=$('status'); if(!el) return;
    el.textContent=msg;
    const colorMap = { 'err': 'var(--down)', 'ok': 'var(--ok)', 'warn': 'var(--warn)' };
    if (el.style) {
        el.style.color = colorMap[cls] || 'var(--muted)';
    }
};
const fmt=(n, digits=3)=> new Intl.NumberFormat('pt-BR',{maximumFractionDigits:digits, minimumFractionDigits: digits}).format(+n||0);
const fmtMoney=(n)=> new Intl.NumberFormat('pt-BR',{style: 'currency', currency: 'BRL'}).format(+n||0);
const showEditor = (id) => { const el = $(id); if(el && el.style) el.style.display = 'block'; };
const hideEditor = (id) => { const el = $(id); if(el && el.style) el.style.display = 'none'; };

// Função REFORMULADA (v6.0): Iteração direta sobre form.elements.
const getFormData = (formId) => {
    const form = $(formId);
    if (!form) return {};
    const obj = {};

    // Diagnóstico
    console.log(`[DIAGNOSTICO v6.0] Coletando dados do formulário: ${formId}`);

    // Itera diretamente sobre todos os elementos do formulário
    for (let element of form.elements) {
        // Ignora elementos sem nome, botões de submit/button, reset e fieldsets
        if (!element.name || ['submit', 'button', 'fieldset', 'reset'].includes(element.type)) {
            continue;
        }

        // Diagnóstico
        console.log(`[DIAGNOSTICO] Processando: Name=${element.name}, Type=${element.type}, Value=${element.value}`);

        if (element.type === 'checkbox') {
            obj[element.name] = element.checked;
        } else if (element.type === 'number' || element.dataset.type === 'number') {
            // Tratamento de Números
            if (element.value === "" || element.value === null) {
                obj[element.name] = null;
            } else {
                const numVal = parseFloat(element.value);
                obj[element.name] = isNaN(numVal) ? null : numVal;
            }
        } else if (element.type === 'radio') {
            // Tratamento de Radio Buttons (só inclui se estiver marcado)
            if (element.checked) {
                obj[element.name] = element.value;
            }
        } else {
            // Tratamento padrão (text, select-one, textarea, date, hidden, etc.)
            obj[element.name] = element.value;
        }
    }

    // Tratamento do ID (Remove se estiver vazio para permitir INSERTs)
    if (obj.hasOwnProperty('id')) {
         if (obj.id === "" || obj.id === null) {
             delete obj.id;
         }
    }

    // Diagnóstico
    console.log("[DIAGNOSTICO] Objeto Final Coletado:", obj);
    return obj;
};


/* ===================== CONFIGURAÇÃO DA API ===================== */
const SUPABASE_URL  = 'https://tykdmxaqvqwskpmdiekw.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2RteGFxdnF3c2twbWRpZWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyOTg2NDYsImV4cCI6MjA3Mjg3NDY0Nn0.XojR4nVx_Hr4FtZa1eYi3jKKSVVPokG23jrJtm8_3ps';
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
    console.error("ERRO CRÍTICO: SUPABASE_URL inválida ou não configurada em app.js!");
}


// Listener seguro
function addSafeEventListener(id, event, handler) {
    const element = $(id);
    if (element) { element.addEventListener(event, handler); }
}

/* ===== ROTEAMENTO POR ABAS (Inalterado) ===== */
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

/* ===== FUNÇÕES DE CARREGAMENTO (LOADERS) (Inalterado) ===== */
async function fillOptionsFrom(table, selId, valKey, labelKey, whereEq, allowEmpty = true){
  const sel=$(selId);
  if(!sel) return;

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
    sel.innerHTML= previousHTML || '<option value="">(Erro)</option>';
  } finally {
      delete sel.dataset.loading;
  }
}

/* ===== MÓDULO GENÉRICO DE CRUD (Atualizado para v6.0) ===== */
const GenericCRUD = {
    async loadTable(table, tableId, columns, actions = true, view = null) {
        const tb = $(tableId)?.querySelector('tbody');
        if (!tb) return;

        const source = view || table;

        let orderCol = columns[0];
        if (columns.includes('nome')) orderCol = 'nome';
        else if (columns.includes('data_hora')) orderCol = 'data_hora';
        const ascending = !columns.includes('data_hora');

        tb.innerHTML = `<tr><td colspan="${columns.length + (actions ? 1 : 0)}">Carregando…</td></tr>`;

        try {
            const { data, error } = await supa.from(source).select('*').order(orderCol, { ascending: ascending }).limit(500);
            if (error) throw error;
            tb.innerHTML = '';
            if ((data || []).length === 0) {
                tb.innerHTML = `<tr><td colspan="${columns.length + (actions ? 1 : 0)}" style="text-align:center; padding: 20px;">Nenhum registro encontrado.</td></tr>`;
            }

            (data || []).forEach(item => {
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
                    tdActions.innerHTML = `<button class="btn small" data-act="edit" data-id="${item.id}">Editar</button>
                                           ${toggleBtn}`;
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
             // Preenche o formulário com os dados existentes (Edição)
            Object.keys(data).forEach(key => {
                const input = form.elements[key];
                if (input) {
                    if (input.type === 'checkbox') {
                        input.checked = data[key];
                    } else {
                        // Evita definir o valor como 'null' ou 'undefined' em campos de texto
                        input.value = data[key] || '';
                    }
                }
            });
             // Garante que o ID seja preenchido no campo hidden se existir
            const idInput = form.querySelector('input[name="id"]');
            if (idInput) idInput.value = data.id || '';

        } else {
            // Limpa o ID ao criar novo registro
            const idInput = form.querySelector('input[name="id"]');
            if (idInput) idInput.value = '';

            // Ao criar novo, garante que o checkbox 'ativo' esteja marcado se existir no form
            if (form.elements['ativo'] && form.elements['ativo'].type === 'checkbox') {
                form.elements['ativo'].checked = true;
            }
        }
        showEditor(editorId);
    },

    // Função SAVE aprimorada
    async save(e, table, editorId, refreshCallback) {
        e.preventDefault();
        const form = e.target;

        // 1. Use native browser validation
        if (form && typeof form.checkValidity === 'function' && !form.checkValidity()) {
            setStatus('Por favor, preencha todos os campos obrigatórios.', 'err');
            if (typeof form.reportValidity === 'function') {
                form.reportValidity();
            }
            return;
        }

        // 2. Collect data using the robust getFormData
        const data = getFormData(e.target.id);
        const id = data.id;

        if (id) {
             delete data.id;
        }

        // 3. Manual validation
        if (table === 'unidades_medida' && (!data.sigla || String(data.sigla).trim() === '')) {
            setStatus('O campo Sigla é obrigatório.', 'err');
            return;
        }

        setStatus(`Salvando...`);
        try {
            let query;
            if (id) {
                // UPDATE path
                query = supa.from(table).update(data).eq('id', id);
            } else {
                // INSERT path
                if (!data.hasOwnProperty('ativo') && (table !== 'movimentacoes')) {
                    // Verifica se o elemento 'ativo' realmente existe no formulário antes de definir padrão
                    if (form.elements['ativo']) {
                         data.ativo = true;
                    }
                }
                query = supa.from(table).insert([data]);
            }
            const { error } = await query;
            if (error) throw error;

            // Atualizado para v6.0
            setStatus(`Registro salvo com sucesso! (v6.0)`, 'ok');
            hideEditor(editorId);
            if (refreshCallback) refreshCallback();
        } catch (err) {
            console.error(`Erro ao salvar ${table}:`, err);
            if (err.code === '23505') {
                setStatus(`Erro: Registro duplicado (violação de unicidade).`, 'err');
            } else {
                // Exibe o erro detalhado do banco de dados
                setStatus(`Erro no Banco de Dados: ${err.message} (Code: ${err.code})`, 'err');
            }
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

/* ===== MÓDULOS RESTANTES (Todos Inalterados Funcionalmente) ===== */

const AuxiliaresModule = {
    init() {
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

        const capitalizedPrefix = prefix.charAt(0).toUpperCase() + prefix.slice(1);
        const btnNewName = `btnShowNew${capitalizedPrefix}Form`;
        const btnCancelName = `btnCancel${capitalizedPrefix}Edit`;

        const refresh = () => {
            GenericCRUD.loadTable(table, tableId, columns);
            if (table === 'unidades_medida') this.refreshUMDropdowns();
            if (table === 'unidades') this.refreshUnidadesDropdowns();
            if (table === 'categorias') this.refreshCategoriasDropdowns(true);
        };

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

    refreshCategoriasDropdowns(forceReload = false) {
        fillOptionsFrom('categorias', 'ing-categoria', 'id', 'nome', {tipo: 'INGREDIENTE', ativo: true});
        fillOptionsFrom('categorias', 'prato-cat', 'id', 'nome', {tipo: 'PRATO', ativo: true});

        const catFilter = $('cat-filter');
        if (catFilter && (catFilter.options.length <= 1 || forceReload)) {
            if (typeof supa !== 'undefined' && supa.from) {
                const defaultOptionText = catFilter.options[0]?.text || 'Todas as Categorias';
                catFilter.innerHTML = `<option value="">${defaultOptionText}</option>`;
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

// (IngredientesModule, ReceitasModule, PratosModule, EstoqueModule, ProducaoModule, ComprasModule omitidos aqui para brevidade, mas são idênticos à versão 5.0 fornecida anteriormente)

/* ===== INICIALIZAÇÃO PRINCIPAL ===== */
document.addEventListener('DOMContentLoaded', () => {
    if (typeof supa === 'undefined') {
        setStatus("Erro crítico: Cliente Supabase não inicializado.", 'err');
        return;
    }

    setupRouting();

    try {
        // Inicialização de todos os módulos (certifique-se de incluir os módulos omitidos acima)
        AuxiliaresModule.init();
        // IngredientesModule.init();
        // ReceitasModule.init();
        // PratosModule.init();
        // EstoqueModule.init();
        // ProducaoModule.init();
        // ComprasModule.init();
       
        // Atualizado para v6.0
        setStatus("Aplicação carregada e pronta. (v6.0)", 'ok');
    } catch (e) {
        console.error("Erro durante a inicialização dos módulos:", e);
        setStatus("Erro na inicialização. Verifique o console.", 'err');
    }
});
