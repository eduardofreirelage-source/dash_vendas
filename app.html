<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8"/>
    <meta content="width=device-width,initial-scale=1" name="viewport"/>
    <title>Mapa de Produção — v3.5 Final</title>
    <link href='data:image/svg+xml,&lt;svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"&gt;&lt;rect x="0" y="0" width="128" height="128" rx="22" fill="%237b1e3a"/&gt;&lt;text x="64" y="78" text-anchor="middle" font-family="Arial" font-size="56" fill="white"&gt;MP&lt;/text&gt;&lt;/svg&gt;' rel="icon"/>
    <link rel="stylesheet" href="estoque_styles.css">
    <style>
        :root {
            --pri: #7b1e3a; --bg: #f7f7fa; --card: #fff; --line: #e5e7eb;
            --ink: #0f172a; --muted: #64748b; --ok: #10b981; --down: #ef4444; --warn: #f59e0b;
        }
        body { font-family: sans-serif; background: var(--bg); color: var(--ink); margin: 0; font-size: 14px; }
        .main { display: flex; flex-direction: column; min-height: 100vh; }
        .top { background: var(--card); padding: 12px 16px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; }
        .brand { display: flex; align-items: center; gap: 12px; }
        .logo { background: var(--pri); color: white; padding: 8px; border-radius: 8px; font-weight: bold; }
        .tabs button { background: none; border: none; padding: 8px 12px; cursor: pointer; color: var(--muted); font-size: 16px;}
        .tabs button.active { color: var(--pri); font-weight: bold; border-bottom: 2px solid var(--pri); }
        .content-wrap { flex: 1; padding: 16px; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .section { background: var(--card); padding: 16px; border-radius: 12px; border: 1px solid var(--line); }
        .subtabs { margin-bottom: 16px; border-bottom: 1px solid var(--line); display: flex; flex-wrap: wrap; }
        .subtabs button { background: none; border: none; padding: 6px 10px; cursor: pointer; color: var(--muted); font-size: 14px; }
        .subtabs button.active { color: var(--ink); font-weight: bold; border-bottom: 2px solid var(--pri); }
        .subpage { display: none; }
        .subpage.active { display: block; }
        .editor-container { display: none; background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--line); }
        .form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .form-span-col-2 { grid-column: span 2; }
        label { display: block; margin-bottom: 4px; color: var(--ink); }
        input, select, textarea { width: 100%; padding: 8px; border: 1px solid var(--line); border-radius: 6px; font-size: 14px; box-sizing: border-box; }
        input:disabled { background-color: #f1f1f1; }
        .btn { padding: 8px 16px; border: 1px solid var(--line); border-radius: 6px; cursor: pointer; background: white; color: var(--ink); font-weight: 500; }
        .btn.pri { background: var(--pri); color: white; border-color: var(--pri); }
        .btn.small { padding: 4px 8px; font-size: 12px; }
        .right { display: flex; justify-content: flex-end; gap: 8px; }
        .sep { border-top: 1px solid var(--line); margin: 16px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px 12px; border-bottom: 1px solid var(--line); text-align: left; }
        th { background: var(--bg); font-weight: bold; }
        .table-container { overflow-x: auto; }
        .pill { padding: 2px 8px; border-radius: 16px; font-size: 12px; background: var(--line); color: var(--ink); display: inline-block; }
        .pill.ok { background: rgba(16, 185, 129, 0.1); color: var(--ok); }
        .pill.bad { background: rgba(239, 68, 68, 0.1); color: var(--down); }
        .pill.warn { background: rgba(245, 158, 11, 0.1); color: var(--warn); }
    </style>
</head>
<body>
<main class="main">
    <div class="top">
        <div class="brand">
            <div class="logo">MP</div>
            <div>
                <h1 style="font-size:18px; margin:0; line-height:1.2">Mapa de Produção</h1>
                <div class="hint" style="margin:0;">Ficha técnica, previsão e compras</div>
            </div>
        </div>
        <nav class="tabs" id="main-tabs">
            <button class="active" data-tab="cadastros">Cadastros</button>
            <button data-tab="producao">Produção</button>
            <button data-tab="compras">Compras</button>
            <button data-tab="estoque">Estoque</button>
        </nav>
        <div class="status-bar">
            <div id="status">Carregando…</div>
        </div>
    </div>

    <div class="content-wrap">
    <section class="tab-content active" id="tab-cadastros">
        <div class="section" id="section-cadastros">
            <nav class="subtabs" id="cadastro-subtabs">
                <button class="active" data-subtab="pratos">Pratos</button>
                <button data-subtab="componentes">Componentes</button>
                <button data-subtab="receitas">Receitas</button>
                <button data-subtab="ingredientes">Ingredientes</button>
                <button class="chip" data-subtab="um">Unidades de Medida</button>
                <button class="chip" data-subtab="unidades">Locais/Unidades</button>
                <button class="chip" data-subtab="categorias">Categorias</button>
            </nav>

            <div class="subpage active" id="sub-pratos">
                <div class="right" style="margin-bottom: 16px;">
                    <button class="btn pri" id="btnNovoPrato">+ Novo prato</button>
                </div>
                <div class="editor-container" id="prato-editor-container">
                    <h3 id="prato-form-title" class="form-title">Novo Prato</h3>
                    <form id="form-prato">
                        <input type="hidden" name="id">
                        <div class="form-grid">
                            <div><label>Nome do Prato</label><input name="nome" required placeholder="Ex.: Strogonoff de frango"/></div>
                            <div><label>Categoria</label><select name="categoria_id" id="prato-cat" required></select></div>
                            <div><label>Preço de Venda (R$)</label><input name="preco_venda" type="number" step="0.01" placeholder="Ex.: 34,90"/></div>
                        </div>
                        <div class="form-actions right"><button class="btn" type="button" id="btnCancelarPrato">Cancelar</button><button class="btn pri" type="submit">Salvar Prato</button></div>
                    </form>
                </div>
                <div class="table-container"><table id="tblPratos"><thead><tr><th>Nome</th><th>Categoria</th><th>Preço</th><th>Ativo</th><th>Ações</th></tr></thead><tbody></tbody></table></div>
            </div>

            <div class="subpage" id="sub-receitas">
                <div class="right" style="margin-bottom: 16px;"><button class="btn pri" id="btnShowNewRecipeForm">+ Nova Receita</button></div>
                <div class="editor-container" id="recipe-editor-container">
                    <h3 id="recipe-form-title">Nova Receita</h3>
                    <form id="form-receita"><input type="hidden" name="id">
                        <div class="form-grid">
                            <div><label>Nome da Receita</label><input name="nome" required placeholder="Ex.: Arroz Branco pronto"/></div>
                            <div><label>Rendimento (qtd)</label><input name="rendimento_qtd" required type="number" step="0.001" placeholder="Ex.: 1000"/></div>
                            <div><label>Unidade de Rendimento</label><select name="rendimento_unidade" required><option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="L">L</option></select></div>
                        </div>
                        <div class="form-actions right"><button class="btn" type="button" id="btnCancelRecEdit">Cancelar</button><button class="btn pri" type="submit">Salvar Receita</button></div>
                    </form>
                </div>
                <div class="table-container"><table id="tblRec"><thead><tr><th>Nome</th><th>Rendimento</th><th>Unidade</th><th>Ativo</th><th>Ações</th></tr></thead><tbody></tbody></table></div>
            </div>

            <div class="subpage" id="sub-ingredientes">
                <div class="right" style="margin-bottom: 16px;"><button class="btn pri" id="btnShowNewIngredienteForm">+ Novo Ingrediente</button></div>
                <div class="editor-container" id="ingrediente-editor-container">
                     <h3 id="ingrediente-form-title">Novo Ingrediente</h3>
                    <form id="form-ingrediente"><input type="hidden" name="id">
                        <div class="form-grid">
                            <div><label>Nome do Ingrediente</label><input name="nome" required placeholder="Ex.: Arroz branco cru"/></div>
                            <div><label>Categoria</label><select name="categoria_id" id="ing-categoria" required></select></div>
                            <div><label>Custo Unitário (R$)</label><input name="custo_unitario" type="number" step="0.0001" placeholder="Ex.: 0.0123"/></div>
                            <div><label>Unidade de Medida</label><select name="unidade_medida_id" id="ing-unidade-medida" required></select></div>
                        </div>
                        <div class="form-actions right"><button class="btn" type="button" id="btnCancelIngEdit">Cancelar</button><button class="btn pri" type="submit">Salvar Ingrediente</button></div>
                    </form>
                </div>
                <div class="table-container"><table id="tblIng"><thead><tr><th>Nome</th><th>Categoria</th><th>Unidade</th><th>Custo</th><th>Ativo</th><th>Ações</th></tr></thead><tbody></tbody></table></div>
            </div>

            <div class="subpage" id="sub-um">
                <h3>Unidades de Medida</h3>
                <div class="right" style="margin-bottom: 16px;"><button class="btn pri" id="btnShowNewUmForm">+ Nova Unidade</button></div>
                <div class="editor-container" id="um-editor-container">
                    <h3 id="um-form-title">Nova Unidade de Medida</h3>
                    <form id="form-um"><input name="id" type="hidden"/>
                        <div class="grid cols-2">
                            <div><label>Sigla</label><input maxlength="5" name="sigla" placeholder="KG" required=""/></div>
                            <div><label>Nome</label><input name="nome" placeholder="Quilograma" required=""/></div>
                        </div>
                        <div class="right" style="margin-top:16px;"><button class="btn" type="button" id="btnCancelUmEdit">Cancelar</button><button class="btn pri" type="submit">Salvar</button></div>
                    </form>
                </div>
                <div class="table-container"><table id="tbl-um"><thead><tr><th>Sigla</th><th>Nome</th><th>Ativo</th><th>Ações</th></tr></thead><tbody></tbody></table></div>
            </div>

            <div class="subpage" id="sub-unidades">
                <h3>Locais de Estoque / Unidades</h3>
                <div class="right" style="margin-bottom: 16px;"><button class="btn pri" id="btnShowNewUnidadesForm">+ Novo Local</button></div>
                <div class="editor-container" id="unidades-editor-container">
                     <h3 id="unidades-form-title">Novo Local/Unidade</h3>
                     <form id="form-unidades"><input name="id" type="hidden"/>
                         <div><label>Nome</label><input name="nome" placeholder="Ex: Cozinha Central" required=""/></div>
                         <div class="right" style="margin-top:16px;"><button class="btn" type="button" id="btnCancelUnidadesEdit">Cancelar</button><button class="btn pri" type="submit">Salvar</button></div>
                     </form>
                </div>
                <div class="table-container"><table id="tbl-unidades"><thead><tr><th>Nome</th><th>Ativo</th><th>Ações</th></tr></thead><tbody></tbody></table></div>
            </div>

            <div class="subpage" id="sub-categorias">
                <h3>Categorias</h3>
                 <div class="right" style="margin-bottom: 16px;"><button class="btn pri" id="btnShowNewCategoriasForm">+ Nova Categoria</button></div>
                <div class="editor-container" id="categorias-editor-container">
                    <h3 id="categorias-form-title">Nova Categoria</h3>
                    <form id="form-categorias"><input name="id" type="hidden"/>
                        <div class="grid cols-2">
                             <div><label>Nome</label><input name="nome" required="" placeholder="Ex: Proteínas"/></div>
                             <div><label>Tipo</label><select name="tipo"><option value="INGREDIENTE">INGREDIENTE</option><option value="PRATO">PRATO</option></select></div>
                        </div>
                        <div class="right" style="margin-top:16px;"><button class="btn" type="button" id="btnCancelCategoriasEdit">Cancelar</button><button class="btn pri" type="submit">Salvar</button></div>
                    </form>
                </div>
                 <div class="table-container"><table id="tbl-categorias"><thead><tr><th>Nome</th><th>Tipo</th><th>Ativo</th><th>Ações</th></tr></thead><tbody></tbody></table></div>
            </div>
        </div>
    </section>
    </div>
</main>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="estoque_app.js"></script>
</body>
</html>
