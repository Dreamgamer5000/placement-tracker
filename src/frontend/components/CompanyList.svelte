<script lang="ts">
  import { onMount } from 'svelte';

  let companies: any[] = [];
  let loading = true;
  let searchTerm = '';
  let selectedCompany: any = null;
  let showAddForm = false;
  let editingCompany: any = null;

  let newCompany = {
    name: '',
    ctc: '',
    total_rounds: '',
    experience_required: '',
    notes: '',
    round_details: ''
  };

  let recalculatingAnalytics = false;
  let analyticsMessage = '';
  let analyticsMessageType: 'success' | 'error' = 'success';

  onMount(async () => {
    await loadCompanies();
  });

  async function loadCompanies() {
    loading = true;
    try {
      const response = await fetch('/api/companies');
      companies = await response.json();
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      loading = false;
    }
  }

  async function viewCompany(id: number) {
    try {
      const response = await fetch(`/api/companies/${id}`);
      selectedCompany = await response.json();
    } catch (error) {
      console.error('Error loading company details:', error);
    }
  }

  async function addCompany() {
    if (!newCompany.name.trim()) return;
    try {
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCompany)
      });
      
      if (response.ok) {
        newCompany = { name: '', ctc: '', total_rounds: '', experience_required: '', notes: '', round_details: '' };
        showAddForm = false;
        await loadCompanies();
      }
    } catch (error) {
      console.error('Error adding company:', error);
    }
  }

  function openEditCompany(company: any) {
    editingCompany = {
      id: company.id,
      name: company.name || '',
      ctc: company.ctc || '',
      total_rounds: company.total_rounds || company.rounds || '',
      experience_required: company.experience_required || '',
      notes: company.notes || '',
      round_details: company.round_details || ''
    };
  }

  async function saveCompany() {
    if (!editingCompany || !editingCompany.name.trim()) return;
    try {
      const response = await fetch(`/api/companies/${editingCompany.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCompany)
      });

      if (response.ok) {
        const updated = await response.json();
        editingCompany = null;
        await loadCompanies();
        if (selectedCompany && selectedCompany.id === updated.id) {
          await viewCompany(updated.id);
        }
      }
    } catch (error) {
      console.error('Error saving company:', error);
    }
  }

  async function recalculateAnalytics() {
    if (recalculatingAnalytics) return;
    
    recalculatingAnalytics = true;
    analyticsMessage = '';
    
    try {
      const response = await fetch('/api/companies/recalculate-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (response.ok) {
        analyticsMessage = result.message + (result.errorCount > 0 ? ` (${result.errorCount} errors)` : '');
        analyticsMessageType = result.errorCount > 0 ? 'error' : 'success';
        
        await loadCompanies();
        if (selectedCompany) {
          await viewCompany(selectedCompany.id);
        }
      } else {
        analyticsMessage = result.error || 'Failed to recalculate analytics';
        analyticsMessageType = 'error';
      }
    } catch (error) {
      analyticsMessage = 'Error recalculating analytics';
      analyticsMessageType = 'error';
      console.error('Error:', error);
    } finally {
      recalculatingAnalytics = false;
      setTimeout(() => {
        analyticsMessage = '';
      }, 5000);
    }
  }

  $: filteredCompanies = Array.isArray(companies) ? companies.filter(c => {
    if (!searchTerm || !searchTerm.trim()) return true;
    
    const tokens = searchTerm.toLowerCase().trim().split(/\s+/);
    const combinedText = [
      c.name,
      c.ctc,
      c.notes,
      c.round_details,
      c.experience_required,
      c.rounds ? `${c.rounds} rounds` : '',
      c.total_rounds ? `${c.total_rounds} rounds` : ''
    ].filter(Boolean).join(' ').toLowerCase();

    return tokens.every(token => combinedText.includes(token));
  }) : [];
</script>

<div class="p-8 max-w-[1600px] mx-auto">
  <!-- Top Bar -->
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
    <div>
      <h2 class="text-3xl font-bold text-gray-900">🏢 Company Profiles</h2>
      <p class="text-gray-500 text-sm mt-1">Explore job opportunities, CTC details, selection ratios, and round information.</p>
    </div>
    
    <div class="flex flex-wrap gap-3">
      <button 
        class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-sm flex items-center gap-2"
        on:click={recalculateAnalytics}
        disabled={recalculatingAnalytics}
      >
        {#if recalculatingAnalytics}
          <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Recalculating...
        {:else}
          🔄 Recalculate Analytics
        {/if}
      </button>
      <button 
        class="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-sm"
        on:click={() => showAddForm = !showAddForm}
      >
        {showAddForm ? 'Cancel' : '+ Add Company'}
      </button>
    </div>
  </div>

  <!-- Search Bar -->
  <div class="mb-8">
    <input 
      type="text" 
      placeholder="🔍 Search companies by name, CTC (e.g. 15 LPA), notes, or round information..." 
      bind:value={searchTerm}
      class="w-full px-5 py-3.5 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base shadow-sm bg-white"
    />
  </div>

  {#if analyticsMessage}
    <div class="mb-6 p-4 rounded-xl border-l-4 {analyticsMessageType === 'success' ? 'bg-green-50 border-green-500 text-green-800' : 'bg-red-50 border-red-500 text-red-800'}">
      <p class="font-semibold">{analyticsMessage}</p>
    </div>
  {/if}

  {#if showAddForm}
    <div class="bg-white rounded-2xl shadow-md p-6 mb-8 border border-purple-100">
      <h3 class="text-xl font-bold text-gray-800 mb-4">✨ Add New Company</h3>
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input 
            type="text" 
            placeholder="Company Name *" 
            bind:value={newCompany.name}
            class="px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
          <input 
            type="text" 
            placeholder="CTC Package (e.g. 14 LPA)" 
            bind:value={newCompany.ctc}
            class="px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input 
            type="number" 
            placeholder="Total Rounds (e.g. 4)" 
            bind:value={newCompany.total_rounds}
            class="px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input 
            type="text" 
            placeholder="Experience Required (e.g. Freshers, 0-1 yrs)" 
            bind:value={newCompany.experience_required}
            class="px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <textarea 
          placeholder="General Notes (optional)" 
          bind:value={newCompany.notes}
          rows="2"
          class="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 resize-vertical"
        />

        <textarea 
          placeholder="Round-by-Round Notes & Details (e.g. Round 1: OA, Round 2: Tech Interview...)" 
          bind:value={newCompany.round_details}
          rows="3"
          class="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 resize-vertical"
        />

        <button 
          class="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-colors duration-200 shadow-md"
          on:click={addCompany}
        >
          Save Company Profile
        </button>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="text-center py-16 text-gray-600">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      <p class="mt-4 text-base font-medium">Loading companies...</p>
    </div>
  {:else if filteredCompanies.length === 0}
    <div class="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100 text-gray-500">
      <p class="text-lg">No companies matching "{searchTerm}"</p>
    </div>
  {:else}
    <!-- Aesthetic 4-Column Card Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {#each filteredCompanies as company}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div 
          class="bg-white rounded-2xl border border-gray-100 p-6 cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between"
          on:click={() => viewCompany(company.id)}
        >
          <div>
            <div class="flex justify-between items-start mb-3 gap-2">
              <h3 class="text-xl font-bold text-gray-900 leading-snug">{company.name}</h3>
              {#if company.ctc}
                <span class="px-2.5 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full whitespace-nowrap">
                  💰 {company.ctc}
                </span>
              {/if}
            </div>

            {#if company.notes}
              <p class="text-gray-600 text-sm mb-4 line-clamp-2">{company.notes}</p>
            {/if}
          </div>

          <div class="pt-4 border-t border-gray-100 flex flex-wrap gap-2 text-xs text-gray-500">
            {#if company.total_rounds || company.rounds}
              <span class="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-md font-semibold">
                📝 {company.total_rounds || company.rounds} Rounds
              </span>
            {/if}
            {#if company.experience_required}
              <span class="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md font-medium">
                💼 {company.experience_required}
              </span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- View / Edit Company Modal -->
{#if selectedCompany}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div 
    class="fixed inset-0 bg-[rgba(15,23,42,0.6)] backdrop-blur-sm flex items-center justify-center z-50 p-4"
    on:click={() => { selectedCompany = null; editingCompany = null; }}
  >
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div 
      class="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-y-auto relative p-8"
      on:click|stopPropagation
    >
      <button 
        class="absolute top-5 right-5 w-10 h-10 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-xl font-bold transition-colors"
        on:click={() => { selectedCompany = null; editingCompany = null; }}
      >
        ×
      </button>

      <!-- Modal Header & Actions -->
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pr-12">
        <div>
          <h3 class="text-3xl font-bold text-gray-900">{selectedCompany.name}</h3>
          <div class="flex flex-wrap gap-2 mt-2">
            {#if selectedCompany.ctc}
              <span class="px-3 py-1 bg-green-100 text-green-800 text-sm font-bold rounded-full">
                💰 CTC: {selectedCompany.ctc}
              </span>
            {/if}
            {#if selectedCompany.total_rounds || selectedCompany.rounds}
              <span class="px-3 py-1 bg-purple-100 text-purple-800 text-sm font-bold rounded-full">
                📝 {selectedCompany.total_rounds || selectedCompany.rounds} Rounds
              </span>
            {/if}
            {#if selectedCompany.experience_required}
              <span class="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">
                💼 {selectedCompany.experience_required}
              </span>
            {/if}
          </div>
        </div>

        <button 
          on:click={() => openEditCompany(selectedCompany)}
          class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all shadow-sm flex items-center gap-2"
        >
          ✏️ Edit Company Details
        </button>
      </div>

      <!-- Editable Form inside Modal if Editing -->
      {#if editingCompany}
        <div class="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 mb-8">
          <h4 class="text-xl font-bold text-amber-900 mb-4">✏️ Edit Company Profile</h4>
          <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="edit-company-name" class="block text-xs font-bold text-gray-700 uppercase mb-1">Company Name *</label>
                <input id="edit-company-name" type="text" bind:value={editingCompany.name} class="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white" required />
              </div>
              <div>
                <label for="edit-company-ctc" class="block text-xs font-bold text-gray-700 uppercase mb-1">CTC Package</label>
                <input id="edit-company-ctc" type="text" bind:value={editingCompany.ctc} placeholder="e.g. 16 LPA" class="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white" />
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="edit-company-rounds" class="block text-xs font-bold text-gray-700 uppercase mb-1">Total Rounds</label>
                <input id="edit-company-rounds" type="number" bind:value={editingCompany.total_rounds} placeholder="e.g. 4" class="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white" />
              </div>
              <div>
                <label for="edit-company-exp" class="block text-xs font-bold text-gray-700 uppercase mb-1">Experience Required</label>
                <input id="edit-company-exp" type="text" bind:value={editingCompany.experience_required} placeholder="e.g. Freshers" class="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white" />
              </div>
            </div>

            <div>
              <label for="edit-company-notes" class="block text-xs font-bold text-gray-700 uppercase mb-1">General Notes</label>
              <textarea id="edit-company-notes" bind:value={editingCompany.notes} rows="2" class="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white" />
            </div>

            <div>
              <label for="edit-company-details" class="block text-xs font-bold text-gray-700 uppercase mb-1">Round-by-Round Details / Instructions</label>
              <textarea id="edit-company-details" bind:value={editingCompany.round_details} rows="4" placeholder="Describe each round, questions asked, cutoffs, etc." class="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white" />
            </div>

            <div class="flex justify-end gap-3 pt-2">
              <button on:click={() => editingCompany = null} class="px-5 py-2 bg-gray-200 text-gray-700 font-semibold rounded-xl">Cancel</button>
              <button on:click={saveCompany} class="px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700">Save Changes</button>
            </div>
          </div>
        </div>
      {/if}

      <!-- SECTION 1 (FIRST): Company Overview & Round Information -->
      <div class="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-6 mb-8">
        <h4 class="text-xl font-bold text-indigo-950 mb-4">📋 Company Overview & Round Information</h4>

        {#if selectedCompany.notes}
          <div class="mb-4">
            <span class="text-xs font-bold text-indigo-600 uppercase tracking-wider">General Notes:</span>
            <p class="text-gray-800 mt-1 whitespace-pre-line">{selectedCompany.notes}</p>
          </div>
        {/if}

        {#if selectedCompany.round_details}
          <div>
            <span class="text-xs font-bold text-indigo-600 uppercase tracking-wider">Round-by-Round Details & Process Notes:</span>
            <div class="bg-white p-4 rounded-xl border border-indigo-100 text-gray-800 mt-2 whitespace-pre-line leading-relaxed">
              {selectedCompany.round_details}
            </div>
          </div>
        {:else if !selectedCompany.notes}
          <p class="text-gray-500 italic">No round notes provided yet. Click "Edit Company Details" above to add round information.</p>
        {/if}
      </div>

      <!-- SECTION 2 (SECOND): Finally Selected / Interned Students Analytics & List -->
      {#if selectedCompany.analytics && selectedCompany.analytics.total_selected > 0}
        <div class="border-2 border-blue-500 rounded-2xl p-6 bg-blue-50/60 mb-8">
          <h4 class="text-2xl font-bold text-blue-950 mb-4">💼 Selection & Interned Analytics</h4>
          
          <div class="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-xl text-center mb-6 shadow-md">
            <div class="text-sm opacity-90 mb-1">Selection Ratio</div>
            <div class="text-4xl font-bold">
              {selectedCompany.analytics.total_selected} / {selectedCompany.analytics.total_shortlisted}
              <span class="text-3xl ml-2">({selectedCompany.analytics.selection_ratio?.toFixed(1) || 0}%)</span>
            </div>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div class="bg-white border-2 border-blue-400 p-4 rounded-xl text-center">
              <div class="text-xs text-gray-500 font-semibold mb-1 uppercase">Total Selected</div>
              <div class="text-2xl font-bold text-blue-700">{selectedCompany.analytics.total_selected || 0}</div>
            </div>
            <div class="bg-white border-2 border-blue-400 p-4 rounded-xl text-center">
              <div class="text-xs text-gray-500 font-semibold mb-1 uppercase">Gender Ratio</div>
              <div class="text-2xl font-bold text-blue-700">{selectedCompany.analytics.gender_ratio_selected || 'N/A'}</div>
            </div>
            <div class="bg-white border-2 border-blue-400 p-4 rounded-xl text-center">
              <div class="text-xs text-gray-500 font-semibold mb-1 uppercase">Min CGPA</div>
              <div class="text-2xl font-bold text-blue-700">{selectedCompany.analytics.min_cgpa_selected?.toFixed(2) || 'N/A'}</div>
            </div>
            <div class="bg-white border-2 border-blue-400 p-4 rounded-xl text-center">
              <div class="text-xs text-gray-500 font-semibold mb-1 uppercase">Avg CGPA</div>
              <div class="text-2xl font-bold text-blue-700">{selectedCompany.analytics.avg_cgpa_selected?.toFixed(2) || 'N/A'}</div>
            </div>
            <div class="bg-white border-2 border-blue-400 p-4 rounded-xl text-center">
              <div class="text-xs text-gray-500 font-semibold mb-1 uppercase">Min 10th</div>
              <div class="text-2xl font-bold text-blue-700">{selectedCompany.analytics.min_tenth_selected?.toFixed(2) || 'N/A'}</div>
            </div>
            <div class="bg-white border-2 border-blue-400 p-4 rounded-xl text-center">
              <div class="text-xs text-gray-500 font-semibold mb-1 uppercase">Min 12th</div>
              <div class="text-2xl font-bold text-blue-700">{selectedCompany.analytics.min_twelfth_selected?.toFixed(2) || 'N/A'}</div>
            </div>
          </div>
        </div>
      {/if}

      {#if (selectedCompany.selected && selectedCompany.selected.length > 0) || (selectedCompany.placed && selectedCompany.placed.length > 0)}
        {@const candidates = selectedCompany.selected && selectedCompany.selected.length > 0 ? selectedCompany.selected : selectedCompany.placed}
        <div class="mb-8 border border-blue-200 rounded-2xl bg-blue-50/30 overflow-hidden shadow-sm">
          <div class="bg-blue-100/70 px-6 py-4 flex justify-between items-center border-b border-blue-200">
            <h4 class="text-2xl font-bold text-blue-950 flex items-center gap-2">
              💼 Finally Interned / Placed Students
            </h4>
            <span class="px-3 py-1 bg-blue-700 text-white text-xs font-bold rounded-full">
              {candidates.length} Candidate{candidates.length === 1 ? '' : 's'}
            </span>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-blue-100">
              <thead class="bg-white/80">
                <tr>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">Reg No / Neo ID</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">Name</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">Campus</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">TopCoder</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">CGPA</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">Offer Status</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">Gender</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">Resume</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-blue-50">
                {#each candidates as student}
                  <tr class="hover:bg-blue-50/50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {student.regno}
                      {#if student.neo_id}
                        <span class="ml-1.5 px-1.5 py-0.5 text-xs font-mono bg-blue-100 text-blue-800 rounded font-semibold">{student.neo_id}</span>
                      {/if}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                      <span class="px-2 py-0.5 rounded-full text-xs font-bold {student.campus === 'Unknown' || !student.campus ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}">
                        {student.campus || 'Unknown'}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                      {#if student.topcoder}
                        <span class="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">⚡ TopCoder</span>
                      {:else}
                        <span class="text-gray-400 text-xs">No</span>
                      {/if}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.cgpa?.toFixed(2) || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                      <span class="px-2.5 py-0.5 rounded-full text-xs font-bold {student.status === 'placed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-blue-100 text-blue-800 border border-blue-300'}">
                        {student.status === 'placed' ? '✓ Full-Time' : '💼 Intern'}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.gender || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                      {#if student.resume_link}
                        <a href={student.resume_link} target="_blank" class="text-blue-600 hover:text-blue-800 font-semibold">📄 View</a>
                      {:else}
                        <span class="text-gray-400">N/A</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}

      <!-- SECTION 3 (THIRD): Shortlist Analytics & Round-by-Round Shortlisted Students -->
      {#if selectedCompany.analytics}
        <div class="mb-8">
          <h4 class="text-2xl font-bold text-gray-900 mb-4">📊 Shortlist Analytics</h4>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
            <div class="bg-purple-50 p-4 rounded-xl text-center">
              <div class="text-xs text-gray-500 font-semibold mb-1 uppercase">Total Shortlisted</div>
              <div class="text-2xl font-bold text-purple-700">{selectedCompany.analytics.total_shortlisted || 0}</div>
            </div>
            <div class="bg-purple-50 p-4 rounded-xl text-center">
              <div class="text-xs text-gray-500 font-semibold mb-1 uppercase">Gender Ratio</div>
              <div class="text-2xl font-bold text-purple-700">{selectedCompany.analytics.gender_ratio_shortlist || 'N/A'}</div>
            </div>
            <div class="bg-purple-50 p-4 rounded-xl text-center">
              <div class="text-xs text-gray-500 font-semibold mb-1 uppercase">Min CGPA</div>
              <div class="text-2xl font-bold text-purple-700">{selectedCompany.analytics.min_cgpa_shortlist?.toFixed(2) || 'N/A'}</div>
            </div>
            <div class="bg-purple-50 p-4 rounded-xl text-center">
              <div class="text-xs text-gray-500 font-semibold mb-1 uppercase">Avg CGPA</div>
              <div class="text-2xl font-bold text-purple-700">{selectedCompany.analytics.avg_cgpa_shortlist?.toFixed(2) || 'N/A'}</div>
            </div>
            <div class="bg-purple-50 p-4 rounded-xl text-center">
              <div class="text-xs text-gray-500 font-semibold mb-1 uppercase">Min 10th</div>
              <div class="text-2xl font-bold text-purple-700">{selectedCompany.analytics.min_tenth_shortlist?.toFixed(2) || 'N/A'}</div>
            </div>
            <div class="bg-purple-50 p-4 rounded-xl text-center">
              <div class="text-xs text-gray-500 font-semibold mb-1 uppercase">Min 12th</div>
              <div class="text-2xl font-bold text-purple-700">{selectedCompany.analytics.min_twelfth_shortlist?.toFixed(2) || 'N/A'}</div>
            </div>
          </div>
        </div>
      {/if}

      {#if selectedCompany.shortlist_rounds && selectedCompany.shortlist_rounds.length > 0}
        <div class="mb-8 space-y-6">
          {#each selectedCompany.shortlist_rounds as round}
            <div class="border border-purple-200 rounded-2xl bg-purple-50/30 overflow-hidden shadow-sm">
              <div class="bg-purple-100/70 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-purple-200">
                <h4 class="text-xl font-bold text-purple-950 flex items-center gap-2">
                  📋 {round.round_name || `Shortlist ${round.round_number}`}
                </h4>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="px-3 py-1 bg-purple-700 text-white text-xs font-bold rounded-full">
                    Total: {round.students.length}
                  </span>
                  <span class="px-3 py-1 bg-indigo-700 text-white text-xs font-bold rounded-full">
                    Chennai: {round.students.filter(s => s.campus === 'Chennai').length}
                  </span>
                  {#if round.students.filter(s => s.campus === 'Unknown' || !s.campus).length > 0}
                    <span class="px-3 py-1 bg-amber-600 text-white text-xs font-bold rounded-full">
                      Unknown: {round.students.filter(s => s.campus === 'Unknown' || !s.campus).length}
                    </span>
                  {/if}
                </div>
              </div>
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-purple-100">
                  <thead class="bg-white/80">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-bold text-purple-900 uppercase tracking-wider">Reg No / Neo ID</th>
                      <th class="px-6 py-3 text-left text-xs font-bold text-purple-900 uppercase tracking-wider">Name</th>
                      <th class="px-6 py-3 text-left text-xs font-bold text-purple-900 uppercase tracking-wider">Campus</th>
                      <th class="px-6 py-3 text-left text-xs font-bold text-purple-900 uppercase tracking-wider">TopCoder</th>
                      <th class="px-6 py-3 text-left text-xs font-bold text-purple-900 uppercase tracking-wider">CGPA</th>
                      <th class="px-6 py-3 text-left text-xs font-bold text-purple-900 uppercase tracking-wider">10th</th>
                      <th class="px-6 py-3 text-left text-xs font-bold text-purple-900 uppercase tracking-wider">12th</th>
                      <th class="px-6 py-3 text-left text-xs font-bold text-purple-900 uppercase tracking-wider">Gender</th>
                      <th class="px-6 py-3 text-left text-xs font-bold text-purple-900 uppercase tracking-wider">Resume</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-purple-50">
                    {#each round.students as student}
                      <tr class="hover:bg-purple-50/50">
                        <td class="px-6 py-3.5 whitespace-nowrap text-sm font-bold text-gray-900">
                          {student.regno}
                          {#if student.neo_id}
                            <span class="ml-1 px-1.5 py-0.5 text-xs font-mono bg-purple-100 text-purple-800 rounded">{student.neo_id}</span>
                          {/if}
                        </td>
                        <td class="px-6 py-3.5 whitespace-nowrap text-sm text-gray-900">{student.name}</td>
                        <td class="px-6 py-3.5 whitespace-nowrap text-sm">
                          <span class="px-2 py-0.5 rounded-full text-xs font-bold {student.campus === 'Unknown' || !student.campus ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}">
                            {student.campus || 'Unknown'}
                          </span>
                        </td>
                        <td class="px-6 py-3.5 whitespace-nowrap text-sm">
                          {#if student.topcoder}
                            <span class="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">⚡ TopCoder</span>
                          {:else}
                            <span class="text-gray-400 text-xs">No</span>
                          {/if}
                        </td>
                        <td class="px-6 py-3.5 whitespace-nowrap text-sm text-gray-900">{student.cgpa?.toFixed(2) || 'N/A'}</td>
                        <td class="px-6 py-3.5 whitespace-nowrap text-sm text-gray-900">{student.tenth_marks?.toFixed(2) || 'N/A'}</td>
                        <td class="px-6 py-3.5 whitespace-nowrap text-sm text-gray-900">{student.twelfth_marks?.toFixed(2) || 'N/A'}</td>
                        <td class="px-6 py-3.5 whitespace-nowrap text-sm text-gray-900">{student.gender || 'N/A'}</td>
                        <td class="px-6 py-3.5 whitespace-nowrap text-sm">
                          {#if student.resume_link}
                            <a href={student.resume_link} target="_blank" class="text-purple-600 hover:text-purple-800 font-semibold">📄 View</a>
                          {:else}
                            <span class="text-gray-400">N/A</span>
                          {/if}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {/each}
        </div>
      {:else if selectedCompany.shortlisted && selectedCompany.shortlisted.length > 0}
        <div class="mb-8">
          <h4 class="text-2xl font-bold text-gray-900 mb-4">📋 Shortlisted Students ({selectedCompany.shortlisted.length})</h4>
          <div class="overflow-x-auto rounded-xl border border-gray-200">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Reg No</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">CGPA</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">10th</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">12th</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Gender</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Resume</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {#each selectedCompany.shortlisted as student}
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{student.regno}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.cgpa?.toFixed(2) || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.tenth_marks?.toFixed(2) || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.twelfth_marks?.toFixed(2) || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.gender || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                      {#if student.resume_link}
                        <a href={student.resume_link} target="_blank" class="text-purple-600 hover:text-purple-800 font-semibold">📄 View</a>
                      {:else}
                        <span class="text-gray-400">N/A</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
