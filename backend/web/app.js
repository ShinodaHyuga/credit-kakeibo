const state = {
  categories: [],
  noticeTimer: null,
};

const qs = (s) => document.querySelector(s);

async function api(path, init = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  let body = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }

  if (!res.ok) {
    throw new Error(body.error?.message || "request failed");
  }
  return body.data;
}

function money(v) {
  return Number(v).toLocaleString("ja-JP");
}

function setCount(id, count, suffix = "件") {
  qs(id).textContent = `${count.toLocaleString("ja-JP")} ${suffix}`;
}

function showNotice(message, isError = false) {
  const notice = qs("#notice");
  notice.hidden = false;
  notice.classList.toggle("error", isError);
  notice.textContent = message;
  if (state.noticeTimer) {
    clearTimeout(state.noticeTimer);
  }
  state.noticeTimer = setTimeout(() => {
    notice.hidden = true;
  }, 2600);
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === name);
  });
  document.querySelectorAll(".panel").forEach((p) => {
    p.classList.toggle("active", p.id === name);
  });
}

function categorySelect(selectedId) {
  const sel = document.createElement("select");
  for (const c of state.categories) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    if (Number(selectedId) === c.id) {
      opt.selected = true;
    }
    sel.appendChild(opt);
  }
  return sel;
}

function fillCategorySelect(id) {
  const target = qs(id);
  target.innerHTML = "";
  for (const c of state.categories) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    target.appendChild(opt);
  }
}

function setBusy(button, busy, labelBusy = "処理中...") {
  if (!button) return;
  if (!button.dataset.labelDefault) {
    button.dataset.labelDefault = button.textContent;
  }
  button.disabled = busy;
  button.textContent = busy ? labelBusy : button.dataset.labelDefault;
}

function clearTransactionFilters() {
  qs("#txMonths").value = "";
  qs("#txStore").value = "";
  qs("#txAll").checked = false;
  qs("#txUncategorized").checked = false;
}

function clearSummaryFilters() {
  qs("#sumMonths").value = "";
}

function clearRuleFilters() {
  qs("#ruleFilterText").value = "";
  qs("#ruleFilterActive").checked = true;
}

function clearUncategorizedFilters() {
  qs("#uncStore").value = "";
}

async function loadCategories() {
  state.categories = await api("/api/categories");
  fillCategorySelect("#newCategory");
}

async function createRule(payload) {
  await api("/api/category-rules", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function updateRule(id, payload) {
  await api(`/api/category-rules/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

async function deleteRule(id) {
  await api(`/api/category-rules/${id}`, { method: "DELETE" });
}

async function loadTransactions() {
  const params = new URLSearchParams();
  if (qs("#txMonths").value.trim()) params.set("months", qs("#txMonths").value.trim());
  if (qs("#txStore").value.trim()) params.set("storeName", qs("#txStore").value.trim());
  if (qs("#txAll").checked) params.set("all", "true");
  if (qs("#txUncategorized").checked) params.set("uncategorized", "true");

  const rows = await api(`/api/transactions?${params.toString()}`);
  const tbody = qs("#txTable tbody");
  tbody.innerHTML = "";

  for (const r of rows) {
    const tr = document.createElement("tr");
    const isUn = r.category === "未分類";

    tr.innerHTML = `
      <td>${r.useDate}</td>
      <td>${r.storeName}</td>
      <td class="${isUn ? "uncategorized" : ""}">${r.category}</td>
      <td class="num">${money(r.amount)}</td>
      <td>${r.appliedRuleId ?? "-"}</td>
      <td></td>
    `;

    const sel = categorySelect();
    const btn = document.createElement("button");
    btn.textContent = "作成";
    btn.onclick = async () => {
      try {
        setBusy(btn, true);
        await createRule({
          matchText: r.storeName,
          categoryId: Number(sel.value),
          isActive: true,
        });
        showNotice(`ルール作成: ${r.storeName}`);
        await refreshAll();
      } catch (e) {
        showNotice(e.message, true);
      } finally {
        setBusy(btn, false);
      }
    };

    const cell = tr.children[5];
    cell.appendChild(sel);
    cell.appendChild(btn);
    tbody.appendChild(tr);
  }

  setCount("#txCount", rows.length);
}

async function loadSummary() {
  const params = new URLSearchParams();
  if (qs("#sumMonths").value.trim()) params.set("months", qs("#sumMonths").value.trim());
  const rows = await api(`/api/summary/monthly?${params.toString()}`);
  const thead = qs("#summaryTable thead");
  const tbody = qs("#summaryTable tbody");

  const categoryNames = state.categories.map((c) => c.name);
  thead.innerHTML = `<tr><th>利用年月</th>${categoryNames.map((n) => `<th>${n}</th>`).join("")}<th>合計</th></tr>`;

  tbody.innerHTML = "";
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${row.yearMonth}</td>${categoryNames
      .map((n) => `<td class="num">${money(row.categories[n] ?? 0)}</td>`)
      .join("")}<td class="num">${money(row.total)}</td>`;
    tbody.appendChild(tr);
  }

  setCount("#sumCount", rows.length, "ヶ月");
}

async function loadRules() {
  const params = new URLSearchParams();
  if (qs("#ruleFilterText").value.trim()) params.set("matchText", qs("#ruleFilterText").value.trim());
  if (qs("#ruleFilterActive").checked) params.set("active", "true");

  const rows = await api(`/api/category-rules?${params.toString()}`);
  const tbody = qs("#ruleTable tbody");
  tbody.innerHTML = "";

  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${row.id}</td><td></td><td></td><td></td><td></td>`;

    const txt = document.createElement("input");
    txt.value = row.matchText;

    const catSel = categorySelect(row.categoryId);

    const active = document.createElement("input");
    active.type = "checkbox";
    active.checked = row.isActive;

    const save = document.createElement("button");
    save.textContent = "保存";
    save.onclick = async () => {
      try {
        setBusy(save, true);
        await updateRule(row.id, {
          matchText: txt.value,
          categoryId: Number(catSel.value),
          isActive: active.checked,
        });
        showNotice(`ルール更新: #${row.id}`);
        await refreshAll();
      } catch (e) {
        showNotice(e.message, true);
      } finally {
        setBusy(save, false);
      }
    };

    const del = document.createElement("button");
    del.textContent = "削除";
    del.onclick = async () => {
      try {
        setBusy(del, true);
        await deleteRule(row.id);
        showNotice(`ルール削除: #${row.id}`);
        await refreshAll();
      } catch (e) {
        showNotice(e.message, true);
      } finally {
        setBusy(del, false);
      }
    };

    tr.children[1].appendChild(txt);
    tr.children[2].appendChild(catSel);
    tr.children[3].appendChild(active);
    tr.children[4].appendChild(save);
    tr.children[4].appendChild(del);
    tbody.appendChild(tr);
  }

  setCount("#ruleCount", rows.length);
}

