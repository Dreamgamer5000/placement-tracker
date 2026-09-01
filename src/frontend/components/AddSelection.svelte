<script lang="ts">
  import { onMount } from 'svelte';

  let companies: any[] = [];
  let companySearchTerm = '';
  let selectedCompanyId = '';
  let regnos = '';
  let offerStatus: 'placed' | 'intern' = 'placed';
  let message = '';
  let messageType: 'success' | 'error' = 'success';

  let availableRoles: any[] = [];
  let selectedRole = '';
  let customRoleName = '';
  let isCustomRole = false;
  let showRoleSelector = false;
  let roleSearchTerm = '';
  let previousCompanyId = '';

  $: filteredRoles = Array.isArray(availableRoles) ? availableRoles.filter(r => {
    if (!roleSearchTerm || !roleSearchTerm.trim()) return true;
    const term = roleSearchTerm.toLowerCase().trim();
    return (r.name && r.name.toLowerCase().includes(term)) || (r.category && r.category.toLowerCase().includes(term));
  }) : [];

  $: isExactRoleMatch = Array.isArray(availableRoles) && availableRoles.some(r => r.name.toLowerCase().trim() === roleSearchTerm.toLowerCase().trim());

  function applyCustomRole(roleName: string) {
    if (!roleName || !roleName.trim()) return;
    const trimmed = roleName.trim();
    selectedRole = trimmed;
    customRoleName = trimmed;
    isCustomRole = true;
    roleSearchTerm = '';
    showRoleSelector = false;
  }

  function selectStandardRole(roleName: string) {
    selectedRole = roleName;
    customRoleName = '';
    isCustomRole = false;
    roleSearchTerm = '';
    showRoleSelector = false;
  }

  function clearRole() {
    selectedRole = '';
    customRoleName = '';
    isCustomRole = false;
    roleSearchTerm = '';
    showRoleSelector = false;
  }

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
      c.rounds ? `${c.rounds} rounds` : '',
      c.total_rounds ? `${c.total_rounds} rounds` : ''
    ].filter(Boolean).join(' ').toLowerCase();

    return tokens.every(token => combinedText.includes(token));
  }) : [];

  $: if (selectedCompanyId !== previousCompanyId) {
    previousCompanyId = selectedCompanyId;
    if (selectedCompanyId) {
      const comp = companies.find(c => String(c.id) === String(selectedCompanyId));
      if (comp && comp.role) {
        selectedRole = comp.role;
        isCustomRole = false;
      }
    } else {
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

    const finalRole = isCustomRole ? (customRoleName.trim() || null) : (selectedRole.trim() || null);

    try {
      const response = await fetch(`/api/companies/${selectedCompanyId}/selections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regnos: regnoList,
          status: offerStatus,
          role: finalRole
        })
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        message = 'Server error: Expected JSON response';
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
      
      const statusLabel = offerStatus === 'intern' ? 'Internship' : 'Full-Time Placed';
      const roleLabel = finalRole ? ` as "${finalRole}"` : '';
      if (successCount > 0) {
        message = `✅ Successfully added ${successCount} student(s) as "${statusLabel}"${roleLabel}.`;
        if (errorCount > 0) {
          const sampleErrors = result.errors.slice(0, 3).map((e: any) => e.identifier).join(', ');
          message += ` ${errorCount} candidate(s) not found (${sampleErrors}${errorCount > 3 ? '...' : ''}).`;
        }
        messageType = 'success';
        regnos = '';
        await loadRoles();
      } else if (errorCount > 0) {
        const sampleErrors = result.errors.slice(0, 3).map((e: any) => e.identifier).join(', ');
        message = `❌ Failed: ${errorCount} candidate(s) not found: (${sampleErrors}${errorCount > 3 ? '...' : ''}).`;
        messageType = 'error';
      } else {
        message = 'No candidate records processed.';
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
      <span class="text-xl">✅</span>
      <h1 class="text-xl sm:text-2xl font-display font-extrabold text-white tracking-tight">
        Add Final Offers & Selections
      </h1>
    </div>
    <p class="text-xs sm:text-sm text-slate-400 font-medium">
      Record confirmed full-time offers or verified internship placements with direct analytics attribution.
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
                💼 Default Role: {selectedCompany.role}
              </p>
            {/if}
            {#if selectedCompany.job_location}
              <p class="text-[11px] font-mono text-zinc-400 mt-0.5">
                📍 {selectedCompany.job_location}
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
              placeholder="🔍 Search company by name, CTC, or text..."
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
                  {#if company.job_location}
                    <span class="text-[10px] font-mono text-zinc-400 shrink-0 self-start sm:self-center">
                      {company.job_location}
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

    <!-- Offer Type Selector -->
    <div class="bg-[#080C14] p-4 rounded-xl border border-slate-800 space-y-2.5">
      <span class="block text-xs font-mono font-bold uppercase text-[#BBF351]">
        Offer / Selection Type *
      </span>
      <div class="grid grid-cols-2 gap-3">
        <button
          type="button"
          class="py-2.5 px-4 rounded-xl font-mono font-bold text-xs transition-all border touch-press
            {offerStatus === 'placed' 
              ? 'neon-badge-lime border-[#BBF351] shadow-[0_0_15px_rgba(187,243,81,0.2)]' 
              : 'bg-slate-800/80 text-slate-400 border-slate-700'}"
          on:click={() => offerStatus = 'placed'}
        >
          ✓ Full-Time Placed
        </button>
        <button
          type="button"
          class="py-2.5 px-4 rounded-xl font-mono font-bold text-xs transition-all border touch-press
            {offerStatus === 'intern' 
              ? 'neon-badge-cyan border-[#00BCFF] shadow-[0_0_15px_rgba(0,188,255,0.2)]' 
              : 'bg-slate-800/80 text-slate-400 border-slate-700'}"
          on:click={() => offerStatus = 'intern'}
        >
          💼 Internship Offer
        </button>
      </div>
    </div>

    <!-- Role Selection (Mobile-Friendly Search & Custom Role Combo) -->
    <div class="p-3.5 sm:p-4 rounded-xl bg-zinc-900/80 border border-white/[0.08] space-y-3">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="min-w-0 flex-1">
          <span class="text-[10px] font-mono font-semibold uppercase text-zinc-400 block mb-0.5">
            Offered Job Role
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
                General / Company Default Role
              </span>
            {/if}
          </div>
        </div>

        <button
          type="button"
          class="neon-btn-ghost px-3 py-1.5 rounded-lg text-xs font-mono font-medium shrink-0 touch-press cursor-pointer"
          on:click={() => { showRoleSelector = !showRoleSelector; roleSearchTerm = ''; }}
        >
          {showRoleSelector ? '✕ Done' : (selectedRole || (isCustomRole && customRoleName) ? '✏️ Change Role' : '+ Set / Custom Role')}
        </button>
      </div>

      {#if showRoleSelector}
        <div class="pt-3 border-t border-white/[0.08] space-y-2.5 animate-in fade-in duration-150">
          <div class="flex gap-2">
            <div class="relative flex-1 min-w-0">
              <input
                id="role-search-input"
                type="text"
                bind:value={roleSearchTerm}
                placeholder="Type or search role (e.g. SDE Intern, QA, Analyst)..."
                class="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm pr-8 font-sans"
                on:keydown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (roleSearchTerm.trim()) {
                      applyCustomRole(roleSearchTerm);
                    }
                  }
                }}
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
            {#if roleSearchTerm.trim()}
              <button
                type="button"
                class="neon-btn-primary px-3.5 py-2 rounded-xl text-xs font-mono font-bold shrink-0 touch-press cursor-pointer"
                on:click={() => applyCustomRole(roleSearchTerm)}
              >
                Set Role
              </button>
            {/if}
          </div>

          <!-- Role Suggestions & Custom Creation List (Clips-proof scroll container) -->
          <div class="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-zinc-950 divide-y divide-white/[0.06] shadow-lg">
            
            <!-- Custom role button if typed query is not an exact match -->
            {#if roleSearchTerm.trim() && !isExactRoleMatch}
              <button
                type="button"
                class="w-full text-left p-2.5 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 text-[#a3e635] text-xs font-mono font-bold flex items-center justify-between gap-2 touch-press cursor-pointer transition-colors"
                on:click={() => applyCustomRole(roleSearchTerm)}
              >
                <div class="min-w-0 flex-1 truncate">
                  <span>✨ Create & use role: </span>
                  <span class="underline">"{roleSearchTerm.trim()}"</span>
                </div>
                <span class="text-[10px] uppercase font-semibold shrink-0">Apply ➔</span>
              </button>
            {/if}

            <!-- Company Default Preset if available -->
            {#if selectedCompany && selectedCompany.role}
              <button
                type="button"
                class="w-full text-left p-2.5 hover:bg-white/[0.05] text-[#38bdf8] text-xs font-mono transition-colors cursor-pointer flex items-center justify-between gap-2"
                on:click={() => selectStandardRole(selectedCompany.role)}
              >
                <span class="truncate">🏢 Company Default: {selectedCompany.role}</span>
                <span class="text-[10px] uppercase font-semibold shrink-0">Select</span>
              </button>
            {/if}

            <!-- Reset / Default Option -->
            <button
              type="button"
              class="w-full text-left p-2.5 text-zinc-400 hover:text-white hover:bg-white/[0.04] text-xs font-mono transition-colors cursor-pointer"
              on:click={clearRole}
            >
              -- Reset to General / Unspecified Role --
            </button>

            <!-- Filtered Standard Roles List -->
            {#each filteredRoles.slice(0, 20) as role}
              <button
                type="button"
                class="w-full text-left p-2.5 hover:bg-white/[0.05] transition-colors flex items-center justify-between gap-2 touch-press cursor-pointer"
                on:click={() => selectStandardRole(role.name)}
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
                Type in the search box above to search or create a custom role.
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <!-- Candidate Registration Numbers Input -->
    <div>
      <div class="flex items-center justify-between mb-1.5">
        <label for="regnos" class="text-xs font-mono font-bold uppercase text-slate-400">
          Selected Candidate Identifiers (Reg No / Neo ID) *
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
        placeholder="Paste selected candidates here (one per line):&#10;23BCE1087&#10;O3W3I4P1&#10;23BAI1008"
        rows="8"
        class="w-full px-4 py-3 rounded-xl font-mono text-xs text-white"
      />
    </div>

    <button 
      on:click={addSelections}
      class="w-full py-3.5 neon-btn-primary rounded-xl text-xs font-bold uppercase tracking-wider touch-press cursor-pointer"
    >
      💾 Confirm & Save Final Selections
    </button>
  </div>

</div>
