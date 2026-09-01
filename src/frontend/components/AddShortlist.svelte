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
  let showRoleSelector = false;
  let roleSearchTerm = '';

  $: filteredRoles = Array.isArray(availableRoles) ? availableRoles.filter(r => {
    if (!roleSearchTerm || !roleSearchTerm.trim()) return true;
    const term = roleSearchTerm.toLowerCase().trim();
    return (r.name && r.name.toLowerCase().includes(term)) || (r.category && r.category.toLowerCase().includes(term));
  }) : [];

  $: isExactRoleMatch = Array.isArray(availableRoles) && availableRoles.some(r => r.name.toLowerCase().trim() === roleSearchTerm.toLowerCase().trim());

  $: selectedCompany = Array.isArray(companies) ? companies.find(c => String(c.id) === String(selectedCompanyId)) || null : null;

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

    const comp = companies.find(c => String(c.id) === String(companyId));
    if (comp) {
      if (comp.latest_round_number) {
        roundNumber = comp.latest_round_number;
        customRoundName = comp.latest_round_name || `Shortlist ${comp.latest_round_number}`;
      }
      // Shortlists default to No Role (role is assigned strictly on final placement)
      selectedRole = '';
      customRoleName = '';
      isCustomRole = false;
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
    if (!selectedCompanyId) {
      message = 'Please select a company';
      messageType = 'error';
      return;
    }

    const identifiersList = extractCleanTokens(regnos);

    if (identifiersList.length === 0) {
      message = 'Please enter at least one valid Register Number or Neo ID';
      messageType = 'error';
      return;
    }

    const finalRole = isCustomRole ? customRoleName.trim() : selectedRole;
    const finalRoundName = customRoundName.trim() || `Shortlist ${roundNumber}`;

    try {
      const response = await fetch(`/api/companies/${selectedCompanyId}/shortlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regnos: identifiersList,
          round_number: roundNumber,
          round_name: finalRoundName,
          role: finalRole
        })
      });

      const result = await response.json();
      const successCount = result.results ? result.results.filter((r: any) => r.success).length : 0;
      const errorCount = result.errors ? result.errors.length : 0;
      
      if (successCount > 0) {
        const roleLabel = finalRole ? ` for role "${finalRole}"` : '';
        message = `✅ Successfully added ${successCount} student(s) to "${finalRoundName}"${roleLabel}.`;
        if (errorCount > 0) {
          const sampleErrors = result.errors.slice(0, 3).map((e: any) => e.identifier).join(', ');
          message += ` ${errorCount} candidate(s) not found (${sampleErrors}${errorCount > 3 ? '...' : ''}).`;
        }
        messageType = 'success';
        regnos = '';
        if (selectedCompanyId) {
          await onCompanySelect(selectedCompanyId);
          await loadCompanies();
          await loadRoles();
        }
      } else if (errorCount > 0) {
        const sampleErrors = result.errors.slice(0, 3).map((e: any) => e.identifier).join(', ');
        message = `❌ Failed to add candidates. ${errorCount} not found: (${sampleErrors}${errorCount > 3 ? '...' : ''}).`;
        messageType = 'error';
      } else {
        message = 'No candidate identifiers processed.';
        messageType = 'error';
      }
    } catch (error: any) {
      message = `❌ Network Error: ${error.message}`;
      messageType = 'error';
    }

    setTimeout(() => { message = ''; }, 6000);
  }
</script>

<div class="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
  
  <!-- Header -->
  <div class="neon-card p-5 sm:p-6 space-y-1">
    <div class="flex items-center gap-2">
      <span class="text-xl">📝</span>
      <h1 class="text-xl sm:text-2xl font-display font-extrabold text-white tracking-tight">
        Add Candidates to Company Shortlist
      </h1>
    </div>
    <p class="text-xs sm:text-sm text-slate-400 font-medium">
      Upload multi-round shortlists by Registration Numbers or Neo IDs with automated role & stage binding.
    </p>
  </div>

  {#if message}
    <div class="p-3.5 rounded-xl text-xs sm:text-sm font-mono font-semibold border {messageType === 'error' ? 'bg-rose-950/40 text-rose-300 border-rose-800' : 'bg-[#BBF351]/10 text-[#BBF351] border-[#BBF351]/30'}">
      {message}
    </div>
  {/if}

  <!-- Main Form Card -->
  <div class="neon-card p-5 sm:p-7 space-y-5">
    
    <!-- Company Selection (Mobile-Responsive & Non-Clipping) -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <label for="company-search" class="block text-xs font-mono font-bold uppercase text-zinc-400">
          Select Recruiting Partner *
        </label>
        {#if selectedCompanyId}
          <button
            type="button"
            class="text-[11px] font-mono text-[#a3e635] hover:underline cursor-pointer"
            on:click={() => { selectedCompanyId = ''; companySearchTerm = ''; }}
          >
            Change Company ✕
          </button>
        {/if}
      </div>

      {#if selectedCompany}
        <!-- Selected Company Active Card -->
        <div class="p-3.5 sm:p-4 rounded-xl bg-zinc-900/90 border border-[#a3e635]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm sm:text-base font-display font-bold text-white tracking-tight break-words">
                {selectedCompany.name}
              </span>
              {#if selectedCompany.ctc}
                <span class="neon-badge-lime px-2 py-0.5 rounded text-[10px] font-mono font-bold whitespace-nowrap">
                  💰 {selectedCompany.ctc}
                </span>
              {/if}
              {#if selectedCompany.category}
                <span class="neon-badge-purple px-2 py-0.5 rounded text-[10px] font-mono">
                  {selectedCompany.category}
                </span>
              {/if}
            </div>
            {#if selectedCompany.role}
              <p class="text-xs font-mono text-[#38bdf8] mt-1 truncate">
                💼 {selectedCompany.role}
              </p>
            {/if}
            {#if selectedCompany.latest_round_name}
              <p class="text-[11px] font-mono text-zinc-400 mt-0.5">
                Latest Stage: <span class="text-zinc-200 font-semibold">{selectedCompany.latest_round_name}</span>
              </p>
            {/if}
          </div>

          <button
            type="button"
            on:click={() => { selectedCompanyId = ''; companySearchTerm = ''; }}
            class="neon-btn-ghost px-3.5 py-1.5 rounded-xl text-xs font-mono font-medium self-start sm:self-center shrink-0 touch-press"
          >
            Switch
          </button>
        </div>
      {:else}
        <!-- Search Input & Quick Select List -->
        <div class="space-y-2">
          <div class="relative">
            <input 
              id="company-search"
              type="text" 
              placeholder="🔍 Search company by name, CTC, or role..."
              bind:value={companySearchTerm}
              class="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm pr-8"
            />
            {#if companySearchTerm}
              <button
                type="button"
                on:click={() => companySearchTerm = ''}
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-xs p-1"
                aria-label="Clear search"
              >
                ✕
              </button>
            {/if}
          </div>

          <!-- Quick Select Scrollable Container (Clips-safe, touch friendly on phone) -->
          <div class="max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-zinc-950 divide-y divide-white/[0.06] shadow-lg">
            {#if filteredCompanies.length === 0}
              <div class="p-4 text-center text-xs font-mono text-zinc-500">
                No company matching "{companySearchTerm}"
              </div>
            {:else}
              {#each filteredCompanies.slice(0, 30) as company}
                <button
                  type="button"
                  class="w-full text-left p-3 hover:bg-white/[0.05] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 touch-press cursor-pointer"
                  on:click={() => { selectedCompanyId = String(company.id); companySearchTerm = ''; }}
                >
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-xs sm:text-sm font-bold text-zinc-100">{company.name}</span>
                      {#if company.ctc}
                        <span class="neon-badge-lime px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold">
                          {company.ctc}
                        </span>
                      {/if}
                    </div>
                    {#if company.role}
                      <p class="text-[11px] font-mono text-[#38bdf8] truncate mt-0.5">{company.role}</p>
                    {/if}
                  </div>
                  {#if company.latest_round_name}
                    <span class="text-[10px] font-mono text-zinc-400 shrink-0 self-start sm:self-center">
                      {company.latest_round_name}
                    </span>
                  {/if}
                </button>
              {/each}
              {#if filteredCompanies.length > 30}
                <div class="p-2 text-center text-[10px] font-mono text-zinc-500 bg-zinc-900/50">
                  Showing 30 of {filteredCompanies.length} companies. Type to search more.
                </div>
              {/if}
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <!-- Role Selection (Non-Clipping Search & Create Combo Box) -->
    <div class="p-3.5 sm:p-4 rounded-xl bg-zinc-900/80 border border-white/[0.08] space-y-3">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="min-w-0 flex-1">
          <span class="text-[10px] font-mono font-semibold uppercase text-zinc-400 block mb-0.5">
            Role Tag (Optional)
          </span>
          <div class="flex items-center gap-1.5 flex-wrap">
            {#if isCustomRole && customRoleName.trim()}
              <span class="neon-badge-lime px-2 py-0.5 rounded text-xs font-mono font-semibold truncate max-w-full">
                💼 {customRoleName.trim()} (Custom)
              </span>
            {:else if selectedRole}
              <span class="neon-badge-cyan px-2 py-0.5 rounded text-xs font-mono font-semibold truncate max-w-full">
                💼 {selectedRole}
              </span>
            {:else}
              <span class="text-xs font-mono text-zinc-400">
                No Role / Qualifier Stage (Default)
              </span>
            {/if}
          </div>
        </div>

        <button
          type="button"
          class="neon-btn-ghost px-3 py-1.5 rounded-lg text-xs font-mono font-medium shrink-0 touch-press cursor-pointer"
          on:click={() => { showRoleSelector = !showRoleSelector; roleSearchTerm = ''; }}
        >
          {showRoleSelector ? '✕ Done' : (selectedRole || (isCustomRole && customRoleName) ? '✏️ Change Role' : '+ Search / Custom Role')}
        </button>
      </div>

      {#if showRoleSelector}
        <div class="pt-3 border-t border-white/[0.08] space-y-2.5 animate-in fade-in duration-150">
          <div class="relative">
            <input
              id="role-search-input"
              type="text"
              bind:value={roleSearchTerm}
              placeholder="🔍 Search role (e.g. SDE, AI Intern, Technical Analyst)..."
              class="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm pr-8 font-sans"
            />
            {#if roleSearchTerm}
              <button
                type="button"
                on:click={() => roleSearchTerm = ''}
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-xs p-1"
                aria-label="Clear role search"
              >
                ✕
              </button>
            {/if}
          </div>

          <!-- Role Suggestions & Custom Creation List (Clips-proof scroll container) -->
          <div class="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-zinc-950 divide-y divide-white/[0.06] shadow-lg">
            
            <!-- Custom role option if typed query is not an exact match -->
            {#if roleSearchTerm.trim() && !isExactRoleMatch}
              <button
                type="button"
                class="w-full text-left p-2.5 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 text-[#a3e635] text-xs font-mono font-bold flex items-center justify-between gap-2 touch-press cursor-pointer transition-colors"
                on:click={() => {
                  selectedRole = roleSearchTerm.trim();
                  isCustomRole = true;
                  customRoleName = roleSearchTerm.trim();
                  roleSearchTerm = '';
                  showRoleSelector = false;
                }}
              >
                <div class="min-w-0 flex-1 truncate">
                  <span>✨ Use new custom role: </span>
                  <span class="underline">"{roleSearchTerm.trim()}"</span>
                </div>
                <span class="text-[10px] uppercase font-semibold shrink-0">Select ➔</span>
              </button>
            {/if}

            <!-- Reset / Default Option -->
            <button
              type="button"
              class="w-full text-left p-2.5 text-zinc-400 hover:text-white hover:bg-white/[0.04] text-xs font-mono transition-colors cursor-pointer"
              on:click={() => {
                selectedRole = '';
                isCustomRole = false;
                customRoleName = '';
                roleSearchTerm = '';
                showRoleSelector = false;
              }}
            >
              -- No Role / Round Qualifier (Default) --
            </button>

            <!-- Filtered Standard Roles List -->
            {#each filteredRoles.slice(0, 20) as role}
              <button
                type="button"
                class="w-full text-left p-2.5 hover:bg-white/[0.05] transition-colors flex items-center justify-between gap-2 touch-press cursor-pointer"
                on:click={() => {
                  selectedRole = role.name;
                  isCustomRole = false;
                  customRoleName = '';
                  roleSearchTerm = '';
                  showRoleSelector = false;
                }}
              >
                <span class="text-xs font-medium text-zinc-200 truncate">{role.name}</span>
                {#if role.category}
                  <span class="neon-badge-purple px-1.5 py-0.2 rounded text-[10px] font-mono shrink-0">
                    {role.category}
                  </span>
                {/if}
              </button>
            {/each}

            {#if filteredRoles.length === 0 && !roleSearchTerm.trim()}
              <div class="p-3 text-center text-xs font-mono text-zinc-500">
                Type in search box above to search or create a role.
              </div>
            {/if}
          </div>

          <p class="text-[11px] text-zinc-500 font-normal">
            Shortlists default to no role. The official job role is assigned upon final placement.
          </p>
        </div>
      {/if}
    </div>

    <!-- Round / Stage Selection -->
    <div class="bg-[#080C14] p-4 rounded-xl border border-slate-800 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-xs font-mono font-bold uppercase text-[#BBF351]">
          ⚡ Shortlist Round / Stage
        </span>
        {#if latestRound}
          <span class="neon-badge-lime px-2 py-0.5 rounded text-[10px] font-mono font-bold">
            Latest: {latestRound.round_name}
          </span>
        {/if}
      </div>

      {#if selectedCompanyId && companyRounds.length > 0}
        <div class="flex flex-wrap gap-2">
          {#each companyRounds as round}
            {@const isSelected = roundNumber === round.round_number && customRoundName === round.round_name}
            <button
              type="button"
              class="px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all border touch-press
                {isSelected ? 'neon-badge-lime border-[#BBF351]' : 'bg-slate-800/80 text-slate-300 border-slate-700'}"
              on:click={() => {
                roundNumber = round.round_number;
                customRoundName = round.round_name || `Shortlist ${round.round_number}`;
              }}
            >
              <span>{round.round_name || `Shortlist ${round.round_number}`}</span>
              <span class="ml-1 opacity-75">({round.student_count})</span>
            </button>
          {/each}

          <button
            type="button"
            class="px-3 py-2 rounded-xl text-xs font-mono font-bold neon-btn-ghost border-dashed border-[#00BCFF]/50 text-[#00BCFF] touch-press"
            on:click={() => {
              roundNumber = suggestedNextRoundNumber;
              customRoundName = `Shortlist ${suggestedNextRoundNumber}`;
            }}
          >
            ➕ Next (Round {suggestedNextRoundNumber})
          </button>
        </div>
      {/if}

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800/80">
        <div>
          <label for="round-num" class="block text-[10px] font-mono uppercase text-slate-400 mb-1">Round Index</label>
          <input id="round-num" type="number" min="1" bind:value={roundNumber} class="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold" />
        </div>
        <div class="sm:col-span-2">
          <label for="custom-round-name" class="block text-[10px] font-mono uppercase text-slate-400 mb-1">Stage Name *</label>
          <input id="custom-round-name" type="text" bind:value={customRoundName} placeholder="e.g. Technical OA, Interview 1" class="w-full px-3 py-2 rounded-xl text-xs font-sans font-semibold" />
        </div>
      </div>
    </div>

    <!-- Candidate Registration Numbers Input -->
    <div>
      <div class="flex items-center justify-between mb-1.5">
        <label for="regnos" class="text-xs font-mono font-bold uppercase text-slate-400">
          Candidate Identifiers (Reg No / Neo ID) *
        </label>
        {#if detectedTokens.length > 0}
          <span class="neon-badge-lime px-2 py-0.5 rounded text-[10px] font-mono font-bold">
            {detectedTokens.length} Detected
          </span>
        {/if}
      </div>

      <textarea 
        id="regnos"
        bind:value={regnos}
        placeholder="Paste candidate IDs here (one per line):&#10;23BCE1087&#10;O3W3I4P1&#10;23BAI1008"
        rows="8"
        class="w-full px-4 py-3 rounded-xl font-mono text-xs text-white"
      />
    </div>

    <button 
      on:click={addShortlist}
      class="w-full py-3.5 neon-btn-primary rounded-xl text-xs font-bold uppercase tracking-wider touch-press"
    >
      💾 Process & Save Shortlist
    </button>
  </div>

  <!-- Instructions Bento Card -->
  <div class="neon-card p-5 space-y-2 text-xs font-sans text-slate-300">
    <h2 class="text-xs font-mono font-bold uppercase text-[#BBF351] tracking-wider mb-2 flex items-center gap-1.5">
      <span>ℹ️</span> Shortlist Ingestion Guidelines
    </h2>
    <ul class="space-y-1.5 list-disc list-inside text-slate-400">
      <li>Accepts both VIT Register Numbers (e.g. <strong class="text-slate-200">23BCE1087</strong>) and Master Neo IDs (e.g. <strong class="text-slate-200">O3W3I4P1</strong>).</li>
      <li>Headers and summary rows like "Neo ID", "Registration No", or "Student Name" are automatically filtered.</li>
      <li>All company shortlists and candidate timelines synchronize immediately across the analytics dashboard.</li>
    </ul>
  </div>

</div>
