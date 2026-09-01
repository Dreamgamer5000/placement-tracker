<script lang="ts">
  import { onMount } from 'svelte';
  import PasswordModal from './PasswordModal.svelte';

  let showPasswordModal = false;
  let pendingAction: any = null;
  let passwordModalTitle = '';
  let passwordModalMessage = '';

  function handlePasswordSubmit(event: CustomEvent<string>) {
    const pwd = event.detail;
    showPasswordModal = false;
    if (pendingAction) {
      pendingAction(pwd);
      pendingAction = null;
    }
  }

  function handlePasswordCancel() {
    showPasswordModal = false;
    pendingAction = null;
  }

  let students: any[] = [];
  let loading = true;
  let searchTerm = '';
  let debouncedSearch = '';
  let searchTimer: any = null;
  let page = 1;
  let limit = 50;
  let totalCount = 0;
  let totalPages = 1;

  // Global Counts from Backend
  let unmappedChennaiCount = 0;
  let mastersCount = 0;
  let placedCount = 0;
  let internCount = 0;
  let notPlacedCount = 0;
  let topcoderCount = 0;

  // Multi-Sort State Array (in order of priority)
  let activeSorts: string[] = [];

  // Active Category Filters
  let statusFilter: 'all' | 'placed' | 'intern' | 'masters' | 'not_placed' = 'all';
  let topcoderFilter: 'all' | 'true' | 'false' = 'all';
  let campusFilter: 'all' | 'unmapped_chennai' | 'chennai' | 'vellore' = 'all';

  let selectedStudent: any = null;
  let editingStudent: any = null;
  let saveLoading = false;
  let saveMessage = '';
  let recalculating = false;
  let syncMessage = '';
  let availableRoles: any[] = [];

  onMount(async () => {
    await Promise.all([loadStudents(), loadRoles()]);
  });

  async function loadRoles() {
    try {
      const response = await fetch('/api/roles');
      if (response.ok) {
        availableRoles = await response.json();
      }
    } catch (error) {
      console.error('Error loading roles in StudentList:', error);
    }
  }

  async function recalculateStudentAnalytics() {
    if (recalculating) return;
    recalculating = true;
    syncMessage = '';
    try {
      const response = await fetch('/api/students/recalculate-analytics', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        syncMessage = `✅ Synced ${data.updatedNeoIds || 0} NeoIDs, ${data.updatedFinalPlacements || 0} final placements, ${data.updatedInterns || 0} interns, reset ${data.resetStaleCandidates || 0} stale records.`;
        await loadStudents();
      } else {
        syncMessage = `❌ Error: ${data.error || 'Failed to sync'}`;
      }
    } catch (err: any) {
      syncMessage = `❌ Error: ${err.message}`;
    } finally {
      recalculating = false;
      setTimeout(() => { syncMessage = ''; }, 6000);
    }
  }

  function handleSearchInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    searchTerm = val;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      debouncedSearch = val;
      page = 1;
      loadStudents();
    }, 300);
  }

  // Filter Select Handlers
  function setStatusFilter(filter: 'all' | 'placed' | 'intern' | 'masters' | 'not_placed') {
    if (statusFilter === filter && filter !== 'all') {
      statusFilter = 'all';
    } else {
      statusFilter = filter;
    }
    page = 1;
    loadStudents();
  }

  function setTopcoderFilter(filter: 'all' | 'true' | 'false') {
    if (topcoderFilter === filter && filter !== 'all') {
      topcoderFilter = 'all';
    } else {
      topcoderFilter = filter;
    }
    page = 1;
    loadStudents();
  }

  function setCampusFilter(filter: 'all' | 'unmapped_chennai' | 'chennai' | 'vellore') {
    if (campusFilter === filter && filter !== 'all') {
      campusFilter = 'all';
    } else {
      campusFilter = filter;
    }
    page = 1;
    loadStudents();
  }

  function resetAllFiltersAndSorts() {
    activeSorts = [];
    statusFilter = 'all';
    topcoderFilter = 'all';
    campusFilter = 'all';
    searchTerm = '';
    debouncedSearch = '';
    page = 1;
    loadStudents();
  }

  // Multi-Sort Column Header Cycling
  function toggleSortColumn(type: 'shortlists' | 'cgpa' | 'status' | 'topcoder' | 'name' | 'regno') {
    if (type === 'shortlists') {
      if (activeSorts.includes('shortlists_desc')) {
        activeSorts = activeSorts.map(s => s === 'shortlists_desc' ? 'shortlists_asc' : s);
      } else if (activeSorts.includes('shortlists_asc')) {
        activeSorts = activeSorts.filter(s => s !== 'shortlists_asc');
      } else {
        activeSorts = [type === 'shortlists' ? 'shortlists_desc' : '', ...activeSorts].filter(Boolean);
      }
    } else if (type === 'cgpa') {
      if (activeSorts.includes('cgpa_desc')) {
        activeSorts = activeSorts.map(s => s === 'cgpa_desc' ? 'cgpa_asc' : s);
      } else if (activeSorts.includes('cgpa_asc')) {
        activeSorts = activeSorts.filter(s => s !== 'cgpa_asc');
      } else {
        activeSorts = ['cgpa_desc', ...activeSorts];
      }
    } else if (type === 'topcoder') {
      if (activeSorts.includes('topcoder_desc')) {
        activeSorts = activeSorts.map(s => s === 'topcoder_desc' ? 'topcoder_asc' : s);
      } else if (activeSorts.includes('topcoder_asc')) {
        activeSorts = activeSorts.filter(s => s !== 'topcoder_asc');
      } else {
        activeSorts = ['topcoder_desc', ...activeSorts];
      }
    } else if (type === 'status') {
      if (activeSorts.includes('status_placed')) {
        activeSorts = activeSorts.map(s => s === 'status_placed' ? 'status_unplaced' : s);
      } else if (activeSorts.includes('status_unplaced')) {
        activeSorts = activeSorts.map(s => s === 'status_unplaced' ? 'status_masters' : s);
      } else if (activeSorts.includes('status_masters')) {
        activeSorts = activeSorts.filter(s => s !== 'status_masters');
      } else {
        activeSorts = ['status_placed', ...activeSorts];
      }
    } else if (type === 'name') {
      if (activeSorts.includes('name_asc')) {
        activeSorts = activeSorts.map(s => s === 'name_asc' ? 'name_desc' : s);
      } else if (activeSorts.includes('name_desc')) {
        activeSorts = activeSorts.filter(s => s !== 'name_desc');
      } else {
        activeSorts = ['name_asc', ...activeSorts];
      }
    } else if (type === 'regno') {
      if (activeSorts.includes('regno_asc')) {
        activeSorts = activeSorts.map(s => s === 'regno_asc' ? 'regno_desc' : s);
      } else if (activeSorts.includes('regno_desc')) {
        activeSorts = activeSorts.filter(s => s !== 'regno_desc');
      } else {
        activeSorts = ['regno_asc', ...activeSorts];
      }
    }

    page = 1;
    loadStudents();
  }

  function removeSortToken(token: string) {
    activeSorts = activeSorts.filter(s => s !== token);
    page = 1;
    loadStudents();
  }

  function getSortLabel(token: string): string {
    switch (token) {
      case 'shortlists_desc': return '📊 Shortlists: High ➔ Low (⬇)';
      case 'shortlists_asc': return '📊 Shortlists: Low ➔ High (⬆)';
      case 'cgpa_desc': return '🎯 CGPA: High ➔ Low (⬇)';
      case 'cgpa_asc': return '🎯 CGPA: Low ➔ High (⬆)';
      case 'topcoder_desc': return '⚡ TopCoder First (⬇)';
      case 'topcoder_asc': return '⚡ Non-TopCoder First (⬆)';
      case 'status_placed': return '✅ Placed First (⬇)';
      case 'status_unplaced': return '⭕ Not Placed First (⬆)';
      case 'status_masters': return '🎓 Masters First (⬇)';
      case 'name_asc': return '👤 Name: A ➔ Z (⬇)';
      case 'name_desc': return '👤 Name: Z ➔ A (⬆)';
      case 'regno_asc': return '🔢 RegNo: Ascending (⬇)';
      case 'regno_desc': return '🔢 RegNo: Descending (⬆)';
      default: return token;
    }
  }

  async function loadStudents() {
    loading = true;
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search: debouncedSearch
      });

      if (activeSorts.length > 0) {
        params.set('sort', activeSorts.join(','));
      }
      if (statusFilter && statusFilter !== 'all') {
        params.set('statusFilter', statusFilter);
      }
      if (topcoderFilter && topcoderFilter !== 'all') {
        params.set('topcoderFilter', topcoderFilter);
      }
      if (campusFilter && campusFilter !== 'all') {
        params.set('campusFilter', campusFilter);
      }

      const response = await fetch(`/api/students?${params.toString()}`);
      const data = await response.json();

      if (data && Array.isArray(data.students)) {
        students = data.students;
        totalCount = data.totalCount || data.students.length;
        unmappedChennaiCount = data.unmappedChennaiCount || 0;
        mastersCount = data.mastersCount || 0;
        placedCount = data.placedCount || 0;
        internCount = data.internCount || 0;
        notPlacedCount = data.notPlacedCount || 0;
        topcoderCount = data.topcoderCount || 0;
        totalPages = data.totalPages || 1;
      } else if (Array.isArray(data)) {
        students = data;
        totalCount = data.length;
        totalPages = 1;
      } else {
        students = [];
      }
    } catch (error) {
      console.error('Error loading students:', error);
      students = [];
    } finally {
      loading = false;
    }
  }

  async function changePage(newPage: number) {
    if (newPage < 1 || newPage > totalPages) return;
    page = newPage;
    await loadStudents();
  }

  async function viewStudent(regno: string) {
    const s = students.find(item => item.regno === regno);
    selectedStudent = s ? { ...s, loadingDetails: true } : null;
    try {
      const response = await fetch(`/api/students/${regno}`);
      if (response.ok) {
        selectedStudent = await response.json();
      }
    } catch (error) {
      console.error('Error fetching full student details:', error);
    }
  }

  function openEdit(student: any) {
    editingStudent = { ...student };
    saveMessage = '';
  }

  function initiateSaveStudent() {
    if (!editingStudent) return;
    passwordModalTitle = 'Save Changes';
    passwordModalMessage = `Enter admin password to save changes for ${editingStudent.name}.`;
    pendingAction = (pwd: string) => executeSaveStudent(pwd);
    showPasswordModal = true;
  }

  async function executeSaveStudent(pwd = '') {
    if (!editingStudent) return;
    saveLoading = true;
    saveMessage = '';
    try {
      const response = await fetch(`/api/students/${editingStudent.regno}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Password': pwd 
        },
        body: JSON.stringify(editingStudent)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save student details');
      }

      const updated = await response.json();
      saveMessage = '✅ Student details updated successfully!';
      
      students = students.map(s => s.regno === updated.regno ? { ...s, ...updated } : s);
      if (selectedStudent && selectedStudent.regno === updated.regno) {
        selectedStudent = { ...selectedStudent, ...updated };
      }
      setTimeout(() => {
        saveMessage = '';
      }, 4000);
    } catch (error: any) {
      saveMessage = `❌ Error: ${error.message}`;
    } finally {
      saveLoading = false;
    }
  }
</script>

<div class="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
  
  <!-- Header & Multi-Filter Control Console -->
  <div class="neon-card p-5 sm:p-7 space-y-5">
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
          Candidate Directory
        </h1>
        <p class="text-xs sm:text-sm text-zinc-400 font-normal mt-1">
          Search candidate records, multi-sort fields together, and filter by placement status. (All students in this list are from Chennai only)
        </p>
      </div>

      <!-- Synchronize Data Button -->
      <div class="flex items-center gap-2">
        <button 
          type="button"
          class="neon-btn-ghost px-4 py-2 rounded-xl text-xs sm:text-sm font-medium font-mono flex items-center gap-1.5 touch-press disabled:opacity-50 min-h-[38px]"
          disabled={recalculating}
          on:click={recalculateStudentAnalytics}
        >
          <span class={recalculating ? 'animate-spin' : ''}>↻</span>
          <span>{recalculating ? 'Syncing…' : 'Sync data'}</span>
        </button>

        {#if activeSorts.length > 0 || statusFilter !== 'all' || topcoderFilter !== 'all' || campusFilter !== 'all' || searchTerm}
          <button 
            type="button"
            class="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium font-mono bg-rose-950/30 border border-rose-900/60 text-rose-300 hover:bg-rose-900/40 touch-press min-h-[38px] flex items-center gap-1"
            on:click={resetAllFiltersAndSorts}
          >
            ✕ Reset filters
          </button>
        {/if}
      </div>
    </div>

    <!-- Quick Action Filter Chips Carousel (1-Click Filtering) -->
    <div class="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
      
      <!-- All Filter -->
      <button 
        type="button"
        class="shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold font-mono transition-all border touch-press min-h-[38px]
          {statusFilter === 'all' && campusFilter === 'all' && topcoderFilter === 'all'
            ? 'bg-zinc-800 text-white border-zinc-600 shadow-sm font-bold'
            : 'bg-zinc-900/80 text-zinc-400 border-white/[0.08] hover:text-white'}"
        on:click={() => { statusFilter = 'all'; campusFilter = 'all'; topcoderFilter = 'all'; page = 1; loadStudents(); }}
      >
        All ({totalCount})
      </button>

      <!-- Placed Filter -->
      <button 
        type="button"
        class="shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold font-mono transition-all border touch-press min-h-[38px]
          {statusFilter === 'placed'
            ? 'bg-[#a3e635]/15 text-[#a3e635] border-[#a3e635]/50 shadow-sm font-bold'
            : 'bg-zinc-900/80 text-lime-400 border-white/[0.08] hover:border-[#a3e635]/40'}"
        on:click={() => setStatusFilter('placed')}
      >
        Placed ({placedCount})
      </button>

      <!-- Intern Filter -->
      <button 
        type="button"
        class="shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold font-mono transition-all border touch-press min-h-[38px]
          {statusFilter === 'intern'
            ? 'bg-amber-500/15 text-amber-300 border-amber-500/50 shadow-sm font-bold'
            : 'bg-zinc-900/80 text-amber-400/80 border-white/[0.08] hover:border-amber-500/40'}"
        on:click={() => setStatusFilter('intern')}
      >
        Interns ({internCount})
      </button>

      <!-- Masters Filter -->
      <button 
        type="button"
        class="shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold font-mono transition-all border touch-press min-h-[38px]
          {statusFilter === 'masters'
            ? 'bg-purple-500/15 text-purple-300 border-purple-500/50 shadow-sm font-bold'
            : 'bg-zinc-900/80 text-purple-400/80 border-white/[0.08] hover:border-purple-500/40'}"
        on:click={() => setStatusFilter('masters')}
      >
        Masters ({mastersCount})
      </button>

      <!-- Not Placed Filter -->
      <button 
        type="button"
        class="shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold font-mono transition-all border touch-press min-h-[38px]
          {statusFilter === 'not_placed'
            ? 'bg-zinc-800 text-zinc-200 border-zinc-500 shadow-sm font-bold'
            : 'bg-zinc-900/80 text-zinc-500 border-white/[0.08] hover:text-zinc-300'}"
        on:click={() => setStatusFilter('not_placed')}
      >
        Unplaced ({notPlacedCount})
      </button>

      <!-- TopCoder Filter -->
      <button 
        type="button"
        class="shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold font-mono transition-all border touch-press min-h-[38px]
          {topcoderFilter === 'true'
            ? 'bg-amber-500/20 text-amber-300 border-amber-400/60 shadow-sm font-bold'
            : 'bg-zinc-900/80 text-amber-400 border-white/[0.08] hover:border-amber-500/40'}"
        on:click={() => setTopcoderFilter('true')}
      >
        TopCoder ({topcoderCount})
      </button>

      <!-- Unmapped Chennai Filter -->
      <button 
        type="button"
        class="shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold font-mono transition-all border touch-press min-h-[38px]
          {campusFilter === 'unmapped_chennai'
            ? 'bg-rose-500/15 text-rose-300 border-rose-500/50 shadow-sm font-bold'
            : 'bg-zinc-900/80 text-rose-400/80 border-white/[0.08] hover:border-rose-500/40'}"
        on:click={() => setCampusFilter('unmapped_chennai')}
      >
        Unmapped Chennai ({unmappedChennaiCount})
      </button>

    </div>

    <!-- Search Input -->
    <div class="relative">
      <input 
        type="text" 
        class="w-full px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl bg-zinc-900/90 border border-white/10 text-white placeholder-zinc-500 font-sans text-sm sm:text-base focus:border-[#a3e635]/60 focus:shadow-sm min-h-[46px]"
        placeholder="Search by candidate name, registration number (e.g. 23BCE1087), Neo ID, or branch…" 
        value={searchTerm}
        on:input={handleSearchInput}
      />
    </div>

    <!-- Active Multi-Sort Priority Bar -->
    {#if activeSorts.length > 0}
      <div class="bg-zinc-900/70 p-3 px-4 rounded-xl border border-white/[0.08] flex flex-wrap items-center gap-2">
        <span class="text-[11px] font-mono font-medium text-zinc-400">
          Combined sorts:
        </span>
        {#each activeSorts as sortToken, idx}
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-white/[0.06] border border-white/10 text-zinc-200">
            <span class="text-[10px] text-zinc-400">#{idx + 1}</span>
            <span>{getSortLabel(sortToken)}</span>
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <span 
              class="cursor-pointer text-zinc-400 hover:text-white text-xs ml-1"
              on:click={() => removeSortToken(sortToken)}
              title="Remove sort"
            >
              ✕
            </span>
          </span>
        {/each}

        <button 
          class="text-[11px] font-mono text-zinc-400 hover:text-rose-300 ml-auto underline"
          on:click={() => { activeSorts = []; page = 1; loadStudents(); }}
        >
          Clear all
        </button>
      </div>
    {/if}
  </div>

  {#if syncMessage}
    <div class="p-3.5 rounded-xl text-xs sm:text-sm font-mono font-medium border {syncMessage.includes('❌') ? 'bg-rose-950/30 text-rose-300 border-rose-900/60' : 'bg-[#a3e635]/10 text-[#a3e635] border-[#a3e635]/25'}">
      {syncMessage}
    </div>
  {/if}

  {#if loading}
    <div class="neon-card p-16 text-center flex flex-col items-center justify-center gap-4">
      <div class="w-8 h-8 rounded-full border-2 border-white/20 border-t-[#a3e635] animate-spin"></div>
      <p class="text-sm font-mono text-zinc-400">Loading student directory records…</p>
    </div>
  {:else if students.length === 0}
    <div class="neon-card p-16 text-center">
      <div class="text-3xl mb-3 text-zinc-500">∅</div>
      <h3 class="text-base font-semibold text-white">No Candidates Found</h3>
      <p class="text-xs sm:text-sm text-zinc-400 font-mono mt-1">No candidate profile matches active filters and search query.</p>
    </div>
  {:else}
    
    <!-- Table Container with Multi-Sort Clickable Headers -->
    <div class="neon-card overflow-hidden">
      <div class="table-responsive">
        <table class="w-full text-left text-xs border-collapse min-w-[700px]">
          <thead>
            <tr class="border-b border-white/[0.08] bg-zinc-900/70 text-zinc-400 font-mono text-[11px] uppercase tracking-wider select-none">
              
              <!-- RegNo & Neo ID Header (Clickable Sort) -->
              <th 
                class="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                on:click={() => toggleSortColumn('regno')}
                title="Click to sort by RegNo"
              >
                Reg No / Neo ID
                {#if activeSorts.includes('regno_asc')}
                  <span class="text-[#a3e635] font-bold">↑ A-Z</span>
                {:else if activeSorts.includes('regno_desc')}
                  <span class="text-[#a3e635] font-bold">↓ Z-A</span>
                {:else}
                  <span class="text-zinc-600">↕</span>
                {/if}
              </th>

              <!-- Name & Branch Header (Clickable Sort) -->
              <th 
                class="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                on:click={() => toggleSortColumn('name')}
                title="Click to sort by Name"
              >
                Candidate Name
                {#if activeSorts.includes('name_asc')}
                  <span class="text-[#a3e635] font-bold">↑ A-Z</span>
                {:else if activeSorts.includes('name_desc')}
                  <span class="text-[#a3e635] font-bold">↓ Z-A</span>
                {:else}
                  <span class="text-zinc-600">↕</span>
                {/if}
              </th>

              <!-- TopCoder Header (Clickable Sort) -->
              <th 
                class="py-3 px-3 cursor-pointer hover:text-white transition-colors"
                on:click={() => toggleSortColumn('topcoder')}
                title="Click to sort TopCoder"
              >
                TopCoder
                {#if activeSorts.includes('topcoder_desc')}
                  <span class="text-amber-400 font-bold">↓ First</span>
                {:else if activeSorts.includes('topcoder_asc')}
                  <span class="text-zinc-400 font-bold">↑ Standard</span>
                {:else}
                  <span class="text-zinc-600">↕</span>
                {/if}
              </th>

              <!-- CGPA Header (Clickable Sort) -->
              <th 
                class="py-3 px-3 cursor-pointer hover:text-white transition-colors"
                on:click={() => toggleSortColumn('cgpa')}
                title="Click to sort CGPA"
              >
                CGPA
                {#if activeSorts.includes('cgpa_desc')}
                  <span class="text-[#a3e635] font-bold">↓ High</span>
                {:else if activeSorts.includes('cgpa_asc')}
                  <span class="text-[#a3e635] font-bold">↑ Low</span>
                {:else}
                  <span class="text-zinc-600">↕</span>
                {/if}
              </th>

              <!-- Shortlists Header (Clickable Sort) -->
              <th 
                class="py-3 px-3 cursor-pointer hover:text-white transition-colors"
                on:click={() => toggleSortColumn('shortlists')}
                title="Click to sort Shortlists"
              >
                Shortlists
                {#if activeSorts.includes('shortlists_desc')}
                  <span class="text-[#38bdf8] font-bold">↓ High</span>
                {:else if activeSorts.includes('shortlists_asc')}
                  <span class="text-[#38bdf8] font-bold">↑ Low</span>
                {:else}
                  <span class="text-zinc-600">↕</span>
                {/if}
              </th>

              <!-- Status Header (Clickable Sort) -->
              <th 
                class="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                on:click={() => toggleSortColumn('status')}
                title="Click to sort Status: Placed ➔ Unplaced ➔ Masters ➔ Off"
              >
                Status
                {#if activeSorts.includes('status_placed')}
                  <span class="text-[#a3e635] font-bold">Placed first</span>
                {:else if activeSorts.includes('status_unplaced')}
                  <span class="text-zinc-300 font-bold">Unplaced first</span>
                {:else if activeSorts.includes('status_masters')}
                  <span class="text-purple-300 font-bold">Masters first</span>
                {:else}
                  <span class="text-zinc-600">↕</span>
                {/if}
              </th>

              <th class="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/[0.06] font-mono">
            {#each students as student}
              <tr class="hover:bg-white/[0.03] transition-colors">
                
                <!-- Reg No & Neo ID -->
                <td class="py-3 px-4">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold text-zinc-200">{student.regno}</span>
                    {#if student.neo_id}
                      <span class="neon-badge-cyan px-2 py-0.5 rounded text-[10px] font-medium">
                        {student.neo_id}
                      </span>
                    {/if}
                  </div>
                </td>

                <!-- Name & Branch -->
                <td class="py-3 px-4 font-sans">
                  <div class="font-medium text-zinc-100 text-sm">{student.name}</div>
                  {#if student.branch}
                    <span class="text-[11px] font-mono text-zinc-400 uppercase">{student.branch} • {student.campus || 'Chennai'}</span>
                  {/if}
                </td>

                <!-- TopCoder Flag -->
                <td class="py-3 px-3">
                  {#if student.topcoder}
                    <span class="neon-badge-amber px-2 py-0.5 rounded text-[10px] font-medium">
                      TopCoder
                    </span>
                  {:else}
                    <span class="text-zinc-600 text-[11px]">—</span>
                  {/if}
                </td>

                <!-- CGPA with Clean Color Thresholds -->
                <td class="py-3 px-3 font-mono font-semibold tabular-nums">
                  {#if !student.cgpa}
                    <span class="text-zinc-600 text-xs">N/A</span>
                  {:else if parseFloat(student.cgpa) >= 9.0}
                    <span class="text-[#a3e635]">{student.cgpa}</span>
                  {:else if parseFloat(student.cgpa) >= 8.0}
                    <span class="text-[#38bdf8]">{student.cgpa}</span>
                  {:else}
                    <span class="text-zinc-300">{student.cgpa}</span>
                  {/if}
                </td>

                <!-- Shortlists Count -->
                <td class="py-3 px-3 font-mono font-medium tabular-nums">
                  {#if student.shortlist_count > 0}
                    <span class="neon-badge-cyan px-2 py-0.5 rounded-full text-xs font-semibold">
                      {student.shortlist_count}
                    </span>
                  {:else}
                    <span class="text-zinc-600 text-xs">0</span>
                  {/if}
                </td>

                <!-- Status Badge -->
                <td class="py-3 px-4">
                  {#if student.status === 'placed' || (student.placed == 1 && student.status !== 'intern')}
                    <div class="flex flex-col gap-0.5 items-start">
                      <span class="neon-badge-lime px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                        Placed
                      </span>
                      {#if student.role}
                        <span class="text-[10px] font-sans font-medium text-emerald-300/80 truncate max-w-[160px]">
                          {student.role}
                        </span>
                      {/if}
                    </div>
                  {:else if student.status === 'intern'}
                    <div class="flex flex-col gap-0.5 items-start">
                      <span class="neon-badge-amber px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                        Intern
                      </span>
                      {#if student.role}
                        <span class="text-[10px] font-sans font-medium text-amber-300/80 truncate max-w-[160px]">
                          {student.role}
                        </span>
                      {/if}
                    </div>
                  {:else if student.status === 'masters' || student.masters}
                    <span class="neon-badge-purple px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                      Masters
                    </span>
                  {:else}
                    <span class="bg-zinc-800/80 text-zinc-400 border border-white/[0.08] px-2.5 py-0.5 rounded-full text-[10px]">
                      Unplaced
                    </span>
                  {/if}
                </td>

                <!-- Actions Button -->
                <td class="py-3 px-4 text-right">
                  <button 
                    class="neon-btn-ghost px-3.5 py-1.5 rounded-xl text-xs font-medium touch-press min-h-[34px]"
                    on:click={() => viewStudent(student.regno)}
                  >
                    View
                  </button>
                </td>

              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Responsive Pagination Bar -->
      <div class="p-4 sm:p-5 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0F172A]/50">
        <span class="text-xs sm:text-sm font-mono text-slate-400 text-center sm:text-left">
          Showing <strong class="text-white">{(page - 1) * limit + 1}</strong> to <strong class="text-white">{Math.min(page * limit, totalCount)}</strong> of <strong class="text-[#BBF351]">{totalCount}</strong> candidates
        </span>

        <div class="flex items-center gap-2">
          <button 
            class="neon-btn-ghost px-4 py-2 rounded-xl text-xs font-bold font-mono disabled:opacity-30 touch-press min-h-[40px]"
            disabled={page === 1} 
            on:click={() => changePage(page - 1)}
          >
            ← Prev
          </button>
          
          <span class="px-4 py-2 text-xs font-mono font-bold text-slate-300 bg-slate-800 rounded-xl border border-slate-700">
            Page {page} / {totalPages}
          </span>
          
          <button 
            class="neon-btn-ghost px-4 py-2 rounded-xl text-xs font-bold font-mono disabled:opacity-30 touch-press min-h-[40px]"
            disabled={page >= totalPages} 
            on:click={() => changePage(page + 1)}
          >
            Next →
          </button>
        </div>
      </div>
    </div>

  {/if}
</div>

<!-- 👤 STUDENT DETAILS BOTTOM SHEET / MODAL -->
{#if selectedStudent}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" on:click|self={() => selectedStudent = null} role="dialog" aria-modal="true">
    <div class="w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl bg-[#0F172A] border border-slate-700/80 p-5 sm:p-7 max-h-[88vh] overflow-y-auto shadow-2xl relative">
      
      <!-- Mobile Bottom Sheet Grab Handle -->
      <div class="sheet-handle sm:hidden"></div>

      <!-- Close Button -->
      <button 
        class="absolute top-4 right-4 w-10 h-10 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 touch-press text-base"
        on:click={() => selectedStudent = null}
        aria-label="Close dialog"
      >
        ✕
      </button>

      <div class="flex items-start justify-between gap-4 mb-5 pr-10">
        <div>
          <h2 class="text-xl sm:text-2xl font-display font-extrabold text-white">{selectedStudent.name}</h2>
          <div class="flex items-center gap-2 mt-1 font-mono text-xs text-slate-400 flex-wrap">
            <span class="text-slate-200 font-bold">{selectedStudent.regno}</span>
            {#if selectedStudent.neo_id}
              <span>•</span>
              <span class="text-[#00BCFF] font-bold">{selectedStudent.neo_id}</span>
            {/if}
            {#if selectedStudent.campus}
              <span>•</span>
              <span class="text-purple-300 font-semibold">{selectedStudent.campus}</span>
            {/if}
          </div>
        </div>

        <button 
          class="neon-btn-primary px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 touch-press min-h-[38px]"
          on:click={() => openEdit(selectedStudent)}
        >
          ✏️ Edit
        </button>
      </div>

      <!-- Candidate Metric Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
        <div class="bg-[#080C14] p-3 rounded-xl border border-slate-800 text-center">
          <span class="text-[10px] font-mono text-slate-400 uppercase">CGPA</span>
          <div class="text-lg font-bold font-mono text-[#BBF351] mt-0.5">{selectedStudent.cgpa || 'N/A'}</div>
        </div>
        <div class="bg-[#080C14] p-3 rounded-xl border border-slate-800 text-center">
          <span class="text-[10px] font-mono text-slate-400 uppercase">10th Marks</span>
          <div class="text-lg font-bold font-mono text-slate-200 mt-0.5">{selectedStudent.tenth_marks ? `${selectedStudent.tenth_marks}%` : 'N/A'}</div>
        </div>
        <div class="bg-[#080C14] p-3 rounded-xl border border-slate-800 text-center">
          <span class="text-[10px] font-mono text-slate-400 uppercase">12th Marks</span>
          <div class="text-lg font-bold font-mono text-slate-200 mt-0.5">{selectedStudent.twelfth_marks ? `${selectedStudent.twelfth_marks}%` : 'N/A'}</div>
        </div>
        <div class="bg-[#080C14] p-3 rounded-xl border border-slate-800 text-center">
          <span class="text-[10px] font-mono text-slate-400 uppercase">TopCoder</span>
          <div class="text-lg font-bold font-mono {selectedStudent.topcoder ? 'text-amber-400' : 'text-slate-500'} mt-0.5">
            {selectedStudent.topcoder ? '⚡ Yes' : 'No'}
          </div>
        </div>
      </div>

      <!-- Contact Details -->
      <div class="bg-[#080C14]/70 p-4 rounded-xl border border-slate-800/80 space-y-2 text-xs font-mono mb-6">
        <div class="flex justify-between py-1 border-b border-slate-800/60 flex-wrap gap-1">
          <span class="text-slate-400">Institutional Email:</span>
          <span class="text-slate-200 font-semibold break-all">{selectedStudent.email || 'N/A'}</span>
        </div>
        <div class="flex justify-between py-1 border-b border-slate-800/60">
          <span class="text-slate-400">Phone:</span>
          <span class="text-slate-200 font-semibold">{selectedStudent.phone || 'N/A'}</span>
        </div>
        <div class="flex justify-between py-1">
          <span class="text-slate-400">Gender:</span>
          <span class="text-slate-200 font-semibold">{selectedStudent.gender || 'N/A'}</span>
        </div>
        {#if selectedStudent.resume_link}
          <div class="pt-2 border-t border-slate-800 flex justify-between items-center">
            <span class="text-slate-400">Resume / CV:</span>
            <a href={selectedStudent.resume_link} target="_blank" rel="noopener noreferrer" class="text-[#00BCFF] hover:underline font-bold flex items-center gap-1">
              View Document ↗
            </a>
          </div>
        {/if}
      </div>

      <!-- Shortlists & Selections History -->
      {#if selectedStudent.loadingDetails}
        <div class="py-8 text-center text-xs font-mono text-slate-400">
          <div class="w-6 h-6 rounded-full border-2 border-[#BBF351] border-t-transparent animate-spin mx-auto mb-2"></div>
          Loading full placement records...
        </div>
      {:else}
        
        <!-- Shortlisted Companies -->
        <div class="mb-5">
          <h3 class="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
            <span>📋</span>
            <span>Shortlisted Companies ({selectedStudent.shortlists ? selectedStudent.shortlists.length : 0})</span>
          </h3>

          {#if selectedStudent.shortlists && selectedStudent.shortlists.length > 0}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {#each selectedStudent.shortlists as company}
                <div class="bg-[#080C14] p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                  <span class="font-bold text-slate-200 text-xs font-sans">{company.name}</span>
                  <span class="neon-badge-cyan px-2 py-0.5 rounded-md text-[10px] font-bold font-mono">
                    {company.round_name || `Round ${company.round_number}`}
                  </span>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-xs text-slate-500 italic">No shortlists recorded.</p>
          {/if}
        </div>

        <!-- Selections & Final Offers -->
        <div>
          <h3 class="text-xs font-mono font-bold uppercase tracking-wider text-[#BBF351] mb-3 flex items-center gap-2">
            <span>✅</span>
            <span>Confirmed Selections & Offers ({selectedStudent.selections ? selectedStudent.selections.length : 0})</span>
          </h3>

          {#if selectedStudent.selections && selectedStudent.selections.length > 0}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {#each selectedStudent.selections as selection}
                <div class="bg-[#080C14] p-3 rounded-xl border border-emerald-900/40 flex items-center justify-between gap-2">
                  <span class="font-bold text-emerald-200 text-xs font-sans">{selection.name}</span>
                  <span class="neon-badge-lime px-2 py-0.5 rounded-md text-[10px] font-bold font-mono">
                    {selection.offer_type === 'intern' ? '💼 Intern' : '✓ Full-Time'}
                  </span>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-xs text-slate-500 italic">No confirmed offers recorded.</p>
          {/if}
        </div>

      {/if}

    </div>
  </div>
{/if}

<!-- ✏️ EDIT STUDENT MODAL -->
{#if editingStudent}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md" on:click|self={() => editingStudent = null} role="dialog" aria-modal="true">
    <div class="w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl bg-[#0F172A] border border-slate-700 p-5 sm:p-7 max-h-[90vh] overflow-y-auto shadow-2xl relative">
      
      <div class="sheet-handle sm:hidden"></div>

      <button 
        class="absolute top-4 right-4 w-10 h-10 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 text-base touch-press"
        on:click={() => editingStudent = null}
        aria-label="Close edit modal"
      >
        ✕
      </button>

      <h3 class="text-xl font-display font-extrabold text-white mb-1">✏️ Edit Candidate Record</h3>
      <p class="text-xs text-slate-400 font-mono mb-4">Editing profile for <strong class="text-[#BBF351]">{editingStudent.regno}</strong></p>

      {#if saveMessage}
        <div class="mb-4 p-3 rounded-xl text-xs font-mono font-semibold border {saveMessage.includes('❌') ? 'bg-rose-950/40 text-rose-300 border-rose-800' : 'bg-[#BBF351]/10 text-[#BBF351] border-[#BBF351]/30'}">
          {saveMessage}
        </div>
      {/if}

      <form on:submit|preventDefault={initiateSaveStudent} class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label for="edit-name" class="block text-[11px] font-mono uppercase text-slate-400 mb-1">Name *</label>
            <input id="edit-name" type="text" class="w-full px-3.5 py-2.5 rounded-xl text-xs" bind:value={editingStudent.name} required />
          </div>

          <div>
            <label for="edit-email" class="block text-[11px] font-mono uppercase text-slate-400 mb-1">Email ID *</label>
            <input id="edit-email" type="email" class="w-full px-3.5 py-2.5 rounded-xl text-xs" bind:value={editingStudent.email} required />
          </div>

          <div>
            <label for="edit-phone" class="block text-[11px] font-mono uppercase text-slate-400 mb-1">Phone Number</label>
            <input id="edit-phone" type="text" class="w-full px-3.5 py-2.5 rounded-xl text-xs" bind:value={editingStudent.phone} />
          </div>

          <div>
            <label for="edit-neoid" class="block text-[11px] font-mono uppercase text-slate-400 mb-1">Neo ID</label>
            <input id="edit-neoid" type="text" class="w-full px-3.5 py-2.5 rounded-xl text-xs" bind:value={editingStudent.neo_id} />
          </div>

          <div>
            <label for="edit-cgpa" class="block text-[11px] font-mono uppercase text-slate-400 mb-1">CGPA</label>
            <input id="edit-cgpa" type="number" step="0.01" min="0" max="10" class="w-full px-3.5 py-2.5 rounded-xl text-xs" bind:value={editingStudent.cgpa} />
          </div>

          <div>
            <label for="edit-tenth" class="block text-[11px] font-mono uppercase text-slate-400 mb-1">10th Marks (%)</label>
            <input id="edit-tenth" type="number" step="0.01" min="0" max="100" class="w-full px-3.5 py-2.5 rounded-xl text-xs" bind:value={editingStudent.tenth_marks} />
          </div>
        </div>

        <div>
          <label for="edit-twelfth" class="block text-[11px] font-mono uppercase text-slate-400 mb-1">12th Marks (%)</label>
          <input id="edit-twelfth" type="number" step="0.01" min="0" max="100" class="w-full px-3.5 py-2.5 rounded-xl text-xs" bind:value={editingStudent.twelfth_marks} />
        </div>

        <div>
          <label for="edit-role" class="block text-[11px] font-mono uppercase text-slate-400 mb-1">Job Role / Profile</label>
          <input id="edit-role" type="text" list="student-roles-list" class="w-full px-3.5 py-2.5 rounded-xl text-xs" bind:value={editingStudent.role} />
          <datalist id="student-roles-list">
            {#each availableRoles as role}
              <option value={role.name}>{role.category ? `${role.name} (${role.category})` : role.name}</option>
            {/each}
          </datalist>
        </div>

        <div class="bg-purple-950/30 p-3.5 rounded-xl border border-purple-800/40">
          <label for="edit-masters" class="flex items-center gap-3 cursor-pointer">
            <input 
              id="edit-masters" 
              type="checkbox" 
              checked={editingStudent.status === 'masters' || Boolean(editingStudent.masters)} 
              on:change={(e) => {
                const checked = e.currentTarget.checked;
                if (checked) {
                  editingStudent.status = 'masters';
                  editingStudent.masters = 1;
                } else {
                  if (editingStudent.status === 'masters') {
                    editingStudent.status = 'not_placed';
                  }
                  editingStudent.masters = 0;
                }
              }}
              class="w-5 h-5 accent-purple-500 rounded cursor-pointer" 
            />
            <span class="font-bold text-purple-200 text-xs sm:text-sm">
              🎓 Masters / Higher Studies Status
            </span>
          </label>
        </div>

        <div class="flex items-center justify-end gap-3 pt-3">
          <button type="button" class="neon-btn-ghost px-4 py-2.5 rounded-xl text-xs font-semibold min-h-[42px]" on:click={() => editingStudent = null}>
            Cancel
          </button>
          <button type="submit" class="neon-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold min-h-[42px]" disabled={saveLoading}>
            {saveLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

    </div>
  </div>
{/if}

<PasswordModal 
  isOpen={showPasswordModal}
  title={passwordModalTitle}
  message={passwordModalMessage}
  on:submit={handlePasswordSubmit}
  on:cancel={handlePasswordCancel}
/>
