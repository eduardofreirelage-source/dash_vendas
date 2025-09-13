document.addEventListener('DOMContentLoaded', () => {
    // Substitua pelas suas credenciais do Supabase
    const SUPABASE_URL = 'https://rqeagimulvgfecvuzubk.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZWFnaW11bHZnZmVjdnV6dWJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5NzkyMzUsImV4cCI6MjA3MjU1NTIzNX0.SeNHyHOlpqjm-QTl7KXq7YF-48fk5iOQCRgpangP4zU';

    const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const addItemBtn = document.getElementById('addItemBtn');
    const itemModal = document.getElementById('itemModal');
    const closeButton = itemModal.querySelector('.close-button');
    const itemForm = document.getElementById('itemForm');
    const modalTitle = document.getElementById('modalTitle');
    const inventoryBody = document.getElementById('inventoryBody');
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');

    async function fetchInventory() {
        const { data, error } = await supa.from('estoque').select('*');
        if (error) {
            console.error('Erro ao buscar inventário:', error);
            return;
        }
        
        const searchTerm = searchInput.value.toLowerCase();
        const selectedCategory = categoryFilter.value;

        const filteredData = data.filter(item => {
            const matchesSearch = item.nome.toLowerCase().includes(searchTerm);
            const matchesCategory = selectedCategory === 'all' || item.categoria === selectedCategory;
            return matchesSearch && matchesCategory;
        });

        inventoryBody.innerHTML = '';
        filteredData.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.nome}</td>
                <td>${item.categoria}</td>
                <td>${item.quantidade}</td>
                <td>${item.unidade}</td>
                <td class="action-buttons">
                    <button onclick="editItem(${item.id}, '${item.nome}', '${item.categoria}', ${item.quantidade}, '${item.unidade}')">✏️</button>
                    <button onclick="deleteItem(${item.id})">🗑️</button>
                </td>
            `;
            inventoryBody.appendChild(tr);
        });

        populateCategoryFilter(data);
    }

    function populateCategoryFilter(data) {
        const categories = [...new Set(data.map(item => item.categoria))];
        const currentOptions = Array.from(categoryFilter.options).map(o => o.value);
        
        categories.forEach(category => {
            if (!currentOptions.includes(category)) {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categoryFilter.appendChild(option);
            }
        });
    }

    async function addItem(item) {
        const { error } = await supa.from('estoque').insert(item);
        if (error) console.error('Erro ao adicionar item:', error);
        else fetchInventory();
    }

    async function updateItem(id, item) {
        const { error } = await supa.from('estoque').update(item).eq('id', id);
        if (error) console.error('Erro ao atualizar item:', error);
        else fetchInventory();
    }
    
    window.deleteItem = async function(id) {
        if (confirm('Tem certeza que deseja excluir este item?')) {
            const { error } = await supa.from('estoque').delete().eq('id', id);
            if (error) console.error('Erro ao excluir item:', error);
            else fetchInventory();
        }
    }
    
    window.editItem = function(id, name, category, quantity, unit) {
        modalTitle.textContent = 'Editar Item';
        document.getElementById('itemId').value = id;
        document.getElementById('itemName').value = name;
        document.getElementById('itemCategory').value = category;
        document.getElementById('itemQuantity').value = quantity;
        document.getElementById('itemUnit').value = unit;
        itemModal.style.display = 'block';
    }

    addItemBtn.addEventListener('click', () => {
        modalTitle.textContent = 'Adicionar Novo Item';
        itemForm.reset();
        document.getElementById('itemId').value = '';
        itemModal.style.display = 'block';
    });

    closeButton.addEventListener('click', () => {
        itemModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target == itemModal) {
            itemModal.style.display = 'none';
        }
    });

    itemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('itemId').value;
        const item = {
            nome: document.getElementById('itemName').value,
            categoria: document.getElementById('itemCategory').value,
            quantidade: document.getElementById('itemQuantity').value,
            unidade: document.getElementById('itemUnit').value,
        };

        if (id) {
            await updateItem(id, item);
        } else {
            await addItem(item);
        }
        itemModal.style.display = 'none';
    });
    
    searchInput.addEventListener('input', fetchInventory);
    categoryFilter.addEventListener('change', fetchInventory);

    fetchInventory();
});
