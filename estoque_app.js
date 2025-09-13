/* ========= CONFIGURAÇÃO DO SUPABASE ========= */
// ATENÇÃO: Estas são as credenciais encontradas no seu arquivo 'estoque_app (5).js'.
const SUPABASE_URL = 'https://rqeagimulvgfecvuzubk.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZWFnaW11bHZnZmVjdnV6dWJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5NzkyMzUsImV4cCI6MjA3MjU1NTIzNX0.SeNHyHOlpqjm-QTl7KXq7YF-48fk5iOQCRgpangP4zU';
const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// Nome da tabela no Supabase que armazena os itens de estoque.
// Você precisa ter uma tabela com este nome no seu projeto Supabase.
const TABLE_NAME = 'estoque';

/* ========= SELETORES DE ELEMENTOS E HELPERS ========= */
const $ = id => document.getElementById(id);
const setStatus = (text, type = 'info') => {
    const el = $('status');
    if (!el) return;
    el.textContent = text;
    el.style.color = type === 'err' ? '#b91c1c' : type === 'ok' ? '#0b5d47' : '#64748b';
};

// Elementos da interface
const inventoryBody = $('inventoryBody');
const searchInput = $('searchInput');
const categoryFilter = $('categoryFilter');
const addItemBtn = $('addItemBtn');
const modal = $('itemModal');
const modalTitle = $('modalTitle');
const itemForm = $('itemForm');
const closeButton = document.querySelector('.close-button');
let allItems = []; // Guarda os itens localmente para agilizar a filtragem

/* ========= FUNÇÕES DA APLICAÇÃO ========= */

/**
 * Busca todos os itens do Supabase e atualiza a interface.
 */
async function fetchAndRenderItems() {
    setStatus('Carregando itens...');
    try {
        const { data, error } = await supa.from(TABLE_NAME).select('*').order('nome', { ascending: true });
        if (error) throw error;

        allItems = data || [];
        renderTable(allItems);
        populateCategoryFilter(allItems);
        setStatus('Itens carregados.', 'ok');
    } catch (e) {
        console.error('Erro ao buscar itens:', e);
        setStatus(`Erro ao carregar dados: ${e.message}`, 'err');
        inventoryBody.innerHTML = `<tr><td colspan="5" class="error-msg">Falha ao carregar os itens. Verifique o console.</td></tr>`;
    }
}

/**
 * Renderiza a tabela de itens com base em uma lista de dados.
 * @param {Array} items - A lista de itens a ser exibida.
 */
function renderTable(items) {
    inventoryBody.innerHTML = ''; // Limpa a tabela

    if (items.length === 0) {
        inventoryBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">Nenhum item encontrado.</td></tr>';
        return;
    }

    items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.nome || 'N/A'}</td>
            <td><span class="pill">${item.categoria || 'Sem categoria'}</span></td>
            <td>${item.quantidade !== null ? item.quantidade.toLocaleString('pt-BR') : '0'}</td>
            <td>${item.unidade || 'N/A'}</td>
            <td>
                <div class="row-actions">
                    <button class="btn small edit">Editar</button>
                    <button class="btn small bad delete">Excluir</button>
                </div>
            </td>
        `;
        // Adiciona os eventos de clique de forma segura
        tr.querySelector('.edit').addEventListener('click', () => openModal(item));
        tr.querySelector('.delete').addEventListener('click', () => deleteItem(item.id));

        inventoryBody.appendChild(tr);
    });
}

/**
 * Popula o menu de filtros de categoria dinamicamente.
 * @param {Array} items - A lista completa de itens do estoque.
 */
function populateCategoryFilter(items) {
    const currentCategory = categoryFilter.value;
    const categories = [...new Set(items.map(item => item.categoria).filter(Boolean))];
    categoryFilter.innerHTML = '<option value="all">Todas as Categorias</option>';
    categories.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
    });
    categoryFilter.value = currentCategory;
}

/**
 * Filtra os itens exibidos na tabela com base nos inputs do usuário.
 */
function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedCategory = categoryFilter.value;

    const filteredItems = allItems.filter(item => {
        const matchesSearch = item.nome.toLowerCase().includes(searchTerm);
        const matchesCategory = selectedCategory === 'all' || item.categoria === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    renderTable(filteredItems);
}

/**
 * Abre o modal para criar ou editar um item.
 * @param {Object|null} item - O item a ser editado. Se for nulo, abre para criar um novo.
 */
function openModal(item = null) {
    itemForm.reset();
    if (item) {
        modalTitle.textContent = 'Editar Item';
        $('itemId').value = item.id;
        $('itemName').value = item.nome;
        $('itemCategory').value = item.categoria;
        $('itemQuantity').value = item.quantidade;
        $('itemUnit').value = item.unidade;
    } else {
        modalTitle.textContent = 'Adicionar Novo Item';
        $('itemId').value = '';
    }
    modal.style.display = 'block';
}

/**
 * Fecha o modal.
 */
function closeModal() {
    modal.style.display = 'none';
}

/**
 * Lida com o envio do formulário, seja para criar ou atualizar um item.
 * @param {Event} e - O evento de submit do formulário.
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    setStatus('Salvando item...');

    const itemData = {
        nome: $('itemName').value.trim(),
        categoria: $('itemCategory').value.trim(),
        quantidade: parseFloat($('itemQuantity').value),
        unidade: $('itemUnit').value.trim(),
    };
    const id = $('itemId').value;

    try {
        let error;
        if (id) {
            // Atualiza um item existente
            ({ error } = await supa.from(TABLE_NAME).update(itemData).eq('id', id));
        } else {
            // Insere um novo item
            ({ error } = await supa.from(TABLE_NAME).insert([itemData]));
        }
        if (error) throw error;

        setStatus('Item salvo com sucesso!', 'ok');
        closeModal();
        await fetchAndRenderItems(); // Atualiza a lista
    } catch (err) {
        console.error('Erro ao salvar item:', err);
        setStatus(`Erro ao salvar: ${err.message}`, 'err');
    }
}

/**
 * Deleta um item do banco de dados após confirmação.
 * @param {number} id - O ID do item a ser deletado.
 */
async function deleteItem(id) {
    if (!confirm('Tem certeza de que deseja excluir este item? Esta ação não pode ser desfeita.')) {
        return;
    }
    setStatus('Excluindo item...');
    try {
        const { error } = await supa.from(TABLE_NAME).delete().eq('id', id);
        if (error) throw error;

        setStatus('Item excluído com sucesso.', 'ok');
        await fetchAndRenderItems(); // Atualiza a lista
    } catch (err) {
        console.error('Erro ao excluir item:', err);
        setStatus(`Erro ao excluir: ${err.message}`, 'err');
    }
}

/* ========= INICIALIZAÇÃO E EVENTOS ========= */

// Evento que inicia a aplicação quando a página carrega
document.addEventListener('DOMContentLoaded', fetchAndRenderItems);

// Eventos para os filtros
searchInput.addEventListener('input', applyFilters);
categoryFilter.addEventListener('change', applyFilters);

// Eventos do modal
addItemBtn.addEventListener('click', () => openModal());
closeButton.addEventListener('click', closeModal);
window.addEventListener('click', (e) => {
    if (e.target === modal) {
        closeModal();
    }
});
itemForm.addEventListener('submit', handleFormSubmit);
