<script lang="ts">
  import { onMount } from 'svelte';

  let companies: any[] = [];
  let companySearchTerm = '';
  let selectedCompanyId = '';
  let regnos = '';
  let offerStatus: 'placed' | 'intern' = 'placed';
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

  async function addSelections() {
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

    try {
      const response = await fetch(`/api/companies/${selectedCompanyId}/selections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regnos: regnoList,
          status: offerStatus
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
      
      const statusLabel = offerStatus === 'intern' ? 'Intern' : 'Placed (Full-Time)';
      if (successCount > 0) {
        message = `Successfully added ${successCount} student(s) to final selections as "${statusLabel}".`;
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
      message = 'Error adding students to selections';
      messageType = 'error';
      console.error('Error:', error);
    }

    setTimeout(() => {
      message = '';
    }, 6000);
  }
</script>

<div class="p-8 max-w-[1600px] mx-auto space-y-8">
  <h2 class="text-3xl font-bold text-gray-800 dark:text-gray-300 dark:text-slate-200">✅ Add Final Selections</h2>
  
  <div class="bg-blue-50 dark:bg-blue-900/40 border-l-4 border-blue-500 p-4 mb-6 rounded-r-lg">
    <div class="flex">
      <div class="flex-shrink-0">
        <svg class="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
        </svg>
      </div>
      <div class="ml-3">
        <p class="text-sm text-blue-800 dark:text-blue-300">
          <strong>Note:</strong> Use this to add students who received <strong>final selection/offer</strong> from the company.
        </p>
      </div>
    </div>
  </div>
  
  <div class="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 mb-6">
    <div class="mb-6">
      <label for="company-search" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 dark:text-slate-300 mb-2">
        Select Company *
      </label>
      <div class="space-y-2">
        <input 
          id="company-search"
          type="text" 
          placeholder="🔍 Type to search company by name, CTC, or text..."
          bind:value={companySearchTerm}
          class="w-full px-4 py-2 border-2 border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
        />
        <select 
          id="company" 
          bind:value={selectedCompanyId}
          class="w-full px-4 py-2 border-2 border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">-- Select a company ({filteredCompanies.length} available) --</option>
          {#each filteredCompanies as company}
            <option value={company.id}>{company.name} {company.ctc ? `(${company.ctc})` : ''}</option>
          {/each}
        </select>
        <p class="text-xs text-gray-500 dark:text-slate-400">
          Showing {filteredCompanies.length} of {companies.length} companies. New companies can be added from the <strong>Companies</strong> page.
        </p>
      </div>
    </div>

    <!-- Offer Type Selector -->
    <div class="mb-6 bg-blue-50/70 dark:bg-blue-900/40 p-4 rounded-xl border border-blue-200">
      <span class="block text-sm font-bold text-blue-900 dark:text-blue-300 mb-2">
        Offer / Selection Type *
      </span>
      <div class="grid grid-cols-2 gap-3">
        <button
          type="button"
          class="py-2.5 px-4 rounded-lg font-semibold text-sm transition-all border-2 {offerStatus === 'placed' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-blue-300'}"
          on:click={() => offerStatus = 'placed'}
        >
          ✓ Placed (Full-Time)
        </button>
        <button
          type="button"
          class="py-2.5 px-4 rounded-lg font-semibold text-sm transition-all border-2 {offerStatus === 'intern' ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-blue-300'}"
          on:click={() => offerStatus = 'intern'}
        >
          💼 Intern (Internship)
        </button>
      </div>
    </div>

    <div class="mb-6">
      <label for="regnos" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 dark:text-slate-300 mb-2">
        Register Numbers or Neo IDs (one per line) *
      </label>
      <textarea 
        id="regnos"
        bind:value={regnos}
        placeholder="Enter one Register Number or Neo ID per line:&#10;23BAI1008&#10;O3W3I4P1&#10;A621V0L6"
        rows="10"
        class="w-full px-4 py-3 border-2 border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono resize-vertical"
      />
      <div class="mt-2 text-sm text-gray-600 dark:text-slate-400 space-y-1">
        <p>Enter Register Numbers (e.g. 23BAI1008) or Neo IDs (e.g. O3W3I4P1). Paste entire single lines or lists with names/headers — headers like "Neo ID" are automatically filtered out.</p>
        {#if detectedTokens.length > 0}
          <p class="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 p-2 rounded border border-blue-200 inline-block mt-1">
            🔍 Detected {detectedTokens.length} candidate identifier(s): {detectedTokens.slice(0, 5).join(', ')}{detectedTokens.length > 5 ? '...' : ''}
          </p>
        {/if}
      </div>
    </div>

    <button 
      on:click={addSelections}
      class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
    >
      Add to Final Selections
    </button>

    {#if message}
      <div class="mt-6 p-4 rounded-lg border-l-4 {messageType === 'success' ? 'bg-green-50 dark:bg-green-900/40 border-green-500 text-green-800 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/40 border-red-500 text-red-800 dark:text-red-300'}">
        <p class="font-semibold">{message}</p>
      </div>
    {/if}
  </div>

  <div class="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
    <h3 class="text-xl font-bold text-gray-800 dark:text-gray-300 dark:text-slate-200 mb-4">ℹ️ Instructions</h3>
    <ul class="space-y-3 text-gray-700 dark:text-gray-300 dark:text-slate-300">
      <li class="flex items-start">
        <span class="text-primary-600 mr-2">•</span>
        <span>Select an existing company from the dropdown list. (New companies can be created on the <strong>Companies</strong> page)</span>
      </li>
      <li class="flex items-start">
        <span class="text-primary-600 mr-2">•</span>
        <span>Select the Offer Type (Full-Time Placed vs Internship)</span>
      </li>
      <li class="flex items-start">
        <span class="text-primary-600 mr-2">•</span>
        <span>Paste Register Numbers or Neo IDs of selected candidates (one per line)</span>
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
