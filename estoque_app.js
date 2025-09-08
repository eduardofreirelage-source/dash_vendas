// =================================================================================
// SCRIPT ÚNICO, COMPLETO E FUNCIONAL
// =================================================================================

/* ===== Helpers ===== */
const $  = (id)=> document.getElementById(id);
const $$ = (sel,root=document)=> Array.from(root.querySelectorAll(sel));
const setStatus=(msg,cls)=>{const el=$('status'); if(!el) return; el.textContent=msg; el.style.color=(cls==='err'?'var(--down)':cls==='ok'?'var(--ok)':'var(--muted)');};
const fmt=(n)=> new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(+n||0);
const ptToNumber=(v)=>{ if(v==null) return 0; const s=String(v).trim().replace(/\./g,'').replace(',','.'); const n=parseFloat(s); return isNaN(n)?0:n; };
const todayStr=()=> new Date().toISOString().slice(0,10);
const showEditor = (id) => { const el = $(id); if(el) el.style.display = 'block'; };
const hideEditor = (id) => { const el = $(id); if(el) el.style.display = 'none'; };


/* ===== Supabase ===== */
// ATENÇÃO: Use as suas próprias chaves do Supabase aqui
const SUPABASE_URL  = 'https://tykdmxaqvqwskpmdiekw.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2RteGFxdnF3c2twbWRpZWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyOTg2NDYsImV4cCI6MjA3Mjg3NDY0Nn0.XojR4nVx_Hr4FtZa1eYi3jKKSVVPokG23jrJtm8_3ps';
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
  const mainTabsContainer = $('main-tabs');
  const mainContents = $$('.tab-content');
  
  const setupSubTabs = (containerId, contentSelector) => {
      const container = $(containerId);
      if (!container) return;
      const contents = $$(contentSelector);
      
      container.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const subTabId = btn.dataset.subtab;
        $$('button', container).forEach(b => b.classList.remove('active'));
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
    $$('button', mainTabsContainer).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mainContents.forEach(content => {
      content.classList.toggle('active', content.id === 'tab-' + tabId);
    });
  });
  
  setupSubTabs('cadastro-subtabs', '#tab-cadastros .subpage');
  setupSubTabs('estoque-subtabs', '#tab-estoque .subpage');
}

/* ===== FUNÇÕES DE CARREGAMENTO (LOADERS) ===== */
async function fillOptionsFrom(table, selId, valKey, labelKey, whereEq){
  const sel=$(selId); if(!sel) return; sel.innerHTML='<option value="">Carregando…</option>';
  try{
    let query=supa.from(table).select(`${valKey},${labelKey}`).order(labelKey,{ascending:true});
    if(whereEq) Object.entries(whereEq).forEach(([k,v])=> query=query.eq(k,v));
    const {data,error}=await query;
    if(error) throw error;
    sel.innerHTML='<option value="">Selecione</option>';
    (data||[]).forEach(x=>{ const o=document.createElement('option'); o.value=x[valKey]; o.textContent=x[labelKey]; sel.appendChild(o); });
  }catch(e){
    console.error(`Erro ao carregar options para ${selId}:`, e);
    sel.innerHTML='<option value="">(Erro)</option>';
  }
}

/* ===== MÓDULO DE CADASTROS ===== */
const CadastrosModule = {
    async loadPratos() {
        const tb = $('#tblPratos')?.querySelector('tbody');
        if (!tb) return;
        tb.innerHTML = '<tr><td colspan="5">Carregando pratos…</td></tr>';
        try {
            const { data, error } = await supa.from('pratos')
                .select('*, categoria:categorias(nome), prato_receitas(count)')
                .order('nome', { ascending: true });
            if (error) throw error;

            tb.innerHTML = '';
            (data || []).forEach(p => {
                const tr = document.createElement('tr');
                const categoriaNome = p.categoria ? p.categoria.nome : '—';
                const receitasCount = p.prato_receitas.length > 0 ? p.prato_receitas[0].count : 0;

                tr.innerHTML = `<td>${p.nome}</td>
                  <td>${categoriaNome}</td>
                  <td>${receitasCount}</td>
                  <td>${p.ativo ? '<span class="pill ok">Ativo</span>' : '<span class="pill bad">Inativo</span>'}</td>
                  <td class="row-actions"><button class="btn small" data-act="edit" data-id="${p.id}">Editar</button>
                  <button class="btn small" data-act="toggle" data-id="${p.id}">${p.ativo ? 'Desativar' : 'Ativar'}</button></td>`;
                tb.appendChild(tr);
            });
        } catch (e) {
            console.error("Erro ao carregar pratos:", e);
            tb.innerHTML = '<tr><td colspan="5">Erro ao carregar. Verifique o console.</td></tr>';
        }
    },
    
    handleNovoPrato() {
        $('prato-form-title').textContent = 'Novo Prato';
        // Limpa o formulário, idealmente com <form> tag, mas por ID funciona
        const fields = ['prato-nome', 'prato-preco', 'prato-descricao'];
        fields.forEach(id => $(id).value = '');
        $('prato-cat').selectedIndex = 0;
        showEditor('prato-editor-container');
    },

    async handleSalvarPrato(e) {
        e.preventDefault();
        const btn = e.target;
        btn.disabled = true;
        setStatus('Salvando prato...');

        try {
            const pratoData = {
                nome: $('prato-nome').value,
                categoria_id: $('prato-cat').value,
                preco_venda: ptToNumber($('prato-preco').value),
                descricao: $('prato-descricao').value,
            };

            // Validação explícita para robustez
            if (!pratoData.nome || !pratoData.preco_venda || !pratoData.categoria_id) {
                throw new Error('Nome, Categoria e Preço de Venda são obrigatórios.');
            }

            const { error } = await supa.from('pratos').insert([pratoData]);
            if (error) throw error;

            setStatus('Prato salvo com sucesso!', 'ok');
            hideEditor('prato-editor-container');
            await this.loadPratos();

        } catch (err) {
            console.error("Erro ao salvar prato:", err);
            setStatus(`Erro: ${err.message}`, 'err');
        } finally {
            btn.disabled = false;
        }
    },

    init() {
        addSafeEventListener('btnNovoPrato', 'click', () => this.handleNovoPrato());
        addSafeEventListener('btnSalvarPrato', 'click', (e) => this.handleSalvarPrato(e));
        addSafeEventListener('btnCancelarPrato', 'click', () => hideEditor('prato-editor-container'));

        // Carregar dados para os selects
        fillOptionsFrom('categorias', 'prato-cat', 'id', 'nome', { tipo: 'PRATO' });

        this.loadPratos();
    }
};

