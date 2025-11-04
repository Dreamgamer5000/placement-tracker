<script lang="ts">
  import { onMount } from 'svelte';

  let companies: any[] = [];
  let loading = true;
  let selectedCompany: any = null;
  let showAddForm = false;
  let newCompany = { name: '', notes: '', rounds: '', experience_required: '' };
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
      console.log('Company data:', selectedCompany);
    } catch (error) {
      console.error('Error loading company details:', error);
    }
  }

  async function addCompany() {
    try {
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCompany)
      });
      
      if (response.ok) {
        newCompany = { name: '', notes: '', rounds: '', experience_required: '' };
        showAddForm = false;
        await loadCompanies();
      }
    } catch (error) {
      console.error('Error adding company:', error);
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
        
        // Reload companies to get fresh data
        await loadCompanies();
        
        // If a company is currently selected, reload its data
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
      
      // Clear message after 5 seconds
      setTimeout(() => {
        analyticsMessage = '';
      }, 5000);
    }
  }
</script>

<div class="p-8">
  <div class="flex justify-between items-center mb-8">
    <h2 class="text-3xl font-bold text-gray-800">🏢 Companies</h2>
    <div class="flex gap-3">
      <button 
        class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
        class="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
        on:click={() => showAddForm = !showAddForm}
    >
      {showAddForm ? 'Cancel' : '+ Add Company'}
    </button>
  </div>
  </div>

  {#if analyticsMessage}
    <div class="mb-6 p-4 rounded-lg border-l-4 {analyticsMessageType === 'success' ? 'bg-green-50 border-green-500 text-green-800' : 'bg-red-50 border-red-500 text-red-800'}">
      <p class="font-semibold">{analyticsMessage}</p>
    </div>
  {/if}

  {#if showAddForm}
    <div class="bg-white rounded-lg shadow-md p-6 mb-8">
      <h3 class="text-xl font-bold text-gray-800 mb-4">Add New Company</h3>
      <div class="space-y-4">
        <input 
          type="text" 
          placeholder="Company Name *" 
          bind:value={newCompany.name}
          class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          required
        />
        <textarea 
          placeholder="Notes (optional)" 
          bind:value={newCompany.notes}
          rows="3"
          class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-vertical"
        />
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input 
            type="number" 
            placeholder="Number of Rounds (optional)" 
            bind:value={newCompany.rounds}
            class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <input 
            type="text" 
            placeholder="Experience Required (optional)" 
            bind:value={newCompany.experience_required}
            class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <button 
          class="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
          on:click={addCompany}
        >
          Add Company
        </button>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="text-center py-12 text-gray-600">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      <p class="mt-4">Loading companies...</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each companies as company}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div 
          class="bg-white rounded-lg shadow-md p-6 cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-1"
          on:click={() => viewCompany(company.id)}
        >
          <h3 class="text-xl font-bold text-gray-800 mb-2">{company.name}</h3>
          {#if company.notes}
            <p class="text-gray-600 text-sm mb-4">{company.notes}</p>
          {/if}
          <div class="flex gap-4 text-sm text-gray-500">
            {#if company.rounds}
              <span>📝 {company.rounds} rounds</span>
            {/if}
            {#if company.experience_required}
              <span>💼 {company.experience_required}</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if selectedCompany}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div 
    class="fixed inset-0 bg-[rgba(0,0,0,0.5)] bg-opacity-50 flex items-center justify-center z-50 p-4"
    on:click={() => selectedCompany = null}
  >
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div 
      class="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto relative p-8"
      on:click|stopPropagation
    >
      <button 
        class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-3xl font-bold leading-none"
        on:click={() => selectedCompany = null}
      >
        ×
      </button>
      
      <h3 class="text-3xl font-bold text-gray-800 mb-4">{selectedCompany.name}</h3>
      
      {#if selectedCompany.notes}
        <p class="text-gray-600 mb-6"><strong>Notes:</strong> {selectedCompany.notes}</p>
      {/if}

      {#if selectedCompany.analytics}
        <!-- Shortlist Analytics -->
        <div class="mb-8">
          <h4 class="text-2xl font-bold text-gray-800 mb-4">📊 Shortlist Analytics</h4>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
            <div class="bg-purple-50 p-4 rounded-lg text-center">
              <div class="text-sm text-gray-600 mb-1">Total Shortlisted</div>
              <div class="text-2xl font-bold text-purple-600">{selectedCompany.analytics.total_shortlisted || 0}</div>
            </div>
            <div class="bg-purple-50 p-4 rounded-lg text-center">
              <div class="text-sm text-gray-600 mb-1">Gender Ratio</div>
              <div class="text-2xl font-bold text-purple-600">{selectedCompany.analytics.gender_ratio_shortlist || 'N/A'}</div>
            </div>
            <div class="bg-purple-50 p-4 rounded-lg text-center">
              <div class="text-sm text-gray-600 mb-1">Min CGPA</div>
              <div class="text-2xl font-bold text-purple-600">{selectedCompany.analytics.min_cgpa_shortlist?.toFixed(2) || 'N/A'}</div>
            </div>
            <div class="bg-purple-50 p-4 rounded-lg text-center">
              <div class="text-sm text-gray-600 mb-1">Avg CGPA</div>
              <div class="text-2xl font-bold text-purple-600">{selectedCompany.analytics.avg_cgpa_shortlist?.toFixed(2) || 'N/A'}</div>
            </div>
            <div class="bg-purple-50 p-4 rounded-lg text-center">
              <div class="text-sm text-gray-600 mb-1">Min 10th</div>
              <div class="text-2xl font-bold text-purple-600">{selectedCompany.analytics.min_tenth_shortlist?.toFixed(2) || 'N/A'}</div>
            </div>
            <div class="bg-purple-50 p-4 rounded-lg text-center">
              <div class="text-sm text-gray-600 mb-1">Min 12th</div>
              <div class="text-2xl font-bold text-purple-600">{selectedCompany.analytics.min_twelfth_shortlist?.toFixed(2) || 'N/A'}</div>
            </div>
          </div>
        </div>

        <!-- Selection Analytics -->
        {#if selectedCompany.analytics.total_selected > 0}
          <div class="border-2 border-green-500 rounded-xl p-6 bg-green-50 mb-8">
            <h4 class="text-2xl font-bold text-gray-800 mb-4">✅ Selection Analytics</h4>
            
            <!-- Selection Ratio Banner -->
            <div class="bg-gradient-to-r from-green-600 to-green-500 text-white p-6 rounded-lg text-center mb-6">
              <div class="text-sm opacity-90 mb-2">Selection Ratio</div>
              <div class="text-4xl font-bold">
                {selectedCompany.analytics.total_selected} / {selectedCompany.analytics.total_shortlisted}
                <span class="text-3xl ml-2">({selectedCompany.analytics.selection_ratio?.toFixed(1) || 0}%)</span>
              </div>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div class="bg-white border-2 border-green-500 p-4 rounded-lg text-center">
                <div class="text-sm text-gray-600 mb-1">Total Selected</div>
                <div class="text-2xl font-bold text-green-600">{selectedCompany.analytics.total_selected || 0}</div>
              </div>
              <div class="bg-white border-2 border-green-500 p-4 rounded-lg text-center">
                <div class="text-sm text-gray-600 mb-1">Gender Ratio</div>
                <div class="text-2xl font-bold text-green-600">{selectedCompany.analytics.gender_ratio_selected || 'N/A'}</div>
              </div>
              <div class="bg-white border-2 border-green-500 p-4 rounded-lg text-center">
                <div class="text-sm text-gray-600 mb-1">Min CGPA</div>
                <div class="text-2xl font-bold text-green-600">{selectedCompany.analytics.min_cgpa_selected?.toFixed(2) || 'N/A'}</div>
              </div>
              <div class="bg-white border-2 border-green-500 p-4 rounded-lg text-center">
                <div class="text-sm text-gray-600 mb-1">Avg CGPA</div>
                <div class="text-2xl font-bold text-green-600">{selectedCompany.analytics.avg_cgpa_selected?.toFixed(2) || 'N/A'}</div>
              </div>
              <div class="bg-white border-2 border-green-500 p-4 rounded-lg text-center">
                <div class="text-sm text-gray-600 mb-1">Min 10th</div>
                <div class="text-2xl font-bold text-green-600">{selectedCompany.analytics.min_tenth_selected?.toFixed(2) || 'N/A'}</div>
              </div>
              <div class="bg-white border-2 border-green-500 p-4 rounded-lg text-center">
                <div class="text-sm text-gray-600 mb-1">Min 12th</div>
                <div class="text-2xl font-bold text-green-600">{selectedCompany.analytics.min_twelfth_selected?.toFixed(2) || 'N/A'}</div>
              </div>
            </div>
          </div>
        {/if}
      {/if}

      {#if selectedCompany.shortlisted && selectedCompany.shortlisted.length > 0}
        <div class="mb-8">
          <h4 class="text-2xl font-bold text-gray-800 mb-4">📋 Shortlisted Students ({selectedCompany.shortlisted.length})</h4>
          <div class="overflow-x-auto rounded-lg border border-gray-200">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reg No</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CGPA</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">10th</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">12th</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resume</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {#each selectedCompany.shortlisted as student}
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.regno}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.cgpa?.toFixed(2) || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.tenth_marks?.toFixed(2) || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.twelfth_marks?.toFixed(2) || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.gender || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                      {#if student.resume_link}
                        <a href={student.resume_link} target="_blank" class="text-purple-600 hover:text-purple-800">📄 View</a>
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

      {#if selectedCompany.placed && selectedCompany.placed.length > 0}
        <div class="mb-8">
          <h4 class="text-2xl font-bold text-gray-800 mb-4">✅ Finally Selected Students ({selectedCompany.placed.length})</h4>
          <div class="overflow-x-auto rounded-lg border border-green-200 bg-green-50">
            <table class="min-w-full divide-y divide-green-200">
              <thead class="bg-green-100">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Reg No</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Name</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">CGPA</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">10th</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">12th</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Gender</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Resume</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-green-100">
                {#each selectedCompany.placed as student}
                  <tr class="hover:bg-green-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.regno}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.cgpa?.toFixed(2) || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.tenth_marks?.toFixed(2) || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.twelfth_marks?.toFixed(2) || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.gender || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                      {#if student.resume_link}
                        <a href={student.resume_link} target="_blank" class="text-green-600 hover:text-green-800 font-semibold">📄 View</a>
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
