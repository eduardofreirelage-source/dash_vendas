// =================================================================================
// SCRIPT ÚNICO, COMPLETO E CORRIGIDO
// =================================================================================

/* ===== Helpers ===== */
const $  = (id)=> document.getElementById(id);
const $$ = (sel,root=document)=> Array.from(root.querySelectorAll(sel));
const setStatus=(msg,cls)=>{const el=$('status'); if(!el) return; el.textContent=msg; el.style.color=(cls==='err'?'var(--down)':cls==='ok'?'var(--ok)':'var(--muted)');};
const fmt=(n)=> new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(+n||0);
const ptToNumber=(v)=>{ if(v==null) return 0; const s=String(v).trim().replace(/\./g,'').replace(',','.'); const n=parseFloat(s); return isNaN(n)?0:n; };
const todayStr=()=> new Date().toISOString().slice(0,10);

/* ===== Supabase ===== */
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
    console.error(`Erro ao carregar opções para ${selId}:`, e);
    sel.innerHTML='<option value="">(Erro ao carregar)</option>';
  }
}

async function loadPratos(){
  const tb=$('#tblPratos')?.querySelector('tbody'); if(!tb) return;
  tb.innerHTML='<tr><td colspan="5">Carregando…</td></tr>';
  const {data,error} = await supa.from('v_pratos_resumo').select('*').order('nome',{ascending:true});
  if(error) return tb.innerHTML='<tr><td colspan="5">Erro ao carregar pratos.</td></tr>';
  tb.innerHTML = '';
  (data||[]).forEach(p=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${p.nome}</td><td>${p.categoria?.nome || '—'}</td><td>${p.receitas ?? '—'}</td>
      <td>${p.ativo?'<span class="pill ok">Ativo</span>':'<span class="pill bad">Inativo</span>'}</td>
      <td class="row-actions"><button class="btn small" data-act="edit" data-id="${p.id}">Editar</button>
      <button class="btn small" data-act="toggle" data-id="${p.id}">${p.ativo?'Desativar':'Ativar'}</button></td>`;
    tb.appendChild(tr);
  });
}

const EstoqueModule = {
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
            
            console.log("Dados recebidos do Supabase:", data);
            console.error("Erro recebido do Supabase:", error);

           if (error) throw error;
           
            tbody.innerHTML = '';
            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6">Nenhum saldo encontrado.</td></tr>';
                return;
            }

           data.forEach(item => {
               if (!item.ingredientes || !item.unidades) return; 
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
                   <td>${statusPill}</td>`;
               tbody.appendChild(tr);
           });
       } catch(e) {
           tbody.innerHTML = `<tr><td colspan="6">Erro ao carregar saldos. Verifique o console.</td></tr>`;
           console.error("Erro em loadSaldos:", e);
       }
    },
    async handleMovimentacao(e) {
        e.preventDefault();
        const form = e.target;
        const btn = form.querySelector('[type="submit"]');
        btn.disabled = true;
        
        const tipoMov = form.dataset.movType;
        let rpcName = '';
        let payload = {};
        
        const item_id = $('mov-item').value;
        const qtd = ptToNumber($('mov-qtd').value);

        try {
            switch(tipoMov) {
                case 'ENTRADA':
                    rpcName = 'rpc_entrada';
                    payload = {
                        p_unidade_id: $('mov-unidade-destino').value,
                        p_item_id: item_id,
                        p_item_tipo: 'INGREDIENTE',
                        p_lote: $('mov-lote').value || 'LOTE_PADRAO',
                        p_qtd: qtd,
                        p_validade: $('mov-validade').value || null,
                        p_custo_unit: ptToNumber($('mov-custo').value),
                        p_ref_doc: $('mov-doc').value || null
                    };
                    break;
                // Adicionar outros casos (SAIDA, AJUSTE) aqui
            }
            
            const { error } = await supa.rpc(rpcName, payload);
            if (error) throw error;
            
            setStatus('Movimentação registrada com sucesso!', 'ok');
            $('mov-form-container').style.display = 'none';
            await this.loadSaldos(); // Recarrega os saldos
        } catch(ex) {
            console.error('Erro na movimentação:', ex);
            setStatus('Erro ao registrar: ' + (ex.message || 'Verifique os dados'), 'err');
        } finally {
            btn.disabled = false;
        }
    },
    async init() {
        $$('.mov-actions .btn').forEach(btn => btn.addEventListener('click', (e) => {
            const type = e.currentTarget.dataset.movType;
            const container = $('mov-form-container');
            container.style.display = 'block';
            $('frmMov').dataset.movType = type;
            $('mov-form-title').textContent = `Registrar ${type}`;
        }));
        
        addSafeEventListener('btnMovCancel', 'click', () => $('mov-form-container').style.display = 'none');
        addSafeEventListener('frmMov', 'submit', (e) => this.handleMovimentacao(e));
        
        await fillOptionsFrom('unidades', 'mov-unidade-destino', 'id', 'nome');
        await fillOptionsFrom('ingredientes', 'mov-item', 'id', 'nome', {ativo: true});
        await this.loadSaldos();
    }
};


/* ===== INICIALIZAÇÃO ===== */
async function init(){
  try{
    setStatus('Inicializando...');
    setupRouting();
    await loadPratos();
    EstoqueModule.init();
    setStatus('Pronto','ok');
  }catch(e){ 
    console.error("Erro fatal na inicialização:", e);
    setStatus('Erro na inicialização. Verifique o console.', 'err');
  }
}

document.addEventListener('DOMContentLoaded',init);
