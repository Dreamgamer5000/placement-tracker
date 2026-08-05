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
    stipend: '',
    role: '',
    category: '',
    job_location: '',
    eligible_branches: '',
    eligibility_criteria: '',
    website: '',
    total_rounds: '',
    experience_required: '',
    notes: '',
    round_details: ''
  };

  let emailRawText = '';
  let emailParseSuccessMsg = '';

  function autoParseEmail() {
    if (!emailRawText || !emailRawText.trim()) return;

    const lines = emailRawText.split('\n');
    let currentKey = '';
    const map: Record<string, string[]> = {};

    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const lower = trimmed.toLowerCase();
      let matchedKey = '';

      if (lower.includes('name of the company') || lower.includes('company name')) {
        matchedKey = 'name';
      } else if (lower.startsWith('category')) {
        matchedKey = 'category';
      } else if (lower.includes('eligible branches')) {
        matchedKey = 'eligible_branches';
      } else if (lower.includes('eligibility criteria') || lower.startsWith('eligibility')) {
        matchedKey = 'eligibility_criteria';
      } else if (lower.startsWith('ctc')) {
        matchedKey = 'ctc';
      } else if (lower.startsWith('stipend')) {
        matchedKey = 'stipend';
      } else if (lower.startsWith('website')) {
        matchedKey = 'website';
      } else if (lower.includes('job location') || lower.startsWith('location')) {
        matchedKey = 'job_location';
      } else if (lower.includes('job profile') || lower.includes('job role') || lower.startsWith('role')) {
        matchedKey = 'role';
      }

      if (matchedKey) {
        currentKey = matchedKey;
        if (!map[currentKey]) map[currentKey] = [];
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx !== -1) {
          const valAfterColon = trimmed.substring(colonIdx + 1).trim();
          if (valAfterColon) {
            map[currentKey].push(valAfterColon);
          }
        }
      } else if (currentKey) {
        map[currentKey].push(trimmed);
      }
    }

    if (map['name'] && map['name'].length > 0) newCompany.name = map['name'].join(' ');
    if (map['category'] && map['category'].length > 0) newCompany.category = map['category'].join(' ');
    if (map['eligible_branches'] && map['eligible_branches'].length > 0) newCompany.eligible_branches = map['eligible_branches'].join(' ');
    if (map['eligibility_criteria'] && map['eligibility_criteria'].length > 0) newCompany.eligibility_criteria = map['eligibility_criteria'].join('\n');
    if (map['ctc'] && map['ctc'].length > 0) newCompany.ctc = map['ctc'].join(' ');
    if (map['stipend'] && map['stipend'].length > 0) newCompany.stipend = map['stipend'].join(' ');
    if (map['website'] && map['website'].length > 0) newCompany.website = map['website'].join(' ');
    if (map['job_location'] && map['job_location'].length > 0) newCompany.job_location = map['job_location'].join(' ');
    if (map['role'] && map['role'].length > 0) newCompany.role = map['role'].join(' / ');

    emailParseSuccessMsg = '✨ Email parsed successfully! Form fields populated below.';
    setTimeout(() => { emailParseSuccessMsg = ''; }, 4000);
  }

  let recalculatingAnalytics = false;
  let analyticsMessage = '';
  let analyticsMessageType: 'success' | 'error' = 'success';

  let editingRoundNumber: number | null = null;
  let editingRoundNameInput = '';

  function startRenamingRound(round: any) {
    editingRoundNumber = round.round_number;
    editingRoundNameInput = round.round_name || `Shortlist ${round.round_number}`;
  }

  async function saveRoundName(companyId: number, roundNumber: number) {
    if (!editingRoundNameInput.trim()) return;
    try {
      const response = await fetch(`/api/companies/${companyId}/shortlist-round/${roundNumber}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round_name: editingRoundNameInput.trim() })
      });
      if (response.ok) {
        editingRoundNumber = null;
        if (selectedCompany) {
          await viewCompany(companyId);
        }
      }
    } catch (error) {
      console.error('Error renaming round:', error);
    }
  }

  onMount(async () => {
    await loadCompanies();
  });

  // Windowed rendering & search state for company detail modal
  let modalSearchTerm = '';
  let pageSize = 50;
  let roundPages: Record<number, number> = {};
  let finalStudentsPage = 1;
  let internStudentsPage = 1;

  function resetModalState() {
    modalSearchTerm = '';
    pageSize = 50;
    roundPages = {};
    finalStudentsPage = 1;
    internStudentsPage = 1;
  }

  function getRoundPage(roundNum: number): number {
    return roundPages[roundNum] || 1;
  }

  function setRoundPage(roundNum: number, page: number) {
    roundPages = { ...roundPages, [roundNum]: page };
  }

  function getCampusRank(campus: string | undefined | null): number {
    if (!campus) return 3;
    const c = campus.trim().toLowerCase();
    if (c === 'chennai' || c.includes('chennai')) return 1;
    if (c === 'vellore' || c.includes('vellore')) return 2;
    return 3;
  }

  function sortStudents(students: any[]): any[] {
    if (!students || !Array.isArray(students)) return [];
    return [...students].sort((a, b) => {
      // 1. Campus priority: Chennai (1) -> Vellore (2) -> Unknown / Others (3)
      const rankA = getCampusRank(a.campus);
      const rankB = getCampusRank(b.campus);
      if (rankA !== rankB) return rankA - rankB;

      // 2. TopCoder priority: TopCoder=1 first
      const tcA = a.topcoder ? 1 : 0;
      const tcB = b.topcoder ? 1 : 0;
      if (tcA !== tcB) return tcB - tcA;

      // 3. CGPA priority: Highest CGPA first
      const cgpaA = typeof a.cgpa === 'number' ? a.cgpa : 0;
      const cgpaB = typeof b.cgpa === 'number' ? b.cgpa : 0;
      return cgpaB - cgpaA;
    });
  }

  function getFilteredStudents(students: any[], search: string) {
    if (!students || !Array.isArray(students)) return [];
    let list = students;
    if (search && search.trim()) {
      const term = search.toLowerCase().trim();
      list = students.filter(s => {
        return (s.regno && s.regno.toLowerCase().includes(term)) ||
               (s.name && s.name.toLowerCase().includes(term)) ||
               (s.neo_id && s.neo_id.toLowerCase().includes(term)) ||
               (s.campus && s.campus.toLowerCase().includes(term)) ||
               (s.branch && s.branch.toLowerCase().includes(term));
      });
    }
    return sortStudents(list);
  }

  function getPaginatedSlice(students: any[], page: number, size: number) {
    if (size <= 0) return students; // Show all
    const start = (page - 1) * size;
    return students.slice(start, start + size);
  }

  function getTotalPages(totalItems: number, size: number) {
    if (size <= 0 || totalItems <= 0) return 1;
    return Math.ceil(totalItems / size);
  }

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
      resetModalState();
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
        newCompany = {
          name: '',
          ctc: '',
          stipend: '',
          role: '',
          category: '',
          job_location: '',
          eligible_branches: '',
          eligibility_criteria: '',
          website: '',
          total_rounds: '',
          experience_required: '',
          notes: '',
          round_details: ''
        };
        emailRawText = '';
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
      stipend: company.stipend || '',
      role: company.role || '',
      category: company.category || '',
      job_location: company.job_location || '',
      eligible_branches: company.eligible_branches || '',
      eligibility_criteria: company.eligibility_criteria || '',
      website: company.website || '',
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
      c.stipend,
      c.role,
      c.category,
      c.job_location,
      c.eligible_branches,
      c.eligibility_criteria,
      c.website,
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
    <div class="bg-white rounded-2xl shadow-md p-6 mb-8 border border-purple-100 space-y-6">
      <div class="flex justify-between items-center border-b border-gray-100 pb-3">
        <h3 class="text-xl font-bold text-gray-800">✨ Add New Company</h3>
        <span class="text-xs font-semibold text-purple-600 bg-purple-50 px-3 py-1 rounded-full">Manual Entry or Paste Email</span>
      </div>

      <!-- Quick Email Parser Box -->
      <div class="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-5">
        <div class="flex justify-between items-center mb-2">
          <label for="email-quick-parser" class="text-sm font-bold text-purple-900 flex items-center gap-2">
            📋 Quick Auto-Fill from Placement Email
          </label>
          <button 
            type="button"
            on:click={autoParseEmail}
            class="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
          >
            ⚡ Parse & Fill Fields
          </button>
        </div>
        <p class="text-xs text-purple-700 mb-2">Paste raw placement cell notification text (Company Name, Category, Eligible Branches, Eligibility Criteria, CTC, Stipend, Location, Role, Website):</p>
        <textarea 
          id="email-quick-parser"
          bind:value={emailRawText}
          placeholder="Paste email text here... then click 'Parse & Fill Fields'"
          rows="4"
          class="w-full px-3.5 py-2.5 border border-purple-200 rounded-xl bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        {#if emailParseSuccessMsg}
          <p class="text-xs font-bold text-emerald-700 mt-2 flex items-center gap-1">{emailParseSuccessMsg}</p>
        {/if}
      </div>

      <!-- Form Inputs Grid -->
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label for="new-company-name" class="block text-xs font-bold text-gray-700 uppercase mb-1">Company Name *</label>
            <input 
              id="new-company-name"
              type="text" 
              placeholder="e.g. Saviynt" 
              bind:value={newCompany.name}
              class="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>
          <div>
            <label for="new-company-category" class="block text-xs font-bold text-gray-700 uppercase mb-1">Category / Tier</label>
            <input 
              id="new-company-category"
              type="text" 
              placeholder="e.g. Super Dream Internship/ Placement" 
              bind:value={newCompany.category}
              class="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label for="new-company-role" class="block text-xs font-bold text-gray-700 uppercase mb-1">Job Profile / Role</label>
            <input 
              id="new-company-role"
              type="text" 
              placeholder="e.g. Associate Engineer / SRE" 
              bind:value={newCompany.role}
              class="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label for="new-company-ctc" class="block text-xs font-bold text-gray-700 uppercase mb-1">CTC Package</label>
            <input 
              id="new-company-ctc"
              type="text" 
              placeholder="e.g. 21,00,000 (21 LPA)" 
              bind:value={newCompany.ctc}
              class="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label for="new-company-stipend" class="block text-xs font-bold text-gray-700 uppercase mb-1">Stipend</label>
            <input 
              id="new-company-stipend"
              type="text" 
              placeholder="e.g. 50,000 per month" 
              bind:value={newCompany.stipend}
              class="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label for="new-company-location" class="block text-xs font-bold text-gray-700 uppercase mb-1">Job Location</label>
            <input 
              id="new-company-location"
              type="text" 
              placeholder="e.g. Bengaluru / Remote" 
              bind:value={newCompany.job_location}
              class="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label for="new-company-website" class="block text-xs font-bold text-gray-700 uppercase mb-1">Company Website</label>
            <input 
              id="new-company-website"
              type="text" 
              placeholder="e.g. saviynt.com" 
              bind:value={newCompany.website}
              class="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="new-company-branches" class="block text-xs font-bold text-gray-700 uppercase mb-1">Eligible Branches</label>
            <input 
              id="new-company-branches"
              type="text" 
              placeholder="e.g. B.Tech (CSE, IT & ECE related courses)" 
              bind:value={newCompany.eligible_branches}
              class="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label for="new-company-criteria" class="block text-xs font-bold text-gray-700 uppercase mb-1">Eligibility Criteria</label>
            <input 
              id="new-company-criteria"
              type="text" 
              placeholder="e.g. 90% in X & XII, 9.0 CGPA, No Standing Arrears" 
              bind:value={newCompany.eligibility_criteria}
              class="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="new-company-rounds" class="block text-xs font-bold text-gray-700 uppercase mb-1">Total Rounds</label>
            <input 
              id="new-company-rounds"
              type="number" 
              placeholder="e.g. 4" 
              bind:value={newCompany.total_rounds}
              class="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label for="new-company-exp" class="block text-xs font-bold text-gray-700 uppercase mb-1">Experience Required</label>
            <input 
              id="new-company-exp"
              type="text" 
              placeholder="e.g. Freshers (2027 batch)" 
              bind:value={newCompany.experience_required}
              class="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <div>
          <label for="new-company-notes" class="block text-xs font-bold text-gray-700 uppercase mb-1">General Notes</label>
          <textarea 
            id="new-company-notes"
            placeholder="General Notes (optional)" 
            bind:value={newCompany.notes}
            rows="2"
            class="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 resize-vertical"
          />
        </div>

        <div>
          <label for="new-company-details" class="block text-xs font-bold text-gray-700 uppercase mb-1">Round-by-Round Details / Instructions</label>
          <textarea 
            id="new-company-details"
            placeholder="Describe each round, questions asked, cutoffs, etc." 
            bind:value={newCompany.round_details}
            rows="3"
            class="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 resize-vertical"
          />
        </div>

        <button 
          class="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-colors duration-200 shadow-md flex items-center justify-center gap-2"
          on:click={addCompany}
        >
          💾 Save Company Profile
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
            <div class="flex justify-between items-start mb-2 gap-2">
              <div>
                <h3 class="text-xl font-bold text-gray-900 leading-snug">{company.name}</h3>
                {#if company.category}
                  <span class="inline-block text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded mt-1">
                    🌟 {company.category}
                  </span>
                {/if}
              </div>
              {#if company.ctc}
                <span class="px-2.5 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full whitespace-nowrap">
                  💰 {company.ctc}
                </span>
              {/if}
            </div>

            {#if company.role}
              <div class="text-xs font-semibold text-indigo-700 bg-indigo-50/70 px-2.5 py-1 rounded-md mb-2 inline-block">
                💼 {company.role}
              </div>
            {/if}

            {#if company.job_location}
              <div class="text-xs text-gray-600 mb-2 flex items-center gap-1 font-medium">
                📍 {company.job_location}
              </div>
            {/if}

            {#if company.notes}
              <p class="text-gray-600 text-xs mb-3 line-clamp-2">{company.notes}</p>
            {/if}
          </div>

          <div class="pt-3 border-t border-gray-100 flex flex-wrap gap-1.5 text-xs text-gray-500">
            {#if company.stipend}
              <span class="px-2 py-0.5 bg-amber-50 text-amber-800 rounded font-semibold text-[11px]">
                💵 Stipend: {company.stipend}
              </span>
            {/if}
            {#if company.total_rounds || company.rounds}
              <span class="px-2 py-0.5 bg-purple-50 text-purple-700 rounded font-semibold text-[11px]">
                📝 {company.total_rounds || company.rounds} Rounds
              </span>
            {/if}
            {#if company.experience_required}
              <span class="px-2 py-0.5 bg-gray-100 text-gray-700 rounded font-medium text-[11px]">
                🎓 {company.experience_required}
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
        class="absolute top-5 right-5 w-10 h-10 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-xl font-bold transition-colors z-10"
        on:click={() => { selectedCompany = null; editingCompany = null; }}
      >
        ×
      </button>

      <!-- Modal Header & Actions -->
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pr-12">
        <div>
          <div class="flex items-center gap-3">
            <h3 class="text-3xl font-bold text-gray-900">{selectedCompany.name}</h3>
            {#if selectedCompany.category}
              <span class="px-3 py-1 bg-purple-100 text-purple-900 text-xs font-bold rounded-full">
                🌟 {selectedCompany.category}
              </span>
            {/if}
          </div>

          {#if selectedCompany.role}
            <div class="text-sm font-bold text-indigo-700 mt-1">
              💼 Role: {selectedCompany.role}
            </div>
          {/if}

          <div class="flex flex-wrap gap-2 mt-2">
            {#if selectedCompany.ctc}
              <span class="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">
                💰 CTC: {selectedCompany.ctc}
              </span>
            {/if}
            {#if selectedCompany.stipend}
              <span class="px-3 py-1 bg-amber-100 text-amber-900 text-xs font-bold rounded-full">
                💵 Stipend: {selectedCompany.stipend}
              </span>
            {/if}
            {#if selectedCompany.job_location}
              <span class="px-3 py-1 bg-blue-100 text-blue-900 text-xs font-bold rounded-full">
                📍 {selectedCompany.job_location}
              </span>
            {/if}
            {#if selectedCompany.total_rounds || selectedCompany.rounds}
              <span class="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded-full">
                📝 {selectedCompany.total_rounds || selectedCompany.rounds} Rounds
              </span>
            {/if}
            {#if selectedCompany.website}
              <a 
                href={selectedCompany.website.startsWith('http') ? selectedCompany.website : `https://${selectedCompany.website}`}
                target="_blank"
                rel="noreferrer"
                class="px-3 py-1 bg-sky-100 text-sky-800 hover:bg-sky-200 text-xs font-bold rounded-full transition-colors inline-flex items-center gap-1"
              >
                🌐 {selectedCompany.website} ↗
              </a>
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
        <div class="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 mb-8 space-y-4">
          <h4 class="text-xl font-bold text-amber-900 mb-2">✏️ Edit Company Profile</h4>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label for="edit-company-name" class="block text-xs font-bold text-gray-700 uppercase mb-1">Company Name *</label>
              <input id="edit-company-name" type="text" bind:value={editingCompany.name} class="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white" required />
            </div>
            <div>
              <label for="edit-company-category" class="block text-xs font-bold text-gray-700 uppercase mb-1">Category</label>
              <input id="edit-company-category" type="text" bind:value={editingCompany.category} placeholder="e.g. Super Dream" class="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white" />
            </div>
            <div>
              <label for="edit-company-role" class="block text-xs font-bold text-gray-700 uppercase mb-1">Job Profile / Role</label>
              <input id="edit-company-role" type="text" bind:value={editingCompany.role} placeholder="e.g. Associate Engineer" class="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white" />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label for="edit-company-ctc" class="block text-xs font-bold text-gray-700 uppercase mb-1">CTC Package</label>
              <input id="edit-company-ctc" type="text" bind:value={editingCompany.ctc} placeholder="e.g. 21 LPA" class="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white" />
            </div>
            <div>
              <label for="edit-company-stipend" class="block text-xs font-bold text-gray-700 uppercase mb-1">Stipend</label>
              <input id="edit-company-stipend" type="text" bind:value={editingCompany.stipend} placeholder="e.g. 50k/month" class="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white" />
            </div>
            <div>
              <label for="edit-company-location" class="block text-xs font-bold text-gray-700 uppercase mb-1">Job Location</label>
              <input id="edit-company-location" type="text" bind:value={editingCompany.job_location} placeholder="e.g. Bengaluru" class="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white" />
            </div>
            <div>
              <label for="edit-company-website" class="block text-xs font-bold text-gray-700 uppercase mb-1">Website</label>
              <input id="edit-company-website" type="text" bind:value={editingCompany.website} placeholder="e.g. saviynt.com" class="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white" />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="edit-company-branches" class="block text-xs font-bold text-gray-700 uppercase mb-1">Eligible Branches</label>
              <input id="edit-company-branches" type="text" bind:value={editingCompany.eligible_branches} placeholder="e.g. B.Tech CSE, IT, ECE" class="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white" />
            </div>
            <div>
              <label for="edit-company-criteria" class="block text-xs font-bold text-gray-700 uppercase mb-1">Eligibility Criteria</label>
              <input id="edit-company-criteria" type="text" bind:value={editingCompany.eligibility_criteria} placeholder="e.g. 9.0 CGPA, No Standing Arrears" class="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white" />
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
      {/if}

      <!-- SECTION 1 (FIRST): Company Overview & Round Information -->
      <div class="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-6 mb-8 space-y-4">
        <h4 class="text-xl font-bold text-indigo-950">📋 Company Overview & Placement Criteria</h4>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {#if selectedCompany.eligible_branches}
            <div class="bg-white p-4 rounded-xl border border-indigo-100">
              <span class="text-xs font-bold text-indigo-600 uppercase tracking-wider block mb-1">🎓 Eligible Branches:</span>
              <p class="text-gray-800 text-sm font-semibold">{selectedCompany.eligible_branches}</p>
            </div>
          {/if}

          {#if selectedCompany.eligibility_criteria}
            <div class="bg-white p-4 rounded-xl border border-indigo-100">
              <span class="text-xs font-bold text-indigo-600 uppercase tracking-wider block mb-1">📊 Eligibility Criteria:</span>
              <p class="text-gray-800 text-sm whitespace-pre-line font-medium">{selectedCompany.eligibility_criteria}</p>
            </div>
          {/if}
        </div>

        {#if selectedCompany.notes}
          <div>
            <span class="text-xs font-bold text-indigo-600 uppercase tracking-wider">General Notes:</span>
            <p class="text-gray-800 mt-1 whitespace-pre-line text-sm">{selectedCompany.notes}</p>
          </div>
        {/if}

        {#if selectedCompany.round_details}
          <div>
            <span class="text-xs font-bold text-indigo-600 uppercase tracking-wider">Round-by-Round Details & Process Notes:</span>
            <div class="bg-white p-4 rounded-xl border border-indigo-100 text-gray-800 mt-2 whitespace-pre-line text-sm leading-relaxed">
              {selectedCompany.round_details}
            </div>
          </div>
        {:else if !selectedCompany.notes && !selectedCompany.eligible_branches && !selectedCompany.eligibility_criteria}
          <p class="text-gray-500 italic text-sm">No round notes provided yet. Click "Edit Company Details" above to add information.</p>
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

      <!-- Final Placements (from temp_final_selection) -->
      {#if selectedCompany.finals && selectedCompany.finals.length > 0}
        {@const filteredFinals = getFilteredStudents(selectedCompany.finals, modalSearchTerm)}
        {@const totalPages = getTotalPages(filteredFinals.length, pageSize)}
        {@const paginatedFinals = getPaginatedSlice(filteredFinals, finalStudentsPage, pageSize)}
        {@const startIdx = pageSize > 0 ? (finalStudentsPage - 1) * pageSize + 1 : 1}
        {@const endIdx = pageSize > 0 ? Math.min(finalStudentsPage * pageSize, filteredFinals.length) : filteredFinals.length}

        <div class="mb-8 border border-emerald-200 rounded-2xl bg-emerald-50/30 overflow-hidden shadow-sm">
          <div class="bg-emerald-100/70 px-6 py-4 flex justify-between items-center border-b border-emerald-200">
            <h4 class="text-2xl font-bold text-emerald-950 flex items-center gap-2">
              ✅ Final Placements (Full-Time)
            </h4>
            <span class="px-3 py-1 bg-emerald-700 text-white text-xs font-bold rounded-full">
              {filteredFinals.length} Placed
            </span>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-emerald-100">
              <thead class="bg-white/80">
                <tr>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-emerald-900 uppercase tracking-wider">Reg No / Neo ID</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-emerald-900 uppercase tracking-wider">Name</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-emerald-900 uppercase tracking-wider">Campus</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-emerald-900 uppercase tracking-wider">TopCoder</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-emerald-900 uppercase tracking-wider">CGPA</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-emerald-900 uppercase tracking-wider">Gender</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-emerald-900 uppercase tracking-wider">Resume</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-emerald-50">
                {#if paginatedFinals.length === 0}
                  <tr>
                    <td colspan="7" class="px-6 py-6 text-center text-gray-500 italic">
                      No placed students matching "{modalSearchTerm}".
                    </td>
                  </tr>
                {:else}
                  {#each paginatedFinals as student}
                    <tr class="hover:bg-emerald-50/50">
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        {student.regno}
                        {#if student.neo_id}
                          <span class="ml-1.5 px-1.5 py-0.5 text-xs font-mono bg-emerald-100 text-emerald-800 rounded font-semibold">{student.neo_id}</span>
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
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.gender || 'N/A'}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm">
                        {#if student.resume_link}
                          <a href={student.resume_link} target="_blank" class="text-emerald-600 hover:text-emerald-800 font-semibold">📄 View</a>
                        {:else}
                          <span class="text-gray-400">N/A</span>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                {/if}
              </tbody>
            </table>
          </div>

          {#if pageSize > 0 && filteredFinals.length > 0}
            <div class="px-6 py-3 bg-white border-t border-emerald-100 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-gray-600">
              <div>
                Showing <span class="font-bold text-emerald-900">{startIdx}</span>–<span class="font-bold text-emerald-900">{endIdx}</span> of <span class="font-bold text-emerald-900">{filteredFinals.length}</span> placed students
              </div>

              {#if totalPages > 1}
                <div class="flex items-center gap-2">
                  <button
                    on:click={() => finalStudentsPage = Math.max(1, finalStudentsPage - 1)}
                    disabled={finalStudentsPage === 1}
                    class="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    ◀ Previous
                  </button>

                  <span class="font-semibold px-2">
                    Page {finalStudentsPage} of {totalPages}
                  </span>

                  <button
                    on:click={() => finalStudentsPage = Math.min(totalPages, finalStudentsPage + 1)}
                    disabled={finalStudentsPage >= totalPages}
                    class="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next ▶
                  </button>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Intern Selections (from temp_interns_selected) -->
      {#if selectedCompany.interns && selectedCompany.interns.length > 0}
        {@const filteredInterns = getFilteredStudents(selectedCompany.interns, modalSearchTerm)}
        {@const totalPages = getTotalPages(filteredInterns.length, pageSize)}
        {@const paginatedInterns = getPaginatedSlice(filteredInterns, internStudentsPage, pageSize)}
        {@const startIdx = pageSize > 0 ? (internStudentsPage - 1) * pageSize + 1 : 1}
        {@const endIdx = pageSize > 0 ? Math.min(internStudentsPage * pageSize, filteredInterns.length) : filteredInterns.length}

        <div class="mb-8 border border-cyan-200 rounded-2xl bg-cyan-50/30 overflow-hidden shadow-sm">
          <div class="bg-cyan-100/70 px-6 py-4 flex justify-between items-center border-b border-cyan-200">
            <h4 class="text-2xl font-bold text-cyan-950 flex items-center gap-2">
              💼 Intern Selections
            </h4>
            <span class="px-3 py-1 bg-cyan-700 text-white text-xs font-bold rounded-full">
              {filteredInterns.length} Intern{filteredInterns.length === 1 ? '' : 's'}
            </span>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-cyan-100">
              <thead class="bg-white/80">
                <tr>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-cyan-900 uppercase tracking-wider">Reg No / Neo ID</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-cyan-900 uppercase tracking-wider">Name</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-cyan-900 uppercase tracking-wider">Campus</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-cyan-900 uppercase tracking-wider">TopCoder</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-cyan-900 uppercase tracking-wider">CGPA</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-cyan-900 uppercase tracking-wider">Gender</th>
                  <th class="px-6 py-3.5 text-left text-xs font-bold text-cyan-900 uppercase tracking-wider">Resume</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-cyan-50">
                {#if paginatedInterns.length === 0}
                  <tr>
                    <td colspan="7" class="px-6 py-6 text-center text-gray-500 italic">
                      No interns matching "{modalSearchTerm}".
                    </td>
                  </tr>
                {:else}
                  {#each paginatedInterns as student}
                    <tr class="hover:bg-cyan-50/50">
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        {student.regno}
                        {#if student.neo_id}
                          <span class="ml-1.5 px-1.5 py-0.5 text-xs font-mono bg-cyan-100 text-cyan-800 rounded font-semibold">{student.neo_id}</span>
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
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.gender || 'N/A'}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm">
                        {#if student.resume_link}
                          <a href={student.resume_link} target="_blank" class="text-cyan-600 hover:text-cyan-800 font-semibold">📄 View</a>
                        {:else}
                          <span class="text-gray-400">N/A</span>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                {/if}
              </tbody>
            </table>
          </div>

          {#if pageSize > 0 && filteredInterns.length > 0}
            <div class="px-6 py-3 bg-white border-t border-cyan-100 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-gray-600">
              <div>
                Showing <span class="font-bold text-cyan-900">{startIdx}</span>–<span class="font-bold text-cyan-900">{endIdx}</span> of <span class="font-bold text-cyan-900">{filteredInterns.length}</span> intern selections
              </div>

              {#if totalPages > 1}
                <div class="flex items-center gap-2">
                  <button
                    on:click={() => internStudentsPage = Math.max(1, internStudentsPage - 1)}
                    disabled={internStudentsPage === 1}
                    class="px-3 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    ◀ Previous
                  </button>

                  <span class="font-semibold px-2">
                    Page {internStudentsPage} of {totalPages}
                  </span>

                  <button
                    on:click={() => internStudentsPage = Math.min(totalPages, internStudentsPage + 1)}
                    disabled={internStudentsPage >= totalPages}
                    class="px-3 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next ▶
                  </button>
                </div>
              {/if}
            </div>
          {/if}
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
        <!-- Search & Windowed View Controls Bar -->
        <div class="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm">
          <div class="relative w-full md:w-96">
            <input
              type="text"
              placeholder="🔍 Search shortlist (Name, RegNo, NeoID, Branch)..."
              bind:value={modalSearchTerm}
              on:input={() => { roundPages = {}; finalStudentsPage = 1; internStudentsPage = 1; }}
              class="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {#if modalSearchTerm}
              <button
                on:click={() => modalSearchTerm = ''}
                class="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 font-bold text-xs"
              >
                ✕
              </button>
            {/if}
          </div>

          <div class="flex items-center gap-2 text-xs font-semibold text-gray-700 w-full md:w-auto justify-end">
            <span>Rows per page:</span>
            <select
              bind:value={pageSize}
              on:change={() => roundPages = {}}
              class="px-3 py-1.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-bold"
            >
              <option value={25}>25 rows</option>
              <option value={50}>50 rows (Fast)</option>
              <option value={100}>100 rows</option>
              <option value={250}>250 rows</option>
              <option value={0}>All (No Windowing)</option>
            </select>
          </div>
        </div>

        <div class="mb-8 space-y-6">
          {#each selectedCompany.shortlist_rounds as round}
            {@const filteredStudents = getFilteredStudents(round.students, modalSearchTerm)}
            {@const curPage = roundPages[round.round_number] || 1}
            {@const totalPages = getTotalPages(filteredStudents.length, pageSize)}
            {@const paginatedStudents = getPaginatedSlice(filteredStudents, curPage, pageSize)}
            {@const startIdx = pageSize > 0 ? (curPage - 1) * pageSize + 1 : 1}
            {@const endIdx = pageSize > 0 ? Math.min(curPage * pageSize, filteredStudents.length) : filteredStudents.length}

            <div class="border border-purple-200 rounded-2xl bg-purple-50/30 overflow-hidden shadow-sm">
              <div class="bg-purple-100/70 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-purple-200">
                {#if editingRoundNumber === round.round_number}
                  <div class="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      bind:value={editingRoundNameInput}
                      class="px-3 py-1.5 border-2 border-purple-400 rounded-lg text-sm font-bold text-gray-900 bg-white flex-1 max-w-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Custom shortlist round name"
                    />
                    <button
                      on:click={() => saveRoundName(selectedCompany.id, round.round_number)}
                      class="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg shadow-sm"
                    >
                      Save
                    </button>
                    <button
                      on:click={() => editingRoundNumber = null}
                      class="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                {:else}
                  <div class="flex items-center gap-3">
                    <h4 class="text-xl font-bold text-purple-950 flex items-center gap-2">
                      📋 {round.round_name || `Shortlist ${round.round_number}`}
                    </h4>
                    <button
                      on:click={() => startRenamingRound(round)}
                      class="px-2.5 py-1 text-xs bg-purple-200/80 hover:bg-purple-300 text-purple-900 font-semibold rounded-md transition-colors"
                      title="Rename this shortlist round"
                    >
                      ✏️ Rename
                    </button>
                  </div>
                {/if}
                <div class="flex flex-wrap items-center gap-2">
                  <span class="px-3 py-1 bg-purple-700 text-white text-xs font-bold rounded-full">
                    Total: {round.students.length}
                  </span>
                  <span class="px-3 py-1 bg-indigo-700 text-white text-xs font-bold rounded-full">
                    Chennai: {round.chennai_count ?? round.students.filter(s => s.campus === 'Chennai').length}
                  </span>
                  {#if (round.unknown_count ?? round.students.filter(s => s.campus === 'Unknown' || !s.campus).length) > 0}
                    <span class="px-3 py-1 bg-amber-600 text-white text-xs font-bold rounded-full">
                      Unknown: {round.unknown_count ?? round.students.filter(s => s.campus === 'Unknown' || !s.campus).length}
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
                    {#if paginatedStudents.length === 0}
                      <tr>
                        <td colspan="9" class="px-6 py-8 text-center text-gray-500 italic">
                          No students matching "{modalSearchTerm}" in this shortlist.
                        </td>
                      </tr>
                    {:else}
                      {#each paginatedStudents as student}
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
                    {/if}
                  </tbody>
                </table>
              </div>

              <!-- Pagination Controls for Windowed Rendering -->
              {#if pageSize > 0 && filteredStudents.length > 0}
                <div class="px-6 py-3 bg-white border-t border-purple-100 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-gray-600">
                  <div>
                    Showing <span class="font-bold text-purple-900">{startIdx}</span>–<span class="font-bold text-purple-900">{endIdx}</span> of <span class="font-bold text-purple-900">{filteredStudents.length}</span> students
                  </div>

                  {#if totalPages > 1}
                    <div class="flex items-center gap-2">
                      <button
                        on:click={() => setRoundPage(round.round_number, Math.max(1, curPage - 1))}
                        disabled={curPage === 1}
                        class="px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        ◀ Previous
                      </button>

                      <span class="font-semibold px-2">
                        Page {curPage} of {totalPages}
                      </span>

                      <button
                        on:click={() => setRoundPage(round.round_number, Math.min(totalPages, curPage + 1))}
                        disabled={curPage >= totalPages}
                        class="px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Next ▶
                      </button>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {:else if selectedCompany.shortlisted && selectedCompany.shortlisted.length > 0}
        {@const filteredShortlist = getFilteredStudents(selectedCompany.shortlisted, modalSearchTerm)}
        {@const curPage = roundPages[0] || 1}
        {@const totalPages = getTotalPages(filteredShortlist.length, pageSize)}
        {@const paginatedShortlist = getPaginatedSlice(filteredShortlist, curPage, pageSize)}
        {@const startIdx = pageSize > 0 ? (curPage - 1) * pageSize + 1 : 1}
        {@const endIdx = pageSize > 0 ? Math.min(curPage * pageSize, filteredShortlist.length) : filteredShortlist.length}

        <div class="mb-8 border border-gray-200 rounded-2xl bg-white overflow-hidden shadow-sm">
          <div class="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h4 class="text-2xl font-bold text-gray-900">📋 Shortlisted Students ({filteredShortlist.length})</h4>
          </div>
          <div class="overflow-x-auto">
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
                {#each paginatedShortlist as student}
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

          {#if pageSize > 0 && filteredShortlist.length > 0}
            <div class="px-6 py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-gray-600">
              <div>
                Showing <span class="font-bold text-gray-900">{startIdx}</span>–<span class="font-bold text-gray-900">{endIdx}</span> of <span class="font-bold text-gray-900">{filteredShortlist.length}</span> students
              </div>

              {#if totalPages > 1}
                <div class="flex items-center gap-2">
                  <button
                    on:click={() => setRoundPage(0, Math.max(1, curPage - 1))}
                    disabled={curPage === 1}
                    class="px-3 py-1 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    ◀ Previous
                  </button>

                  <span class="font-semibold px-2">
                    Page {curPage} of {totalPages}
                  </span>

                  <button
                    on:click={() => setRoundPage(0, Math.min(totalPages, curPage + 1))}
                    disabled={curPage >= totalPages}
                    class="px-3 py-1 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next ▶
                  </button>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}
