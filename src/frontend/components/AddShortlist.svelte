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

  let companyRounds: any[] = [];
  let latestRound: any = null;
  let suggestedNextRoundNumber = 1;
  let loadingRounds = false;
  let previousCompanyId = '';

  let availableRoles: any[] = [];
  let selectedRole = '';
  let customRoleName = '';
  let isCustomRole = false;

  $: filteredCompanies = Array.isArray(companies) ? companies.filter(c => {
    if (!companySearchTerm || !companySearchTerm.trim()) return true;
    
    const tokens = companySearchTerm.toLowerCase().trim().split(/\s+/);
    const combinedText = [
      c.name,
      c.ctc,
      c.role,
      c.notes,
      c.round_details,
      c.experience_required,
      c.latest_round_name,
      c.latest_round_number ? `round ${c.latest_round_number}` : '',
      c.rounds ? `${c.rounds} rounds` : '',
      c.total_rounds ? `${c.total_rounds} rounds` : ''
    ].filter(Boolean).join(' ').toLowerCase();

    return tokens.every(token => combinedText.includes(token));
  }) : [];

  // Automatically detect and select the latest shortlist whenever selectedCompanyId changes
  $: if (selectedCompanyId !== previousCompanyId) {
    previousCompanyId = selectedCompanyId;
    if (selectedCompanyId) {
      onCompanySelect(selectedCompanyId);
    } else {
      companyRounds = [];
      latestRound = null;
      suggestedNextRoundNumber = 1;
      roundNumber = 1;
      customRoundName = 'Shortlist 1';
      selectedRole = '';
      customRoleName = '';
      isCustomRole = false;
    }
  }

  onMount(async () => {
    await Promise.all([loadCompanies(), loadRoles()]);
  });

  async function loadRoles() {
    try {
      const response = await fetch('/api/roles');
      if (response.ok) {
        availableRoles = await response.json();
      }
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  }

  async function loadCompanies() {
    try {
      const response = await fetch('/api/companies');
      companies = await response.json();
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  }

  async function onCompanySelect(companyId: string) {
    if (!companyId) return;

    // Instant local preview from enriched companies list
    const comp = companies.find(c => String(c.id) === String(companyId));
    if (comp) {
      if (comp.latest_round_number) {
        roundNumber = comp.latest_round_number;
        customRoundName = comp.latest_round_name || `Shortlist ${comp.latest_round_number}`;
      }
      if (comp.role) {
        selectedRole = comp.role;
        isCustomRole = false;
      }
    }

    loadingRounds = true;
    try {
      const response = await fetch(`/api/companies/${companyId}/shortlist-rounds`);
      if (response.ok) {
        const data = await response.json();
        companyRounds = data.rounds || [];
        latestRound = data.latestRound || null;
        suggestedNextRoundNumber = data.suggestedNextRoundNumber || (latestRound ? latestRound.round_number + 1 : 1);

        if (latestRound) {
          roundNumber = latestRound.round_number;
          customRoundName = latestRound.round_name || `Shortlist ${latestRound.round_number}`;
        } else {
          roundNumber = 1;
          customRoundName = 'Shortlist 1';
        }
      }
    } catch (error) {
      console.error('Error loading company shortlist rounds:', error);
    } finally {
      loadingRounds = false;
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
    const finalRole = isCustomRole ? (customRoleName.trim() || null) : (selectedRole.trim() || null);

    try {
      const response = await fetch(`/api/companies/${selectedCompanyId}/shortlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regnos: regnoList,
          round_number: roundNumber,
          round_name: finalRoundName,
          role: finalRole
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
        const roleLabel = finalRole ? ` for role "${finalRole}"` : '';
        message = `Successfully added ${successCount} student(s) to "${finalRoundName}"${roleLabel}.`;
        if (errorCount > 0) {
          const sampleErrors = result.errors.slice(0, 3).map((e: any) => e.identifier).join(', ');
          message += ` ${errorCount} error(s): Not found in database (${sampleErrors}${errorCount > 3 ? '...' : ''}).`;
        }
        messageType = 'success';
        regnos = '';
        // Refresh company rounds, companies & roles list to reflect updated data
        if (selectedCompanyId) {
          await onCompanySelect(selectedCompanyId);
          await loadCompanies();
          await loadRoles();
        }
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
  <h2 class="text-3xl font-bold text-gray-800 dark:text-gray-300 dark:text-slate-200">📝 Add Students to Company Shortlist</h2>
  
  <div class="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 mb-6">
    <div class="mb-6">
      <label for="company-search" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 dark:text-slate-300 mb-2">
        Select Company *
      </label>
      <div class="space-y-2">
        <input 
          id="company-search"
          type="text" 
          placeholder="🔍 Type to search company by name, CTC, role, or round name..."
          bind:value={companySearchTerm}
          class="w-full px-4 py-2 border-2 border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
        />
        <select 
          id="company" 
          bind:value={selectedCompanyId}
          class="w-full px-4 py-2 border-2 border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
        >
          <option value="">-- Select a company ({filteredCompanies.length} available) --</option>
          {#each filteredCompanies as company}
            <option value={company.id}>
              {company.name} {company.role ? `[Role: ${company.role}]` : ''} {company.ctc ? `(${company.ctc})` : ''} {company.latest_round_name ? `• Latest: ${company.latest_round_name} (Round ${company.latest_round_number})` : ''}
            </option>
          {/each}
        </select>
        <p class="text-xs text-gray-500 dark:text-slate-400">
          Showing {filteredCompanies.length} of {companies.length} companies. New companies can be added from the <strong>Companies</strong> page.
        </p>
      </div>
    </div>

    <!-- Job Role / Profile Selection -->
    <div class="mb-6 bg-slate-50 dark:bg-slate-900/60 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
      <div class="flex items-center justify-between gap-2 mb-2">
        <label for="role-select" class="block text-sm font-bold text-gray-800 dark:text-slate-200">
          💼 Shortlist Job Role / Profile
        </label>
        <button
          type="button"
          class="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
          on:click={() => { isCustomRole = !isCustomRole; }}
        >
          {isCustomRole ? '← Choose from standard roles' : '➕ Type new custom role'}
        </button>
      </div>

      {#if isCustomRole}
        <div class="space-y-2">
          <input
            id="custom-role-input"
            type="text"
            bind:value={customRoleName}
            placeholder="e.g. Associate Software Engineer, AI Research Intern, Cloud Specialist"
            class="w-full px-4 py-2.5 border-2 border-purple-300 dark:border-purple-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-sm font-medium"
          />
          <p class="text-xs text-gray-500 dark:text-slate-400">
            This new role will be automatically saved to your master roles database for future selection and analytics.
          </p>
        </div>
      {:else}
        <div class="space-y-3">
          <select
            id="role-select"
            bind:value={selectedRole}
            class="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-sm font-medium"
          >
            <option value="">-- General / No Specific Role --</option>
            {#each availableRoles as role}
              <option value={role.name}>
                {role.name} {role.category ? `(${role.category})` : ''}
              </option>
            {/each}
          </select>

          <!-- Quick Select Role Pills -->
          {#if availableRoles.length > 0}
            <div class="flex flex-wrap gap-1.5 pt-1">
              {#each availableRoles.slice(0, 8) as role}
                <button
                  type="button"
                  class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border {selectedRole === role.name ? 'bg-purple-600 text-white border-purple-600 shadow-xs' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-purple-300'}"
                  on:click={() => { selectedRole = role.name; isCustomRole = false; }}
                >
                  {role.name}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>


    <!-- Shortlist Round / Stage Selection -->
    <div class="mb-6 bg-purple-50/70 dark:bg-purple-900/30 dark:bg-indigo-950/40 p-5 rounded-xl border border-purple-200 dark:border-indigo-800/80">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span class="block text-sm font-bold text-purple-900 dark:text-purple-300 dark:text-indigo-200">
          Shortlist Round / Stage *
        </span>
        {#if selectedCompanyId}
          {#if loadingRounds}
            <span class="text-xs text-purple-600 dark:text-purple-400 animate-pulse font-medium">Checking latest shortlists...</span>
          {:else if latestRound}
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-900/60 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-600 shadow-sm">
              <span>⚡</span>
              <span>Auto-Selected Latest Shortlist: <strong class="underline">{latestRound.round_name}</strong> (Round {latestRound.round_number})</span>
            </span>
          {:else}
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700">
              <span>✨</span>
              <span>First shortlist for this company (Starting at Round 1)</span>
            </span>
          {/if}
        {/if}
      </div>

      {#if selectedCompanyId && companyRounds.length > 0}
        <!-- Company-Specific Shortlist Rounds with Interactive Pills -->
        <div class="space-y-2 mb-4">
          <div class="text-xs font-semibold text-purple-800 dark:text-purple-300 uppercase tracking-wider">
            Select Shortlist Round for This Company:
          </div>
          <div class="flex flex-wrap gap-2.5">
            {#each companyRounds as round}
              {@const isLatest = latestRound && latestRound.round_number === round.round_number}
              {@const isSelected = roundNumber === round.round_number && customRoundName === round.round_name}
              <button
                type="button"
                class="px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 flex items-center gap-2 border-2 {isSelected ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-400/50' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border-gray-200 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-500'}"
                on:click={() => {
                  roundNumber = round.round_number;
                  customRoundName = round.round_name || `Shortlist ${round.round_number}`;
                }}
              >
                <span>{round.round_name || `Shortlist ${round.round_number}`}</span>
                <span class="px-2 py-0.5 text-xs rounded-full {isSelected ? 'bg-purple-700 text-purple-100' : 'bg-purple-100 dark:bg-slate-700 text-purple-700 dark:text-purple-300 font-bold'}">
                  {round.student_count} {round.student_count === 1 ? 'student' : 'students'}
                </span>
                {#if isLatest}
                  <span class="px-1.5 py-0.5 text-[10px] font-extrabold uppercase rounded bg-amber-400 text-amber-950 shadow-sm" title="Latest shortlist recorded">
                    ★ Latest
                  </span>
                {/if}
              </button>
            {/each}

            <!-- Start Next Round Button -->
            <button
              type="button"
              class="px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 flex items-center gap-1.5 border-2 border-dashed {roundNumber === suggestedNextRoundNumber && (customRoundName === `Shortlist ${suggestedNextRoundNumber}` || customRoundName === '') ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-400/50' : 'bg-purple-50 dark:bg-slate-800/80 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-indigo-700 hover:bg-purple-100 dark:hover:bg-slate-700'}"
              on:click={() => {
                roundNumber = suggestedNextRoundNumber;
                customRoundName = `Shortlist ${suggestedNextRoundNumber}`;
              }}
            >
              <span>➕ Next Round (Round {suggestedNextRoundNumber})</span>
            </button>
          </div>
        </div>
      {:else}
        <!-- Default preset round selector when no company is selected or no rounds exist -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <button
            type="button"
            class="py-2.5 px-4 rounded-lg font-semibold text-sm transition-all border-2 {roundNumber === 1 ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-purple-300'}"
            on:click={() => { roundNumber = 1; if (!customRoundName || customRoundName.startsWith('Shortlist ')) customRoundName = 'Shortlist 1'; }}
          >
            Shortlist 1
          </button>
          <button
            type="button"
            class="py-2.5 px-4 rounded-lg font-semibold text-sm transition-all border-2 {roundNumber === 2 ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-purple-300'}"
            on:click={() => { roundNumber = 2; if (!customRoundName || customRoundName.startsWith('Shortlist ')) customRoundName = 'Shortlist 2'; }}
          >
            Shortlist 2
          </button>
          <button
            type="button"
            class="py-2.5 px-4 rounded-lg font-semibold text-sm transition-all border-2 {roundNumber === 3 ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-purple-300'}"
            on:click={() => { roundNumber = 3; if (!customRoundName || customRoundName.startsWith('Shortlist ')) customRoundName = 'Shortlist 3'; }}
          >
            Shortlist 3
          </button>
          <button
            type="button"
            class="py-2.5 px-4 rounded-lg font-semibold text-sm transition-all border-2 {roundNumber >= 4 ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-purple-300'}"
            on:click={() => { if (roundNumber < 4) roundNumber = 4; if (!customRoundName || customRoundName.startsWith('Shortlist ')) customRoundName = `Shortlist ${roundNumber}`; }}
          >
            Custom / Next Round
          </button>
        </div>
      {/if}

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-center pt-3 border-t border-purple-200 dark:border-indigo-800/60">
        <div>
          <label for="round-num" class="block text-xs font-bold text-purple-900 dark:text-purple-300 dark:text-indigo-200 uppercase mb-1">Round Index (#)</label>
          <input
            id="round-num"
            type="number"
            min="1"
            bind:value={roundNumber}
            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm font-bold text-gray-900 dark:text-slate-100"
            placeholder="Round #"
          />
        </div>
        <div class="md:col-span-2">
          <label for="custom-round-name" class="block text-xs font-bold text-purple-900 dark:text-purple-300 dark:text-indigo-200 uppercase mb-1">Custom Shortlist / Round Name *</label>
          <input
            id="custom-round-name"
            type="text"
            bind:value={customRoundName}
            class="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-slate-100"
            placeholder="e.g. Shortlist 1, Technical OA, Coding Assessment, Interview Round 2"
          />
        </div>
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
          <p class="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/40 dark:bg-indigo-950/40 p-2 rounded border border-purple-200 dark:border-indigo-800 inline-block mt-1">
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
