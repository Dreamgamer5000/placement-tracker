<script lang="ts">
  import { onMount } from 'svelte';

  let companies: any[] = [];
  let companySearchTerm = '';
  let selectedCompanyId = '';
  let regnos = '';
  let roundNumber = 1;
  let customRoundName = '';
  let message = '';
  let messageType: 'success' | 'error' = 'success';

  $: filteredCompanies = Array.isArray(companies) ? companies.filter(c => {
    if (!companySearchTerm || !companySearchTerm.trim()) return true;
    
    const tokens = companySearchTerm.toLowerCase().trim().split(/\s+/);
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

  const HEADER_WORDS = new Set([
    'NEO', 'ID', 'NEOID', 'NEOIDS', 'REGNO', 'REGNOS', 'REGISTER', 'REGISTRATION', 
    'NUMBER', 'NUMBERS', 'NAME', 'NAMES', 'STATUS', 'STATE', 'SERIAL', 'SL', 'NO', 
    'SNO', 'S.NO', 'SELECTED', 'PLACED', 'INTERN', 'OFFER', 'TYPE', 'GENDER', 'BRANCH', 'CAMPUS'
  ]);

  function extractCleanTokens(input: string): string[] {
    if (!input || !input.trim()) return [];
    const rawTokens = input.split(/[\s,;\t\r\n]+/);
    const result: string[] = [];
    const seen = new Set<string>();

    for (let token of rawTokens) {
      token = token.trim().replace(/^\d+[\.\)]/, '').trim();
      if (!token) continue;
      const upper = token.toUpperCase();
      if (HEADER_WORDS.has(upper)) continue;
      if (!/^[A-Z0-9]{5,20}$/i.test(upper)) continue;
      if (!seen.has(upper)) {
        seen.add(upper);
        result.push(upper);
      }
    }
    return result;
  }

  $: detectedTokens = extractCleanTokens(regnos);

  async function addShortlist() {
    if (!selectedCompanyId || !regnos.trim()) {
      message = 'Please select a company and enter registration numbers';
      messageType = 'error';
      return;
    }

    const regnoList = detectedTokens;

    if (regnoList.length === 0) {
      message = 'Please enter at least one valid registration number or Neo ID';
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
          const sampleErrors = result.errors.slice(0, 3).map((e: any) => e.identifier).join(', ');
          message += ` ${errorCount} error(s): Not found in database (${sampleErrors}${errorCount > 3 ? '...' : ''}).`;
        }
        messageType = 'success';
        regnos = '';
      } else if (errorCount > 0) {
        const sampleErrors = result.errors.slice(0, 3).map((e: any) => e.identifier).join(', ');
        message = `Failed to add students. ${errorCount} registration number(s) / Neo ID(s) not found in database: (${sampleErrors}${errorCount > 3 ? '...' : ''}).`;
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
    }, 6000);
  }
</script>

<div class="p-8 max-w-[1600px] mx-auto space-y-8">
  <h2 class="text-3xl font-bold text-gray-800">📝 Add Students to Company Shortlist</h2>
  
  <div class="bg-white rounded-lg shadow-md p-6 mb-6">
    <div class="mb-6">
      <label for="company-search" class="block text-sm font-semibold text-gray-700 mb-2">
        Select Company *
      </label>
      <div class="space-y-2">
        <input 
          id="company-search"
          type="text" 
          placeholder="🔍 Type to search company by name, CTC, or text..."
          bind:value={companySearchTerm}
          class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
        />
        <select 
          id="company" 
          bind:value={selectedCompanyId}
          class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">-- Select a company ({filteredCompanies.length} available) --</option>
          {#each filteredCompanies as company}
            <option value={company.id}>{company.name} {company.ctc ? `(${company.ctc})` : ''}</option>
          {/each}
        </select>
        <p class="text-xs text-gray-500">
          Showing {filteredCompanies.length} of {companies.length} companies. New companies can be added from the <strong>Companies</strong> page.
        </p>
      </div>
    </div>
    <!-- Shortlist Round / Stage Selection -->
    <div class="mb-6 bg-purple-50/70 p-4 rounded-xl border border-purple-200">
      <span class="block text-sm font-bold text-purple-900 mb-2">
        Shortlist Round / Stage *
      </span>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <button
          type="button"
          class="py-2.5 px-4 rounded-lg font-semibold text-sm transition-all border-2 {roundNumber === 1 ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'}"
          on:click={() => { roundNumber = 1; if (!customRoundName || customRoundName.startsWith('Shortlist ')) customRoundName = 'Shortlist 1'; }}
        >
          Shortlist 1
        </button>
        <button
          type="button"
          class="py-2.5 px-4 rounded-lg font-semibold text-sm transition-all border-2 {roundNumber === 2 ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'}"
          on:click={() => { roundNumber = 2; if (!customRoundName || customRoundName.startsWith('Shortlist ')) customRoundName = 'Shortlist 2'; }}
        >
          Shortlist 2
        </button>
        <button
          type="button"
          class="py-2.5 px-4 rounded-lg font-semibold text-sm transition-all border-2 {roundNumber === 3 ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'}"
          on:click={() => { roundNumber = 3; if (!customRoundName || customRoundName.startsWith('Shortlist ')) customRoundName = 'Shortlist 3'; }}
        >
          Shortlist 3
        </button>
        <button
          type="button"
          class="py-2.5 px-4 rounded-lg font-semibold text-sm transition-all border-2 {roundNumber >= 4 ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'}"
          on:click={() => { if (roundNumber < 4) roundNumber = 4; if (!customRoundName || customRoundName.startsWith('Shortlist ')) customRoundName = `Shortlist ${roundNumber}`; }}
        >
          Custom / Next Round
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-center pt-3 border-t border-purple-200/60">
        <div>
          <label for="round-num" class="block text-xs font-bold text-purple-900 uppercase mb-1">Round Index (#)</label>
          <input
            id="round-num"
            type="number"
            min="1"
            bind:value={roundNumber}
            class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm font-bold"
            placeholder="Round #"
          />
        </div>
        <div class="md:col-span-2">
          <label for="custom-round-name" class="block text-xs font-bold text-purple-900 uppercase mb-1">Custom Shortlist / Round Name *</label>
          <input
            id="custom-round-name"
            type="text"
            bind:value={customRoundName}
            class="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm"
            placeholder="e.g. Shortlist 1, Technical OA, Coding Assessment, Interview Round 2"
          />
        </div>
      </div>
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
        <p>Enter Register Numbers (e.g. 23BAI1008) or Neo IDs (e.g. O3W3I4P1). Paste entire single lines or lists with names/headers — headers like "Neo ID" are automatically filtered out.</p>
        {#if detectedTokens.length > 0}
          <p class="text-xs font-semibold text-purple-700 bg-purple-50 p-2 rounded border border-purple-200 inline-block mt-1">
            🔍 Detected {detectedTokens.length} candidate identifier(s): {detectedTokens.slice(0, 5).join(', ')}{detectedTokens.length > 5 ? '...' : ''}
          </p>
        {/if}
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
