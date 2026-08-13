<script lang="ts">
  import PasswordModal from './PasswordModal.svelte';

  // ─── Search / Lookup ──────────────────────────────────────────────────────
  let searchQuery = '';
  let searchLoading = false;
  let searchResult: {
    found: boolean;
    neoid?: string;
    campus?: string;
    regno?: string | null;
    topcoder?: boolean;
    studentName?: string | null;
  } | null = null;

  async function doSearch() {
    const q = searchQuery.trim().toUpperCase();
    if (!q) return;
    searchLoading = true;
    searchResult = null;
    try {
      const res = await fetch(`/api/neo-ids/search/${encodeURIComponent(q)}`);
      searchResult = await res.json();
    } catch (e) {
      searchResult = { found: false, neoid: q };
    } finally {
      searchLoading = false;
    }
  }

  function handleSearchKey(e: KeyboardEvent) {
    if (e.key === 'Enter') doSearch();
  }

  // ─── Batch Tabs ───────────────────────────────────────────────────────────
  let activeTab: 'map' | 'campus' | 'lookup' | 'lookup-neoid' = 'map';

  function setActiveTab(id: string) {
    if (id === 'map' || id === 'campus' || id === 'lookup' || id === 'lookup-neoid') activeTab = id as any;
  }

  // ─── Tab 1: Map Registration Numbers ─────────────────────────────────────
  let mapInput = '';
  let mapParsed: { neoid: string; regno: string }[] = [];
  let mapShowModal = false;
  let mapLoading = false;
  let mapToast: { type: 'success' | 'error'; msg: string } | null = null;

  $: {
    mapParsed = mapInput
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split(/[\t,]/).map(p => p.trim());
        return { neoid: parts[0] || '', regno: parts[1] || '' };
      })
      .filter(m => m.neoid && m.regno);
  }

  function submitMap() {
    if (!mapParsed.length) return;
    mapShowModal = true;
  }

  async function doMapSubmit(password: string) {
    mapShowModal = false;
    mapLoading = true;
    mapToast = null;
    try {
      const res = await fetch('/api/neo-ids/batch-map-regno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ mappings: mapParsed })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      mapToast = { type: 'success', msg: data.message };
      mapInput = '';
    } catch (err: any) {
      mapToast = { type: 'error', msg: err.message || 'An error occurred' };
    } finally {
      mapLoading = false;
      setTimeout(() => (mapToast = null), 5000);
    }
  }

  // ─── Tab 2: Set Campus ────────────────────────────────────────────────────
  let campusInput = '';
  let campusSelected: 'Chennai' | 'Vellore' | 'Unknown' = 'Chennai';

  function setCampus(c: string) {
    if (c === 'Chennai' || c === 'Vellore' || c === 'Unknown') campusSelected = c;
  }
  let campusShowModal = false;
  let campusLoading = false;
  let campusToast: { type: 'success' | 'error'; msg: string } | null = null;

  let campusParsed: string[] = [];
  $: campusParsed = campusInput
    .split('\n')
    .map(l => l.trim().toUpperCase())
    .filter(Boolean);

  function submitCampus() {
    if (!campusParsed.length) return;
    campusShowModal = true;
  }

  async function doCampusSubmit(password: string) {
    campusShowModal = false;
    campusLoading = true;
    campusToast = null;
    try {
      const res = await fetch('/api/neo-ids/batch-set-campus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ neoids: campusParsed, campus: campusSelected })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      campusToast = { type: 'success', msg: data.message };
      campusInput = '';
    } catch (err: any) {
      campusToast = { type: 'error', msg: err.message || 'An error occurred' };
    } finally {
      campusLoading = false;
      setTimeout(() => (campusToast = null), 5000);
    }
  }

  // ─── Tab 3: Lookup Names ──────────────────────────────────────────────────
  let lookupInput = '';
  let lookupLoading = false;
  let lookupResults: {
    searchedName: string;
    matches: { name: string; regno: string; neo_id: string | null }[];
    found: boolean;
  }[] = [];
  let lookupDone = false;
  let copyToastVisible = false;

  async function doLookup() {
    const names = lookupInput
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
    if (!names.length) return;
    lookupLoading = true;
    lookupDone = false;
    lookupResults = [];
    try {
      const res = await fetch('/api/students/batch-lookup-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names })
      });
      const data = await res.json();
      lookupResults = data.results || [];
      lookupDone = true;
    } catch (e) {
      lookupResults = [];
      lookupDone = true;
    } finally {
      lookupLoading = false;
    }
  }

  function copyLookupResults() {
    const lines = lookupResults
      .flatMap(r => r.found ? r.matches.map(m => m.regno) : [])
      .join('\n');
    navigator.clipboard.writeText(lines).then(() => {
      copyToastVisible = true;
      setTimeout(() => (copyToastVisible = false), 2000);
    });
  }

  // ─── Tab 4: Batch Lookup Neo IDs ──────────────────────────────────────────
  let batchLookupInput = '';
  let batchLookupLoading = false;
  let batchLookupResults: any[] = [];
  let batchLookupDone = false;

  async function doBatchLookup() {
    const neoids = batchLookupInput
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
    if (!neoids.length) return;
    batchLookupLoading = true;
    batchLookupDone = false;
    batchLookupResults = [];
    try {
      const res = await fetch('/api/neo-ids/batch-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ neoids })
      });
      const data = await res.json();
      const rawResults = data.results || [];
      batchLookupResults = rawResults.sort((a: any, b: any) => {
        const getCampusRank = (c: string) => {
          if (!c) return 3;
          const lower = c.toLowerCase();
          if (lower.includes('chennai')) return 1;
          if (lower.includes('vellore')) return 2;
          return 3;
        };
        
        const campusDiff = getCampusRank(a.campus) - getCampusRank(b.campus);
        if (campusDiff !== 0) return campusDiff;

        const isUnknown = (name: string | null | undefined) => {
          if (!name) return true;
          return name.toLowerCase().startsWith('student (');
        };
        
        const aUnknown = isUnknown(a.studentName);
        const bUnknown = isUnknown(b.studentName);
        
        if (aUnknown && !bUnknown) return 1;
        if (!aUnknown && bUnknown) return -1;
        
        if (!aUnknown && !bUnknown && a.studentName && b.studentName) {
           return a.studentName.localeCompare(b.studentName);
        }
        
        return 0;
      });
      batchLookupDone = true;
    } catch (e) {
      batchLookupResults = [];
      batchLookupDone = true;
    } finally {
      batchLookupLoading = false;
    }
  }
