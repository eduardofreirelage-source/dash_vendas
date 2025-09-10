/* GERAL */
:root {
    --bg-main: #f8fafc;
    --bg-card: #ffffff;
    --text-main: #0f172a;
    --text-light: #64748b;
    --text-inv: #f8fafc;
    --line: #e2e8f0;
    --accent: #7b1e3a;
    --accent-light: #e9d5dc;
    --up: #16a34a;
    --down: #dc2626;
}
* { box-sizing: border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    margin: 0;
    background-color: var(--bg-main);
    color: var(--text-main);
    font-size: 14px;
}
.container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px;
}
.card {
    background-color: var(--bg-card);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 20px;
}

/* HEADER */
header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
}
.header-main {
    display: flex;
    align-items: center;
    gap: 16px;
}
.header-main h1 {
    font-size: 24px;
    font-weight: 600;
    margin: 0;
    color: var(--accent);
}
.status-box {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    background-color: #f1f5f9;
    padding: 4px 10px;
    border-radius: 99px;
}
.status-box span:first-child { color: var(--text-light); }
#status { font-weight: 600; }
.header-controls {
    display: flex;
    align-items: center;
    gap: 12px;
}
.btn-main, .btn-alt, .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-family: inherit;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease-in-out;
}
.btn-main {
    background-color: var(--accent);
    color: var(--text-inv);
    padding: 10px 16px;
    font-size: 14px;
}
.btn-main:hover { background-color: #6a1a33; }
.btn-alt {
    background-color: var(--bg-card);
    color: var(--text-main);
    padding: 10px 16px;
    font-size: 14px;
    border: 1px solid var(--line);
}
.btn-alt:hover { background-color: #f1f5f9; }
.btn-icon {
    background-color: transparent;
    color: var(--text-light);
    width: 32px;
    height: 32px;
    padding: 0;
}
.btn-icon:hover { background-color: #f1f5f9; color: var(--text-main); }
.btn-upload-label svg, #fxBtnMore svg {
    width: 20px;
    height: 20px;
}

/* TABS */
.tabs {
    display: flex;
    gap: 8px;
    border-bottom: 1px solid var(--line);
    margin-bottom: 24px;
}
.tabs button {
    font-family: inherit;
    font-size: 15px;
    font-weight: 600;
    padding: 8px 16px;
    border: none;
    background-color: transparent;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    cursor: pointer;
    color: var(--text-light);
    transition: all 150ms ease-in-out;
}
.tabs button:hover {
    color: var(--text-main);
}
.tabs button.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
}
.tab { display: none; }
.tab.active { display: block; }

/* KPI Grid */
.kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;
}
.kpi {
    padding: 16px;
    cursor: pointer;
    border: 2px solid var(--line);
    transition: all 150ms ease-in-out;
}
.kpi:hover {
    border-color: var(--accent-light);
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(0,0,0,0.05);
}
.kpi.active {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-light);
}
.kpi-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}
.kpi .label {
    font-weight: 600;
    color: var(--text-main);
}
.delta {
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: 13px;
    font-weight: 600;
}
.delta.up { color: var(--up); }
.delta.down { color: var(--down); }
.delta.flat { color: var(--text-light); }
.delta svg {
    width: 16px;
    height: 16px;
}
.kpi .val {
    font-size: 28px;
    font-weight: 700;
    line-height: 1.2;
    margin-bottom: 4px;
    color: var(--text-main);
}
.kpi .sub {
    font-size: 12px;
    color: var(--text-light);
}

/* Hero Panel */
.hero-panel {
    background-color: var(--bg-card);
    border: 1px solid var(--line);
    border-radius: 12px;
    display: grid;
    grid-template-columns: 1fr 2fr;
    overflow: hidden;
}
.hero-header {
    padding: 24px;
    border-right: 1px solid var(--line);
}
.hero-header select {
    font-family: inherit;
    font-size: 16px;
    font-weight: 600;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid var(--line);
    margin-bottom: 16px;
    width: 100%;
}
.hero-value {
    display: flex;
    align-items: baseline;
    gap: 12px;
}
.hero-value-number {
    font-size: 48px;
    font-weight: 700;
    color: var(--accent);
}
.hero-sub-value {
    margin-top: 8px;
    color: var(--text-light);
}
.hero-split {
    display: grid;
    grid-template-columns: 1fr 1fr;
}
.unit-kpi {
    padding: 24px;
}
.unit-kpi:first-child {
    border-right: 1px solid var(--line);
}
.unit-kpi-label {
    font-weight: 600;
    margin-bottom: 12px;
    font-size: 16px;
}
.unit-kpi-main {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 4px;
}
.unit-kpi-value {
    font-size: 32px;
    font-weight: 700;
}
.unit-kpi-sub {
    color: var(--text-light);
    font-size: 13px;
}

