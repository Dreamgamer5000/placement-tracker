<script lang="ts">
  import { onMount } from 'svelte';

  let students: any[] = [];
  let loading = true;
  let searchTerm = '';
  let debouncedSearch = '';
  let searchTimer: any = null;
  let page = 1;
  let limit = 50;
  let totalCount = 0;
  let totalPages = 1;

  let selectedStudent: any = null;
  let editingStudent: any = null;
  let saveLoading = false;
  let saveMessage = '';
  let filterUnmappedChennai = false;
  let unmappedChennaiCount = 0;
  let filterMasters = false;
  let mastersCount = 0;
  let sortBy: 'default' | 'shortlists' = 'default';

  onMount(async () => {
    await loadStudents();
  });

  function handleSearchInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    searchTerm = val;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      debouncedSearch = val;
      page = 1;
      loadStudents();
    }, 300);
  }

  async function toggleUnmappedChennaiFilter() {
    filterUnmappedChennai = !filterUnmappedChennai;
    page = 1;
    await loadStudents();
  }

  async function toggleMastersFilter() {
    filterMasters = !filterMasters;
    page = 1;
    await loadStudents();
  }

  async function loadStudents() {
    loading = true;
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search: debouncedSearch,
        sortByShortlists: (sortBy === 'shortlists').toString(),
        unmappedChennai: filterUnmappedChennai.toString(),
        masters: filterMasters.toString()
      });
      const response = await fetch(`/api/students?${params.toString()}`);
      const data = await response.json();

      if (data && Array.isArray(data.students)) {
        students = data.students;
        totalCount = data.totalCount || data.students.length;
        unmappedChennaiCount = data.unmappedChennaiCount || 0;
        mastersCount = data.mastersCount || 0;
        totalPages = data.totalPages || 1;
      } else if (Array.isArray(data)) {
        students = data;
        totalCount = data.length;
        totalPages = 1;
      } else {
        students = [];
      }
    } catch (error) {
      console.error('Error loading students:', error);
      students = [];
    } finally {
      loading = false;
    }
  }

  async function changePage(newPage: number) {
    if (newPage < 1 || newPage > totalPages) return;
    page = newPage;
    await loadStudents();
  }

  async function viewStudent(regno: string) {
    const s = students.find(item => item.regno === regno);
    selectedStudent = s ? { ...s, loadingDetails: true } : null;
    try {
      const response = await fetch(`/api/students/${regno}`);
      if (response.ok) {
        selectedStudent = await response.json();
      }
    } catch (error) {
      console.error('Error fetching full student details:', error);
    }
  }

  function openEdit(student: any) {
    editingStudent = { ...student };
    saveMessage = '';
  }

  async function saveStudent() {
    if (!editingStudent) return;
    saveLoading = true;
    saveMessage = '';
    try {
      const response = await fetch(`/api/students/${editingStudent.regno}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingStudent)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save student details');
      }

      const updated = await response.json();
      saveMessage = '✅ Student details updated successfully!';
      
      // Update in local state (keyed by regno since temp_students has no integer id)
      students = students.map(s => s.regno === updated.regno ? { ...s, ...updated } : s);
      if (selectedStudent && selectedStudent.regno === updated.regno) {
        selectedStudent = { ...selectedStudent, ...updated };
      }
      setTimeout(() => {
        saveMessage = '';
      }, 4000);
    } catch (error: any) {
      saveMessage = `❌ Error: ${error.message}`;
    } finally {
      saveLoading = false;
    }
  }

  async function toggleSort() {
    if (sortBy === 'default') {
      sortBy = 'shortlists';
    } else {
      sortBy = 'default';
    }
    page = 1;
    await loadStudents();
  }
</script>

<div class="student-list">
  <div class="header-row">
    <div>
      <h2>👥 Student Directory</h2>
      <p class="text-xs text-gray-500 mt-1">Manage students, Neo IDs, placement statuses, and company shortlists.</p>
    </div>
    <div class="flex items-center gap-2">
      <button 
        type="button"
        class="px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 {!filterUnmappedChennai ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'}"
        on:click={() => { if (filterUnmappedChennai) { filterUnmappedChennai = false; page = 1; loadStudents(); } }}
      >
        All Students ({filterUnmappedChennai ? 'Show All' : totalCount})
      </button>
      <button 
        type="button"
        class="px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 {filterUnmappedChennai ? 'bg-amber-600 text-white border-amber-600 shadow-sm' : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'}"
        on:click={toggleUnmappedChennaiFilter}
      >
        ⚠️ Unmapped Chennai NeoIDs ({unmappedChennaiCount})
      </button>
      <button 
        type="button"
        class="px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 {filterMasters ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-indigo-50 text-indigo-900 border-indigo-300 hover:bg-indigo-100'}"
        on:click={toggleMastersFilter}
      >
        🎓 Masters ({mastersCount})
      </button>
    </div>
  </div>
  
  <div class="search-container">
    <input 
      type="text" 
      class="search-box"
      placeholder="🔍 Search by name, regno, neoID, or branch (fuzzy search)..." 
      value={searchTerm}
      on:input={handleSearchInput}
    />
  </div>

  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading students...</p>
    </div>
  {:else if students.length === 0}
    <div class="empty-state">
      <p>No students found matching "{searchTerm}"</p>
    </div>
  {:else}
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Reg No</th>
            <th>Neo ID</th>
            <th>Name</th>
            <th>TopCoder</th>
            <th>Campus</th>
            <th>CGPA</th>
            <th class="sortable" on:click={toggleSort}>
              Shortlists 
              {#if sortBy === 'shortlists'}
                <span class="sort-icon">⬇</span>
              {:else}
                <span class="sort-icon">⬍</span>
              {/if}
            </th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each students as student}
            <tr>
              <td><span class="regno-tag">{student.regno}</span></td>
              <td>
                <span class="neo-badge" class:has-neoid={student.neo_id}>
                  {student.neo_id || 'Not Assigned'}
                </span>
              </td>
              <td class="name-cell">{student.name}</td>
              <td>
                {#if student.topcoder}
                  <span class="status topcoder">⚡ TopCoder</span>
                {:else}
                  <span class="text-gray-400 text-xs">No</span>
                {/if}
              </td>
              <td>{student.campus}</td>
              <td><strong>{student.cgpa || 'N/A'}</strong></td>
              <td>
                <span class="shortlist-count" class:has-shortlists={student.shortlist_count > 0}>
                  {student.shortlist_count || 0}
                </span>
              </td>
              <td>
                {#if student.status === 'placed'}
                  <span class="status placed">✓ Placed</span>
                {:else if student.status === 'intern'}
                  <span class="status intern">💼 Intern</span>
                {:else if student.status === 'masters'}
                  <span class="status masters">🎓 Masters</span>
                {:else}
                  <span class="status not-placed">Not Placed</span>
                {/if}
              </td>
              <td class="action-cells">
                <button class="btn-action btn-view" on:click={() => viewStudent(student.regno)}>
                  View Details
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Pagination Bar -->
    <div class="pagination-bar">
      <span class="pagination-info">
        Showing <strong>{(page - 1) * limit + 1}</strong> to <strong>{Math.min(page * limit, totalCount)}</strong> of <strong>{totalCount}</strong> students
      </span>

      <div class="pagination-controls">
        <button class="btn-page" disabled={page === 1} on:click={() => changePage(page - 1)}>
          ← Previous
        </button>
        <span class="page-indicator">Page {page} of {totalPages}</span>
        <button class="btn-page" disabled={page >= totalPages} on:click={() => changePage(page + 1)}>
          Next →
        </button>
      </div>
    </div>
  {/if}
</div>

{#if selectedStudent}
  <button class="modal" type="button" on:click|self={() => selectedStudent = null}>
    <div class="modal-content text-left cursor-default">
      <button class="close-btn" on:click={() => selectedStudent = null}>×</button>
      
      <div class="modal-header">
        <h3>{selectedStudent.name}</h3>
        <button class="btn-primary btn-edit-header" on:click={() => openEdit(selectedStudent)}>
          ✏️ Edit Details
        </button>
      </div>

      <div class="details-grid">
        <div class="detail-item"><strong>Registration No:</strong> {selectedStudent.regno}</div>
        <div class="detail-item">
          <strong>Neo ID:</strong> 
          <span class="neo-badge" class:has-neoid={selectedStudent.neo_id}>
            {selectedStudent.neo_id || 'Not Assigned'}
          </span>
        </div>
        <div class="detail-item"><strong>Email:</strong> {selectedStudent.email}</div>
        <div class="detail-item"><strong>Phone:</strong> {selectedStudent.phone || 'N/A'}</div>
        <div class="detail-item"><strong>Personal Email:</strong> {selectedStudent.personal_email || 'N/A'}</div>
        <div class="detail-item"><strong>Gender:</strong> {selectedStudent.gender || 'N/A'}</div>
        <div class="detail-item"><strong>CGPA:</strong> {selectedStudent.cgpa || 'N/A'}</div>
        <div class="detail-item"><strong>10th Marks:</strong> {selectedStudent.tenth_marks || 'N/A'}</div>
        <div class="detail-item"><strong>12th Marks:</strong> {selectedStudent.twelfth_marks || 'N/A'}</div>
        <div class="detail-item"><strong>Campus:</strong> {selectedStudent.campus}</div>
        <div class="detail-item"><strong>Status:</strong> {selectedStudent.status}</div>
        <div class="detail-item">
          <strong>TopCoder:</strong> 
          {#if selectedStudent.topcoder}
            <span class="status topcoder">⚡ Yes (TopCoder)</span>
          {:else}
            No
          {/if}
        </div>
      </div>

      {#if selectedStudent.resume_link}
        <div class="detail-item">
          <strong>Resume:</strong> 
          <a href={selectedStudent.resume_link} target="_blank" rel="noopener noreferrer">
            View Resume 🔗
          </a>
        </div>
      {/if}

      {#if selectedStudent.loadingDetails}
        <div class="py-8 text-center text-gray-500 font-medium">
          <div class="spinner mx-auto mb-2"></div>
          Loading full placement records...
        </div>
      {:else}
        <!-- Shortlisted Companies Section -->
        <div class="mt-6 pt-6 border-t border-gray-100">
          <h4 class="text-sm font-bold uppercase tracking-wider text-purple-900 mb-3 flex items-center gap-2">
            <span>📋</span> Shortlisted Companies ({selectedStudent.shortlists ? selectedStudent.shortlists.length : 0})
          </h4>
          {#if selectedStudent.shortlists && selectedStudent.shortlists.length > 0}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {#each selectedStudent.shortlists as company}
                <div class="flex items-center justify-between p-3 rounded-xl bg-purple-50/70 border border-purple-100 hover:border-purple-200 transition-all">
                  <div class="font-semibold text-gray-800 text-sm">{company.name}</div>
                  {#if company.round_name || company.round_number}
                    <span class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-purple-200 text-purple-800">
                      {company.round_name || `Round ${company.round_number}`}
                    </span>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-xs text-gray-400 italic">No shortlists recorded for this student.</p>
          {/if}
        </div>

        <!-- Selections & Internships Section -->
        <div class="mt-6 pt-6 border-t border-gray-100">
          <h4 class="text-sm font-bold uppercase tracking-wider text-emerald-900 mb-3 flex items-center gap-2">
            <span>✅</span> Selections & Offers ({selectedStudent.selections ? selectedStudent.selections.length : 0})
          </h4>
          {#if selectedStudent.selections && selectedStudent.selections.length > 0}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {#each selectedStudent.selections as selection}
                <div class="flex items-center justify-between p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 hover:border-emerald-300 transition-all">
                  <div>
                    <div class="font-bold text-emerald-950 text-sm">{selection.name}</div>
                    {#if selection.ctc_lpa || selection.package_lpa}
                      <div class="text-xs text-emerald-700 font-medium">Package: {selection.ctc_lpa || selection.package_lpa} LPA</div>
                    {/if}
                  </div>
                  <span class="text-xs font-bold px-2.5 py-1 rounded-lg {selectedStudent.status === 'intern' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'} shadow-xs">
                    {selectedStudent.status === 'intern' ? 'Interned' : 'Selected'}
                  </span>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-xs text-gray-400 italic">No selections recorded for this student.</p>
          {/if}
        </div>

        <!-- Final Placed / Interned Company Banner -->
        {#if selectedStudent.finalCompany}
          {#if selectedStudent.status === 'intern' || selectedStudent.status?.toLowerCase().includes('intern')}
            <div class="mt-6 p-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md flex items-center justify-between">
              <div>
                <span class="text-xs uppercase font-bold tracking-wider opacity-90">Internship Record</span>
                <h4 class="text-lg font-extrabold m-0 text-white">
                  Interned at {selectedStudent.finalCompany.name}
                </h4>
              </div>
              {#if selectedStudent.finalCompany.ctc_lpa}
                <span class="text-sm font-extrabold bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/30">
                  {selectedStudent.finalCompany.ctc_lpa} LPA
                </span>
              {/if}
            </div>
          {:else}
            <div class="mt-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md flex items-center justify-between">
              <div>
                <span class="text-xs uppercase font-bold tracking-wider opacity-90">Official Placement</span>
                <h4 class="text-lg font-extrabold m-0 text-white">
                  Placed at {selectedStudent.finalCompany.name}
                </h4>
              </div>
              {#if selectedStudent.finalCompany.ctc_lpa}
                <span class="text-sm font-extrabold bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/30">
                  {selectedStudent.finalCompany.ctc_lpa} LPA
                </span>
              {/if}
            </div>
          {/if}
        {/if}
      {/if}
    </div>
  </button>
{/if}

{#if editingStudent}
  <button class="modal" type="button" on:click|self={() => editingStudent = null}>
    <div class="modal-content edit-modal text-left cursor-default">
      <button class="close-btn" on:click={() => editingStudent = null}>×</button>
      <h3>✏️ Edit Student Details</h3>

      {#if saveMessage}
        <div class="alert" class:alert-error={saveMessage.includes('❌')} class:alert-success={saveMessage.includes('✅')}>
          {saveMessage}
        </div>
      {/if}

      <form on:submit|preventDefault={saveStudent} class="edit-form">
        <div class="form-grid">
          <div class="form-group">
            <label for="edit-name">Name *</label>
            <input id="edit-name" type="text" bind:value={editingStudent.name} required />
          </div>

          <div class="form-group">
            <label for="edit-regno">Register Number *</label>
            <input id="edit-regno" type="text" bind:value={editingStudent.regno} required />
          </div>

          <div class="form-group">
            <label for="edit-neoid">Neo ID (e.g. O3U8P6W1)</label>
            <input id="edit-neoid" type="text" bind:value={editingStudent.neo_id} placeholder="O3U8P6W1" />
          </div>

          <div class="form-group">
            <label for="edit-email">Email *</label>
            <input id="edit-email" type="email" bind:value={editingStudent.email} required />
          </div>

          <div class="form-group">
            <label for="edit-personal-email">Personal Email</label>
            <input id="edit-personal-email" type="email" bind:value={editingStudent.personal_email} />
          </div>

          <div class="form-group">
            <label for="edit-phone">Phone</label>
            <input id="edit-phone" type="text" bind:value={editingStudent.phone} />
          </div>

          <div class="form-group">
            <label for="edit-gender">Gender</label>
            <select id="edit-gender" bind:value={editingStudent.gender}>
              <option value="">Select Gender</option>
              <option value="M">Male (M)</option>
              <option value="F">Female (F)</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div class="form-group">
            <label for="edit-branch">Branch</label>
            <input id="edit-branch" type="text" bind:value={editingStudent.branch} />
          </div>

          <div class="form-group">
            <label for="edit-campus">Campus</label>
            <input id="edit-campus" type="text" bind:value={editingStudent.campus} />
          </div>

          <div class="form-group">
            <label for="edit-cgpa">CGPA</label>
            <input id="edit-cgpa" type="number" step="0.01" min="0" max="10" bind:value={editingStudent.cgpa} />
          </div>

          <div class="form-group">
            <label for="edit-tenth">10th Marks (%)</label>
            <input id="edit-tenth" type="number" step="0.01" min="0" max="100" bind:value={editingStudent.tenth_marks} />
          </div>

          <div class="form-group">
            <label for="edit-twelfth">12th Marks (%)</label>
            <input id="edit-twelfth" type="number" step="0.01" min="0" max="100" bind:value={editingStudent.twelfth_marks} />
          </div>

          <div class="form-group full-width">
            <label for="edit-resume">Resume Link</label>
            <input id="edit-resume" type="url" bind:value={editingStudent.resume_link} placeholder="https://..." />
          </div>

          <div class="form-group full-width">
            <label for="edit-status">Placement / Academic Status *</label>
            <select id="edit-status" bind:value={editingStudent.status} class="w-full">
              <option value="not_placed">Not Placed</option>
              <option value="intern">💼 Intern (Internship)</option>
              <option value="placed">✓ Placed (Full-Time Offer)</option>
              <option value="masters">🎓 Masters (Higher Studies)</option>
            </select>
          </div>

          <div class="form-group full-width bg-amber-50/60 p-3 rounded-xl border border-amber-200">
            <label for="edit-topcoder" class="flex items-center gap-3 cursor-pointer">
              <input id="edit-topcoder" type="checkbox" bind:checked={editingStudent.topcoder} class="w-5 h-5 accent-amber-600 rounded cursor-pointer" />
              <span class="font-bold text-amber-950 text-sm">⚡ TopCoder Student</span>
            </label>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-secondary" on:click={() => editingStudent = null}>Cancel</button>
          <button type="submit" class="btn-primary" disabled={saveLoading}>
            {saveLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  </button>
{/if}

<style>
  .student-list {
    padding: 2.5rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  h2 {
    color: #1e293b;
    font-size: 1.875rem;
    font-weight: 700;
    margin: 0;
  }

  .search-container {
    margin-bottom: 2rem;
  }

  .search-box {
    width: 100%;
    padding: 1.1rem 1.5rem;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    font-size: 1.05rem;
    background: #ffffff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
    transition: all 0.2s ease-in-out;
  }

  .search-box:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15);
  }

  .loading, .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    background: #ffffff;
    border-radius: 16px;
    color: #64748b;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  }

  .spinner {
    width: 2.5rem;
    height: 2.5rem;
    border: 3px solid #e2e8f0;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 1rem auto;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .table-container {
    background: white;
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    overflow-x: auto;
    border: 1px solid #f1f5f9;
  }

  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
  }

  th {
    background: #f8fafc;
    font-weight: 700;
    color: #475569;
    padding: 1.25rem 1.5rem;
    text-align: left;
    border-bottom: 2px solid #e2e8f0;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  td {
    padding: 1.25rem 1.5rem;
    text-align: left;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
    font-size: 0.975rem;
    vertical-align: middle;
  }

  tbody tr {
    transition: background 0.15s ease-in-out;
  }

  tbody tr:hover {
    background: #f8fafc;
  }

  .name-cell {
    font-weight: 600;
    color: #0f172a;
  }

  .regno-tag {
    font-family: monospace;
    font-weight: 700;
    color: #334155;
    background: #f1f5f9;
    padding: 0.25rem 0.6rem;
    border-radius: 6px;
    font-size: 0.9rem;
  }

  .sortable {
    cursor: pointer;
    user-select: none;
  }

  .sortable:hover {
    color: #4338ca;
  }

  .sort-icon {
    font-size: 0.85rem;
    margin-left: 0.35rem;
  }

  .neo-badge {
    display: inline-block;
    padding: 0.35rem 0.75rem;
    border-radius: 8px;
    background: #f1f5f9;
    color: #94a3b8;
    font-size: 0.85rem;
    font-family: monospace;
  }

  .neo-badge.has-neoid {
    background: #e0e7ff;
    color: #4338ca;
    font-weight: 700;
  }

  .shortlist-count {
    display: inline-block;
    padding: 0.3rem 0.8rem;
    border-radius: 20px;
    background: #f1f5f9;
    color: #64748b;
    font-weight: 700;
    min-width: 2.2rem;
    text-align: center;
  }

  .shortlist-count.has-shortlists {
    background: #6366f1;
    color: white;
  }

  .status {
    padding: 0.35rem 0.85rem;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 600;
    background: #fef3c7;
    color: #d97706;
    white-space: nowrap;
    word-break: keep-all;
    display: inline-block;
  }

  .status.placed {
    background: #dcfce7;
    color: #15803d;
    border: 1px solid #bbf7d0;
  }

  .status.intern {
    background: #e0f2fe;
    color: #0369a1;
    border: 1px solid #bae6fd;
    font-weight: 700;
  }

  .status.masters {
    background: #f3e8ff;
    color: #7e22ce;
    border: 1px solid #e9d5ff;
  }

  .status.topcoder {
    background: #fef3c7;
    color: #b45309;
    border: 1px solid #fde68a;
    font-weight: 700;
  }

  .action-cells {
    display: flex;
    gap: 0.6rem;
    align-items: center;
  }

  .btn-action {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: none;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-view {
    background: #4f46e5;
    color: white;
  }

  .btn-view:hover {
    background: #4338ca;
  }

  .pagination-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2rem;
    background: #ffffff;
    border-radius: 16px;
    margin-top: 1.5rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
    border: 1px solid #f1f5f9;
  }

  .pagination-info {
    color: #64748b;
    font-size: 0.95rem;
  }

  .pagination-controls {
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }

  .btn-page {
    padding: 0.6rem 1.25rem;
    background: #ffffff;
    border: 1.5px solid #cbd5e1;
    border-radius: 10px;
    font-weight: 600;
    color: #334155;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-page:hover:not(:disabled) {
    background: #6366f1;
    border-color: #6366f1;
    color: white;
  }

  .btn-page:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .page-indicator {
    font-weight: 700;
    color: #1e293b;
    font-size: 0.95rem;
  }

  /* Modals */
  .modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1.5rem;
  }

  .modal-content {
    background: white;
    padding: 2.5rem;
    border-radius: 20px;
    max-width: 850px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  }

  .close-btn {
    position: absolute;
    top: 1.5rem;
    right: 1.5rem;
    background: #f1f5f9;
    border: none;
    font-size: 1.5rem;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    cursor: pointer;
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: #e2e8f0;
    color: #0f172a;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-right: 3rem;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.5rem;
    color: #0f172a;
  }

  .details-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1.75rem;
    margin: 2rem 0;
    padding: 1.5rem;
    background: #f8fafc;
    border-radius: 14px;
    border: 1px solid #f1f5f9;
  }

  .detail-item {
    font-size: 0.975rem;
    color: #334155;
  }

  .detail-item strong {
    display: block;
    color: #64748b;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 0.3rem;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1.5rem;
    margin-top: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .form-group.full-width {
    grid-column: 1 / -1;
  }

  .form-group label {
    font-weight: 600;
    font-size: 0.9rem;
    color: #334155;
  }

  .form-group input,
  .form-group select {
    padding: 0.8rem 1rem;
    border: 1.5px solid #cbd5e1;
    border-radius: 10px;
    font-size: 1rem;
    background: #ffffff;
    transition: all 0.2s;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1.25rem;
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e2e8f0;
  }

  .btn-primary {
    padding: 0.75rem 1.75rem;
    background: #6366f1;
    color: white;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-weight: 600;
    font-size: 1rem;
    transition: background 0.2s;
  }

  .btn-primary:hover:not(:disabled) {
    background: #4f46e5;
  }

  .btn-secondary {
    padding: 0.75rem 1.5rem;
    background: #f1f5f9;
    color: #475569;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-weight: 600;
    font-size: 1rem;
  }

  .btn-secondary:hover {
    background: #e2e8f0;
  }

  .alert {
    padding: 1rem 1.25rem;
    border-radius: 10px;
    margin-bottom: 1.5rem;
    font-weight: 600;
  }

  .alert-success {
    background: #dcfce7;
    color: #15803d;
    border: 1px solid #bbf7d0;
  }

  .alert-error {
    background: #fee2e2;
    color: #b91c1c;
    border: 1px solid #fca5a5;
  }
</style>