</script>

<div class="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">

  <!-- Page Header -->
  <div class="flex items-center gap-4">
    <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/20">
      🔗
    </div>
    <div>
      <h1 class="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Neo ID Manager</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Search, map, and manage Neo IDs for the 2027 batch</p>
    </div>
  </div>

  <!-- ─── Section 1: Single Search ─────────────────────────────────────── -->
  <div class="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 backdrop-blur-sm">
    <h2 class="text-base font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
      <span class="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-sm">🔍</span>
      Look Up a Neo ID
    </h2>

    <div class="flex gap-3">
      <input
        id="neoid-search-input"
        bind:value={searchQuery}
        on:keydown={handleSearchKey}
        type="text"
        placeholder="e.g. D1D9H1A1"
        class="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white placeholder:text-slate-400 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
      />
      <button
        id="neoid-search-btn"
        on:click={doSearch}
        disabled={searchLoading || !searchQuery.trim()}
        class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-sm shadow-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {searchLoading ? 'Searching…' : 'Search'}
      </button>
    </div>

    {#if searchResult !== null}
      <div class="mt-5 rounded-xl border {searchResult.found ? 'border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/60 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40'} p-5 transition-all">
        {#if searchResult.found}
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span class="block text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Neo ID</span>
              <span class="font-mono font-bold text-slate-900 dark:text-white">{searchResult.neoid}</span>
            </div>
            <div>
              <span class="block text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Campus</span>
              <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold
                {searchResult.campus === 'Chennai' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' :
                 searchResult.campus === 'Vellore' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}">
                {searchResult.campus || 'Unknown'}
              </span>
            </div>
            <div>
              <span class="block text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Reg No</span>
              {#if searchResult.regno}
                <span class="font-mono font-bold text-emerald-700 dark:text-emerald-400">{searchResult.regno}</span>
              {:else}
                <span class="text-sm text-slate-400 italic">Unmapped</span>
              {/if}
            </div>
            <div>
              <span class="block text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">TopCoder</span>
              <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold
                {searchResult.topcoder ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}">
                {searchResult.topcoder ? '✓ Yes' : '✗ No'}
              </span>
            </div>
          </div>
          {#if searchResult.studentName}
            <div class="mt-3 pt-3 border-t border-indigo-100 dark:border-indigo-800/40">
              <span class="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Student</span>
              <span class="ml-2 text-sm font-semibold text-slate-800 dark:text-white">{searchResult.studentName}</span>
            </div>
          {/if}
        {:else}
          <div class="flex items-center gap-3 text-slate-500 dark:text-slate-400">
            <span class="text-2xl">🤷</span>
            <span class="text-sm">No record found for <span class="font-mono font-bold text-slate-700 dark:text-slate-200">{searchResult.neoid}</span></span>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- ─── Section 2: Batch Operations ──────────────────────────────────── -->
  <div class="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm backdrop-blur-sm overflow-hidden">

    <!-- Tab bar -->
    <div class="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40">
      {#each [
        { id: 'map',    label: 'Map Reg Numbers', icon: '🗺️' },
        { id: 'campus', label: 'Set Campus',       icon: '🏫' },
        { id: 'lookup', label: 'Lookup Names',     icon: '📋' },
        { id: 'lookup-neoid', label: 'Lookup Neo IDs', icon: '🔍' }
      ] as tab}
        <button
          id="neoid-tab-{tab.id}"
          on:click={() => setActiveTab(tab.id)}
          class="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold transition-all
            {activeTab === tab.id
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 bg-white dark:bg-slate-800'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'}"
        >
          <span class="hidden sm:inline">{tab.icon}</span>
          {tab.label}
        </button>
      {/each}
    </div>

    <div class="p-6">

      <!-- ── Tab 1: Map Registration Numbers ── -->
      {#if activeTab === 'map'}
        <div class="space-y-4">
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Paste <span class="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs">NeoID → RegNo</span> mappings — one per line, separated by a tab, comma, or space.
          </p>

          <textarea
            id="neoid-map-textarea"
            bind:value={mapInput}
            rows="8"
            placeholder="X3O3M8I3&#9;23BDS1093&#10;E0X7R3D1&#9;23BCE1529&#10;X1Q9F0L0&#9;23BCB7092"
            class="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white placeholder:text-slate-400 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y transition"
          ></textarea>

          {#if mapParsed.length > 0}
            <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div class="bg-slate-50 dark:bg-slate-900/40 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex justify-between">
                <span>Preview — {mapParsed.length} mapping{mapParsed.length !== 1 ? 's' : ''}</span>
              </div>
              <div class="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
                {#each mapParsed as m, i}
                  <div class="flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <span class="text-xs text-slate-400 w-6 shrink-0">{i + 1}</span>
                    <span class="font-mono font-semibold text-indigo-600 dark:text-indigo-400 w-28 shrink-0">{m.neoid}</span>
                    <span class="text-slate-400">→</span>
                    <span class="font-mono text-emerald-700 dark:text-emerald-400">{m.regno}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          {#if mapToast}
            <div class="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold
              {mapToast.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700/50'}">
              {mapToast.type === 'success' ? '✅' : '❌'} {mapToast.msg}
            </div>
          {/if}

          <div class="flex justify-end">
            <button
              id="neoid-map-submit-btn"
              on:click={submitMap}
              disabled={mapLoading || mapParsed.length === 0}
              class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-sm shadow-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {mapLoading ? 'Submitting…' : `Submit ${mapParsed.length > 0 ? mapParsed.length + ' Mapping' + (mapParsed.length !== 1 ? 's' : '') : ''}`}
            </button>
          </div>
        </div>

      <!-- ── Tab 2: Set Campus ── -->
      {:else if activeTab === 'campus'}
        <div class="space-y-4">
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Paste Neo IDs (one per line) and select their campus to bulk-update.
          </p>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {#each ['Chennai', 'Vellore', 'Unknown'] as c}
              <button
                id="neoid-campus-{c.toLowerCase()}-btn"
                on:click={() => setCampus(c)}
                class="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all
                  {campusSelected === c
                    ? c === 'Chennai' ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-600'
                    : c === 'Vellore' ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-600'
                    : 'border-slate-500 bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-500'
                    : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500'}"
              >
                {c === 'Chennai' ? '🌴' : c === 'Vellore' ? '🏛️' : '❓'} {c}
              </button>
            {/each}
          </div>

          <textarea
            id="neoid-campus-textarea"
            bind:value={campusInput}
            rows="8"
            placeholder="D1D9H1A1&#10;X3O3M8I3&#10;E0X7R3D1"
            class="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white placeholder:text-slate-400 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y transition"
          ></textarea>

          {#if campusParsed.length > 0}
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Ready to set <strong class="text-slate-700 dark:text-slate-200">{campusParsed.length}</strong> Neo ID{campusParsed.length !== 1 ? 's' : ''} → campus <strong class="text-slate-700 dark:text-slate-200">{campusSelected}</strong>
            </p>
          {/if}

          {#if campusToast}
            <div class="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold
              {campusToast.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700/50'}">
              {campusToast.type === 'success' ? '✅' : '❌'} {campusToast.msg}
            </div>
          {/if}

          <div class="flex justify-end">
            <button
              id="neoid-campus-submit-btn"
              on:click={submitCampus}
              disabled={campusLoading || campusParsed.length === 0}
              class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-sm shadow-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {campusLoading ? 'Updating…' : `Set Campus for ${campusParsed.length > 0 ? campusParsed.length + ' ID' + (campusParsed.length !== 1 ? 's' : '') : '…'}`}
            </button>
          </div>
        </div>

      <!-- ── Tab 3: Lookup Names ── -->
      {:else if activeTab === 'lookup'}
        <div class="space-y-4">
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Paste student names (one per line) to find their registration numbers from <span class="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs">temp_students</span>.
          </p>

          <textarea
            id="neoid-lookup-textarea"
            bind:value={lookupInput}
            rows="8"
            placeholder="Abhiram Sharma&#10;Saksham Anand&#10;Harshini Devendran"
            class="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y transition"
          ></textarea>

          <div class="flex justify-between items-center">
            <button
              id="neoid-lookup-submit-btn"
              on:click={doLookup}
              disabled={lookupLoading || !lookupInput.trim()}
              class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-sm shadow-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {lookupLoading ? 'Looking up…' : 'Lookup Names'}
            </button>

            {#if lookupDone && lookupResults.length > 0}
              <button
                id="neoid-lookup-copy-btn"
                on:click={copyLookupResults}
                class="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-semibold transition-all active:scale-95"
              >
                {#if copyToastVisible}
                  ✅ Copied!
                {:else}
                  📋 Copy Reg Numbers
                {/if}
              </button>
            {/if}
          </div>

          {#if lookupDone && lookupResults.length > 0}
            <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div class="bg-slate-50 dark:bg-slate-900/40 px-4 py-2.5 flex justify-between items-center">
                <span class="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Results — {lookupResults.length} quer{lookupResults.length !== 1 ? 'ies' : 'y'}</span>
                <span class="text-xs text-slate-400">
                  {lookupResults.filter(r => r.found).length} found · {lookupResults.filter(r => !r.found).length} not found
                </span>
              </div>
              <div class="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
                {#each lookupResults as row}
                  {#if row.found}
                    {#each row.matches as match}
                      <div class="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <span class="w-5 h-5 rounded-full {match.score >= 0.99 ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'} flex items-center justify-center text-xs shrink-0">✓</span>
                        <div class="flex-1 min-w-0">
                          <span class="text-slate-700 dark:text-slate-200">{row.searchedName}</span>
                          {#if match.score < 0.99}
                            <span class="ml-1 text-xs text-slate-400 dark:text-slate-500">→ <span class="italic">{match.name}</span></span>
                          {/if}
                        </div>
                        {#if match.score < 0.99}
                          <span class="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 shrink-0">{Math.round(match.score * 100)}%</span>
                        {/if}
                        <span class="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-lg shrink-0">{match.regno}</span>
                        {#if match.neo_id}
                          <span class="font-mono text-xs text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg hidden sm:block shrink-0">{match.neo_id}</span>
                        {/if}
                      </div>
                    {/each}
                  {:else}
                    <div class="flex items-center gap-3 px-4 py-2.5 text-sm opacity-60 hover:opacity-80 hover:bg-slate-50 dark:hover:bg-slate-700/20">
                      <span class="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs text-slate-400 shrink-0">✗</span>
                      <span class="flex-1 text-slate-500 dark:text-slate-400 line-through">{row.searchedName}</span>
                      <span class="text-xs font-semibold text-slate-400 italic">Not Found</span>
                    </div>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {:else if activeTab === 'lookup-neoid'}
        <div class="space-y-4">
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Paste Neo IDs (one per line) to bulk lookup their registration numbers, names, and campus details.
          </p>

          <textarea
            id="batch-neoid-lookup-textarea"
            bind:value={batchLookupInput}
            rows="8"
            placeholder="D1D9H1A1&#10;X3O3M8I3"
            class="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white placeholder:text-slate-400 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y transition"
          ></textarea>

          <div class="flex justify-between items-center">
            <button
              id="batch-neoid-lookup-submit-btn"
              on:click={doBatchLookup}
              disabled={batchLookupLoading || !batchLookupInput.trim()}
              class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-sm shadow-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {batchLookupLoading ? 'Looking up…' : 'Lookup Neo IDs'}
            </button>
          </div>

          {#if batchLookupDone && batchLookupResults.length > 0}
            <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div class="bg-slate-50 dark:bg-slate-900/40 px-4 py-2.5 flex justify-between items-center">
                <span class="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Results — {batchLookupResults.length} quer{batchLookupResults.length !== 1 ? 'ies' : 'y'}</span>
                <span class="text-xs text-slate-400">
                  {batchLookupResults.filter(r => r.found).length} found · {batchLookupResults.filter(r => !r.found).length} not found
                </span>
              </div>
              <div class="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
                {#each batchLookupResults as row}
                  {#if row.found}
                    <div class="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <span class="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs shrink-0">✓</span>
                      <span class="font-mono font-semibold text-indigo-600 dark:text-indigo-400 w-24 shrink-0">{row.neoid}</span>
                      {#if row.regno}
                        <span class="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-lg shrink-0">{row.regno}</span>
                      {:else}
                        <span class="text-xs font-semibold text-slate-400 italic w-[84px] shrink-0">Unmapped</span>
                      {/if}
                      <span class="flex-1 text-slate-700 dark:text-slate-200 min-w-0 truncate">{row.studentName || 'Unknown Name'}</span>
                      <span class="text-xs font-semibold px-2 py-1 rounded-lg {row.campus === 'Chennai' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : row.campus === 'Vellore' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'} hidden sm:block shrink-0">{row.campus || 'Unknown'}</span>
                    </div>
                  {:else}
                    <div class="flex items-center gap-3 px-4 py-2.5 text-sm opacity-60 hover:opacity-80 hover:bg-slate-50 dark:hover:bg-slate-700/20">
                      <span class="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs text-slate-400 shrink-0">✗</span>
                      <span class="font-mono font-semibold text-slate-500 dark:text-slate-400 w-24 shrink-0">{row.neoid}</span>
                      <span class="text-xs font-semibold text-slate-400 italic">Not Found</span>
                    </div>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}

    </div>
  </div>

</div>

<!-- Password Modals -->
<PasswordModal
  bind:show={mapShowModal}
  title="Authorize Mapping"
  message="You are about to map Neo IDs to registration numbers. Enter the admin password to proceed."
  on:submit={(e) => doMapSubmit(e.detail)}
  on:cancel={() => (mapShowModal = false)}
/>

<PasswordModal
  bind:show={campusShowModal}
  title="Authorize Campus Update"
  message="You are about to batch-update campus for Neo IDs. Enter the admin password to proceed."
  on:submit={(e) => doCampusSubmit(e.detail)}
  on:cancel={() => (campusShowModal = false)}
/>
