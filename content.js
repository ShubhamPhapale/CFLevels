(function () {
  "use strict";

  if (window.__cflevels_injected) return;
  window.__cflevels_injected = true;

  function getUserLanguage() {
    try {
      const urlParam = new URLSearchParams(window.location.search).get("locale");
      if (urlParam) return urlParam.toLowerCase();
    } catch (_) {}

    try {
      const cookieMatch = document.cookie.match(/(?:^|;\s*)locale=([a-z]{2})/i);
      if (cookieMatch) return cookieMatch[1].toLowerCase();
    } catch (_) {}

    const htmlLang =
      document.documentElement.lang ||
      document.querySelector("html")?.getAttribute("lang");
    if (htmlLang) return htmlLang.toLowerCase().slice(0, 2);

    return (navigator.language || "en").slice(0, 2);
  }

  const userLang = getUserLanguage();
  const CACHE_KEY = `cflevels_data_cache_v11_${userLang}`;
  const CACHE_TTL = 24 * 60 * 60 * 1000;

  let contestTypes = [];
  let allLevels = [];
  let allProblems = [];
  let problemStats = {};
  let contestMap = {};
  let solvedProblems = new Set();

  let selectedTypes = new Set();
  let selectedLevels = new Set();
  let currentPage = 1;
  const PROBLEMS_PER_PAGE = 100;

  let typeContainer = null;
  let typeTrigger = null;
  let typeTriggerText = null;
  let typeMenu = null;

  let levelContainer = null;
  let levelTrigger = null;
  let levelTriggerText = null;
  let levelMenu = null;
  let sideStatusEl = null;
  let problemsTable = null;
  let tableTbody = null;
  let nativeTbodyHTML = "";
  let nativePaginationHTML = "";
  let isFilteredViewActive = false;
  let submitIconSrc = "//codeforces.com/images/icons/submit-22x22.png";
  let userIconSrc = "//codeforces.com/images/icons/user.png";

  function naturalSort(a, b) {
    const isLetterA = /^[A-Za-z]/.test(a);
    const isLetterB = /^[A-Za-z]/.test(b);
    if (isLetterA !== isLetterB) return isLetterA ? -1 : 1;
    const la = (a.match(/^[A-Za-z]+/) || [""])[0];
    const lb = (b.match(/^[A-Za-z]+/) || [""])[0];
    if (la !== lb) return la.localeCompare(lb);
    const na = parseInt(a.slice(la.length), 10) || 0;
    const nb = parseInt(b.slice(lb.length), 10) || 0;
    return na - nb;
  }

  function getActiveNativeFilters() {
    let tags = [];
    let isOrLogic = false;
    let minRating = null;
    let maxRating = null;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tagsParam = urlParams.get("tags");
      if (tagsParam) {
        const rawTags = tagsParam.split(",").map((t) => t.trim()).filter(Boolean);
        for (const t of rawTags) {
          if (t.toLowerCase() === "combine-tags-by-or") {
            isOrLogic = true;
            continue;
          }

          // Handles rating ranges encoded as tags, e.g. "1400-1400" or "1200-1600"
          const rangeMatch = t.match(/^(\d+)?-(\d+)?$/);
          if (rangeMatch && (rangeMatch[1] || rangeMatch[2])) {
            if (rangeMatch[1]) minRating = parseInt(rangeMatch[1], 10);
            if (rangeMatch[2]) maxRating = parseInt(rangeMatch[2], 10);
          } else {
            tags.push(t.toLowerCase());
          }
        }
      }

      const minParam = urlParams.get("minDifficulty");
      const maxParam = urlParams.get("maxDifficulty");
      if (minParam && minRating === null) {
        const v = parseInt(minParam, 10);
        if (!isNaN(v)) minRating = v;
      }
      if (maxParam && maxRating === null) {
        const v = parseInt(maxParam, 10);
        if (!isNaN(v)) maxRating = v;
      }

      if (tags.length === 0) {
        document.querySelectorAll("._FilterByTagsFrame_tagBoxItem").forEach((el) => {
          const name =
            el.getAttribute("data-name") ||
            el.querySelector("._FilterByTagsFrame_tagBoxCaption")?.textContent?.trim();
          if (name && !/^(\d+)?-(\d+)?$/.test(name)) {
            tags.push(name.toLowerCase());
          }
        });
      }

      if (minRating === null) {
        const minInput = document.querySelector('input[name="minDifficulty"]');
        if (minInput && minInput.value.trim()) {
          const v = parseInt(minInput.value.trim(), 10);
          if (!isNaN(v)) minRating = v;
        }
      }
      if (maxRating === null) {
        const maxInput = document.querySelector('input[name="maxDifficulty"]');
        if (maxInput && maxInput.value.trim()) {
          const v = parseInt(maxInput.value.trim(), 10);
          if (!isNaN(v)) maxRating = v;
        }
      }

      return {
        tags,
        isOrLogic,
        minRating: isNaN(minRating) ? null : minRating,
        maxRating: isNaN(maxRating) ? null : maxRating,
        hasActiveFilters:
          tags.length > 0 || minRating !== null || maxRating !== null,
      };
    } catch (_) {
      return { tags: [], isOrLogic: false, minRating: null, maxRating: null, hasActiveFilters: false };
    }
  }

  function matchesNativeFilters(p, nativeFilters) {
    if (!nativeFilters.hasActiveFilters) return true;

    if (nativeFilters.minRating !== null) {
      if (p.rating === undefined || p.rating < nativeFilters.minRating) return false;
    }
    if (nativeFilters.maxRating !== null) {
      if (p.rating === undefined || p.rating > nativeFilters.maxRating) return false;
    }

    if (nativeFilters.tags.length > 0) {
      const pTags = (p.tags || []).map((t) => t.toLowerCase());
      if (nativeFilters.isOrLogic) {
        const hasAny = nativeFilters.tags.some((t) => pTags.includes(t));
        if (!hasAny) return false;
      } else {
        const hasAll = nativeFilters.tags.every((t) => pTags.includes(t));
        if (!hasAll) return false;
      }
    }

    return true;
  }

  function getAvailableLevels(typesSet = selectedTypes) {
    const sourcePool = allProblems && allProblems.length > 0 ? allProblems : [];
    if (sourcePool.length === 0) return allLevels;

    const nativeFilters = getActiveNativeFilters();
    const set = typesSet instanceof Set ? typesSet : new Set(typesSet ? [typesSet] : []);
    const hasTypeFilter = set.size > 0;

    const levels = new Set();
    for (const p of sourcePool) {
      if (!matchesNativeFilters(p, nativeFilters)) continue;

      if (hasTypeFilter) {
        const types = contestMap[p.contestId] || [];
        if (!types.some((t) => set.has(t))) continue;
      }
      const idx = (p.index || "").toUpperCase();
      if (idx && /^[A-Z]/.test(idx)) {
        levels.add(idx);
      }
    }
    return [...levels].sort(naturalSort);
  }

  function matchContestTypes(contestName, knownTypes) {
    const matched = new Set();
    const name = contestName || "";
    const n = name.replace(/Div\.(\d)/g, "Div. $1");

    if (/Div\.\s*1\s*\+\s*Div\.\s*2/i.test(n)) {
      matched.add("Div. 1 + Div. 2");
    } else {
      if (/Div\.\s*1\b/i.test(n)) matched.add("Div. 1");
      if (/Div\.\s*2\b/i.test(n)) matched.add("Div. 2");
    }

    if (/Div\.\s*3\b/i.test(n)) matched.add("Div. 3");
    if (/Div\.\s*4\b/i.test(n)) matched.add("Div. 4");
    if (/\bEducational\b/i.test(name)) matched.add("Educational");
    if (/\bCodeTON\b/i.test(name)) matched.add("CodeTON");
    if (/\bGlobal\b/i.test(name)) matched.add("Global");
    if (/\bKotlin\b/i.test(name)) matched.add("Kotlin");
    if (/\bVK\s*Cup\b/i.test(name)) matched.add("VK Cup");
    if (/\bApril\s*Fools\b/i.test(name)) matched.add("April Fools");
    if (/\bTeam\b/i.test(name)) matched.add("Team Contests");
    if (/\bICPC\b/i.test(name)) matched.add("ICPC Scoring");
    if (/\bLong\b/i.test(name)) matched.add("Long Rounds");

    for (const t of knownTypes) {
      if (!matched.has(t) && !t.includes("Div.")) {
        if (name.toLowerCase().includes(t.toLowerCase())) {
          matched.add(t);
        }
      }
    }

    return Array.from(matched);
  }

  function renderFilteredTable() {
    if (!problemsTable || !tableTbody) return;

    const nativeFilters = getActiveNativeFilters();

    const filtered = allProblems.filter((p) => {
      if (!matchesNativeFilters(p, nativeFilters)) return false;

      if (selectedTypes.size > 0) {
        const types = contestMap[p.contestId] || [];
        if (!types.some((t) => selectedTypes.has(t))) return false;
      }
      if (selectedLevels.size > 0) {
        const idx = (p.index || "").toUpperCase();
        if (!selectedLevels.has(idx)) return false;
      }
      return true;
    });

    try {
      const orderParam = new URLSearchParams(window.location.search).get("order");
      if (orderParam === "BY_SOLVED_DESC") {
        filtered.sort((a, b) => {
          const sa = problemStats[`${a.contestId}_${a.index}`] || 0;
          const sb = problemStats[`${b.contestId}_${b.index}`] || 0;
          return sb - sa;
        });
      } else if (orderParam === "BY_RATING_ASC") {
        filtered.sort((a, b) => (a.rating || 9999) - (b.rating || 9999));
      } else if (orderParam === "BY_RATING_DESC") {
        filtered.sort((a, b) => (b.rating || -1) - (a.rating || -1));
      }
    } catch (_) {}

    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / PROBLEMS_PER_PAGE));
    if (currentPage > totalPages) currentPage = 1;

    const startIdx = (currentPage - 1) * PROBLEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + PROBLEMS_PER_PAGE, totalCount);
    const pageProblems = filtered.slice(startIdx, endIdx);

    const headerRow = tableTbody.querySelector("tr:first-child");
    const headerHTML = headerRow ? headerRow.outerHTML : "";

    const rowsHTML = pageProblems
      .map((p) => {
        const cid = p.contestId;
        const idx = p.index;
        const name = p.name || "";
        const rating = p.rating
          ? `<span title="Difficulty" class="ProblemRating">${p.rating}</span>`
          : "";
        const stat = problemStats[`${cid}_${idx}`];
        const solved = stat !== undefined
          ? `<a title="Participants solved the problem" href="/problemset/status/${cid}/problem/${idx}"><img style="vertical-align:middle;" src="${userIconSrc}"/>&nbsp;x${stat}</a>`
          : "";
        const tags = (p.tags || [])
          .map(
            (t) =>
              `<a href="/problemset?tags=${encodeURIComponent(
                t
              )}" style="text-decoration: none;" class="notice">${t}</a>`
          )
          .join(", ");
        const isSolved = solvedProblems.has(`${cid}_${idx}`);
        const trClass = isSolved ? `class="accepted-problem"` : "";

        return `<tr ${trClass}>
          <td class="id"><a href="/problemset/problem/${cid}/${idx}">${cid}${idx}</a></td>
          <td>
            <div style="float: left;"><a href="/problemset/problem/${cid}/${idx}">${name}</a></div>
            <div style="float: right; font-size: 1.1rem; padding-top: 1px; text-align: right;">${tags}</div>
          </td>
          <td class="act">
            <span class="act-item"><a href="/problemset/submit/${cid}/${idx}"><img src="${submitIconSrc}" title="Submit" alt="Submit"/></a></span>
          </td>
          <td style="font-size: 1.1rem">${rating}</td>
          <td style="font-size: 1.1rem;">${solved}</td>
        </tr>`;
      })
      .join("");

    tableTbody.innerHTML = headerHTML + rowsHTML;
    renderPagination(currentPage, totalPages, totalCount);

    if (sideStatusEl) {
      sideStatusEl.textContent = `${totalCount} problems`;
    }

    isFilteredViewActive = true;
  }

  function renderPagination(current, totalPages, totalCount) {
    let paginationEl = document.querySelector(".pagination");
    if (!paginationEl) {
      paginationEl = document.createElement("div");
      paginationEl.className = "pagination cflevels-pagination";
      problemsTable.parentElement.appendChild(paginationEl);
    } else {
      paginationEl.classList.add("cflevels-pagination");
    }

    if (totalCount === 0) {
      paginationEl.innerHTML = `<div style="text-align: center; color: #666; padding: 1em;">No problems found matching this filter.</div>`;
      return;
    }

    const pageSet = new Set([1, totalPages]);
    for (let i = current - 2; i <= current + 2; i++) {
      if (i >= 1 && i <= totalPages) pageSet.add(i);
    }
    const sorted = [...pageSet].sort((a, b) => a - b);
    const pageList = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
        pageList.push("...");
      }
      pageList.push(sorted[i]);
    }

    const prevArrow =
      current > 1
        ? `<li><a href="#" class="arrow prev-page" data-page="${current - 1}">&larr;</a></li>`
        : `<li><span class="arrow-disabled">&larr;</span></li>`;

    const nextArrow =
      current < totalPages
        ? `<li><a href="#" class="arrow next-page" data-page="${current + 1}">&rarr;</a></li>`
        : `<li><span class="arrow-disabled">&rarr;</span></li>`;

    const pagesHTML = pageList
      .map((item) => {
        if (item === "...") {
          return `<li><span class="dots">&hellip;</span></li>`;
        }
        const isActive = item === current ? 'class="active"' : "";
        return `<li ${isActive}><a href="#" data-page="${item}">${item}</a></li>`;
      })
      .join("");

    paginationEl.innerHTML = `<ul>${prevArrow}${pagesHTML}${nextArrow}</ul>`;

    paginationEl.querySelectorAll("a[data-page]").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const p = parseInt(a.getAttribute("data-page"), 10);
        if (p && p !== currentPage) {
          currentPage = p;
          renderFilteredTable();
          problemsTable.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  function restoreNativeTable() {
    if (!isFilteredViewActive) return;

    if (tableTbody && nativeTbodyHTML) {
      tableTbody.innerHTML = nativeTbodyHTML;
    }

    const paginationEl = document.querySelector(".pagination");
    if (paginationEl && nativePaginationHTML) {
      paginationEl.outerHTML = nativePaginationHTML;
    }

    if (sideStatusEl) {
      sideStatusEl.textContent = "";
    }

    isFilteredViewActive = false;
  }

  function updateTriggerText(triggerTextEl, set) {
    if (!triggerTextEl) return;
    if (set.size === 0) {
      triggerTextEl.className = "cflevels-placeholder";
      triggerTextEl.textContent = "Any";
      triggerTextEl.removeAttribute("title");
    } else {
      const arr = Array.from(set);
      triggerTextEl.className = "cflevels-selected-text";
      const fullText = arr.join(", ");
      triggerTextEl.setAttribute("title", fullText);
      if (arr.length <= 2) {
        triggerTextEl.textContent = fullText;
      } else {
        triggerTextEl.textContent = `${arr.length} selected`;
      }
    }
  }

  function closeAllMenus() {
    if (typeMenu) typeMenu.classList.remove("open");
    if (typeTrigger) typeTrigger.classList.remove("open");
    if (levelMenu) levelMenu.classList.remove("open");
    if (levelTrigger) levelTrigger.classList.remove("open");
  }

  function toggleMenu(triggerEl, menuEl) {
    if (!triggerEl || !menuEl) return;
    const isOpen = menuEl.classList.contains("open");
    closeAllMenus();
    if (!isOpen) {
      menuEl.classList.add("open");
      triggerEl.classList.add("open");
    }
  }

  function onTypeCheckboxChanged(type, isChecked) {
    if (isChecked) {
      selectedTypes.add(type);
    } else {
      selectedTypes.delete(type);
    }

    try {
      if (selectedTypes.size > 0) {
        sessionStorage.setItem("cflevels_selected_types", JSON.stringify([...selectedTypes]));
      } else {
        sessionStorage.removeItem("cflevels_selected_types");
      }
    } catch (_) {}

    updateTriggerText(typeTriggerText, selectedTypes);
    populateLevelMultiSelect();
    applyFilter();
  }

  function onLevelCheckboxChanged(level, isChecked) {
    if (isChecked) {
      selectedLevels.add(level);
    } else {
      selectedLevels.delete(level);
    }

    try {
      if (selectedLevels.size > 0) {
        sessionStorage.setItem("cflevels_selected_levels", JSON.stringify([...selectedLevels]));
      } else {
        sessionStorage.removeItem("cflevels_selected_levels");
      }
    } catch (_) {}

    updateTriggerText(levelTriggerText, selectedLevels);
    applyFilter();
  }

  function populateContestTypeMultiSelect() {
    if (!typeMenu) return;
    typeMenu.innerHTML = "";

    for (const type of contestTypes) {
      const item = document.createElement("div");
      item.className = "cflevels-multiselect-item";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = `cflevels-type-${type.replace(/[^a-zA-Z0-9]/g, "_")}`;
      cb.value = type;
      cb.checked = selectedTypes.has(type);

      const label = document.createElement("label");
      label.htmlFor = cb.id;
      label.textContent = type;

      cb.addEventListener("change", () => {
        onTypeCheckboxChanged(type, cb.checked);
      });

      item.addEventListener("click", (e) => {
        if (e.target !== cb && e.target !== label) {
          cb.checked = !cb.checked;
          onTypeCheckboxChanged(type, cb.checked);
        }
      });

      item.appendChild(cb);
      item.appendChild(label);
      typeMenu.appendChild(item);
    }
    updateTriggerText(typeTriggerText, selectedTypes);
  }

  function populateLevelMultiSelect() {
    if (!levelMenu) return;
    levelMenu.innerHTML = "";

    const availableLevels = getAvailableLevels(selectedTypes);

    if (allProblems.length > 0 && selectedLevels.size > 0) {
      for (const lvl of [...selectedLevels]) {
        if (!availableLevels.includes(lvl)) {
          selectedLevels.delete(lvl);
        }
      }
      try {
        if (selectedLevels.size > 0) {
          sessionStorage.setItem("cflevels_selected_levels", JSON.stringify([...selectedLevels]));
        } else {
          sessionStorage.removeItem("cflevels_selected_levels");
        }
      } catch (_) {}
    }

    for (const level of availableLevels) {
      const item = document.createElement("div");
      item.className = "cflevels-multiselect-item";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = `cflevels-level-${level.replace(/[^a-zA-Z0-9]/g, "_")}`;
      cb.value = level;
      cb.checked = selectedLevels.has(level);

      const label = document.createElement("label");
      label.htmlFor = cb.id;
      label.textContent = level;

      cb.addEventListener("change", () => {
        onLevelCheckboxChanged(level, cb.checked);
      });

      item.addEventListener("click", (e) => {
        if (e.target !== cb && e.target !== label) {
          cb.checked = !cb.checked;
          onLevelCheckboxChanged(level, cb.checked);
        }
      });

      item.appendChild(cb);
      item.appendChild(label);
      levelMenu.appendChild(item);
    }

    updateTriggerText(levelTriggerText, selectedLevels);
  }

  function applyFilter() {
    if (selectedTypes.size > 0 || selectedLevels.size > 0) {
      currentPage = 1;
      renderFilteredTable();
    } else {
      restoreNativeTable();
    }
  }

  function clearFilters() {
    selectedTypes.clear();
    selectedLevels.clear();
    try {
      sessionStorage.removeItem("cflevels_selected_types");
      sessionStorage.removeItem("cflevels_selected_type");
      sessionStorage.removeItem("cflevels_selected_levels");
      sessionStorage.removeItem("cflevels_selected_level");
    } catch (_) {}

    if (typeMenu) {
      typeMenu.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        cb.checked = false;
      });
    }
    updateTriggerText(typeTriggerText, selectedTypes);

    populateLevelMultiSelect();
    updateTriggerText(levelTriggerText, selectedLevels);

    applyFilter();
  }

  function refreshDropdowns() {
    populateContestTypeMultiSelect();
    populateLevelMultiSelect();
  }

  function buildUI(table) {
    problemsTable = table;
    tableTbody = table.querySelector("tbody") || table;

    if (!nativeTbodyHTML) {
      nativeTbodyHTML = tableTbody.innerHTML;
    }
    const nativePagination = document.querySelector(".pagination");
    if (nativePagination && !nativePaginationHTML) {
      nativePaginationHTML = nativePagination.outerHTML;
    }

    const subImg = table.querySelector("td.act img");
    if (subImg && subImg.src) submitIconSrc = subImg.src;
    const uImg = table.querySelector("td:last-child img");
    if (uImg && uImg.src) userIconSrc = uImg.src;

    const sidebar = document.getElementById("sidebar");
    if (sidebar && !document.getElementById("cflevels-sidebar-box")) {
      const sidebox = document.createElement("div");
      sidebox.id = "cflevels-sidebar-box";
      sidebox.className = "roundbox sidebox borderTopRound";

      const caption = document.createElement("div");
      caption.className = "caption titled";
      caption.innerHTML = `&rarr; Filter by Level<div class="top-links"></div>`;
      sidebox.appendChild(caption);

      const body = document.createElement("div");
      body.className = "cflevels-body";

      const typeField = document.createElement("div");
      typeField.className = "cflevels-field";
      const typeLab = document.createElement("div");
      typeLab.className = "cflevels-field-label";
      typeLab.textContent = "Contest type:";
      typeField.appendChild(typeLab);

      typeContainer = document.createElement("div");
      typeContainer.className = "cflevels-multiselect";

      typeTrigger = document.createElement("div");
      typeTrigger.className = "cflevels-multiselect-trigger";
      typeTrigger.tabIndex = 0;

      typeTriggerText = document.createElement("span");
      typeTriggerText.className = "cflevels-placeholder";
      typeTriggerText.textContent = "Any";

      const typeArrow = document.createElement("span");
      typeArrow.className = "cflevels-multiselect-arrow";

      typeTrigger.appendChild(typeTriggerText);
      typeTrigger.appendChild(typeArrow);

      typeMenu = document.createElement("div");
      typeMenu.className = "cflevels-multiselect-menu";

      typeTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleMenu(typeTrigger, typeMenu);
      });

      typeTrigger.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleMenu(typeTrigger, typeMenu);
        } else if (e.key === "Escape") {
          closeAllMenus();
        }
      });

      typeContainer.appendChild(typeTrigger);
      typeContainer.appendChild(typeMenu);
      typeField.appendChild(typeContainer);
      body.appendChild(typeField);

      const levelField = document.createElement("div");
      levelField.className = "cflevels-field";
      const levelLab = document.createElement("div");
      levelLab.className = "cflevels-field-label";
      levelLab.textContent = "Problem level:";
      levelField.appendChild(levelLab);

      levelContainer = document.createElement("div");
      levelContainer.className = "cflevels-multiselect";

      levelTrigger = document.createElement("div");
      levelTrigger.className = "cflevels-multiselect-trigger";
      levelTrigger.tabIndex = 0;

      levelTriggerText = document.createElement("span");
      levelTriggerText.className = "cflevels-placeholder";
      levelTriggerText.textContent = "Any";

      const levelArrow = document.createElement("span");
      levelArrow.className = "cflevels-multiselect-arrow";

      levelTrigger.appendChild(levelTriggerText);
      levelTrigger.appendChild(levelArrow);

      levelMenu = document.createElement("div");
      levelMenu.className = "cflevels-multiselect-menu";

      levelTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleMenu(levelTrigger, levelMenu);
      });

      levelTrigger.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleMenu(levelTrigger, levelMenu);
        } else if (e.key === "Escape") {
          closeAllMenus();
        }
      });

      levelContainer.appendChild(levelTrigger);
      levelContainer.appendChild(levelMenu);
      levelField.appendChild(levelContainer);
      body.appendChild(levelField);

      document.addEventListener("click", (e) => {
        const inType = typeContainer && typeContainer.contains(e.target);
        const inLevel = levelContainer && levelContainer.contains(e.target);
        if (!inType && !inLevel) {
          closeAllMenus();
        }
      });

      const btnRow = document.createElement("div");
      btnRow.className = "cflevels-button-row";

      const clearBtn = document.createElement("input");
      clearBtn.type = "button";
      clearBtn.value = "Clear";
      clearBtn.title = "Reset filters";
      clearBtn.addEventListener("click", clearFilters);
      btnRow.appendChild(clearBtn);

      sideStatusEl = document.createElement("div");
      sideStatusEl.className = "cflevels-status";
      btnRow.appendChild(sideStatusEl);

      body.appendChild(btnRow);
      sidebox.appendChild(body);

      const filterProblemsBox = sidebar.querySelector("._FilterByTagsFrame_main");
      if (filterProblemsBox && filterProblemsBox.nextSibling) {
        sidebar.insertBefore(sidebox, filterProblemsBox.nextSibling);
      } else if (filterProblemsBox) {
        sidebar.appendChild(sidebox);
      } else {
        sidebar.appendChild(sidebox);
      }
    }

    refreshDropdowns();
  }

  async function loadDataInBackground() {
    try {
      const cached = await chrome.storage.local.get(CACHE_KEY);
      if (cached && cached[CACHE_KEY]) {
        const { types, levels, problems, stats, cmap, ts } = cached[CACHE_KEY];
        if (
          Date.now() - ts < CACHE_TTL &&
          types &&
          levels &&
          problems &&
          problems.length > 0
        ) {
          contestTypes = types;
          allLevels = levels;
          allProblems = problems;
          problemStats = stats || {};
          contestMap = cmap || {};
          refreshDropdowns();
          if (selectedTypes.size > 0 || selectedLevels.size > 0) {
            applyFilter();
          }
          fetchUserSolved();
          return;
        }
      }
    } catch (_) {}

    let scrapedTypes = [];
    try {
      const contestPageRes = await fetch("https://codeforces.com/contests/page/1", {
        credentials: "same-origin",
      });
      if (contestPageRes.ok) {
        const html = await contestPageRes.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const select = doc.querySelector('#filterTypes, select[name="filterTypes"]');
        if (select) {
          select.querySelectorAll("option").forEach((opt) => {
            const txt = opt.textContent.trim();
            if (txt && txt !== "Any") scrapedTypes.push(txt);
          });
        }
      }
    } catch (_) {}

    let newContestMap = {};
    try {
      const res = await fetch(`https://codeforces.com/api/contest.list?gym=false&lang=${encodeURIComponent(userLang)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.status === "OK" && json.result) {
          for (const c of json.result) {
            if (c.phase === "FINISHED") {
              const matched = matchContestTypes(c.name, scrapedTypes);
              if (matched.length > 0) {
                newContestMap[c.id] = matched;
              }
            }
          }
        }
      }
    } catch (_) {}

    let newProblems = [];
    let newStats = {};
    let dynamicLevels = [];
    try {
      const res = await fetch(`https://codeforces.com/api/problemset.problems?lang=${encodeURIComponent(userLang)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.status === "OK" && json.result) {
          newProblems = json.result.problems || [];
          (json.result.problemStatistics || []).forEach((s) => {
            newStats[`${s.contestId}_${s.index}`] = s.solvedCount;
          });

          newProblems.sort((a, b) => {
            if (b.contestId !== a.contestId) {
              return b.contestId - a.contestId;
            }
            return 0;
          });

          const levelSet = new Set();
          newProblems.forEach((p) => {
            const idx = (p.index || "").toUpperCase();
            if (idx && /^[A-Z]/.test(idx)) {
              levelSet.add(idx);
            }
          });
          dynamicLevels = [...levelSet].sort(naturalSort);
        }
      }
    } catch (_) {}

    const discoveredTypes = new Set(scrapedTypes);
    for (const types of Object.values(newContestMap)) {
      for (const t of types) {
        discoveredTypes.add(t);
      }
    }

    const priorityTypes = [
      "Div. 1",
      "Div. 2",
      "Div. 3",
      "Div. 4",
      "Div. 1 + Div. 2",
      "Educational",
      "Global",
      "CodeTON",
      "Kotlin",
      "VK Cup",
      "April Fools",
    ];

    const sortedTypes = [];
    for (const pt of priorityTypes) {
      if (discoveredTypes.has(pt)) {
        sortedTypes.push(pt);
        discoveredTypes.delete(pt);
      }
    }
    const remainingTypes = [...discoveredTypes].sort();
    const finalTypes = [...sortedTypes, ...remainingTypes];

    if (finalTypes.length > 0) contestTypes = finalTypes;
    if (dynamicLevels.length > 0) allLevels = dynamicLevels;
    if (newProblems.length > 0) allProblems = newProblems;
    if (Object.keys(newStats).length > 0) problemStats = newStats;
    if (Object.keys(newContestMap).length > 0) contestMap = newContestMap;

    try {
      await chrome.storage.local.set({
        [CACHE_KEY]: {
          types: contestTypes,
          levels: allLevels,
          problems: allProblems,
          stats: problemStats,
          cmap: contestMap,
          ts: Date.now(),
        },
      });
    } catch (_) {}

    refreshDropdowns();
    if (selectedTypes.size > 0 || selectedLevels.size > 0) {
      applyFilter();
    }
    fetchUserSolved();
  }

  async function fetchUserSolved() {
    try {
      const profileLink = document.querySelector("a[href^='/profile/']");
      if (!profileLink) return;
      const handle = profileLink.textContent.trim();
      if (!handle) return;

      const res = await fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=1000&lang=${encodeURIComponent(userLang)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.status === "OK" && json.result) {
          json.result.forEach((sub) => {
            if (sub.verdict === "OK" && sub.problem) {
              solvedProblems.add(`${sub.problem.contestId}_${sub.problem.index}`);
            }
          });
          if (isFilteredViewActive) {
            renderFilteredTable();
          }
        }
      }
    } catch (_) {}
  }

  async function init() {
    try {
      const storedTypes = sessionStorage.getItem("cflevels_selected_types");
      if (storedTypes) {
        const parsed = JSON.parse(storedTypes);
        if (Array.isArray(parsed)) {
          selectedTypes = new Set(parsed);
        }
      } else {
        const oldType = sessionStorage.getItem("cflevels_selected_type");
        if (oldType) {
          selectedTypes = new Set([oldType]);
        }
      }

      const storedLevels = sessionStorage.getItem("cflevels_selected_levels");
      if (storedLevels) {
        const parsed = JSON.parse(storedLevels);
        if (Array.isArray(parsed)) {
          selectedLevels = new Set(parsed);
        }
      } else {
        const oldLevel = sessionStorage.getItem("cflevels_selected_level");
        if (oldLevel) {
          selectedLevels = new Set([oldLevel]);
        }
      }
    } catch (_) {}

    try {
      const cached = await chrome.storage.local.get(CACHE_KEY);
      if (cached && cached[CACHE_KEY]) {
        const { types, levels, problems, stats, cmap, ts } = cached[CACHE_KEY];
        if (Date.now() - ts < CACHE_TTL && types && levels && problems && problems.length > 0) {
          contestTypes = types;
          allLevels = levels;
          allProblems = problems;
          problemStats = stats || {};
          contestMap = cmap || {};
        }
      }
    } catch (_) {}

    const table = document.querySelector("table.problems");
    if (!table) {
      let attempts = 0;
      const timer = setInterval(() => {
        attempts++;
        const t = document.querySelector("table.problems");
        if (t) {
          clearInterval(timer);
          buildUI(t);
          loadDataInBackground();
        } else if (attempts > 30) {
          clearInterval(timer);
        }
      }, 100);
      return;
    }

    buildUI(table);
    loadDataInBackground();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
