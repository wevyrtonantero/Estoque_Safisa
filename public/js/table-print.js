(function () {
  const TABLE_SELECTOR = '[data-print-table]';
  const ACTION_COLUMN_LABELS = new Set(['acao', 'acoes', 'actions']);

  const normalizeText = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const escapeHtml = (value) =>
    String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const getCellText = (cell) => {
    const clone = cell.cloneNode(true);

    clone
      .querySelectorAll('button, input, select, textarea, [role="menu"], .menu-dropdown, .dropdown-menu')
      .forEach((element) => element.remove());

    return (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim();
  };

  const isVisibleRow = (row) => {
    if (row.hidden) {
      return false;
    }

    const style = window.getComputedStyle(row);
    return style.display !== 'none' && style.visibility !== 'hidden';
  };

  const getPrintableColumns = (table) => {
    const headerRow = table.tHead ? table.tHead.rows[0] : table.querySelector('thead tr');
    if (!headerRow) {
      return [];
    }

    return Array.from(headerRow.cells)
      .map((cell, index) => ({
        index,
        label: getCellText(cell),
        normalized: normalizeText(getCellText(cell)),
      }))
      .filter((column) => !ACTION_COLUMN_LABELS.has(column.normalized));
  };

  const getCardContext = (wrapper) => {
    const card = wrapper.closest('.content-card');
    const counter = card ? card.querySelector('p[id]') : null;
    return counter ? counter.textContent.trim() : '';
  };

  const buildPrintTable = (wrapper) => {
    const table = wrapper.querySelector('table');
    if (!table) {
      return null;
    }

    const columns = getPrintableColumns(table);
    const bodyRows = Array.from(table.tBodies[0] ? table.tBodies[0].rows : table.querySelectorAll('tbody tr'))
      .filter(isVisibleRow);

    const headers = columns
      .map((column) => `<th>${escapeHtml(column.label)}</th>`)
      .join('');

    const rows = bodyRows.map((row) => {
      const emptyCell = row.querySelector('.empty-state');
      if (emptyCell) {
        return `<tr><td colspan="${columns.length}" class="empty-state">${escapeHtml(getCellText(emptyCell))}</td></tr>`;
      }

      const cells = columns
        .map((column) => {
          const cell = row.cells[column.index];
          const text = cell ? getCellText(cell) : '';
          return `<td>${escapeHtml(text || '-')}</td>`;
        })
        .join('');

      return `<tr>${cells}</tr>`;
    });

    return {
      html: `<table><thead><tr>${headers}</tr></thead><tbody>${rows.join('')}</tbody></table>`,
      rowCount: bodyRows.length,
    };
  };

  const printTable = (wrapper) => {
    const printData = buildPrintTable(wrapper);
    if (!printData) {
      return;
    }

    const title = wrapper.dataset.printTitle || document.title || 'Tabela';
    const context = getCardContext(wrapper);
    const printedAt = new Date().toLocaleString('pt-BR');
    const printWindow = window.open('', '_blank', 'width=1100,height=800');

    if (!printWindow) {
      window.alert('Nao foi possivel abrir a janela de impressao.');
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <title>${escapeHtml(title)}</title>
          <style>
            @page { size: landscape; margin: 10mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              color: #0a2d55;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 12px;
            }
            header {
              display: flex;
              justify-content: space-between;
              gap: 16px;
              margin-bottom: 14px;
              padding-bottom: 10px;
              border-bottom: 1px solid #c9d9ea;
            }
            h1 {
              margin: 0 0 4px;
              font-size: 20px;
            }
            p {
              margin: 0;
              color: #53677f;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: auto;
            }
            th,
            td {
              padding: 7px 8px;
              border: 1px solid #c9d9ea;
              text-align: left;
              vertical-align: top;
            }
            th {
              color: #0a2d55;
              background: #e7f0fa;
              font-size: 11px;
              text-transform: uppercase;
            }
            td {
              font-size: 11px;
            }
            .empty-state {
              text-align: center;
              color: #53677f;
            }
          </style>
        </head>
        <body>
          <header>
            <div>
              <h1>${escapeHtml(title)}</h1>
              <p>${escapeHtml(context || `${printData.rowCount} registro(s) impresso(s)`)}</p>
            </div>
            <p>${escapeHtml(printedAt)}</p>
          </header>
          ${printData.html}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  const initPrintTables = () => {
    document.querySelectorAll(TABLE_SELECTOR).forEach((wrapper) => {
      if (wrapper.dataset.printReady === 'true') {
        return;
      }

      const table = wrapper.querySelector('table');
      if (!table) {
        return;
      }

      const actions = document.createElement('div');
      actions.className = 'table-print-actions';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-secondary btn-small';
      button.textContent = 'Imprimir';
      button.addEventListener('click', () => printTable(wrapper));

      actions.appendChild(button);
      wrapper.parentNode.insertBefore(actions, wrapper);
      wrapper.dataset.printReady = 'true';
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPrintTables);
  } else {
    initPrintTables();
  }
})();
