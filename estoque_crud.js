// =======================================================
// SCRIPT PARA CONTROLE DE ESTOQUE (estoque_crud.js)
// Dedicado para a página estoque_index.html
// =======================================================

/* ========= CONFIGURAÇÃO SUPABASE ========= */
const SUPABASE_URL = 'https://rqeagimulvgfecvuzubk.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZWFnaW11bHZnZmVjdnV6dWJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5NzkyMzUsImV4cCI6MjA3MjU1NTIzNX0.SeNHyHOlpqjm-QTl7KXq7YF-48fk5iOQCRgpangP4zU'; // SUBSTITUA PELA SUA CHAVE REAL
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

/* ========= ELEMENTOS DA PÁGINA ========= */
const $ = id => document.getElementById(id);
const modal = $('itemModal');
const modalTitle = $('modalTitle');
const itemForm = $('itemForm');
const inventoryBody = $('inventoryBody');
const statusDiv = $('status');
const searchInput = $('searchInput');

/* ========= FUNÇÕES DO MODAL ========= */
const showModal = (title, item = null) => {
    modalTitle.textContent = title;
    itemForm.reset();
    $('itemId').value = '';
    if (item) {
        $('itemId').value = item.id;
        $('itemName').value = item.nome;
        $('itemCategory').value = item.categoria;
        $('itemQuantity').value = item.quantidade;
        $('itemUnit').value = item.unidade;
    }
    modal.style.display = 'block';
};

const hideModal = () => {
    modal.style.display = 'none';
};

/* ========= LÓGICA PRINCIPAL (CRUD) ========= */

const loadItems = async (searchTerm = '') => {
    statusDiv.textContent = 'Carregando itens...';
    let query = supa.from('itens_estoque').select('*').order('nome', { ascending: true });

    if (searchTerm) {
        query = query.ilike('nome', `%${searchTerm}%`);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Erro ao carregar itens:', error);
        statusDiv.textContent = `Erro: ${error.message}`;
        inventoryBody.innerHTML = `<tr><td colspan="5" class="error-msg">Falha ao carregar dados.</td></tr>`;
        return;
    }

    inventoryBody.innerHTML = '';
    if (data.length === 0) {
        inventoryBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Nenhum item encontrado.</td></tr>`;
    } else {
        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.nome}</td>
                <td>${item.categoria}</td>
                <td>${item.quantidade}</td>
                <td>${item.unidade}</td>
                <td class="row-actions">
                    <button class="btn small" data-action="edit" data-id="${item.id}">Editar</button>
                    <button class="btn small bad" data-action="delete" data-id="${item.id}">Excluir</button>
                </td>
            `;
            inventoryBody.appendChild(tr);
        });
    }
    statusDiv.textContent = 'Pronto';
};

const saveItem = async (event) => {
    event.preventDefault();
    const id = $('itemId').value;
    const itemData = {
        nome: $('itemName').value,
        categoria: $('itemCategory').value,
        quantidade: parseFloat($('itemQuantity').value),
        unidade: $('itemUnit').value,
    };

    statusDiv.textContent = 'Salvando...';
    const { error } = id
        ? await supa.from('itens_estoque').update(itemData).eq('id', id)
        : await supa.from('itens_estoque').insert([itemData]);

    if (error) {
        console.error('Erro ao salvar:', error);
        statusDiv.textContent = `Erro: ${error.message}`;
    } else {
        statusDiv.textContent = 'Item salvo com sucesso!';
        hideModal();
        loadItems(searchInput.value);
    }
};

const deleteItem = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;

    statusDiv.textContent = 'Excluindo...';
    const { error } = await supa.from('itens_estoque').delete().eq('id', id);

    if (error) {
        console.error('Erro ao excluir:', error);
        statusDiv.textContent = `Erro: ${error.message}`;
    } else {
        statusDiv.textContent = 'Item excluído.';
        loadItems(searchInput.value);
    }
};

/* ========= EVENT LISTENERS ========= */
document.addEventListener('DOMContentLoaded', () => {
    loadItems();
    $('addItemBtn').addEventListener('click', () => showModal('Adicionar Novo Item'));
    document.querySelector('.close-button').addEventListener('click', hideModal);
    window.addEventListener('click', (event) => { if (event.target === modal) hideModal(); });
    itemForm.addEventListener('submit', saveItem);

    inventoryBody.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const { action, id } = button.dataset;

        if (action === 'delete') {
            deleteItem(id);
        } else if (action === 'edit') {
            const { data } = await supa.from('itens_estoque').select('*').eq('id', id).single();
            if (data) showModal('Editar Item', data);
        }
    });
    
    searchInput.addEventListener('input', () => loadItems(searchInput.value));
});
