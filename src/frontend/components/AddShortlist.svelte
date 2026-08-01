<script lang="ts">
  import { onMount } from 'svelte';

  let companies: any[] = [];
  let selectedCompanyId = '';
  let regnos = '';
  let roundNumber = 1;
  let customRoundName = '';
  let message = '';
  let messageType: 'success' | 'error' = 'success';

  onMount(async () => {
    await loadCompanies();
  });

  async function loadCompanies() {
    try {
      const response = await fetch('/api/companies');
      companies = await response.json();
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  }

  async function addShortlist() {
    if (!selectedCompanyId || !regnos.trim()) {
      message = 'Please select a company and enter registration numbers';
      messageType = 'error';
      return;
    }

    const regnoList = regnos.split('\n').map(r => r.trim()).filter(r => r);

    if (regnoList.length === 0) {
      message = 'Please enter at least one registration number';
      messageType = 'error';
      return;
    }

    const finalRoundName = customRoundName.trim() || `Shortlist ${roundNumber}`;

    try {
      const response = await fetch(`/api/companies/${selectedCompanyId}/shortlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regnos: regnoList,
          round_number: roundNumber,
          round_name: finalRoundName
        })
      });

      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        message = 'Server error: Expected JSON response but got something else';
        messageType = 'error';
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        message = result.error || 'Failed to add students';
        messageType = 'error';
        return;
      }

      const successCount = result.results ? result.results.filter((r: any) => r.success).length : 0;
      const errorCount = result.errors ? result.errors.length : 0;
      
      if (successCount > 0) {
        message = `Successfully added ${successCount} student(s) to "${finalRoundName}".`;
        if (errorCount > 0) {
          message += ` ${errorCount} error(s) occurred (students not found).`;
        }
        messageType = 'success';
        regnos = '';
      } else if (errorCount > 0) {
        message = `Failed to add students. ${errorCount} registration number(s) not found in database.`;
        messageType = 'error';
      } else {
        message = 'No students were added. Please check the registration numbers.';
        messageType = 'error';
      }
    } catch (error) {
      message = 'Error adding students to shortlist';
      messageType = 'error';
      console.error('Error:', error);
    }

    setTimeout(() => {
      message = '';
    }, 5000);
  }
</script>

<div>
  <h2 class="text-3xl font-bold text-gray-800 mb-6">📝 Add Students to Company Shortlist</h2>
  
  <div class="bg-white rounded-lg shadow-md p-6 mb-6">
    <div class="mb-6">
      <label for="company" class="block text-sm font-semibold text-gray-700 mb-2">
        Select Company *
      </label>
      <select 
        id="company" 
        bind:value={selectedCompanyId}
        class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      >
        <option value="">-- Select a company --</option>
        {#each companies as company}
          <option value={company.id}>{company.name}</option>
        {/each}
      </select>
      <p class="mt-1 text-xs text-gray-500">Note: New companies can be added from the <strong>Companies</strong> page.</p>
    </div>
    <!-- Shortlist Round / Stage Selection -->
    <div class="mb-6 bg-purple-50/70 p-4 rounded-xl border border-purple-200">
      <label class="block text-sm font-bold text-purple-900 mb-2">
        Shortlist Round / Stage *
      </label>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <button
          type="button"
          class="py-2.5 px-4 rounded-lg font-semibold text-sm transition-all border-2 {roundNumber === 1 && !customRoundName ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'}"
          on:click={() => { roundNumber = 1; customRoundName = ''; }}
        >
          Shortlist 1 (Round 1)
        </button>
        <button
          type="button"
          class="py-2.5 px-4 rounded-lg font-semibold text-sm transition-all border-2 {roundNumber === 2 && !customRoundName ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'}"
          on:click={() => { roundNumber = 2; customRoundName = ''; }}
        >
          Shortlist 2 (Round 2)
        </button>
        <button
          type="button"
          class="py-2.5 px-4 rounded-lg font-semibold text-sm transition-all border-2 {roundNumber === 3 && !customRoundName ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'}"
          on:click={() => { roundNumber = 3; customRoundName = ''; }}
        >
          Shortlist 3 (Round 3)
        </button>
        <button
          type="button"
          class="py-2.5 px-4 rounded-lg font-semibold text-sm transition-all border-2 {roundNumber >= 4 || customRoundName ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'}"
          on:click={() => { if (roundNumber < 4) roundNumber = 4; }}
        >
          Custom / Next Round
        </button>
      </div>

      {#if roundNumber >= 4 || customRoundName}
        <div class="flex gap-3 items-center">
          <input
            type="number"
            min="1"
            bind:value={roundNumber}
            class="w-24 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm font-bold"
            placeholder="Round #"
          />
          <input
            type="text"
            bind:value={customRoundName}
            class="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm"
            placeholder="Custom name (e.g. Technical Round 2, Shortlist 4)"
          />
        </div>
      {/if}
    </div>

    <div class="mb-6">
      <label for="regnos" class="block text-sm font-semibold text-gray-700 mb-2">
        Register Numbers or Neo IDs (one per line) *
      </label>
      <textarea 
        id="regnos"
        bind:value={regnos}
        placeholder="Enter one Register Number or Neo ID per line:&#10;23BAI1008&#10;O3W3I4P1&#10;A621V0L6"
        rows="10"
        class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono resize-vertical"
      />
      <div class="mt-2 text-sm text-gray-600 space-y-1">
        <p>Enter Register Numbers (e.g. 23BAI1008) or Neo IDs (e.g. O3W3I4P1), one per line.</p>
        <p class="text-xs text-gray-500">
          <strong>Tip:</strong> If a Neo ID is not yet linked to a student, it will automatically be saved into the mapping table for future matching.
        </p>
      </div>
    </div>

    <button 
      on:click={addShortlist}
      class="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
    >
      Add to Shortlist
    </button>

    {#if message}
      <div class="mt-6 p-4 rounded-lg border-l-4 {messageType === 'success' ? 'bg-green-50 border-green-500 text-green-800' : 'bg-red-50 border-red-500 text-red-800'}">
        <p class="font-semibold">{message}</p>
      </div>
    {/if}
  </div>

  <div class="bg-white rounded-lg shadow-md p-6">
    <h3 class="text-xl font-bold text-gray-800 mb-4">ℹ️ Instructions</h3>
    <ul class="space-y-3 text-gray-700">
      <li class="flex items-start">
        <span class="text-primary-600 mr-2">•</span>
        <span>Select an existing company from the dropdown list. (New companies can be created on the <strong>Companies</strong> page)</span>
      </li>
      <li class="flex items-start">
        <span class="text-primary-600 mr-2">•</span>
        <span>Select the Shortlist Round (Shortlist 1, Shortlist 2, etc.) or specify a custom round name</span>
      </li>
      <li class="flex items-start">
        <span class="text-primary-600 mr-2">•</span>
        <span>Paste Register Numbers or Neo IDs of shortlisted candidates (one per line)</span>
      </li>
      <li class="flex items-start">
        <span class="text-primary-600 mr-2">•</span>
        <span>Unmapped Neo IDs are recorded into the database mapping table automatically</span>
      </li>
      <li class="flex items-start">
        <span class="text-primary-600 mr-2">•</span>
        <span>Company analytics update instantly</span>
      </li>
    </ul>
  </div>
</div>
