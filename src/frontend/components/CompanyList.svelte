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
  let emailParseErrorMsg = '';
  let isParsingEmail = false;

  async function parseEmailWithAI() {
    if (!emailRawText || !emailRawText.trim()) {
      emailParseErrorMsg = 'Please paste the email text first.';
      emailParseSuccessMsg = '';
      setTimeout(() => { emailParseErrorMsg = ''; }, 4000);
      return;
    }

    isParsingEmail = true;
    emailParseErrorMsg = '';
    emailParseSuccessMsg = '';

    try {
      const response = await fetch('/api/companies/parse-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailText: emailRawText })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to parse email with Gemini AI');
      }

      const parsed = result.data;
      if (parsed.name) newCompany.name = parsed.name;
      if (parsed.category) newCompany.category = parsed.category;
      if (parsed.role) newCompany.role = parsed.role;
      if (parsed.ctc) newCompany.ctc = parsed.ctc;
      if (parsed.stipend) newCompany.stipend = parsed.stipend;
      if (parsed.job_location) newCompany.job_location = parsed.job_location;
      if (parsed.eligible_branches) newCompany.eligible_branches = parsed.eligible_branches;
      if (parsed.eligibility_criteria) newCompany.eligibility_criteria = parsed.eligibility_criteria;
      if (parsed.website) newCompany.website = parsed.website;
      if (parsed.total_rounds) newCompany.total_rounds = parsed.total_rounds;
      if (parsed.round_details) newCompany.round_details = parsed.round_details;
      if (parsed.notes) newCompany.notes = parsed.notes;
      if (parsed.experience_required) newCompany.experience_required = parsed.experience_required;

      emailParseSuccessMsg = '✨ Email parsed successfully with Gemini AI! Fields auto-populated.';
      setTimeout(() => { emailParseSuccessMsg = ''; }, 6000);
    } catch (err: any) {
      console.error('Email parse error:', err);
      emailParseErrorMsg = `${err.message || 'Error occurred while parsing email'}`;
    } finally {
      isParsingEmail = false;
    }
  }

  let editEmailRawText = '';
  let isParsingEditEmail = false;
  let editEmailParseSuccessMsg = '';
  let editEmailParseErrorMsg = '';

  async function parseEditEmailWithAI() {
    if (!editEmailRawText || !editEmailRawText.trim()) {
      editEmailParseErrorMsg = 'Please paste the email text first.';
      editEmailParseSuccessMsg = '';
      setTimeout(() => { editEmailParseErrorMsg = ''; }, 4000);
      return;
    }

    isParsingEditEmail = true;
    editEmailParseErrorMsg = '';
    editEmailParseSuccessMsg = '';

    try {
      const response = await fetch('/api/companies/parse-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailText: editEmailRawText })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to parse email with Gemini AI');
      }

      const parsed = result.data;
      if (parsed.name) editingCompany.name = parsed.name;
      if (parsed.category) editingCompany.category = parsed.category;
      if (parsed.role) editingCompany.role = parsed.role;
      if (parsed.ctc) editingCompany.ctc = parsed.ctc;
      if (parsed.stipend) editingCompany.stipend = parsed.stipend;
      if (parsed.job_location) editingCompany.job_location = parsed.job_location;
      if (parsed.eligible_branches) editingCompany.eligible_branches = parsed.eligible_branches;
      if (parsed.eligibility_criteria) editingCompany.eligibility_criteria = parsed.eligibility_criteria;
      if (parsed.website) editingCompany.website = parsed.website;
      if (parsed.total_rounds) editingCompany.total_rounds = parsed.total_rounds;
      if (parsed.round_details) editingCompany.round_details = parsed.round_details;
      if (parsed.notes) editingCompany.notes = parsed.notes;
      if (parsed.experience_required) editingCompany.experience_required = parsed.experience_required;

      editEmailParseSuccessMsg = '✨ Email parsed successfully! Review modified fields.';
      setTimeout(() => { editEmailParseSuccessMsg = ''; }, 6000);
    } catch (err: any) {
      console.error('Edit email parse error:', err);
      editEmailParseErrorMsg = `${err.message || 'Error occurred while parsing email'}`;
    } finally {
      isParsingEditEmail = false;
    }
  }

  let editingRoundNumber: number | null = null;
  let editingRoundNameInput = '';

  function startRenamingRound(round: any) {
    editingRoundNumber = round.round_number;
    editingRoundNameInput = round.round_name || `Round ${round.round_number}`;
  }

  function initiateSaveRoundName(companyId: number, roundNum: number) {
    if (!editingRoundNameInput.trim()) return;
    passwordModalTitle = 'Rename Round';
    passwordModalMessage = `Enter admin password to rename Round ${roundNum} to "${editingRoundNameInput}".`;
    pendingAction = (pwd: string) => executeSaveRoundName(companyId, roundNum, pwd);
    showPasswordModal = true;
  }

  async function executeSaveRoundName(companyId: number, roundNum: number, pwd = '') {
    if (!editingRoundNameInput.trim()) return;
    try {
      const response = await fetch(`/api/companies/${companyId}/rounds/${roundNum}/rename`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Password': pwd 
        },
        body: JSON.stringify({ roundName: editingRoundNameInput.trim() })
      });
      if (response.ok) {
        editingRoundNumber = null;
        await viewCompany(companyId);
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to rename round');
      }
    } catch (error) {
      console.error('Error renaming round:', error);
      alert('Error updating round name');
    }
  }

  function initiateDeleteRound(companyId: number, roundNum: number) {
    passwordModalTitle = 'Delete Shortlist Round';
    passwordModalMessage = `Enter admin password to permanently delete Round ${roundNum} shortlist for this company.`;
    pendingAction = (pwd: string) => executeDeleteRound(companyId, roundNum, pwd);
    showPasswordModal = true;
  }

  async function executeDeleteRound(companyId: number, roundNum: number, pwd = '') {
    try {
      const response = await fetch(`/api/companies/${companyId}/rounds/${roundNum}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': pwd }
      });
      if (response.ok) {
        await viewCompany(companyId);
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to delete round');
      }
    } catch (error) {
      console.error('Error deleting round:', error);
      alert('Error deleting round');
    }
  }

  let recalculatingAnalytics = false;
  let analyticsMessage = '';
  let analyticsMessageType: 'success' | 'error' = 'success';
  let availableRoles: any[] = [];

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
      console.error('Error loading roles in CompanyList:', error);
    }
  }

  async function recalculateAnalytics() {
    recalculatingAnalytics = true;
    analyticsMessage = '';
    try {
      const response = await fetch('/api/companies/recalculate-analytics', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        analyticsMessageType = 'success';
        analyticsMessage = `✅ Analytics synced successfully for ${data.updatedCount || 0} companies!`;
        await loadCompanies();
        if (selectedCompany) {
          await viewCompany(selectedCompany.id);
        }
      } else {
        analyticsMessageType = 'error';
        analyticsMessage = `❌ Error: ${data.error || 'Failed to recalculate analytics'}`;
      }
    } catch (error: any) {
      analyticsMessageType = 'error';
      analyticsMessage = `❌ Network Error: ${error.message}`;
    } finally {
      recalculatingAnalytics = false;
      setTimeout(() => { analyticsMessage = ''; }, 5000);
    }
  }

  $: filteredCompanies = companies.filter(company => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      (company.name && company.name.toLowerCase().includes(term)) ||
      (company.role && company.role.toLowerCase().includes(term)) ||
      (company.category && company.category.toLowerCase().includes(term)) ||
      (company.ctc && company.ctc.toLowerCase().includes(term)) ||
      (company.job_location && company.job_location.toLowerCase().includes(term))
    );
  });

  // Modal State & Pagination
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
      const rankA = getCampusRank(a.campus);
      const rankB = getCampusRank(b.campus);
      if (rankA !== rankB) return rankA - rankB;

      const tcA = a.topcoder ? 1 : 0;
      const tcB = b.topcoder ? 1 : 0;
      if (tcA !== tcB) return tcB - tcA;

      const cgpaA = typeof a.cgpa === 'number' ? a.cgpa : 0;
      const cgpaB = typeof b.cgpa === 'number' ? b.cgpa : 0;
      if (cgpaA !== cgpaB) return cgpaB - cgpaA;

      const nameA = (a.name || '').toString().trim().toLowerCase();
      const nameB = (b.name || '').toString().trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }

  function getCampusStats(students: any[]) {
    if (!students || !Array.isArray(students)) {
      return { total: 0, chennai: 0, vellore: 0, unknown: 0 };
    }
    let chennai = 0;
    let vellore = 0;
    let unknown = 0;
    for (const s of students) {
      const c = (s.campus || '').trim().toLowerCase();
      if (c === 'chennai' || c.includes('chennai')) {
        chennai++;
      } else if (c === 'vellore' || c.includes('vellore')) {
        vellore++;
      } else {
        unknown++;
      }
    }
    return { total: students.length, chennai, vellore, unknown };
  }

  function getFilteredStudents(students: any[], search: string) {
    if (!students || !Array.isArray(students)) return [];
    let list = students;
    if (search && search.trim()) {
      const term = search.toLowerCase().trim();
      list = students.filter((s: any) => {
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
    if (size <= 0) return students;
    const start = (page - 1) * size;
    return students.slice(start, start + size);
  }

  function getTotalPages(totalItems: number, size: number) {
    if (size <= 0 || totalItems <= 0) return 1;
    return Math.ceil(totalItems / size);
  }

  function setRoundPage(roundNum: number, newPage: number) {
    roundPages[roundNum] = newPage;
    roundPages = { ...roundPages };
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
        emailParseSuccessMsg = '';
        emailParseErrorMsg = '';
        showAddForm = false;
        await loadCompanies();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to add company');
      }
    } catch (error) {
      console.error('Error adding company:', error);
    }
  }

  function openEditCompany(company: any) {
    editEmailRawText = '';
    editEmailParseSuccessMsg = '';
    editEmailParseErrorMsg = '';
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

  function initiateSaveCompany() {
    if (!editingCompany || !editingCompany.name.trim()) return;
    passwordModalTitle = 'Save Company Changes';
    passwordModalMessage = `Enter admin password to save changes to ${editingCompany.name}.`;
    pendingAction = (pwd: string) => executeSaveCompany(pwd);
    showPasswordModal = true;
  }

  async function executeSaveCompany(pwd = '') {
    if (!editingCompany || !editingCompany.name.trim()) return;
    try {
      const response = await fetch(`/api/companies/${editingCompany.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Password': pwd
        },
        body: JSON.stringify(editingCompany)
      });

      if (response.ok) {
        const updated = await response.json();
        editingCompany = null;
        await loadCompanies();
        if (selectedCompany && selectedCompany.id === updated.id) {
          await viewCompany(updated.id);
        }
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to update company');
      }
    } catch (error) {
      console.error('Error updating company:', error);
    }
  }

  function initiateDeleteCompany(company: any) {
    passwordModalTitle = 'Delete Company Profile';
    passwordModalMessage = `Are you sure you want to delete ${company.name}? This will remove all associated shortlists and selections.`;
    pendingAction = (pwd: string) => executeDeleteCompany(company.id, pwd);
    showPasswordModal = true;
  }

  async function executeDeleteCompany(id: number, pwd = '') {
    try {
      const response = await fetch(`/api/companies/${id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': pwd }
      });
      if (response.ok) {
        selectedCompany = null;
        editingCompany = null;
        await loadCompanies();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to delete company');
      }
    } catch (error) {
      console.error('Error deleting company:', error);
    }
  }
</script>

<div class="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
  
  <!-- Top Showcase Header & Actions -->
  <div class="neon-card p-5 sm:p-7 space-y-4 lg:space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
          Companies & Recruitment Drives
        </h1>
        <p class="text-xs sm:text-sm text-zinc-400 font-normal mt-1">
          Explore recruitment drives, eligibility criteria, compensation packages, and shortlist funnels.
        </p>
      </div>

      <div class="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
        <button 
          class="neon-btn-ghost px-4 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-1.5 touch-press min-h-[38px] flex-1 sm:flex-initial justify-center"
          on:click={recalculateAnalytics}
          disabled={recalculatingAnalytics}
        >
          <span class={recalculatingAnalytics ? 'animate-spin' : ''}>↻</span>
          <span>{recalculatingAnalytics ? 'Syncing…' : 'Recalculate stats'}</span>
        </button>

        <button 
          class="neon-btn-primary px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 touch-press min-h-[38px] flex-1 sm:flex-initial justify-center"
          on:click={() => showAddForm = !showAddForm}
        >
          {showAddForm ? '✕ Close form' : '+ Add company'}
        </button>
      </div>
    </div>

    <!-- Search Input -->
    <div class="relative">
      <input 
        type="text" 
        placeholder="Search company by name, CTC (e.g. 21 LPA), role, location, or notes…" 
        bind:value={searchTerm}
        class="w-full px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl bg-zinc-900/90 border border-white/10 text-white placeholder-zinc-500 font-sans text-sm sm:text-base focus:border-[#a3e635]/60 focus:shadow-sm min-h-[46px]"
      />
    </div>
  </div>

  {#if analyticsMessage}
    <div class="p-3.5 rounded-xl text-xs sm:text-sm font-mono font-medium border {analyticsMessageType === 'error' ? 'bg-rose-950/30 text-rose-300 border-rose-900/60' : 'bg-[#a3e635]/10 text-[#a3e635] border-[#a3e635]/25'}">
      {analyticsMessage}
    </div>
  {/if}

  <!-- ADD COMPANY FORM -->
  {#if showAddForm}
    <div class="neon-card p-5 sm:p-8 space-y-6 border-white/20">
      <div class="flex justify-between items-center border-b border-white/[0.08] pb-3">
        <h2 class="text-lg font-display font-bold text-white">
          Add New Company Profile
        </h2>
        <span class="neon-badge-lime px-3 py-1 rounded-full text-[11px] font-mono font-medium">
          New Drive
        </span>
      </div>

      <!-- AI Email Parser Box -->
      <div class="p-4 rounded-xl bg-zinc-900/80 border border-white/[0.08] space-y-3">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <label for="email-quick-parser" class="text-xs font-mono font-semibold text-amber-400">
            Auto-Extract from Placement Email
          </label>
          <button 
            type="button"
            on:click={parseEmailWithAI}
            disabled={isParsingEmail}
            class="neon-btn-primary px-3.5 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 touch-press disabled:opacity-50 min-h-[36px]"
          >
            <span>{isParsingEmail ? 'Extracting…' : 'Extract & Fill Fields'}</span>
          </button>
        </div>
        
        <p class="text-xs text-zinc-400">Paste placement notification email to extract CTC, stipend, branches, and rounds:</p>
        
        <textarea 
          id="email-quick-parser"
          bind:value={emailRawText}
          disabled={isParsingEmail}
          placeholder="Paste email notification content here…"
          rows="3"
          class="w-full px-3.5 py-2.5 rounded-xl font-mono text-xs text-white"
        />

        {#if emailParseSuccessMsg}
          <div class="p-2.5 bg-[#a3e635]/10 border border-[#a3e635]/25 rounded-xl text-xs font-mono text-[#a3e635]">
            {emailParseSuccessMsg}
          </div>
        {/if}
        {#if emailParseErrorMsg}
          <div class="p-2.5 bg-rose-950/30 border border-rose-900/60 rounded-xl text-xs font-mono text-rose-300">
            {emailParseErrorMsg}
          </div>
        {/if}
      </div>

      <!-- Form Inputs Grid -->
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label for="new-company-name" class="block text-xs font-mono uppercase text-zinc-400 mb-1">Company Name *</label>
            <input id="new-company-name" type="text" class="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm" placeholder="e.g. Saviynt" bind:value={newCompany.name} required />
          </div>
          <div>
            <label for="new-company-category" class="block text-xs font-mono uppercase text-zinc-400 mb-1">Category / Tier</label>
            <input id="new-company-category" type="text" class="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm" placeholder="e.g. Super Dream" bind:value={newCompany.category} />
          </div>
          <div>
            <label for="new-company-role" class="block text-xs font-mono uppercase text-zinc-400 mb-1">Job Profile / Role</label>
            <input id="new-company-role" type="text" list="add-roles-list" class="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm" placeholder="e.g. Software Engineer" bind:value={newCompany.role} />
            <datalist id="add-roles-list">
              {#each availableRoles as role}
                <option value={role.name}>{role.category ? `${role.name} (${role.category})` : role.name}</option>
              {/each}
            </datalist>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label for="new-company-ctc" class="block text-xs font-mono uppercase text-zinc-400 mb-1">CTC Package</label>
            <input id="new-company-ctc" type="text" class="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm" placeholder="e.g. 21 LPA" bind:value={newCompany.ctc} />
          </div>
          <div>
            <label for="new-company-stipend" class="block text-xs font-mono uppercase text-zinc-400 mb-1">Stipend</label>
            <input id="new-company-stipend" type="text" class="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm" placeholder="e.g. 50,000 / mo" bind:value={newCompany.stipend} />
          </div>
          <div>
            <label for="new-company-location" class="block text-xs font-mono uppercase text-zinc-400 mb-1">Job Location</label>
            <input id="new-company-location" type="text" class="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm" placeholder="e.g. Bengaluru / Remote" bind:value={newCompany.job_location} />
          </div>
          <div>
            <label for="new-company-rounds" class="block text-xs font-mono uppercase text-zinc-400 mb-1">Rounds Count</label>
            <input id="new-company-rounds" type="text" class="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm" placeholder="e.g. 3" bind:value={newCompany.total_rounds} />
          </div>
        </div>

        <div>
          <label for="new-company-branches" class="block text-xs font-mono uppercase text-zinc-400 mb-1">Eligible Branches</label>
          <input id="new-company-branches" type="text" class="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm" placeholder="e.g. B.Tech CSE, IT, ECE, EEE" bind:value={newCompany.eligible_branches} />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="new-company-criteria" class="block text-xs font-mono uppercase text-zinc-400 mb-1">Eligibility Criteria</label>
            <textarea id="new-company-criteria" rows="2" class="w-full px-3.5 py-2 rounded-xl text-xs" placeholder="e.g. 8.0 CGPA and above, 70% in 10th & 12th" bind:value={newCompany.eligibility_criteria}></textarea>
          </div>
          <div>
            <label for="new-company-notes" class="block text-xs font-mono uppercase text-zinc-400 mb-1">General Notes</label>
            <textarea id="new-company-notes" rows="2" class="w-full px-3.5 py-2 rounded-xl text-xs" placeholder="e.g. Direct PPO conversion from internship" bind:value={newCompany.notes}></textarea>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-3 pt-3 border-t border-white/[0.08]">
        <button 
          class="neon-btn-ghost px-5 py-2.5 text-xs font-medium rounded-xl min-h-[40px]"
          on:click={() => showAddForm = false}
        >
          Cancel
        </button>
        <button 
          class="neon-btn-primary px-6 py-2.5 text-xs font-semibold rounded-xl min-h-[40px]"
          on:click={addCompany}
        >
          Save Company
        </button>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="neon-card p-16 text-center flex flex-col items-center justify-center gap-4">
      <div class="w-8 h-8 rounded-full border-2 border-white/20 border-t-[#a3e635] animate-spin"></div>
      <p class="text-sm font-mono text-zinc-400">Loading drive records…</p>
    </div>
  {:else if filteredCompanies.length === 0}
    <div class="neon-card p-16 text-center">
      <div class="text-3xl mb-3 text-zinc-500">∅</div>
      <h3 class="text-base font-semibold text-white">No Companies Found</h3>
      <p class="text-xs sm:text-sm text-zinc-400 font-mono mt-1">No company profile matches "{searchTerm}"</p>
    </div>
  {:else}
    
    <!-- Bento Grid of Companies -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
      {#each filteredCompanies as company}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div 
          class="neon-card p-5 sm:p-6 cursor-pointer flex flex-col justify-between group touch-press relative overflow-hidden min-h-[220px]"
          on:click={() => viewCompany(company.id)}
        >
          <div>
            <div class="flex justify-between items-start gap-2 mb-2">
              <h2 class="text-base sm:text-lg font-display font-bold text-white group-hover:text-[#a3e635] transition-colors leading-snug">
                {company.name}
              </h2>
              {#if company.ctc}
                <span class="neon-badge-lime px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold whitespace-nowrap tabular-nums">
                  {company.ctc}
                </span>
              {/if}
            </div>

            {#if company.category}
              <div class="mb-2">
                <span class="neon-badge-purple px-2.5 py-0.5 rounded text-[10px] font-mono font-medium inline-block">
                  {company.category}
                </span>
              </div>
            {/if}

            {#if company.role}
              <div class="text-xs sm:text-sm font-medium text-[#38bdf8] mb-1.5 truncate">
                {company.role}
              </div>
            {/if}

            {#if company.job_location}
              <div class="text-xs text-zinc-400 font-mono mb-2">
                {company.job_location}
              </div>
            {/if}

            {#if company.notes}
              <div class="my-2.5 p-2.5 rounded-xl bg-zinc-900/90 border border-white/[0.06] text-xs text-zinc-300 font-sans">
                <span class="text-[10px] font-mono font-medium text-zinc-400 block mb-0.5 uppercase tracking-wider">Notes:</span>
                <p class="line-clamp-2 leading-relaxed">{company.notes}</p>
              </div>
            {/if}
          </div>

          <!-- Bottom Metric Chips -->
          <div class="pt-3 border-t border-white/[0.06] flex flex-wrap gap-1.5 text-[11px] font-mono text-zinc-400">
            {#if company.stipend}
              <span class="bg-zinc-800/80 px-2.5 py-0.5 rounded text-amber-300 border border-white/[0.06]">
                Stipend: {company.stipend}
              </span>
            {/if}
            {#if company.total_rounds || company.rounds}
              <span class="bg-zinc-800/80 px-2.5 py-0.5 rounded text-zinc-300 border border-white/[0.06]">
                {company.total_rounds || company.rounds} rounds
              </span>
            {/if}
          </div>
        </div>
      {/each}
    </div>

  {/if}
</div>

<!-- 🏢 VIEW COMPANY DETAILS BOTTOM SHEET / MODAL (SHOWCASE SIZING) -->
{#if selectedCompany}
  {@const finalsStats = getCampusStats(selectedCompany.finals)}
  {@const internsStats = getCampusStats(selectedCompany.interns)}

  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div 
    class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 lg:p-6 animate-in fade-in duration-200"
    on:click={() => { selectedCompany = null; editingCompany = null; }}
  >
    <div 
      class="w-full sm:max-w-6xl xl:max-w-7xl rounded-t-3xl sm:rounded-3xl bg-[#0F172A] border border-slate-700/80 p-5 sm:p-8 lg:p-10 max-h-[90vh] overflow-y-auto shadow-2xl relative"
      on:click|stopPropagation
    >
      <div class="sheet-handle sm:hidden"></div>

      <!-- Close Button -->
      <button 
        class="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 text-base touch-press z-10"
        on:click={() => { selectedCompany = null; editingCompany = null; }}
        aria-label="Close dialog"
      >
        ✕
      </button>

      <!-- Header & Quick Actions -->
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 sm:mb-8 pr-10">
        <div>
          <div class="flex items-center gap-3 flex-wrap">
            <h2 class="text-2xl sm:text-3xl lg:text-4xl font-display font-extrabold text-white">{selectedCompany.name}</h2>
            {#if selectedCompany.category}
              <span class="neon-badge-purple px-3 py-1 rounded-full text-xs font-mono font-bold">
                🌟 {selectedCompany.category}
              </span>
            {/if}
          </div>

          {#if selectedCompany.role}
            <div class="text-sm sm:text-base font-semibold text-[#00BCFF] mt-1.5">
              💼 Role: {selectedCompany.role}
            </div>
          {/if}

          <div class="flex flex-wrap gap-2 mt-3 font-mono text-xs sm:text-sm">
            {#if selectedCompany.ctc}
              <span class="neon-badge-lime px-3 py-1 rounded-lg font-bold">
                💰 CTC: {selectedCompany.ctc}
              </span>
            {/if}
            {#if selectedCompany.stipend}
              <span class="neon-badge-amber px-3 py-1 rounded-lg font-bold">
                💵 Stipend: {selectedCompany.stipend}
              </span>
            {/if}
            {#if selectedCompany.job_location}
              <span class="bg-slate-800 text-slate-300 px-3 py-1 rounded-lg border border-slate-700">
                📍 {selectedCompany.job_location}
              </span>
            {/if}
            {#if selectedCompany.total_rounds || selectedCompany.rounds}
              <span class="neon-badge-purple px-3 py-1 rounded-lg font-bold">
                📝 {selectedCompany.total_rounds || selectedCompany.rounds} Rounds
              </span>
            {/if}
            {#if selectedCompany.website}
              <a 
                href={selectedCompany.website.startsWith('http') ? selectedCompany.website : `https://${selectedCompany.website}`}
                target="_blank"
                rel="noreferrer"
                class="neon-badge-cyan px-3 py-1 rounded-lg font-bold hover:underline inline-flex items-center gap-1"
              >
                🌐 Website ↗
              </a>
            {/if}
          </div>
        </div>

        <div class="flex items-center gap-2.5">
          <button 
            type="button"
            on:click={() => openEditCompany(selectedCompany)}
            class="neon-btn-ghost px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 touch-press min-h-[42px]"
          >
            ✏️ Edit
          </button>
          <button 
            type="button"
            on:click={() => initiateDeleteCompany(selectedCompany)}
            class="px-4 py-2 bg-rose-950/60 border border-rose-800 text-rose-300 hover:bg-rose-900 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 touch-press min-h-[42px]"
          >
            🗑️ Delete
          </button>
        </div>
      </div>

      <!-- EDIT COMPANY FORM (When active) -->
      {#if editingCompany}
        <div class="neon-card p-5 sm:p-7 mb-8 border-amber-500/40 bg-[#080C14] space-y-4">
          <div class="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 class="text-base sm:text-lg font-display font-bold text-amber-300">✏️ Edit Company Profile</h3>
            <span class="text-xs font-mono text-slate-400">Manual Edit or AI Parser</span>
          </div>

          <!-- AI Email Parser in Edit Mode -->
          <div class="bg-[#0F172A] p-4 rounded-xl border border-slate-800 space-y-2">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <label for="edit-email-parser" class="text-xs font-mono font-bold text-amber-400 uppercase">
                ⚡ AI Auto-Fill / Update from Email Text
              </label>
              <button 
                type="button" 
                on:click={parseEditEmailWithAI} 
                disabled={isParsingEditEmail} 
                class="neon-btn-primary px-3 py-1.5 text-xs rounded-xl font-bold min-h-[36px]"
              >
                {isParsingEditEmail ? 'Parsing...' : '✨ Parse & Update Fields'}
              </button>
            </div>
            <textarea 
              id="edit-email-parser" 
              bind:value={editEmailRawText} 
              placeholder="Paste updated email text here..." 
              rows="3" 
              class="w-full text-xs font-mono px-3 py-2 rounded-xl"
            />
            {#if editEmailParseSuccessMsg}
              <div class="p-2 bg-[#BBF351]/10 text-[#BBF351] text-xs rounded-lg font-mono">{editEmailParseSuccessMsg}</div>
            {/if}
            {#if editEmailParseErrorMsg}
              <div class="p-2 bg-rose-950/40 text-rose-300 text-xs rounded-lg font-mono">{editEmailParseErrorMsg}</div>
            {/if}
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label for="edit-name" class="block font-mono uppercase text-slate-400 mb-1">Company Name</label>
              <input id="edit-name" type="text" class="w-full px-3 py-2 rounded-xl" bind:value={editingCompany.name} />
            </div>
            <div>
              <label for="edit-category" class="block font-mono uppercase text-slate-400 mb-1">Category</label>
              <input id="edit-category" type="text" class="w-full px-3 py-2 rounded-xl" bind:value={editingCompany.category} />
            </div>
            <div>
              <label for="edit-role" class="block font-mono uppercase text-slate-400 mb-1">Role</label>
              <input id="edit-role" type="text" list="edit-roles-list" class="w-full px-3 py-2 rounded-xl" bind:value={editingCompany.role} />
              <datalist id="edit-roles-list">
                {#each availableRoles as role}
                  <option value={role.name}>{role.category ? `${role.name} (${role.category})` : role.name}</option>
                {/each}
              </datalist>
            </div>
            <div>
              <label for="edit-ctc" class="block font-mono uppercase text-slate-400 mb-1">CTC</label>
              <input id="edit-ctc" type="text" class="w-full px-3 py-2 rounded-xl" bind:value={editingCompany.ctc} />
            </div>
            <div>
              <label for="edit-stipend" class="block font-mono uppercase text-slate-400 mb-1">Stipend</label>
              <input id="edit-stipend" type="text" class="w-full px-3 py-2 rounded-xl" bind:value={editingCompany.stipend} />
            </div>
            <div>
              <label for="edit-location" class="block font-mono uppercase text-slate-400 mb-1">Location</label>
              <input id="edit-location" type="text" class="w-full px-3 py-2 rounded-xl" bind:value={editingCompany.job_location} />
            </div>
            <div>
              <label for="edit-website" class="block font-mono uppercase text-slate-400 mb-1">Website</label>
              <input id="edit-website" type="text" class="w-full px-3 py-2 rounded-xl" bind:value={editingCompany.website} />
            </div>
            <div>
              <label for="edit-rounds" class="block font-mono uppercase text-slate-400 mb-1">Total Rounds</label>
              <input id="edit-rounds" type="text" class="w-full px-3 py-2 rounded-xl" bind:value={editingCompany.total_rounds} />
            </div>
            <div>
              <label for="edit-branches" class="block font-mono uppercase text-slate-400 mb-1">Eligible Branches</label>
              <input id="edit-branches" type="text" class="w-full px-3 py-2 rounded-xl" bind:value={editingCompany.eligible_branches} />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label for="edit-criteria" class="block font-mono uppercase text-slate-400 mb-1">Eligibility Criteria</label>
              <textarea id="edit-criteria" rows="3" class="w-full px-3 py-2 rounded-xl" bind:value={editingCompany.eligibility_criteria}></textarea>
            </div>
            <div>
              <label for="edit-notes" class="block font-mono uppercase text-[#BBF351] mb-1">General Notes</label>
              <textarea id="edit-notes" rows="3" class="w-full px-3 py-2 rounded-xl" bind:value={editingCompany.notes}></textarea>
            </div>
          </div>

          <div>
            <label for="edit-round-details" class="block font-mono uppercase text-slate-400 mb-1 text-xs">Round-by-Round Process Details</label>
            <textarea id="edit-round-details" rows="3" class="w-full px-3 py-2 rounded-xl text-xs" bind:value={editingCompany.round_details}></textarea>
          </div>

          <div class="flex justify-end gap-2.5 pt-2">
            <button class="neon-btn-ghost px-4 py-2 text-xs rounded-xl" on:click={() => editingCompany = null}>Cancel</button>
            <button class="neon-btn-primary px-5 py-2 text-xs font-bold rounded-xl" on:click={initiateSaveCompany}>Save Changes</button>
          </div>
        </div>
      {/if}

      <!-- SECTION 1: Company Overview & Placement Criteria -->
      <div class="neon-card p-5 sm:p-7 mb-8 space-y-4">
        <h3 class="text-base sm:text-lg font-display font-bold text-white flex items-center gap-2">
          <span>📋</span> Company Overview & Placement Criteria
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {#if selectedCompany.eligible_branches}
            <div class="bg-[#080C14] p-4 rounded-xl border border-slate-800">
              <span class="text-[11px] font-mono font-bold uppercase text-[#00BCFF] block mb-1">🎓 Eligible Branches</span>
              <p class="text-xs sm:text-sm text-slate-200 font-medium">{selectedCompany.eligible_branches}</p>
            </div>
          {/if}

          {#if selectedCompany.eligibility_criteria}
            <div class="bg-[#080C14] p-4 rounded-xl border border-slate-800">
              <span class="text-[11px] font-mono font-bold uppercase text-[#BBF351] block mb-1">📊 Eligibility Criteria</span>
              <p class="text-xs sm:text-sm text-slate-200 font-medium whitespace-pre-line">{selectedCompany.eligibility_criteria}</p>
            </div>
          {/if}
        </div>

        {#if selectedCompany.notes}
          <div class="bg-[#080C14] p-4 sm:p-5 rounded-2xl border border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.08)]">
            <span class="text-xs font-mono font-bold uppercase text-amber-400 flex items-center gap-1.5 mb-2">
              <span>📝</span> General Company Notes:
            </span>
            <p class="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line font-sans">{selectedCompany.notes}</p>
          </div>
        {/if}

        {#if selectedCompany.round_details}
          <div class="bg-[#080C14]/60 p-4 sm:p-5 rounded-2xl border border-slate-800/80">
            <span class="text-xs font-mono font-bold uppercase text-[#BBF351] flex items-center gap-1.5 mb-2">
              <span>⚡</span> Round-by-Round Process Details:
            </span>
            <p class="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line font-sans">{selectedCompany.round_details}</p>
          </div>
        {/if}
      </div>

      <!-- SECTION 2: Selection & Conversion Analytics Banner with Campus Breakdown -->
      {#if selectedCompany.analytics && selectedCompany.analytics.total_selected > 0}
        <div class="neon-card p-5 sm:p-7 mb-8 border-[#00BCFF]/40 bg-gradient-to-br from-[#0F172A] via-[#091e2b] to-[#0F172A] space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span class="text-xs font-mono font-bold uppercase tracking-wider text-[#00BCFF]">Selection Conversion Ratio</span>
              <div class="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-mono text-white mt-1">
                {selectedCompany.analytics.total_selected} / {selectedCompany.analytics.total_shortlisted}
                <span class="text-[#00BCFF] text-2xl sm:text-3xl ml-2">({selectedCompany.analytics.selection_ratio?.toFixed(1) || 0}%)</span>
              </div>
            </div>
          </div>

          <!-- Academic & Cutoff Summary Tiles -->
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center font-mono">
            <div class="bg-[#080C14] p-3 rounded-xl border border-slate-800">
              <span class="text-[10px] text-slate-400 uppercase block">Total Selected</span>
              <span class="text-base sm:text-lg font-bold text-white">{selectedCompany.analytics.total_selected || 0}</span>
            </div>
            <div class="bg-[#080C14] p-3 rounded-xl border border-slate-800">
              <span class="text-[10px] text-slate-400 uppercase block">Gender (M:F)</span>
              <span class="text-base sm:text-lg font-bold text-[#00BCFF]">{selectedCompany.analytics.gender_ratio_selected || 'N/A'}</span>
            </div>
            <div class="bg-[#080C14] p-3 rounded-xl border border-slate-800">
              <span class="text-[10px] text-slate-400 uppercase block">Min CGPA</span>
              <span class="text-base sm:text-lg font-bold text-[#BBF351]">{selectedCompany.analytics.min_cgpa_selected?.toFixed(2) || 'N/A'}</span>
            </div>
            <div class="bg-[#080C14] p-3 rounded-xl border border-slate-800">
              <span class="text-[10px] text-slate-400 uppercase block">Avg CGPA</span>
              <span class="text-base sm:text-lg font-bold text-[#00BCFF]">{selectedCompany.analytics.avg_cgpa_selected?.toFixed(2) || 'N/A'}</span>
            </div>
            <div class="bg-[#080C14] p-3 rounded-xl border border-slate-800">
              <span class="text-[10px] text-slate-400 uppercase block">Min 10th</span>
              <span class="text-base sm:text-lg font-bold text-white">{selectedCompany.analytics.min_tenth_selected?.toFixed(1) || 'N/A'}%</span>
            </div>
            <div class="bg-[#080C14] p-3 rounded-xl border border-slate-800">
              <span class="text-[10px] text-slate-400 uppercase block">Min 12th</span>
              <span class="text-base sm:text-lg font-bold text-white">{selectedCompany.analytics.min_twelfth_selected?.toFixed(1) || 'N/A'}%</span>
            </div>
          </div>

          <!-- Campus Breakdown Spotlight (Total, Chennai, Vellore, Unknown) -->
          <div class="bg-[#080C14]/90 p-4 rounded-xl border border-slate-800/80">
            <span class="text-xs font-mono font-bold uppercase text-[#BBF351] block mb-3">
              🏫 Placements by Campus (Total vs Chennai vs Vellore vs Unknown)
            </span>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono">
              <div class="bg-[#0F172A] p-3 rounded-xl border border-slate-800">
                <span class="text-[10px] text-slate-400 uppercase block">Total Placed</span>
                <span class="text-lg font-bold text-white">{finalsStats.total}</span>
              </div>
              <div class="bg-[#0F172A] p-3 rounded-xl border border-[#00BCFF]/40">
                <span class="text-[10px] text-[#00BCFF] uppercase block">🌴 Chennai</span>
                <span class="text-lg font-bold text-[#00BCFF]">{finalsStats.chennai}</span>
              </div>
              <div class="bg-[#0F172A] p-3 rounded-xl border border-purple-500/40">
                <span class="text-[10px] text-purple-300 uppercase block">🏛️ Vellore</span>
                <span class="text-lg font-bold text-purple-300">{finalsStats.vellore}</span>
              </div>
              <div class="bg-[#0F172A] p-3 rounded-xl border border-slate-700">
                <span class="text-[10px] text-slate-400 uppercase block">❓ Unknown</span>
                <span class="text-lg font-bold text-slate-400">{finalsStats.unknown}</span>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Search Filter & Page Size Selector Bar for Tables -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#080C14] p-3.5 px-4 rounded-xl border border-slate-800 mb-6">
        <div class="flex items-center gap-2 flex-1">
          <span class="text-slate-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Search candidate name, reg number, neo ID, or campus in all tables below..."
            bind:value={modalSearchTerm}
            class="w-full text-xs sm:text-sm px-3 py-1.5 rounded-lg bg-[#0F172A] border border-slate-700 text-white min-h-[38px]"
          />
        </div>

        <div class="flex items-center gap-2 font-mono text-xs text-slate-400 shrink-0">
          <label for="table-page-size" class="text-[11px] uppercase">Page Size:</label>
          <select
            id="table-page-size"
            bind:value={pageSize}
            class="px-2.5 py-1.5 rounded-lg bg-[#0F172A] border border-slate-700 text-white text-xs font-mono"
          >
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
            <option value={250}>250 rows</option>
            <option value={-1}>All rows</option>
          </select>
        </div>
      </div>

      <!-- SECTION 3: Final Placements Table (Full-Time Offers) -->
      {#if selectedCompany.finals && selectedCompany.finals.length > 0}
        {@const filteredFinals = getFilteredStudents(selectedCompany.finals, modalSearchTerm)}
        {@const totalPages = getTotalPages(filteredFinals.length, pageSize)}
        {@const paginatedFinals = getPaginatedSlice(filteredFinals, finalStudentsPage, pageSize)}
        {@const filteredStats = getCampusStats(filteredFinals)}

        <div class="neon-card p-5 sm:p-7 mb-8 space-y-4 border-emerald-500/40">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div class="flex items-center gap-2">
              <span class="text-xl">✅</span>
              <h3 class="text-base sm:text-lg font-display font-bold text-emerald-300">
                Final Full-Time Placement Offers
              </h3>
            </div>
            
            <!-- Campus Breakdown Chips -->
            <div class="flex items-center gap-2 font-mono text-xs flex-wrap">
              <span class="neon-badge-lime px-2.5 py-0.5 rounded-full font-bold">
                Total: {filteredStats.total}
              </span>
              <span class="neon-badge-cyan px-2.5 py-0.5 rounded-full font-bold">
                🌴 Chennai: {filteredStats.chennai}
              </span>
              <span class="neon-badge-purple px-2.5 py-0.5 rounded-full font-bold">
                🏛️ Vellore: {filteredStats.vellore}
              </span>
              {#if filteredStats.unknown > 0}
                <span class="bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full border border-slate-700">
                  ❓ Unknown: {filteredStats.unknown}
                </span>
              {/if}
            </div>
          </div>

          <div class="table-responsive max-h-[380px] overflow-y-auto rounded-xl border border-slate-800 bg-[#080C14]">
            <table class="w-full text-left text-xs border-collapse font-mono min-w-[700px]">
              <thead class="sticky top-0 z-10 bg-[#0F172A]">
                <tr class="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                  <th class="py-2.5 px-3">Reg No / Neo ID</th>
                  <th class="py-2.5 px-3">Name</th>
                  <th class="py-2.5 px-3">Role</th>
                  <th class="py-2.5 px-2">Campus</th>
                  <th class="py-2.5 px-2">TopCoder</th>
                  <th class="py-2.5 px-2">CGPA</th>
                  <th class="py-2.5 px-2">Gender</th>
                  <th class="py-2.5 px-3 text-right">Resume</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60">
                {#if paginatedFinals.length === 0}
                  <tr>
                    <td colspan="8" class="py-8 text-center text-slate-500">No placed candidates matching "{modalSearchTerm}".</td>
                  </tr>
                {:else}
                  {#each paginatedFinals as student}
                    <tr class="hover:bg-slate-800/40 transition-colors">
                      <td class="py-2.5 px-3">
                        <span class="text-slate-200 font-bold">{student.regno}</span>
                        {#if student.neo_id}
                          <span class="neon-badge-cyan ml-1 px-1.5 py-0.5 rounded text-[10px]">{student.neo_id}</span>
                        {/if}
                      </td>
                      <td class="py-2.5 px-3 font-sans font-bold text-slate-100">{student.name}</td>
                      <td class="py-2.5 px-3">
                        {#if student.role}
                          <span class="neon-badge-lime px-2 py-0.5 rounded text-[10px] font-bold">
                            💼 {student.role}
                          </span>
                        {:else}
                          <span class="text-slate-600">—</span>
                        {/if}
                      </td>
                      <td class="py-2.5 px-2">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold {student.campus === 'Chennai' ? 'neon-badge-cyan' : student.campus === 'Vellore' ? 'neon-badge-purple' : 'bg-slate-800 text-slate-400'}">
                          {student.campus || 'Unknown'}
                        </span>
                      </td>
                      <td class="py-2.5 px-2">
                        {#if student.topcoder}
                          <span class="neon-badge-amber px-2 py-0.5 rounded text-[10px] font-bold">⚡ Yes</span>
                        {:else}
                          <span class="text-slate-600 text-[11px]">—</span>
                        {/if}
                      </td>
                      <td class="py-2.5 px-2 font-bold {parseFloat(student.cgpa) >= 9.0 ? 'text-[#BBF351]' : parseFloat(student.cgpa) >= 8.0 ? 'text-[#00BCFF]' : 'text-slate-300'}">
                        {student.cgpa?.toFixed(2) || 'N/A'}
                      </td>
                      <td class="py-2.5 px-2 text-slate-400">{student.gender || 'N/A'}</td>
                      <td class="py-2.5 px-3 text-right">
                        {#if student.resume_link}
                          <a href={student.resume_link} target="_blank" rel="noopener noreferrer" class="text-[#00BCFF] hover:underline font-bold">
                            View ↗
                          </a>
                        {:else}
                          <span class="text-slate-600">—</span>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                {/if}
              </tbody>
            </table>
          </div>

          <!-- Pagination Bar -->
          {#if pageSize > 0 && totalPages > 1}
            <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 font-mono text-xs">
              <span class="text-slate-400">
                Showing {(finalStudentsPage - 1) * pageSize + 1} - {Math.min(finalStudentsPage * pageSize, filteredFinals.length)} of {filteredFinals.length}
              </span>
              <div class="flex items-center gap-2">
                <button
                  class="neon-btn-ghost px-3 py-1.5 rounded-lg disabled:opacity-30"
                  disabled={finalStudentsPage <= 1}
                  on:click={() => finalStudentsPage--}
                >
                  ← Prev
                </button>
                <span class="px-3 py-1 rounded bg-slate-800 text-slate-200">
                  Page {finalStudentsPage} / {totalPages}
                </span>
                <button
                  class="neon-btn-ghost px-3 py-1.5 rounded-lg disabled:opacity-30"
                  disabled={finalStudentsPage >= totalPages}
                  on:click={() => finalStudentsPage++}
                >
                  Next →
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- SECTION 4: Intern Selections Table -->
      {#if selectedCompany.interns && selectedCompany.interns.length > 0}
        {@const filteredInterns = getFilteredStudents(selectedCompany.interns, modalSearchTerm)}
        {@const totalPages = getTotalPages(filteredInterns.length, pageSize)}
        {@const paginatedInterns = getPaginatedSlice(filteredInterns, internStudentsPage, pageSize)}
        {@const filteredStats = getCampusStats(filteredInterns)}

        <div class="neon-card p-5 sm:p-7 mb-8 space-y-4 border-amber-500/40">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div class="flex items-center gap-2">
              <span class="text-xl">💼</span>
              <h3 class="text-base sm:text-lg font-display font-bold text-amber-300">
                Internship Selections
              </h3>
            </div>
            
            <!-- Campus Breakdown Chips -->
            <div class="flex items-center gap-2 font-mono text-xs flex-wrap">
              <span class="neon-badge-amber px-2.5 py-0.5 rounded-full font-bold">
                Total: {filteredStats.total}
              </span>
              <span class="neon-badge-cyan px-2.5 py-0.5 rounded-full font-bold">
                🌴 Chennai: {filteredStats.chennai}
              </span>
              <span class="neon-badge-purple px-2.5 py-0.5 rounded-full font-bold">
                🏛️ Vellore: {filteredStats.vellore}
              </span>
              {#if filteredStats.unknown > 0}
                <span class="bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full border border-slate-700">
                  ❓ Unknown: {filteredStats.unknown}
                </span>
              {/if}
            </div>
          </div>

          <div class="table-responsive max-h-[380px] overflow-y-auto rounded-xl border border-slate-800 bg-[#080C14]">
            <table class="w-full text-left text-xs border-collapse font-mono min-w-[700px]">
              <thead class="sticky top-0 z-10 bg-[#0F172A]">
                <tr class="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                  <th class="py-2.5 px-3">Reg No / Neo ID</th>
                  <th class="py-2.5 px-3">Name</th>
                  <th class="py-2.5 px-3">Role</th>
                  <th class="py-2.5 px-2">Campus</th>
                  <th class="py-2.5 px-2">TopCoder</th>
                  <th class="py-2.5 px-2">CGPA</th>
                  <th class="py-2.5 px-2">Gender</th>
                  <th class="py-2.5 px-3 text-right">Resume</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60">
                {#if paginatedInterns.length === 0}
                  <tr>
                    <td colspan="8" class="py-8 text-center text-slate-500">No intern candidates matching "{modalSearchTerm}".</td>
                  </tr>
                {:else}
                  {#each paginatedInterns as student}
                    <tr class="hover:bg-slate-800/40 transition-colors">
                      <td class="py-2.5 px-3">
                        <span class="text-slate-200 font-bold">{student.regno}</span>
                        {#if student.neo_id}
                          <span class="neon-badge-cyan ml-1 px-1.5 py-0.5 rounded text-[10px]">{student.neo_id}</span>
                        {/if}
                      </td>
                      <td class="py-2.5 px-3 font-sans font-bold text-slate-100">{student.name}</td>
                      <td class="py-2.5 px-3">
                        {#if student.role}
                          <span class="neon-badge-amber px-2 py-0.5 rounded text-[10px] font-bold">
                            💼 {student.role}
                          </span>
                        {:else}
                          <span class="text-slate-600">—</span>
                        {/if}
                      </td>
                      <td class="py-2.5 px-2">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold {student.campus === 'Chennai' ? 'neon-badge-cyan' : student.campus === 'Vellore' ? 'neon-badge-purple' : 'bg-slate-800 text-slate-400'}">
                          {student.campus || 'Unknown'}
                        </span>
                      </td>
                      <td class="py-2.5 px-2">
                        {#if student.topcoder}
                          <span class="neon-badge-amber px-2 py-0.5 rounded text-[10px] font-bold">⚡ Yes</span>
                        {:else}
                          <span class="text-slate-600 text-[11px]">—</span>
                        {/if}
                      </td>
                      <td class="py-2.5 px-2 font-bold {parseFloat(student.cgpa) >= 9.0 ? 'text-[#BBF351]' : parseFloat(student.cgpa) >= 8.0 ? 'text-[#00BCFF]' : 'text-slate-300'}">
                        {student.cgpa?.toFixed(2) || 'N/A'}
                      </td>
                      <td class="py-2.5 px-2 text-slate-400">{student.gender || 'N/A'}</td>
                      <td class="py-2.5 px-3 text-right">
                        {#if student.resume_link}
                          <a href={student.resume_link} target="_blank" rel="noopener noreferrer" class="text-[#00BCFF] hover:underline font-bold">
                            View ↗
                          </a>
                        {:else}
                          <span class="text-slate-600">—</span>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                {/if}
              </tbody>
            </table>
          </div>

          <!-- Pagination Bar -->
          {#if pageSize > 0 && totalPages > 1}
            <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 font-mono text-xs">
              <span class="text-slate-400">
                Showing {(internStudentsPage - 1) * pageSize + 1} - {Math.min(internStudentsPage * pageSize, filteredInterns.length)} of {filteredInterns.length}
              </span>
              <div class="flex items-center gap-2">
                <button
                  class="neon-btn-ghost px-3 py-1.5 rounded-lg disabled:opacity-30"
                  disabled={internStudentsPage <= 1}
                  on:click={() => internStudentsPage--}
                >
                  ← Prev
                </button>
                <span class="px-3 py-1 rounded bg-slate-800 text-slate-200">
                  Page {internStudentsPage} / {totalPages}
                </span>
                <button
                  class="neon-btn-ghost px-3 py-1.5 rounded-lg disabled:opacity-30"
                  disabled={internStudentsPage >= totalPages}
                  on:click={() => internStudentsPage++}
                >
                  Next →
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- SECTION 5: Multi-Round Shortlist Funnels -->
      {#if selectedCompany.shortlist_rounds && selectedCompany.shortlist_rounds.length > 0}
        <div class="space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <h3 class="text-base sm:text-lg font-display font-bold text-white flex items-center gap-2">
              <span>📋</span> Multi-Round Shortlist Funnels
            </h3>
          </div>

          {#each selectedCompany.shortlist_rounds as round}
            {@const filteredStudents = getFilteredStudents(round.students, modalSearchTerm)}
            {@const curPage = roundPages[round.round_number] || 1}
            {@const totalPages = getTotalPages(filteredStudents.length, pageSize)}
            {@const paginatedStudents = getPaginatedSlice(filteredStudents, curPage, pageSize)}
            {@const roundStats = getCampusStats(filteredStudents)}

            <div class="neon-card overflow-hidden">
              <div class="bg-[#080C14] p-4 px-5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800">
                
                {#if editingRoundNumber === round.round_number}
                  <div class="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      bind:value={editingRoundNameInput}
                      class="px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-white bg-[#0F172A] border border-slate-700 flex-1 max-w-sm"
                    />
                    <button
                      on:click={() => initiateSaveRoundName(selectedCompany.id, round.round_number)}
                      class="neon-btn-primary px-3 py-1.5 text-xs font-bold rounded-lg"
                    >
                      Save
                    </button>
                    <button
                      on:click={() => editingRoundNumber = null}
                      class="neon-btn-ghost px-3 py-1.5 text-xs rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                {:else}
                  <div class="flex items-center gap-3">
                    <h4 class="text-sm font-mono font-bold text-[#BBF351]">
                      📋 {round.round_name || `Round ${round.round_number}`}
                    </h4>
                    <button
                      on:click={() => startRenamingRound(round)}
                      class="text-[11px] font-mono text-slate-400 hover:text-white"
                      title="Rename stage"
                    >
                      ✏️ Rename
                    </button>
                    <button
                      on:click={() => initiateDeleteRound(selectedCompany.id, round.round_number)}
                      class="text-[11px] font-mono text-rose-400 hover:text-rose-300"
                      title="Delete stage"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                {/if}

                <!-- Campus Breakdown Pills in Round Header -->
                <div class="flex items-center gap-2 font-mono text-xs flex-wrap">
                  <span class="neon-badge-cyan px-2.5 py-0.5 rounded-full font-bold">
                    Total: {roundStats.total}
                  </span>
                  <span class="bg-slate-800 text-[#00BCFF] px-2.5 py-0.5 rounded-full border border-slate-700 font-bold">
                    🌴 Chennai: {roundStats.chennai}
                  </span>
                  <span class="bg-slate-800 text-purple-300 px-2.5 py-0.5 rounded-full border border-slate-700 font-bold">
                    🏛️ Vellore: {roundStats.vellore}
                  </span>
                  {#if roundStats.unknown > 0}
                    <span class="bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full border border-slate-700">
                      ❓ Unknown: {roundStats.unknown}
                    </span>
                  {/if}
                </div>
              </div>

              <!-- Round Level Analytics Summary -->
              <div class="bg-[#080C14]/60 p-3 px-5 border-b border-slate-800/80 grid grid-cols-2 sm:grid-cols-5 gap-2 text-center font-mono text-xs">
                <div class="bg-[#0F172A] p-2 rounded-lg border border-slate-800">
                  <span class="text-[9px] text-slate-400 uppercase block">Gender (M:F)</span>
                  <span class="font-bold text-white">{round.male_count || 0}:{round.female_count || 0}</span>
                </div>
                <div class="bg-[#0F172A] p-2 rounded-lg border border-slate-800">
                  <span class="text-[9px] text-slate-400 uppercase block">Min / Avg CGPA</span>
                  <span class="font-bold text-[#BBF351]">{round.min_cgpa?.toFixed(2) || 'N/A'} / {round.avg_cgpa?.toFixed(2) || 'N/A'}</span>
                </div>
                <div class="bg-[#0F172A] p-2 rounded-lg border border-slate-800">
                  <span class="text-[9px] text-slate-400 uppercase block">Min / Avg 10th</span>
                  <span class="font-bold text-white">{round.min_tenth?.toFixed(1) || 'N/A'}% / {round.avg_tenth?.toFixed(1) || 'N/A'}%</span>
                </div>
                <div class="bg-[#0F172A] p-2 rounded-lg border border-slate-800">
                  <span class="text-[9px] text-slate-400 uppercase block">Min / Avg 12th</span>
                  <span class="font-bold text-white">{round.min_twelfth?.toFixed(1) || 'N/A'}% / {round.avg_twelfth?.toFixed(1) || 'N/A'}%</span>
                </div>
                <div class="bg-[#0F172A] p-2 rounded-lg border border-slate-800">
                  <span class="text-[9px] text-slate-400 uppercase block">TopCoder</span>
                  <span class="font-bold text-amber-400">{round.students.filter(s => s.topcoder).length || 0}</span>
                </div>
              </div>

              <!-- Table -->
              <div class="table-responsive max-h-[320px] overflow-y-auto">
                <table class="w-full text-left text-xs border-collapse font-mono min-w-[700px]">
                  <thead class="sticky top-0 z-10 bg-[#0F172A]">
                    <tr class="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                      <th class="py-2.5 px-3">Reg No / Neo ID</th>
                      <th class="py-2.5 px-3">Name</th>
                      <th class="py-2.5 px-3">Role</th>
                      <th class="py-2.5 px-2">Campus</th>
                      <th class="py-2.5 px-2">TopCoder</th>
                      <th class="py-2.5 px-2">CGPA</th>
                      <th class="py-2.5 px-2">Gender</th>
                      <th class="py-2.5 px-3 text-right">Resume</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800/60">
                    {#if paginatedStudents.length === 0}
                      <tr>
                        <td colspan="8" class="py-6 text-center text-slate-500 text-xs">No students matching "{modalSearchTerm}" in this round.</td>
                      </tr>
                    {:else}
                      {#each paginatedStudents as student}
                        <tr class="hover:bg-slate-800/40 transition-colors">
                          <td class="py-2.5 px-3">
                            <span class="text-slate-200 font-bold">{student.regno}</span>
                            {#if student.neo_id}
                              <span class="neon-badge-cyan ml-1 px-1.5 py-0.5 rounded text-[10px]">{student.neo_id}</span>
                            {/if}
                          </td>
                          <td class="py-2.5 px-3 font-sans font-bold text-slate-100">{student.name}</td>
                          <td class="py-2.5 px-3">
                            {#if student.role}
                              <span class="neon-badge-purple px-2 py-0.5 rounded text-[10px] font-bold">
                                💼 {student.role}
                              </span>
                            {:else}
                              <span class="text-slate-600">—</span>
                            {/if}
                          </td>
                          <td class="py-2.5 px-2">
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold {student.campus === 'Chennai' ? 'neon-badge-cyan' : student.campus === 'Vellore' ? 'neon-badge-purple' : 'bg-slate-800 text-slate-400'}">
                              {student.campus || 'Unknown'}
                            </span>
                          </td>
                          <td class="py-2.5 px-2">
                            {#if student.topcoder}
                              <span class="neon-badge-amber px-2 py-0.5 rounded text-[10px] font-bold">⚡ Yes</span>
                            {:else}
                              <span class="text-slate-600 text-[11px]">—</span>
                            {/if}
                          </td>
                          <td class="py-2.5 px-2 font-bold {parseFloat(student.cgpa) >= 9.0 ? 'text-[#BBF351]' : parseFloat(student.cgpa) >= 8.0 ? 'text-[#00BCFF]' : 'text-slate-300'}">
                            {student.cgpa?.toFixed(2) || 'N/A'}
                          </td>
                          <td class="py-2.5 px-2 text-slate-400">{student.gender || 'N/A'}</td>
                          <td class="py-2.5 px-3 text-right">
                            {#if student.resume_link}
                              <a href={student.resume_link} target="_blank" rel="noopener noreferrer" class="text-[#00BCFF] hover:underline font-bold">
                                View ↗
                              </a>
                            {:else}
                              <span class="text-slate-600">—</span>
                            {/if}
                          </td>
                        </tr>
                      {/each}
                    {/if}
                  </tbody>
                </table>
              </div>

              <!-- Round Pagination Bar -->
              {#if pageSize > 0 && totalPages > 1}
                <div class="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 px-5 bg-[#080C14] border-t border-slate-800 font-mono text-xs">
                  <span class="text-slate-400">
                    Showing {(curPage - 1) * pageSize + 1} - {Math.min(curPage * pageSize, filteredStudents.length)} of {filteredStudents.length}
                  </span>
                  <div class="flex items-center gap-2">
                    <button
                      class="neon-btn-ghost px-3 py-1.5 rounded-lg disabled:opacity-30"
                      disabled={curPage <= 1}
                      on:click={() => setRoundPage(round.round_number, curPage - 1)}
                    >
                      ← Prev
                    </button>
                    <span class="px-3 py-1 rounded bg-slate-800 text-slate-200">
                      Page {curPage} / {totalPages}
                    </span>
                    <button
                      class="neon-btn-ghost px-3 py-1.5 rounded-lg disabled:opacity-30"
                      disabled={curPage >= totalPages}
                      on:click={() => setRoundPage(round.round_number, curPage + 1)}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

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