async function loadUncategorizedStores() {
  const params = new URLSearchParams();
  if (qs("#uncStore").value.trim()) params.set("storeName", qs("#uncStore").value.trim());
  const rows = await api(`/api/uncategorized-stores?${params.toString()}`);
  const tbody = qs("#uncTable tbody");
  tbody.innerHTML = "";

  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="uncategorized">${r.storeName}</td><td></td>`;

    const sel = categorySelect();
    const add = document.createElement("button");
    add.textContent = "追加";
    add.onclick = async () => {
      try {
        setBusy(add, true);
        await createRule({
          matchText: r.storeName,
          categoryId: Number(sel.value),
          isActive: true,
        });
        showNotice(`未分類から追加: ${r.storeName}`);
        await refreshAll();
      } catch (e) {
        showNotice(e.message, true);
      } finally {
        setBusy(add, false);
      }
    };

    tr.children[1].appendChild(sel);
    tr.children[1].appendChild(add);
    tbody.appendChild(tr);
  }

  setCount("#uncCount", rows.length);
}

async function createRuleFromForm() {
  const btn = qs("#createRule");
  try {
    setBusy(btn, true);
    await createRule({
      matchText: qs("#newMatchText").value.trim(),
      categoryId: Number(qs("#newCategory").value),
      isActive: qs("#newActive").checked,
    });
    qs("#newMatchText").value = "";
    showNotice("ルールを追加しました");
    await refreshAll();
  } catch (e) {
    showNotice(e.message, true);
  } finally {
    setBusy(btn, false);
  }
}

async function reloadImport() {
  const btn = qs("#reloadImport");
  try {
    setBusy(btn, true, "取込中...");
    const result = await api("/api/import/reload", { method: "POST" });
    qs("#importResult").textContent = `対象:${result.totalFiles} 成功:${result.successFiles} 失敗:${result.failedFiles}`;
    showNotice("CSV再読み込みが完了しました");
    await refreshAll();
  } catch (e) {
    showNotice(e.message, true);
  } finally {
    setBusy(btn, false);
  }
}

async function refreshAll() {
  await Promise.all([loadTransactions(), loadSummary(), loadRules(), loadUncategorizedStores()]);
}

function bind() {
  document.querySelectorAll(".tab").forEach((b) => {
    b.onclick = () => switchTab(b.dataset.tab);
  });

  qs("#txFilter").onclick = () => loadTransactions().catch((e) => showNotice(e.message, true));
  qs("#sumFilter").onclick = () => loadSummary().catch((e) => showNotice(e.message, true));
  qs("#ruleFilter").onclick = () => loadRules().catch((e) => showNotice(e.message, true));
  qs("#uncFilter").onclick = () => loadUncategorizedStores().catch((e) => showNotice(e.message, true));

  qs("#txClear").onclick = () => {
    clearTransactionFilters();
    loadTransactions().catch((e) => showNotice(e.message, true));
  };
  qs("#sumClear").onclick = () => {
    clearSummaryFilters();
    loadSummary().catch((e) => showNotice(e.message, true));
  };
  qs("#ruleClear").onclick = () => {
    clearRuleFilters();
    loadRules().catch((e) => showNotice(e.message, true));
  };
  qs("#uncClear").onclick = () => {
    clearUncategorizedFilters();
    loadUncategorizedStores().catch((e) => showNotice(e.message, true));
  };

  qs("#createRule").onclick = createRuleFromForm;
  qs("#reloadImport").onclick = reloadImport;
}

async function init() {
  bind();
  await loadCategories();
  await reloadImport();
}

init().catch((e) => {
  showNotice(e.message, true);
  console.error(e);
});