/* ===== MÓDULO DE ESTOQUE ===== */
const EstoqueModule = {
    async loadSaldos() {
       const tbody = $('tblSaldo')?.querySelector('tbody');
       if (!tbody) return;
       tbody.innerHTML = '<tr><td colspan="6">Carregando saldos...</td></tr>';
       try {
           const { data, error } = await supa.from('estoque_saldo').select('*');
           if (error) throw error;
           
            tbody.innerHTML = '';
            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6">Nenhum saldo encontrado.</td></tr>';
                return;
            }

           data.forEach(item => {
               const tr = document.createElement('tr');
               tr.innerHTML = `
                   <td>${item.item_nome}</td>
                   <td>${item.item_tipo}</td>
                   <td>${item.unidade_nome}</td>
                   <td>${fmt(item.saldo_total)}</td>
                   <td>${item.unidade_medida_sigla || 'N/D'}</td>
                   <td><span class="pill ok">OK</span></td>`; // Status placeholder
               tbody.appendChild(tr);
           });
       } catch(e) {
           tbody.innerHTML = `<tr><td colspan="6">Erro ao carregar saldos. Verifique o console.</td></tr>`;
           console.error("Erro em loadSaldos:", e);
       }
    },
    
    async handleMovimentacao(e) {
        e.preventDefault();
        const form = e.target.closest('form');
        const btn = form.querySelector('#btnMovSubmit');
        btn.disabled = true;
        setStatus('Registrando movimentação...');
        
        const tipoMov = form.dataset.movType;
        
        try {
            if (tipoMov === 'ENTRADA') {
                const payload = {
                    p_unidade_id: $('mov-unidade-destino').value,
                    p_item_id: $('mov-item').value,
                    p_lote: $('mov-lote').value || 'LOTE_PADRAO',
                    p_qtd: ptToNumber($('mov-qtd').value),
                    p_validade: $('mov-validade').value || null,
                    p_custo_unit: ptToNumber($('mov-custo').value),
                    p_ref_doc: $('mov-doc').value || null
                };
                 if (!payload.p_unidade_id || !payload.p_item_id || payload.p_qtd <= 0) {
                    throw new Error("Unidade, Item e Quantidade são obrigatórios.");
                }
                const { error } = await supa.rpc('rpc_entrada', payload);
                if (error) throw error;
            } else {
                throw new Error("Tipo de movimentação não implementado.");
            }
            
            setStatus('Movimentação registrada com sucesso!', 'ok');
            hideEditor('mov-form-container');
            await this.loadSaldos();

        } catch(ex) {
            console.error('Erro na movimentação:', ex);
            setStatus('Erro: ' + (ex.message || 'Verifique os dados'), 'err');
        } finally {
            btn.disabled = false;
        }
    },

    setupMovForm(type) {
        const container = $('mov-form-container');
        const form = $('frmMov');
        form.reset();
        
        container.style.display = 'block';
        form.dataset.movType = type;
        $('mov-form-title').textContent = `Registrar ${type}`;

        const show = (elId, visible) => $(elId).style.display = visible ? 'block' : 'none';
        
        show('mov-unidade-origem-group', type === 'TRANSFERENCIA' || type === 'SAIDA');
        show('mov-unidade-destino-group', type === 'TRANSFERENCIA' || type === 'ENTRADA');
        show('mov-validade-group', type === 'ENTRADA');
        show('mov-custo-group', type === 'ENTRADA');
        show('mov-ajuste-sinal-group', type === 'AJUSTE');
    },

    init() {
        $$('.mov-actions .btn').forEach(btn => btn.addEventListener('click', (e) => {
            const type = e.currentTarget.dataset.movType.toUpperCase();
            this.setupMovForm(type);
        }));
        
        addSafeEventListener('btnMovCancel', 'click', () => hideEditor('mov-form-container'));
        addSafeEventListener('frmMov', 'submit', (e) => this.handleMovimentacao(e));
        
        fillOptionsFrom('unidades', 'mov-unidade-destino', 'id', 'nome');
        fillOptionsFrom('ingredientes', 'mov-item', 'id', 'nome', {ativo: true});
        
        this.loadSaldos();
    }
};

/* ===== INICIALIZAÇÃO ===== */
async function init(){
  try{
    setStatus('Inicializando...');
    setupRouting();
    
    CadastrosModule.init();
    EstoqueModule.init();

    setStatus('Pronto','ok');
  }catch(e){ 
    console.error("Erro fatal na inicialização:", e);
    setStatus('Erro na inicialização. Verifique o console.', 'err');
  }
}

document.addEventListener('DOMContentLoaded',init);
