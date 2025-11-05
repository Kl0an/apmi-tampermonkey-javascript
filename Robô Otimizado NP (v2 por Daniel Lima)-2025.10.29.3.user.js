// ==UserScript==
// @name         Robô Otimizado NP (v2 por Daniel Lima)
// @namespace    http://tampermonkey.net/
// @version      2025.10.29.3
// @description  Versão aprimorada com Alerta de Sessão, Modo Minimizar (Bolinha), Baixar Fila Sempre Ativo e Créditos.
// @author       Daniel Nunes Lima
// @match        *://*.notaparana.pr.gov.br/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // --- CSS ---
    GM_addStyle(`
        #automacao-panel {
            position: fixed; top: 20px; right: 20px; z-index: 9999;
            background-color: #ffffff; border: 1px solid #dee2e6;
            border-radius: 12px; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            width: 360px; opacity: 0; transform: scale(0.95);
            animation: fadeInPanel 0.3s ease-out forwards;
            display: flex; flex-direction: column;
        }
        #automacao-panel.minimized { display: none; }
        @keyframes fadeInPanel { to { opacity: 1; transform: scale(1); } }
        #automacao-panel * { box-sizing: border-box; }

        .panel-header {
            background-color: #005ca9; color: white; padding: 12px 18px;
            border-top-left-radius: 12px; border-top-right-radius: 12px;
            font-size: 16px; font-weight: 600;
            display: flex; justify-content: space-between; align-items: center;
        }
        #minimize-btn {
            background: #ffffff20; border: none; color: white; border-radius: 50%;
            width: 24px; height: 24px; font-size: 20px; line-height: 24px;
            cursor: pointer; font-weight: bold; text-align: center;
        }
        .panel-body { padding: 18px; flex-grow: 1; }
        #panel-status {
            margin: 0 0 12px 0; font-size: 15px; color: #212529;
            font-weight: 500; transition: color 0.3s; min-height: 40px;
        }

        #queue-container {
            background-color: #f8f9fa; border: 1px solid #dee2e6;
            border-radius: 8px; height: 120px; min-height: 80px; max-height: 400px;
            overflow-y: auto; resize: vertical;
            padding: 8px; margin: 18px 0 12px 0;
        }
        #queue-list { list-style-type: none; padding: 0; margin: 0; font-size: 12px; line-height: 1.6; color: #495057; }
        #queue-count { margin: 0 0 18px 0; text-align: right; font-weight: 600; font-size: 14px; color: #6c757d; }
        .panel-input {
            width: 100%; padding: 10px; margin-bottom: 12px;
            border: 1px solid #ced4da; border-radius: 8px; font-size: 14px;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        .panel-input:focus {
            outline: none; border-color: #80bdff; box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
        }
        .panel-button {
            width: 100%; padding: 12px; color: white; border: none;
            border-radius: 8px; cursor: pointer; font-size: 16px;
            font-weight: 600; transition: all 0.2s;
        }
        .panel-button:hover { transform: translateY(-1px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        .panel-button:active { transform: translateY(0px); }
        .panel-button:disabled { background-color: #ced4da; cursor: not-allowed; transform: none; box-shadow: none; }

        #target-cnpj-input { margin-bottom: 15px; }
        #start-pause-btn { background-color: #28a745; margin-bottom: 10px; }
        #start-pause-btn.paused { background-color: #ffc107; color: #212529; }
        #toggle-mode-btn { background-color: #6c757d; font-size: 14px; padding: 8px; margin-bottom: 15px; }

        #file-import-controls #import-btn { background-color: #28a745; margin-bottom: 10px; }
        .panel-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
        #download-remaining-btn { background-color: #007bff; font-size: 14px; padding: 10px;}
        #clear-queue-btn { background-color: #dc3545; font-size: 14px; padding: 10px; }

        #automacao-panel.mode-scanner #file-import-controls { display: none; }
        #automacao-panel.mode-scanner #scanner-input { display: block; }
        #automacao-panel.mode-file #file-import-controls { display: block; }
        #automacao-panel.mode-file #scanner-input { display: none; }

        .stats-footer {
            background-color: #f8f9fa; padding: 12px 18px; border-top: 1px solid #dee2e6;
            font-size: 13px; color: #495057;
        }
        .dev-footer {
            padding: 10px 18px; font-size: 11px; text-align: center; color: #6c757d;
            border-bottom-left-radius: 12px; border-bottom-right-radius: 12px; background-color: #f8f9fa; border-top: 1px solid #dee2e6;
        }
        .dev-footer a { color: #005ca9; text-decoration: none; }
        .dev-footer img { vertical-align: middle; margin-right: 4px; height: 16px; }

        #automacao-bubble {
            position: fixed; bottom: 20px; right: 20px; z-index: 9998;
            width: 60px; height: 60px; background-color: #005ca9;
            border-radius: 50%; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            display: flex; align-items: center; justify-content: center;
            font-size: 30px; cursor: pointer;
            transition: transform 0.2s ease-out;
        }
        #automacao-bubble:hover { transform: scale(1.1); }
    `);

    // --- Gerenciamento da Fila e Estado ---
    let donationQueue = JSON.parse(localStorage.getItem('donationQueue')) || [];
    function saveQueue() { localStorage.setItem('donationQueue', JSON.stringify(donationQueue)); }
    function isProcessingActive() { return localStorage.getItem('processingActive') === 'true'; }

    // --- Criação do HTML ---
    const panelHTML = `
        <div id="automacao-bubble" style="display: none;">🤖</div>
        <div id="automacao-panel" class="mode-scanner">
            <div class="panel-header">
                <span>Robô Nota Paraná 🤖</span>
                <button id="minimize-btn" title="Minimizar Painel">-</button>
            </div>
            <div class="panel-body">
                <p id="panel-status">Aguardando...</p>
                <input type="text" id="target-cnpj-input" class="panel-input" placeholder="CNPJ Alvo (só números ou formatado)">
                <button id="start-pause-btn" class="panel-button">Iniciar Fila</button>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;">
                <button id="toggle-mode-btn" class="panel-button">Trocar p/ Modo Arquivo 📄</button>
                <input type="text" id="scanner-input" class="panel-input" placeholder="Passe o leitor aqui">
                <div id="file-import-controls">
                    <input type="file" id="file-importer" accept=".txt" style="display: none;">
                    <button id="import-btn" class="panel-button">Importar Chaves (.txt)</button>
                </div>
                <div id="queue-container"><ul id="queue-list"></ul></div>
                <p id="queue-count">Notas na Fila: 0</p>
                <div class="panel-actions">
                     <button id="download-remaining-btn" class="panel-button">Baixar Fila</button>
                     <button id="clear-queue-btn" class="panel-button">Limpar Fila</button>
                </div>
            </div>
            <div class="stats-footer">
                <h6>Estatísticas</h6>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span><strong>Contador Total:</strong> <span id="total-donated-count">0</span></span>
                    <button id="reset-total-btn" style="background: none; border: none; color: #007bff; cursor: pointer; text-decoration: underline; font-size: 12px; padding: 0;">Zerar</button>
                </div>
                <p style="margin: 8px 0 0 0;"><strong>Última Fila:</strong> <span id="last-batch-stats">N/A</span></p>
            </div>
            <div class="dev-footer">
                Desenvolvido por <strong>Daniel Nunes Lima</strong><br>
                <a href="https://wa.me/5544999117348" target="_blank" title="Abrir WhatsApp">
                    <img src="https://kloansisdan-php.kesug.com/icons8-whatsapp.gif" alt="WhatsApp"> WhatsApp
                </a> |
                <a href="mailto:limanunesdaniel@hotmail.com" title="Enviar Email">
                    limanunesdaniel@hotmail.com
                </a>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', panelHTML);

    // --- Seletores de Elementos ---
    const panel = document.getElementById('automacao-panel');
    const bubble = document.getElementById('automacao-bubble');
    const minimizeBtn = document.getElementById('minimize-btn');
    const statusText = document.getElementById('panel-status');
    const queueListEl = document.getElementById('queue-list');
    const queueCountEl = document.getElementById('queue-count');
    const clearBtn = document.getElementById('clear-queue-btn');
    const totalDonatedEl = document.getElementById('total-donated-count');
    const lastBatchStatsEl = document.getElementById('last-batch-stats');
    const resetTotalBtn = document.getElementById('reset-total-btn');
    const toggleModeBtn = document.getElementById('toggle-mode-btn');
    const scannerInput = document.getElementById('scanner-input');
    const importBtn = document.getElementById('import-btn');
    const fileImporter = document.getElementById('file-importer');
    const downloadRemainingBtn = document.getElementById('download-remaining-btn');
    const targetCNPJInput = document.getElementById('target-cnpj-input');
    const startPauseBtn = document.getElementById('start-pause-btn');

    // --- Áudio de Alerta ---
    const alertAudio = new Audio('https://kloansisdan-php.kesug.com/alerta_nota_parana.mp3');
    function playAlertSound() {
        alertAudio.play().catch(e => console.error("Erro ao tocar áudio:", e));
    }

    // --- Funções Auxiliares ---
    function updateQueueDisplay() {
        queueListEl.innerHTML = donationQueue.map(key => `<li>${key.substring(0,22)}...</li>`).join('');
        queueCountEl.textContent = `Notas na Fila: ${donationQueue.length}`;
        downloadRemainingBtn.disabled = (donationQueue.length === 0);
    }

    function updateStatsDisplay() {
        totalDonatedEl.textContent = localStorage.getItem('totalDonatedCount') || 0;
        const stats = JSON.parse(localStorage.getItem('lastBatchStats'));
        if (stats) {
            const minutes = Math.floor(stats.duration / 60);
            const seconds = (stats.duration % 60).toFixed(0);
            const speed = stats.duration > 0 ? (stats.count / (stats.duration / 60)).toFixed(1) : 0;
            lastBatchStatsEl.textContent = `${stats.count} notas em ${minutes}m ${seconds}s (~${speed} n/min)`;
        } else {
            lastBatchStatsEl.textContent = 'N/A';
        }
    }

function addKeyToQueue(extractedKey) {
        if (!donationQueue.includes(extractedKey)) {
            if (donationQueue.length === 0) {
                // Se for a primeira nota da fila, zera as estatísticas da fila
                localStorage.setItem('batchStartTime', Date.now());
                localStorage.setItem('batchStartCount', 1);
            } else {
                // Se não for, apenas incrementa a contagem inicial da fila
                let startCount = parseInt(localStorage.getItem('batchStartCount')) || 0;
                localStorage.setItem('batchStartCount', startCount + 1);
            }
            donationQueue.push(extractedKey);
            saveQueue();
            updateQueueDisplay();
            return true;
        }
        return false;
    }

    // --- Funções de Controle de Processamento ---
    function pauseProcessing() {
        localStorage.setItem('processingActive', 'false');
        sessionStorage.removeItem('justSubmitted');
        startPauseBtn.textContent = 'Iniciar Fila';
        startPauseBtn.classList.remove('paused');
        if (!statusText.innerHTML.includes('ERRO')) {
            statusText.textContent = 'Pausado. Clique em Iniciar.';
            statusText.style.color = '#ffc107';
        }
        clearBtn.disabled = false;
        importBtn.disabled = false;
        toggleModeBtn.disabled = false;
    }

    function startProcessing() {
        if (donationQueue.length === 0) {
            statusText.textContent = 'Fila vazia. Adicione notas.';
            return;
        }
        localStorage.setItem('processingActive', 'true');
        startPauseBtn.textContent = 'Pausar Fila';
        startPauseBtn.classList.add('paused');
        statusText.textContent = 'Iniciando processamento...';
        statusText.style.color = '#007bff';
        clearBtn.disabled = true;
        importBtn.disabled = true;
        toggleModeBtn.disabled = true;
        checkPageAndProcess();
    }

    // --- Funções de UI (Minimizar/Restaurar) ---
    function minimizePanel() {
        panel.classList.add('minimized');
        bubble.style.display = 'flex';
        localStorage.setItem('panelMinimized', 'true');
    }
    function restorePanel() {
        panel.classList.remove('minimized');
        bubble.style.display = 'none';
        localStorage.setItem('panelMinimized', 'false');
    }

    // --- Event Listeners ---
    minimizeBtn.onclick = minimizePanel;
    bubble.onclick = restorePanel;

    startPauseBtn.onclick = () => isProcessingActive() ? pauseProcessing() : startProcessing();
    targetCNPJInput.oninput = function() { localStorage.setItem('targetCNPJ', this.value); };

    toggleModeBtn.onclick = function() {
        if (panel.classList.contains('mode-scanner')) {
            panel.classList.remove('mode-scanner'); panel.classList.add('mode-file');
            toggleModeBtn.textContent = 'Trocar p/ Modo Scanner ⌨️';
            statusText.textContent = 'Pronto. Importe um arquivo .txt';
        } else {
            panel.classList.remove('mode-file'); panel.classList.add('mode-scanner');
            toggleModeBtn.textContent = 'Trocar p/ Modo Arquivo 📄';
            statusText.textContent = 'Pronto. Escaneie no campo abaixo.';
            scannerInput.focus();
        }
    };

    scannerInput.addEventListener('input', function() {
        const match = this.value.match(/\d{44}/);
        if (match && match[0]) {
            if (addKeyToQueue(match[0])) {
                statusText.textContent = `✅ Nota ${donationQueue.length} adicionada.`;
                statusText.style.color = '#28a745';
                if (isProcessingActive()) {
                    // Se o robô estiver ATIVO, chama o processamento
                    checkPageAndProcess();
                }
            } else {
                statusText.textContent = `⚠️ Nota repetida ignorada.`;
                statusText.style.color = '#ffc107';
            }
            setTimeout(() => { this.value = ''; }, 100);
        }
    });

    importBtn.onclick = () => fileImporter.click();
    fileImporter.onchange = function(event) {
        const file = event.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            const keysFromFile = e.target.result.match(/\d{44}/g) || [];
            if (keysFromFile.length === 0) {
                statusText.textContent = '⚠️ Nenhuma chave (44 dígitos) encontrada.';
                statusText.style.color = '#ffc107'; return;
            }
            let addedCount = 0, duplicateCount = 0;
            keysFromFile.forEach(key => addKeyToQueue(key) ? addedCount++ : duplicateCount++);
            statusText.textContent = `✅ ${addedCount} chaves importadas. ${duplicateCount} duplicadas.`;
            statusText.style.color = '#28a745';
            event.target.value = null;
            if (isProcessingActive()) {
                // Se o robô estiver ATIVO, chama o processamento
                checkPageAndProcess();
            }
        };
        reader.readAsText(file);
    };

    downloadRemainingBtn.onclick = function() {
        if (donationQueue.length === 0) { alert('A fila está vazia.'); return; }
        const fileContent = donationQueue.join('\n');
        const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'chaves_restantes.txt';
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
        statusText.textContent = '📝 Fila restante baixada.';
    };

    clearBtn.onclick = function() {
        if (confirm('Tem certeza que deseja LIMPAR A FILA e parar tudo?')) {
            donationQueue = []; saveQueue();
            localStorage.removeItem('processingActive');
            localStorage.removeItem('batchStartTime');
            localStorage.removeItem('batchStartCount');
            sessionStorage.removeItem('justSubmitted');
            alert('Fila de doações limpa. O processo foi parado.');
            location.reload();
        }
    };

    resetTotalBtn.onclick = function() {
        if (confirm('Tem certeza que deseja ZERAR o contador total?')) {
            localStorage.setItem('totalDonatedCount', '0');
            updateStatsDisplay();
        }
    };

    // --- FUNÇÃO PRINCIPAL DE PROCESSAMENTO ---
    function checkPageAndProcess() {
        // 1. Verificar se o processo deve continuar (Esta é a checagem de PAUSA)
        if (!isProcessingActive()) {
            if (statusText.textContent.includes('Iniciando')) {
                 statusText.textContent = 'Pausado.'; statusText.style.color = '#ffc107';
            }
            return;
        }

        // 2. Verificar se a fila acabou
        if (donationQueue.length === 0) {
            pauseProcessing();
            statusText.innerHTML = '🎉 **Fila concluída!**';
            statusText.style.color = '#28a745';
            const startTime = parseInt(localStorage.getItem('batchStartTime'));
            const startCount = parseInt(localStorage.getItem('batchStartCount'));
            if (startTime && startCount > 0) {
                const duration = (Date.now() - startTime) / 1000; // Duração em segundos
                // Salva as estatísticas da fila que acabou de ser processada
                localStorage.setItem('lastBatchStats', JSON.stringify({ count: startCount, duration: duration }));
            }
            // Limpa os contadores para a próxima fila
            localStorage.removeItem('batchStartTime');
            localStorage.removeItem('batchStartCount');
            updateStatsDisplay();
            return;
        }

        // 3. Checar se estamos na página correta antes de prosseguir
        const isOnDonationPage = window.location.href.includes('DoacaoDocumentoFiscalCadastrar');
        if (!isOnDonationPage) {
            statusText.innerHTML = '<strong>❌ ERRO: Sessão expirou ou página errada!</strong><br>Retorne à pág. de doação para continuar.';
            statusText.style.color = '#dc3545';
            playAlertSound();
            pauseProcessing(); // Pausa para o usuário poder corrigir
            return;
        }

        // --- A partir daqui, estamos na página certa ---
        const chaveInputNaPagina = document.getElementById('chaveAcesso');
        const doarButton = document.getElementById('btnDoarDocumento');
        const pageText = document.body.innerText.toLowerCase();
        const justSubmitted = sessionStorage.getItem('justSubmitted') === 'true';

        // 4. Verificar se houve resultado da última doação
        const successFound = pageText.includes('registrada com sucesso');
        const errorFound = pageText.includes('chave de acesso inválida') || pageText.includes('já foi doado') || pageText.includes('documento fiscal já foi utilizado');

        if (successFound || errorFound) {
            sessionStorage.removeItem('justSubmitted');
            donationQueue.shift(); // Remove a nota (sucesso ou erro)
            saveQueue();
            if (successFound) {
                let totalDonated = parseInt(localStorage.getItem('totalDonatedCount') || 0) + 1;
                localStorage.setItem('totalDonatedCount', totalDonated);
            }
            updateQueueDisplay();
            updateStatsDisplay();
            // Recarrega a função para a próxima nota (se houver)
            setTimeout(checkPageAndProcess, 100);
            return;
        }

        // 5. Se estamos na página de doação, verificar CNPJ, LOOP e doar
        if (chaveInputNaPagina && doarButton) {
            // Lógica Anti-Loop (se a página recarregar sem msg de sucesso/erro)
            if (justSubmitted) {
                sessionStorage.removeItem('justSubmitted');
                const succeededKey = donationQueue.shift(); // Assume que deu certo
                saveQueue();
                let totalDonated = parseInt(localStorage.getItem('totalDonatedCount') || 0) + 1;
                localStorage.setItem('totalDonatedCount', totalDonated);
                updateQueueDisplay();
                updateStatsDisplay();
                statusText.textContent = `✅ Nota ${succeededKey.substring(0,6)}... processada (sem msg). Pulando...`;
                statusText.style.color = '#28a745';
                setTimeout(checkPageAndProcess, 1000); // Tenta a próxima
                return;
            }

            // Lógica do CNPJ
            const targetCNPJRaw = localStorage.getItem('targetCNPJ') || '';
            const targetCNPJNormalized = targetCNPJRaw.replace(/\D/g, '');
            const pageCNPJInput = document.getElementById('cnpjEntidade');
            if (!targetCNPJNormalized) {
                statusText.textContent = '❌ PAUSADO: Defina o CNPJ Alvo no painel.'; pauseProcessing(); return;
            }
            pageCNPJInput.value = targetCNPJNormalized; // Garante que o CNPJ está preenchido

            // TUDO CERTO! Doar a próxima nota.
            statusText.textContent = `Doando... Faltam ${donationQueue.length}`;
            statusText.style.color = '#007bff';
            chaveInputNaPagina.value = donationQueue[0];
            sessionStorage.setItem('justSubmitted', 'true');
            doarButton.click();
        }
    }

    // --- INICIALIZAÇÃO DO SCRIPT ---
    (function init() {
        targetCNPJInput.value = localStorage.getItem('targetCNPJ') || '';
        updateQueueDisplay();
        updateStatsDisplay();

        if (localStorage.getItem('panelMinimized') === 'true') {
            minimizePanel();
        }

        if (isProcessingActive()) {
            startPauseBtn.textContent = 'Pausar Fila';
            startPauseBtn.classList.add('paused');
            clearBtn.disabled = true; importBtn.disabled = true; toggleModeBtn.disabled = true;
        } else {
            statusText.textContent = 'Pausado. Clique em Iniciar.';
            statusText.style.color = '#ffc107';
            sessionStorage.removeItem('justSubmitted');
        }

        setTimeout(checkPageAndProcess, 500);
    })();
})();