/* Analíticos Panel */
.panel {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 16px;
    align-items: start;
}
.side {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
}
.ch-title {
    font-weight: 600;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--line);
}
.ch-wrap {
    height: 250px;
    position: relative;
}
.donut-wrap {
    height: 220px;
}
.donut-center-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    font-weight: 600;
    pointer-events: none;
}

/* Diagnósticos Panel */
.diag-panel {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 16px;
    align-items: start;
}
.diag-main {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
}
.diag-side .card {
    position: sticky;
    top: 24px;
}
.hero-context {
    font-size: 13px;
    color: var(--text-light);
    padding-bottom: 16px;
    margin-bottom: 16px;
    border-bottom: 1px solid var(--line);
}
.hero-context strong {
    color: var(--text-main);
    font-weight: 600;
}
.ins-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.ins-card {
    display: flex;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    background-color: #f8fafc;
}
.ins-card .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: var(--accent);
    margin-top: 5px;
    flex-shrink: 0;
}
.ins-title {
    font-weight: 600;
    margin-bottom: 4px;
}
.ins-sub, .ins-action {
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-light);
}
.ins-action {
    margin-top: 8px;
    font-style: italic;
}

/* Filtros Dropup */
.fx-dropup-wrapper {
    position: relative;
}
.fx-dropup-panel {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 0;
    width: 500px;
    background-color: var(--bg-card);
    border: 1px solid var(--line);
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    z-index: 10;
    display: none;
}
.fx-dropup-wrapper.open .fx-dropup-panel {
    display: block;
}
.fx-du-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    border-bottom: 1px solid var(--line);
}
.fx-du-header h4 {
    margin: 0;
    font-size: 16px;
}
.fx-du-body {
    padding: 20px;
}
.fx-du-row {
    display: flex;
    gap: 16px;
    margin-bottom: 12px;
}
.fx-du-group {
    flex-grow: 1;
}
.fx-du-group label {
    display: block;
    font-weight: 500;
    margin-bottom: 6px;
    font-size: 13px;
}
.fx-du-group input, .fx-du-group select {
    width: 100%;
    padding: 8px 12px;
    font-family: inherit;
    font-size: 14px;
    border: 1px solid var(--line);
    border-radius: 8px;
}
.fx-du-quick {
    display: flex;
    justify-content: space-between;
    margin-bottom: 20px;
}
.fx-du-quick button {
    font-family: inherit;
    font-size: 13px;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--line);
    background-color: var(--bg-card);
    cursor: pointer;
}
.fx-du-quick button.fx-active {
    background-color: var(--accent-light);
    color: var(--accent);
    border-color: var(--accent);
    font-weight: 600;
}
.fx-du-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}
.fx-du-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    border-top: 1px solid var(--line);
    background-color: #f8fafc;
    border-bottom-left-radius: 12px;
    border-bottom-right-radius: 12px;
}

/* Multi-select */
.msel-box { position: relative; }
.msel-box label { display: block; font-weight: 500; margin-bottom: 6px; font-size: 13px; }
.msel-btn {
    width: 100%;
    padding: 8px 12px;
    font-family: inherit;
    font-size: 14px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background-color: #fff;
    text-align: left;
    cursor: pointer;
}
.msel-panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    width: 100%;
    max-height: 250px;
    overflow-y: auto;
    background-color: #fff;
    border: 1px solid var(--line);
    border-radius: 8px;
    box-shadow: 0 4px 10px rgba(0,0,0,0.08);
    z-index: 20;
    padding: 8px;
    display: none;
}
.msel-box.open .msel-panel { display: block; }
.msel-opts-box { display: flex; flex-direction: column; }
.msel-opt { display: flex; align-items: center; gap: 8px; padding: 5px; border-radius: 6px; font-size: 13px; cursor:pointer; }
.msel-opt:hover { background-color: #f1f5f9; }

/* Filtros Rápidos */
.fx-quick-select {
    display: flex;
    background-color: #e2e8f0;
    padding: 4px;
    border-radius: 8px;
}
.fx-chip {
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    padding: 6px 16px;
    border: none;
    background-color: transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
    color: var(--text-light);
}
.fx-chip:hover {
    background-color: #f1f5f9;
    color: var(--text-main);
}
.fx-chip.active {
    background-color: #fff;
    color: var(--text-main);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

/* #### AJUSTE FINAL: OCULTA O SLOT LIVRE #### */
#slot-livre {
    display: none;
}
