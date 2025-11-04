<script lang="ts">
  import { onMount } from 'svelte';

  let companies: any[] = [];
  let loading = true;
  let selectedCompany: any = null;
  let showAddForm = false;
  let newCompany = { name: '', notes: '', rounds: '', experience_required: '' };

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
</script>

<div class="company-list">
  <div class="header">
    <h2>🏢 Companies</h2>
    <button class="btn-primary" on:click={() => showAddForm = !showAddForm}>
      {showAddForm ? 'Cancel' : '+ Add Company'}
    </button>
  </div>

  {#if showAddForm}
    <div class="add-form">
      <h3>Add New Company</h3>
      <input 
        type="text" 
        placeholder="Company Name *" 
        bind:value={newCompany.name}
        required
      />
      <textarea 
        placeholder="Notes (optional)" 
        bind:value={newCompany.notes}
      />
      <input 
        type="number" 
        placeholder="Number of Rounds (optional)" 
        bind:value={newCompany.rounds}
      />
      <input 
        type="text" 
        placeholder="Experience Required (optional)" 
        bind:value={newCompany.experience_required}
      />
      <button class="btn-primary" on:click={addCompany}>Add Company</button>
    </div>
  {/if}

  {#if loading}
    <div class="loading">Loading companies...</div>
  {:else}
    <div class="companies-grid">
      {#each companies as company}
        <div class="company-card" on:click={() => viewCompany(company.id)}>
          <h3>{company.name}</h3>
          {#if company.notes}
            <p class="notes">{company.notes}</p>
          {/if}
          <div class="company-meta">
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
  <div class="modal" on:click={() => selectedCompany = null}>
    <div class="modal-content" on:click|stopPropagation>
      <button class="close-btn" on:click={() => selectedCompany = null}>×</button>
      
      <h3>{selectedCompany.name}</h3>
      
      {#if selectedCompany.notes}
        <p><strong>Notes:</strong> {selectedCompany.notes}</p>
      {/if}

      {#if selectedCompany.analytics}
        <div class="analytics-section">
          <h4>📊 Shortlist Analytics</h4>
          <div class="stats-grid">
            <div class="stat">
              <div class="stat-label">Total Shortlisted</div>
              <div class="stat-value">{selectedCompany.analytics.total_shortlisted || 0}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Gender Ratio</div>
              <div class="stat-value">{selectedCompany.analytics.gender_ratio_shortlist || 'N/A'}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Min CGPA</div>
              <div class="stat-value">{selectedCompany.analytics.min_cgpa_shortlist?.toFixed(2) || 'N/A'}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Avg CGPA</div>
              <div class="stat-value">{selectedCompany.analytics.avg_cgpa_shortlist?.toFixed(2) || 'N/A'}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Min 10th</div>
              <div class="stat-value">{selectedCompany.analytics.min_tenth_shortlist?.toFixed(2) || 'N/A'}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Min 12th</div>
              <div class="stat-value">{selectedCompany.analytics.min_twelfth_shortlist?.toFixed(2) || 'N/A'}</div>
            </div>
          </div>
        </div>

        {#if selectedCompany.analytics.total_selected > 0}
          <div class="analytics-section selection-analytics">
            <h4>✅ Selection Analytics</h4>
            <div class="selection-ratio-banner">
              <div class="ratio-label">Selection Ratio</div>
              <div class="ratio-value">
                {selectedCompany.analytics.total_selected} / {selectedCompany.analytics.total_shortlisted}
                <span class="ratio-percent">({selectedCompany.analytics.selection_ratio?.toFixed(1) || 0}%)</span>
              </div>
            </div>
            <div class="stats-grid">
              <div class="stat stat-success">
                <div class="stat-label">Total Selected</div>
                <div class="stat-value">{selectedCompany.analytics.total_selected || 0}</div>
              </div>
              <div class="stat stat-success">
                <div class="stat-label">Gender Ratio</div>
                <div class="stat-value">{selectedCompany.analytics.gender_ratio_selected || 'N/A'}</div>
              </div>
              <div class="stat stat-success">
                <div class="stat-label">Min CGPA</div>
                <div class="stat-value">{selectedCompany.analytics.min_cgpa_selected?.toFixed(2) || 'N/A'}</div>
              </div>
              <div class="stat stat-success">
                <div class="stat-label">Avg CGPA</div>
                <div class="stat-value">{selectedCompany.analytics.avg_cgpa_selected?.toFixed(2) || 'N/A'}</div>
              </div>
              <div class="stat stat-success">
                <div class="stat-label">Min 10th</div>
                <div class="stat-value">{selectedCompany.analytics.min_tenth_selected?.toFixed(2) || 'N/A'}</div>
              </div>
              <div class="stat stat-success">
                <div class="stat-label">Min 12th</div>
                <div class="stat-value">{selectedCompany.analytics.min_twelfth_selected?.toFixed(2) || 'N/A'}</div>
              </div>
            </div>
          </div>
        {/if}
      {/if}

      {#if selectedCompany.shortlisted && selectedCompany.shortlisted.length > 0}
        <div class="shortlisted-section">
          <h4>Shortlisted Students ({selectedCompany.shortlisted.length})</h4>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Reg No</th>
                  <th>Name</th>
                  <th>CGPA</th>
                  <th>10th</th>
                  <th>12th</th>
                  <th>Gender</th>
                  <th>Resume</th>
                </tr>
              </thead>
              <tbody>
                {#each selectedCompany.shortlisted as student}
                  <tr>
                    <td>{student.regno}</td>
                    <td>{student.name}</td>
                    <td>{student.cgpa?.toFixed(2) || 'N/A'}</td>
                    <td>{student.tenth_marks?.toFixed(2) || 'N/A'}</td>
                    <td>{student.twelfth_marks?.toFixed(2) || 'N/A'}</td>
                    <td>{student.gender || 'N/A'}</td>
                    <td>
                      {#if student.resume_link}
                        <a href={student.resume_link} target="_blank">📄 View</a>
                      {:else}
                        N/A
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
        <div class="placed-section">
          <h4>✅ Finally Selected Students ({selectedCompany.placed.length})</h4>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Reg No</th>
                  <th>Name</th>
                  <th>CGPA</th>
                  <th>10th</th>
                  <th>12th</th>
                  <th>Gender</th>
                  <th>Resume</th>
                </tr>
              </thead>
              <tbody>
                {#each selectedCompany.placed as student}
                  <tr>
                    <td>{student.regno}</td>
                    <td>{student.name}</td>
                    <td>{student.cgpa?.toFixed(2) || 'N/A'}</td>
                    <td>{student.tenth_marks?.toFixed(2) || 'N/A'}</td>
                    <td>{student.twelfth_marks?.toFixed(2) || 'N/A'}</td>
                    <td>{student.gender || 'N/A'}</td>
                    <td>
                      {#if student.resume_link}
                        <a href={student.resume_link} target="_blank">📄 View</a>
                      {:else}
                        N/A
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

<style>
  .company-list {
    padding: 2rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  h2 {
    color: #333;
    margin: 0;
  }

  .btn-primary {
    padding: 0.75rem 1.5rem;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
  }

  .btn-primary:hover {
    background: #5568d3;
  }

  .add-form {
    background: white;
    padding: 2rem;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    margin-bottom: 2rem;
  }

  .add-form h3 {
    margin-top: 0;
    color: #333;
  }

  .add-form input, .add-form textarea {
    width: 100%;
    padding: 0.75rem;
    margin-bottom: 1rem;
    border: 2px solid #ddd;
    border-radius: 5px;
    font-size: 1rem;
    font-family: inherit;
  }

  .add-form textarea {
    min-height: 80px;
    resize: vertical;
  }

  .add-form input:focus, .add-form textarea:focus {
    outline: none;
    border-color: #667eea;
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: #666;
  }

  .companies-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .company-card {
    background: white;
    padding: 1.5rem;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .company-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  }

  .company-card h3 {
    margin: 0 0 0.5rem 0;
    color: #333;
  }

  .notes {
    color: #666;
    font-size: 0.9rem;
    margin: 0.5rem 0;
  }

  .company-meta {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
    font-size: 0.85rem;
    color: #666;
  }

  .modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: white;
    padding: 2rem;
    border-radius: 10px;
    max-width: 1000px;
    width: 95%;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
  }

  .close-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: #999;
  }

  .close-btn:hover {
    color: #333;
  }

  .analytics-section, .shortlisted-section, .placed-section {
    margin-top: 2rem;
  }

  h4 {
    color: #333;
    margin-bottom: 1rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .stat {
    background: #f8f9fa;
    padding: 1rem;
    border-radius: 8px;
    text-align: center;
  }

  .stat-label {
    font-size: 0.85rem;
    color: #666;
    margin-bottom: 0.5rem;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: bold;
    color: #667eea;
  }

  .selection-analytics {
    border: 2px solid #10b981;
    border-radius: 12px;
    padding: 1.5rem;
    background: #f0fdf4;
  }

  .selection-ratio-banner {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    padding: 1.5rem;
    border-radius: 8px;
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .ratio-label {
    font-size: 0.9rem;
    opacity: 0.9;
    margin-bottom: 0.5rem;
  }

  .ratio-value {
    font-size: 2rem;
    font-weight: bold;
  }

  .ratio-percent {
    font-size: 1.5rem;
    margin-left: 0.5rem;
  }

  .stat-success {
    background: #f0fdf4;
    border: 1px solid #10b981;
  }

  .stat-success .stat-value {
    color: #10b981;
  }

  .table-container {
    overflow-x: auto;
    background: white;
    border-radius: 8px;
    border: 1px solid #eee;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th, td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid #eee;
  }

  th {
    background: #f8f9fa;
    font-weight: 600;
    color: #555;
  }

  tbody tr:hover {
    background: #f8f9fa;
  }

  td a {
    color: #667eea;
    text-decoration: none;
  }

  td a:hover {
    text-decoration: underline;
  }

  ul {
    list-style: none;
    padding: 0;
  }

  ul li {
    padding: 0.5rem;
    background: #f8f9fa;
    margin: 0.5rem 0;
    border-radius: 5px;
  }
</style>
