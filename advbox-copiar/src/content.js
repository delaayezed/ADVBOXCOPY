(() => {
  'use strict';

  const MARKER = 'data-advbox-copy-enhanced';
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const CNJ = /\b\d{7}-?\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/;
  const icons = globalThis.ADVBOX_COPY_ICONS || {
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.2 4.2L19 6.7"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M9 11h6M9 15h6"/></svg>',
    error: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 8v5M12 16.5h.01"/></svg>'
  };
  let scheduled = 0;

  const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const visible = (node) => node && node.getClientRects().length > 0;
  const textOf = (node) => normalize(node?.innerText || node?.textContent);
  const isWhatsAppLink = (node) => /(?:web\.whatsapp\.com|api\.whatsapp\.com|wa\.me)\//i.test(node?.href || '');
  const isAfter = (first, second) => Boolean(first?.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

  function findTaskPanel() {
    const headings = [...document.querySelectorAll('p,h1,h2,h3,h4,h5,h6,[role="heading"],strong,b')]
      .filter((node) => visible(node) && /^partes envolvidas$/i.test(textOf(node)));
    if (!headings.length) return null;
    const heading = headings[headings.length - 1];
    return heading.closest('[role="dialog"], .modal-body, aside, [class*="drawer" i], [class*="sidebar" i], [class*="panel" i]') || heading.parentElement?.parentElement || null;
  }

  function findSectionByLabel(panel, label) {
    const target = label.toLocaleLowerCase('pt-BR');
    const nodes = [...panel.querySelectorAll('p,h1,h2,h3,h4,h5,h6,[role="heading"],strong,b,span,div')];
    const labelNode = nodes.find((node) => visible(node) && textOf(node).toLocaleLowerCase('pt-BR') === target);
    if (!labelNode) return null;
    // The ADVBOX markup changes between screens.  Keeping the actual title lets
    // the extraction below use document order instead of fragile CSS classes.
    return labelNode;
  }

  function extractProcessNumber(panel) {
    const processLabel = [...panel.querySelectorAll('*')].find((node) => visible(node) && /^processo\s*:?$/i.test(textOf(node)));
    const scope = processLabel?.parentElement || panel;
    const match = textOf(scope).match(CNJ) || textOf(panel).match(CNJ);
    return match ? match[0] : '';
  }

  function extractPhone(personContainer) {
    const link = [...personContainer.querySelectorAll('a')].find(isWhatsAppLink);
    return normalize(link?.textContent);
  }

  function extractEmail(personContainer) {
    const mailto = [...personContainer.querySelectorAll('a[href^="mailto:"]')]
      .map((node) => normalize(node.getAttribute('href').slice(7))).find((value) => EMAIL.test(value));
    if (mailto) return mailto;
    return textOf(personContainer).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
  }

  function findPersonContainer(link, section) {
    let current = link;
    while (current && current !== section) {
      const content = textOf(current);
      if ([...current.querySelectorAll('a')].some(isWhatsAppLink) || EMAIL.test(content)) return current;
      current = current.parentElement;
    }
    return link.parentElement;
  }

  function extractPeople(panel, sectionTitle) {
    if (!panel || !sectionTitle) return [];
    let section = sectionTitle.nextElementSibling;
    while (section?.matches('[data-advbox-copy-all]')) section = section.nextElementSibling;
    if (!section) return [];
    const result = [];
    let person = null;
    for (const link of section.querySelectorAll('a')) {
      if (/^vs\b/i.test(textOf(link))) break;
      if (/(?:^|\/)customers?\//i.test(link.getAttribute('href') || '')) {
        person = { name: textOf(link), phone: '', email: '', nameNode: link, container: section };
        result.push(person);
      } else if (person && isWhatsAppLink(link)) {
        person.phone = textOf(link); person.phoneNode = link;
      } else if (person && EMAIL.test(link.getAttribute('data-copy') || '')) {
        person.email = link.getAttribute('data-copy'); person.emailNode = link;
      }
    }
    return result;
    /* Legacy extraction retained below for reference; not executed. */
    const vsIndex = [...panel.querySelectorAll('*')].find((node) => isAfter(sectionTitle, node) && /^vs\.?$/i.test(textOf(node)));
    const customers = [...panel.querySelectorAll('a')].filter((link) => {
      const href = link.getAttribute('href') || '';
      const isCustomer = /\/(?:customers?|clientes?)\//i.test(href);
      return visible(link) && isCustomer && isAfter(sectionTitle, link) && (!vsIndex || !isAfter(vsIndex, link));
    });
    const people = [];
    for (const link of customers) {
      const container = findPersonContainer(link, panel);
      const name = normalize(link.textContent);
      if (name && !people.some((person) => person.name === name && person.container === container)) {
        people.push({ name, phone: extractPhone(container), email: extractEmail(container), nameNode: link, container });
      }
    }
    return people;
  }

  function findEmailNode(container, value) {
    return [...container.querySelectorAll('*')].find((node) => node.children.length === 0 && textOf(node).includes(value)) || null;
  }

  function findVisibleLeaf(panel, predicate, after, before) {
    return [...panel.querySelectorAll('*')].find((node) => {
      if (!visible(node) || node.children.length !== 0 || (after && !isAfter(after, node)) || (before && !isAfter(node, before))) return false;
      return predicate(textOf(node), node);
    }) || null;
  }

  // Fallback for ADVBOX views that render the person as plain text or use a
  // route different from /customers/. It remains bounded by the task panel and
  // the visual "vs" divider, so opposing-party data is never included.
  function extractFallbackPerson(panel, sectionTitle) {
    const vs = findVisibleLeaf(panel, (text) => /^vs\.?$/i.test(text), sectionTitle);
    const emailNode = findVisibleLeaf(panel, (text) => /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text), sectionTitle, vs);
    const phoneNode = findVisibleLeaf(panel, (text, node) => /\(?\d{2}\)?\s?\d{4,5}-\d{4}/.test(text) || (node.closest('a') && isWhatsAppLink(node.closest('a'))), sectionTitle, vs);
    const nameNode = findVisibleLeaf(panel, (text, node) => {
      if (!text || text.length < 3 || text.length > 100 || EMAIL.test(text)) return false;
      if (/^(partes envolvidas|processo|visualizar processo|vs\.?|grupo de ação|tipo de ação)$/i.test(text)) return false;
      if (/\(?\d{2}\)?\s?\d{4,5}-\d{4}/.test(text) || node.closest('a') && isWhatsAppLink(node.closest('a'))) return false;
      return true;
    }, sectionTitle, phoneNode || emailNode || vs);
    const name = textOf(nameNode);
    const phone = textOf(phoneNode);
    const email = textOf(emailNode).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
    return name ? { name, phone, email, nameNode, container: nameNode?.parentElement || panel, phoneNode, emailNode } : null;
  }

  async function copyText(value) {
    if (!value) throw new Error('empty');
    try { await navigator.clipboard.writeText(value); return; } catch (_) { /* fallback below */ }
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.className = 'advbox-copy-clipboard-fallback';
    document.body.append(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    if (!copied) throw new Error('clipboard unavailable');
  }

  function showToast(panel) {
    panel.querySelector('.advbox-copy-toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'advbox-copy-toast';
    toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite');
    toast.textContent = 'Dados copiados para a área de transferência';
    panel.append(toast);
    window.setTimeout(() => toast.remove(), 2100);
  }

  function showCopyFeedback(button, ok, message) {
    const original = button.dataset.advboxCopyIcon;
    button.classList.toggle('advbox-copy-error', !ok);
    button.classList.toggle('advbox-copy-success', ok);
    button.innerHTML = ok ? icons.check : icons.error;
    button.setAttribute('aria-label', message); button.title = message;
    window.setTimeout(() => {
      if (!button.isConnected) return;
      button.classList.remove('advbox-copy-error', 'advbox-copy-success');
      button.innerHTML = icons[original];
      button.setAttribute('aria-label', button.dataset.advboxCopyLabel);
      button.title = button.dataset.advboxCopyLabel;
    }, ok ? 1400 : 2000);
  }

  function makeCopyButton(kind, value, label, panel) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'advbox-copy-button';
    button.dataset.advboxCopyIcon = 'copy'; button.dataset.advboxCopyLabel = label;
    button.setAttribute('aria-label', label); button.title = label; button.innerHTML = icons.copy;
    button.addEventListener('click', async (event) => {
      event.preventDefault(); event.stopPropagation();
      try { await copyText(value); showCopyFeedback(button, true, 'Copiado'); showToast(panel); }
      catch (_) { showCopyFeedback(button, false, 'Não foi possível copiar'); }
    });
    return button;
  }

  function addIndividualButton(anchor, kind, value, panel) {
    if (!anchor || !value) return;
    anchor.classList.add('advbox-copy-field-link');
    if (anchor.nextElementSibling?.matches(`[data-advbox-copy-field="${kind}"]`)) return;
    const label = `Copiar ${kind}`;
    const button = makeCopyButton(kind, value, label, panel);
    button.dataset.advboxCopyField = kind;
    anchor.insertAdjacentElement('afterend', button);
  }

  function createAllText(people, process) {
    const blocks = people.map(({ name, phone, email }) => [
      name && `Nome: ${name}`, phone && `Telefone: ${phone}`, email && `E-mail: ${email}`
    ].filter(Boolean).join('\n')).filter(Boolean);
    if (process) blocks.push(`Processo: ${process}`);
    return blocks.join('\n\n');
  }

  function addMainButton(sectionTitle, people, process, panel) {
    if (panel.querySelector('[data-advbox-copy-all]')) return;
    const text = createAllText(people, process);
    if (!text) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'advbox-copy-all'; button.dataset.advboxCopyAll = 'true';
    button.setAttribute('aria-label', 'Copiar dados'); button.innerHTML = `${icons.clipboard}<span>Copiar dados</span>`;
    button.addEventListener('click', async (event) => {
      event.preventDefault(); event.stopPropagation();
      try {
        await copyText(text); button.classList.add('advbox-copy-success');
        button.innerHTML = `${icons.check}<span>Dados copiados</span>`; showToast(panel);
        window.setTimeout(() => { if (button.isConnected) { button.classList.remove('advbox-copy-success'); button.innerHTML = `${icons.clipboard}<span>Copiar dados</span>`; } }, 1400);
      } catch (_) { button.classList.add('advbox-copy-error'); button.innerHTML = `${icons.error}<span>Não foi possível copiar</span>`; window.setTimeout(() => { if (button.isConnected) { button.classList.remove('advbox-copy-error'); button.innerHTML = `${icons.clipboard}<span>Copiar dados</span>`; } }, 2000); }
    });
    sectionTitle.insertAdjacentElement('afterend', button);
  }

  function enhanceTaskPanel(panel) {
    if (!panel) return;
    panel.classList.add('advbox-copy-panel');
    const section = findSectionByLabel(panel, 'Partes envolvidas');
    if (!section) return;
    const people = extractPeople(panel, section); const process = extractProcessNumber(panel);
    people.forEach((person) => {
      addIndividualButton(person.nameNode, 'nome', person.name, panel);
      const phoneNode = person.phoneNode || [...person.container.querySelectorAll('a')].find(isWhatsAppLink);
      addIndividualButton(phoneNode, 'telefone', person.phone, panel);
      // ADVBOX already provides the email copy control via data-copy.
    });
    if (process && !panel.querySelector('[data-copy="' + process + '"]')) {
      const processNode = [...panel.querySelectorAll('*')].find((node) => node.children.length === 0 && textOf(node).includes(process));
      addIndividualButton(processNode, 'processo', process, panel);
    }
    addMainButton(section, people, process, panel);
    panel.setAttribute(MARKER, 'true');
  }

  function scheduleEnhancement() {
    window.clearTimeout(scheduled);
    scheduled = window.setTimeout(() => enhanceTaskPanel(findTaskPanel()), 110);
  }

  const observer = new MutationObserver(scheduleEnhancement);
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleEnhancement();
})();
