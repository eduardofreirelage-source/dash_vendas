// =================================================================================
// SCRIPT FINAL E FUNCIONAL
// =================================================================================

/* ===== Helpers ===== */
const $  = (id)=> document.getElementById(id);
const setStatus=(msg,cls)=>{
    const el=$('status'); if(!el) return; 
    el.textContent=msg; 
    el.style.color = {'err': '#ef4444', 'ok': '#10b981'}[cls] || '#64748b';
};
const fmtMoney=(n)=> new Intl.NumberFormat('pt-BR',{style: 'currency', currency: 'BRL'}).format(+n||0);
const showEditor = (id) => { const el = $(id); if(el) el.style.display = 'block'; };
const hideEditor = (id) => { const el = $(id); if(el) el.style.display = 'none'; };
const getFormData = (form) => {
    const data = new FormData(form);
    const obj = {};
    for (let [key, value] of data.entries()) {
        const input = form.elements[key];
        if (input.type === 'number') obj[key] = value ? parseFloat(value) : null;
        else obj[key] = value;
    }
    return obj;
};

/* ===== CONFIGURAÇÃO DA API ===== */
const SUPABASE_URL  = 'https://rqeagimulvgfecvuzubk.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZWFnaW11bHZnZmVjdnV6dWJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5NzkyMzUsImV4cCI6MjA3MjU1NTIzNX0.SeNHyHOlpqjm-QTl7KXq7YF-48fk5iOQCRgpangP4zU';

let supa;
try {
    supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
} catch (e) {
    console.error("Falha ao inicializar o Supabase:", e);
    setStatus("Erro crítico no Supabase.", "err");
}

function addSafeEventListener(id, event, handler) {
    const element = $(id);
    if (element) element.addEventListener(event, handler);
}

/* ===== ROTEAMENTO POR ABAS ===== */
function setupRouting() {
  const container = $('cadastro-subtabs');
  const contents = document.querySelectorAll('.subpage');
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || !btn.dataset.subtab) return;
    const subTabId = btn.dataset.subtab;
    container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    contents.forEach(content => content.classList.toggle('active', content.id === 'sub-' + subTabId));
  });
}

/* ===== MÓDULO GENÉRICO DE CRUD ===== */
const GenericCRUD = {
    setup(config) {
        const { prefix, table, columns, formatters = {}, onShowForm } = config;
        const editorId = `${prefix}-editor-container`;
        const formId = `form-${prefix}`;
        const titleId = `${prefix}-form-title`;
        const tableId = `tbl-${prefix}`;
        const btnNewId = `btnShowNew${prefix.charAt(0).toUpperCase() + prefix.slice(1)}Form`;
        const btnCancelId = `btnCancel${prefix.charAt(0).toUpperCase() + prefix.slice(1)}Edit`;

        const refresh = () => this.loadTable(table, tableId, columns, formatters);

        addSafeEventListener(btnNewId, 'click', () => this.showForm(editorId, formId, titleId, `Novo Registro`, null, onShowForm));
        addSafeEventListener(btnCancelId, 'click', () => hideEditor(editorId));
        addSafeEventListener(formId, 'submit', (e) => { e.preventDefault(); this.save(e.target, table, editorId, refresh); });
        addSafeEventListener(tableId, 'click', (e) => this.handleTableClick(e, table, editorId, formId, titleId, refresh, onShowForm));
        
        refresh();
    },
    async loadTable(table, tableId, columns, formatters) {
        const tbody = $(tableId)?.querySelector('tbody');
        if (!tbody) return;
        tbody.innerHTML = `<tr><td colspan="${columns.length + 2}">Carregando...</td></tr>`;
        try {
            const { data, error } = await supa.from(table).select('*').order('nome');
            if (error) throw error;
            tbody.innerHTML = '';
            for (const item of data) {
                const tr = tbody.insertRow();
                columns.forEach(col => tr.insertCell().textContent = formatters[col] ? formatters[col](item[col]) : (item[col] ?? '—'));
                tr.insertCell().innerHTML = item.ativo ? '<span class="pill ok">Ativo</span>' : '<span class="pill">Inativo</span>';
                tr.insertCell().innerHTML = `<button class="btn small" data-act="edit" data-id="${item.id}">Editar</button><button class="btn small" data-act="toggle" data-id="${item.id}">${item.ativo ? 'Desativar' : 'Ativar'}</button>`;
            }
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="${columns.length + 2}">Erro ao carregar. Verifique o console e as políticas RLS.</td></tr>`;
            console.error(`Erro ao carregar ${table}:`, e);
        }
    },
    showForm(editorId, formId, titleId, titleText, data, onShowForm) {
        const form = $(formId);
        form.reset();
        form.querySelector('input[name="id"]').value = data ? data.id : '';
        if ($(titleId)) $(titleId).textContent = titleText;
        if (data) {
            Object.keys(data).forEach(key => { if (form.elements[key]) form.elements[key].value = data[key]; });
        }
        if (onShowForm) onShowForm(data);
        showEditor(editorId);
    },
    async save(form, table, editorId, refreshCallback) {
        const data = getFormData(form);
        const id = data.id;
        delete data.id;
        const { error } = await (id ? supa.from(table).update(data).eq('id', id) : supa.from(table).insert([data]));
        if (error) { setStatus(`Erro: ${error.message}`, 'err'); console.error(error); }
        else { setStatus('Salvo com sucesso!', 'ok'); hideEditor(editorId); refreshCallback(); }
    },
    async toggle(table, id, refreshCallback) {
        const { data } = await supa.from(table).select('ativo').eq('id', id).single();
        await supa.from(table).update({ ativo: !data.ativo }).eq('id', id);
        refreshCallback();
    },
    async handleTableClick(e, table, editorId, formId, titleId, refresh, onShowForm) {
        const btn = e.target.closest('button[data-act]');
        if (!btn) return;
        const { act, id } = btn.dataset;
        if (act === 'toggle') return this.toggle(table, id, refresh);
        if (act === 'edit') {
            const { data } = await supa.from(table).select('*').eq('id', id).single();
            this.showForm(editorId, formId, titleId, 'Editar Registro', data, onShowForm);
        }
    }
};

/* ===== INICIALIZAÇÃO ===== */
async function init() {
  if (!supa) return;
  setStatus('Inicializando...');
  
  // A função de roteamento foi simplificada e movida para dentro de init
  // para garantir que os elementos existam.
  const container = $('cadastro-subtabs');
  const contents = document.querySelectorAll('.subpage');
  if (container) {
      container.addEventListener('click', (e) => {
          const btn = e.target.closest('button[data-subtab]');
          if (!btn) return;
          const subTabId = btn.dataset.subtab;
          container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          contents.forEach(content => content.classList.toggle('active', content.id === 'sub-' + subTabId));
      });
  }

  GenericCRUD.setup({ 
      prefix: 'pratos', 
      table: 'pratos', 
      columns: ['nome', 'preco_venda'], 
      formatters: { preco_venda: fmtMoney },
      onShowForm: async () => {
          // Lógica para carregar categorias no formulário de pratos
          const sel = $('prato-cat');
          if (!sel) return;
          const { data } = await supa.from('categorias').select('id, nome').eq('tipo', 'PRATO');
          sel.innerHTML = '<option value="">Selecione</option>';
          data.forEach(cat => sel.add(new Option(cat.nome, cat.id)));
      }
  });
  
  setStatus('Pronto', 'ok');
}

document.addEventListener('DOMContentLoaded', init);
