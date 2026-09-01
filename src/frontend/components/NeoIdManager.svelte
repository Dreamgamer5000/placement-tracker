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
    matches: { name: string; regno: string; neo_id: string | null; score: number }[];
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

<div class="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">

  <!-- Header -->
  <div class="neon-card p-5 sm:p-6 space-y-1">
    <h1 class="text-2xl font-display font-bold text-white tracking-tight">
      Neo ID Directory & Batch Mapper
    </h1>
    <p class="text-xs sm:text-sm text-zinc-400 font-normal">
      Search anonymous Neo IDs, map student registration numbers, and batch lookup candidates.
    </p>
  </div>

  <!-- Single Neo ID Lookup Widget -->
  <div class="neon-card p-5 sm:p-7 space-y-4">
    <h2 class="text-xs font-mono font-semibold uppercase text-zinc-400">
      Search Neo ID
    </h2>

    <div class="flex flex-col sm:flex-row gap-2.5">
      <input
        id="neoid-search-input"
        bind:value={searchQuery}
        on:keydown={handleSearchKey}
        type="text"
        placeholder="Enter Neo ID (e.g. O3W3I4P1, D1D9H1A1)…"
        class="flex-1 px-4 py-2.5 rounded-xl font-mono text-sm uppercase text-white"
      />
      <button
        id="neoid-search-btn"
        on:click={doSearch}
        disabled={searchLoading || !searchQuery.trim()}
        class="neon-btn-primary px-6 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider touch-press disabled:opacity-40 min-h-[40px]"
      >
        {searchLoading ? 'Searching…' : 'Inspect'}
      </button>
    </div>

    {#if searchResult !== null}
      <div class="rounded-xl border {searchResult.found ? 'border-[#00BCFF]/40 bg-[#080C14]' : 'border-slate-800 bg-[#080C14]'} p-4 transition-all">
        {#if searchResult.found}
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div>
              <span class="block text-[10px] text-slate-400 uppercase">Neo ID</span>
              <span class="font-bold text-[#00BCFF] text-sm">{searchResult.neoid}</span>
            </div>
            <div>
              <span class="block text-[10px] text-slate-400 uppercase">Campus</span>
              <span class="px-2 py-0.5 rounded text-[11px] font-bold
                {searchResult.campus === 'Chennai' ? 'neon-badge-cyan' :
                 searchResult.campus === 'Vellore' ? 'neon-badge-purple' :
                 'bg-slate-800 text-slate-400'}">
                {searchResult.campus || 'Unknown'}
              </span>
            </div>
            <div>
              <span class="block text-[10px] text-slate-400 uppercase">Reg No</span>
              {#if searchResult.regno}
                <span class="font-bold text-[#BBF351]">{searchResult.regno}</span>
              {:else}
                <span class="text-slate-500 italic">Unmapped</span>
              {/if}
            </div>
            <div>
              <span class="block text-[10px] text-slate-400 uppercase">TopCoder</span>
              <span class="font-bold {searchResult.topcoder ? 'text-amber-400' : 'text-slate-500'}">
                {searchResult.topcoder ? '⚡ Yes' : 'No'}
              </span>
            </div>
          </div>
          {#if searchResult.studentName}
            <div class="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <span class="text-slate-400 font-mono">Resolved Candidate:</span>
              <span class="font-bold text-white font-sans">{searchResult.studentName}</span>
            </div>
          {/if}
        {:else}
          <div class="flex items-center gap-2 text-slate-400 text-xs font-mono">
            <span>🤷</span>
            <span>No record found for Neo ID: <strong class="text-white">{searchResult.neoid}</strong></span>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Batch Operations Console -->
  <div class="neon-card overflow-hidden">
    
    <!-- Tab Controls -->
    <div class="flex border-b border-slate-800 bg-[#080C14]/90">
      {#each [
        { id: 'map',    label: 'Map Reg Numbers', icon: '🗺️' },
        { id: 'campus', label: 'Set Campus',       icon: '🏫' },
        { id: 'lookup', label: 'Lookup Names',     icon: '📋' },
        { id: 'lookup-neoid', label: 'Lookup Neo IDs', icon: '🔍' }
      ] as tab}
        <button
          id="neoid-tab-{tab.id}"
          on:click={() => setActiveTab(tab.id)}
          class="flex-1 flex items-center justify-center gap-2 px-3 py-3 text-xs font-mono font-bold transition-all border-b-2 touch-press
            {activeTab === tab.id
              ? 'text-[#BBF351] border-[#BBF351] bg-[#0F172A]'
              : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-800/40'}"
        >
          <span>{tab.icon}</span>
          <span class="hidden sm:inline">{tab.label}</span>
        </button>
      {/each}
    </div>

    <div class="p-5 sm:p-7 space-y-4">

      <!-- Tab 1: Map Registration Numbers -->
      {#if activeTab === 'map'}
        <div class="space-y-4">
          <p class="text-xs text-slate-400">
            Paste <span class="font-mono text-[#00BCFF]">NeoID → RegNo</span> pairs (one per line, separated by tab or comma):
          </p>

          <textarea
            id="neoid-map-textarea"
            bind:value={mapInput}
            rows="8"
            placeholder="X3O3M8I3&#9;23BDS1093&#10;E0X7R3D1&#9;23BCE1529"
            class="w-full px-4 py-3 rounded-xl font-mono text-xs text-white"
          ></textarea>

          {#if mapToast}
            <div class="p-3 rounded-xl text-xs font-mono font-semibold border {mapToast.type === 'success' ? 'bg-[#BBF351]/10 text-[#BBF351] border-[#BBF351]/30' : 'bg-rose-950/40 text-rose-300 border-rose-800'}">
              {mapToast.msg}
            </div>
          {/if}

          <div class="flex justify-end">
            <button
              id="neoid-map-submit-btn"
              on:click={submitMap}
              disabled={mapLoading || mapParsed.length === 0}
              class="neon-btn-primary px-6 py-2.5 rounded-xl text-xs font-bold uppercase touch-press disabled:opacity-40"
            >
              {mapLoading ? 'Saving...' : `Map ${mapParsed.length} Identifier${mapParsed.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>

      <!-- Tab 2: Set Campus -->
      {:else if activeTab === 'campus'}
        <div class="space-y-4">
          <div class="grid grid-cols-3 gap-3">
            {#each ['Chennai', 'Vellore', 'Unknown'] as c}
              <button
                id="neoid-campus-{c.toLowerCase()}-btn"
                on:click={() => setCampus(c)}
                class="py-2.5 px-3 rounded-xl font-mono font-bold text-xs border transition-all touch-press
                  {campusSelected === c
                    ? 'neon-badge-lime border-[#BBF351]'
                    : 'bg-[#080C14] text-slate-400 border-slate-800'}"
              >
                {c}
              </button>
            {/each}
          </div>

          <textarea
            id="neoid-campus-textarea"
            bind:value={campusInput}
            rows="8"
            placeholder="Paste Neo IDs to tag with this campus (one per line)..."
            class="w-full px-4 py-3 rounded-xl font-mono text-xs text-white"
          ></textarea>

          {#if campusToast}
            <div class="p-3 rounded-xl text-xs font-mono font-semibold border {campusToast.type === 'success' ? 'bg-[#BBF351]/10 text-[#BBF351] border-[#BBF351]/30' : 'bg-rose-950/40 text-rose-300 border-rose-800'}">
              {campusToast.msg}
            </div>
          {/if}

          <div class="flex justify-end">
            <button
              id="neoid-campus-submit-btn"
              on:click={submitCampus}
              disabled={campusLoading || campusParsed.length === 0}
              class="neon-btn-primary px-6 py-2.5 rounded-xl text-xs font-bold uppercase touch-press disabled:opacity-40"
            >
              {campusLoading ? 'Updating...' : `Set Campus for ${campusParsed.length} ID${campusParsed.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>

      <!-- Tab 3: Lookup Names -->
      {:else if activeTab === 'lookup'}
        <div class="space-y-4">
          <textarea
            id="neoid-lookup-textarea"
            bind:value={lookupInput}
            rows="8"
            placeholder="Paste student names to resolve Reg Numbers (one per line)..."
            class="w-full px-4 py-3 rounded-xl text-xs text-white font-sans"
          ></textarea>

          <div class="flex justify-between items-center">
            <button
              id="neoid-lookup-submit-btn"
              on:click={doLookup}
              disabled={lookupLoading || !lookupInput.trim()}
              class="neon-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold uppercase touch-press disabled:opacity-40"
            >
              {lookupLoading ? 'Resolving…' : 'Lookup Candidates'}
            </button>

            {#if lookupDone && lookupResults.length > 0}
              <button
                id="neoid-lookup-copy-btn"
                on:click={copyLookupResults}
                class="neon-btn-ghost px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 touch-press"
              >
                {copyToastVisible ? '✅ Copied!' : '📋 Copy Reg Numbers'}
              </button>
            {/if}
          </div>
        </div>

      <!-- Tab 4: Batch Lookup Neo IDs -->
      {:else if activeTab === 'lookup-neoid'}
        <div class="space-y-4">
          <textarea
            bind:value={batchLookupInput}
            rows="8"
            placeholder="Paste Neo IDs to resolve (one per line)..."
            class="w-full px-4 py-3 rounded-xl font-mono text-xs text-white"
          ></textarea>

          <div class="flex justify-end">
            <button
              on:click={doBatchLookup}
              disabled={batchLookupLoading || !batchLookupInput.trim()}
              class="neon-btn-primary px-6 py-2.5 rounded-xl text-xs font-bold uppercase touch-press disabled:opacity-40"
            >
              {batchLookupLoading ? 'Querying…' : 'Run Batch Lookup'}
            </button>
          </div>

          {#if batchLookupDone && batchLookupResults.length > 0}
            <div class="table-responsive rounded-xl border border-slate-800 bg-[#080C14] max-h-60 overflow-y-auto">
              <table class="w-full text-left text-xs font-mono">
                <thead class="bg-[#0F172A] text-slate-400 text-[10px] uppercase">
                  <tr>
                    <th class="p-2.5 px-3">Neo ID</th>
                    <th class="p-2.5 px-3">Campus</th>
                    <th class="p-2.5 px-3">Reg No</th>
                    <th class="p-2.5 px-3">Name</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/60">
                  {#each batchLookupResults as res}
                    <tr class="hover:bg-slate-800/30">
                      <td class="p-2 px-3 font-bold text-[#00BCFF]">{res.neoid}</td>
                      <td class="p-2 px-3">{res.campus || 'Unknown'}</td>
                      <td class="p-2 px-3 text-[#BBF351] font-bold">{res.regno || '—'}</td>
                      <td class="p-2 px-3 font-sans font-semibold text-slate-200">{res.studentName || '—'}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      {/if}

    </div>
  </div>

</div>

<!-- Password Authorizations -->
<PasswordModal
  isOpen={mapShowModal}
  title="Authorize RegNo Mapping"
  message="Admin authorization required to bulk-map candidate registration numbers."
  on:submit={(e) => doMapSubmit(e.detail)}
  on:cancel={() => (mapShowModal = false)}
/>

<PasswordModal
  isOpen={campusShowModal}
  title="Authorize Campus Assignment"
  message="Admin authorization required to update campus tags for these Neo IDs."
  on:submit={(e) => doCampusSubmit(e.detail)}
  on:cancel={() => (campusShowModal = false)}
/>
