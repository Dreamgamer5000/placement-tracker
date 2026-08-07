<script lang="ts">
  import { onMount } from 'svelte';

  let summary: any = null;
  let loading = true;
  let errorMessage: string | null = null;

  // Search filter terms for company breakdown tables
  let finalSearchTerm = '';
  let internSearchTerm = '';

  onMount(async () => {
    await loadSummary(false);
  });

  async function loadSummary(recalculate = false) {
    loading = true;
    errorMessage = null;
    try {
      const url = '/api/analytics/summary' + (recalculate ? '?recalculate=true' : '');
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }
      summary = await response.json();
    } catch (error: any) {
      console.error('Error loading analytics:', error);
      errorMessage = error?.message || 'Failed to fetch analytics data';
    } finally {
      loading = false;
    }
  }

  // Reactive company filtering
  $: filteredFinalCompanies = (summary?.finalPlacement?.companiesBreakdown || []).filter(
    (c: any) => !finalSearchTerm.trim() || c.name.toLowerCase().includes(finalSearchTerm.toLowerCase().trim())
  );

  $: filteredInternCompanies = (summary?.internAnalytics?.companiesBreakdown || []).filter(
    (c: any) => !internSearchTerm.trim() || c.name.toLowerCase().includes(internSearchTerm.toLowerCase().trim())
  );
</script>

<div class="analytics">
  <div class="header">
    <h2>📊 Placement & Internship Analytics</h2>
    <button class="btn-refresh" on:click={() => loadSummary(true)} disabled={loading}>
      {loading ? 'Refreshing...' : '🔄 Refresh Data'}
    </button>
  </div>
  
  {#if loading}
    <div class="loading">Loading analytics...</div>
  {:else if errorMessage}
    <div class="error-box">
      <p>⚠️ Error loading analytics: {errorMessage}</p>
      <button class="btn-refresh" on:click={() => loadSummary(true)}>Retry</button>
    </div>
  {:else if summary}
    <!-- Top Summary Stat Cards -->
    <div class="stats-grid">
      <div class="stat-card primary">
        <div class="stat-value">{summary.totalNeoIds || 0}</div>
        <div class="stat-label">Total NeoID Students</div>
        <div class="stat-sub">Master NeoID Directory</div>
      </div>

      <div class="stat-card success">
        <div class="stat-value">{summary.totalPlacedNeoIds || 0}</div>
        <div class="stat-label">Placed NeoIDs</div>
        <div class="stat-sub">
          <strong>{summary.totalPlacedNeoIds || 0} out of {summary.totalNeoIds || 0}</strong> ({summary.overallNeoIdPlacementRate || "0.00"}%)
        </div>
      </div>

      <!-- HIGHLIGHTED CHENNAI NEOID PLACEMENT METRIC -->
      <div class="stat-card chennai-highlight">
        <div class="stat-value">{summary.chennaiNeoIdStats?.rate || "0.00"}%</div>
        <div class="stat-label">Chennai NeoID Placement Rate</div>
        <div class="stat-sub">
          {summary.chennaiNeoIdStats?.placed || 0} placed out of {summary.chennaiNeoIdStats?.total || 0}
        </div>
      </div>

      <div class="stat-card warning">
        <div class="stat-value">{summary.internAnalytics?.totalInterns || 0}</div>
        <div class="stat-label">Interns Selected</div>
        <div class="stat-sub">from temp_interns_selected</div>
      </div>
      
      <div class="stat-card dark">
        <div class="stat-value">{summary.totalCompanies || 0}</div>
        <div class="stat-label">Recruiting Companies</div>
        <div class="stat-sub">Active Drive Partners</div>
      </div>
    </div>

    <!-- SECTION 1: FINAL PLACEMENT METRICS (ORDERED ABOVE INTERNS) -->
    <div class="section-container placement-section">
      <div class="section-header">
        <h3>🎓 Final Placement Metrics (temp_final_selection)</h3>
        <span class="badge badge-success">Full-Time Offers</span>
      </div>

      <div class="charts-grid">
        <!-- NeoID Campus Placement Metrics Table -->
        <div class="chart-card featured">
          <h4>🏫 NeoID Campus Placement Breakdown</h4>
          <p class="chart-desc">Placement rate of NeoIDs campus-wise (Chennai, Vellore, Unknown)</p>
          <table>
            <thead>
              <tr>
                <th>Campus</th>
                <th>Total NeoIDs</th>
                <th>Placed NeoIDs</th>
                <th>Campus Placement Rate</th>
              </tr>
            </thead>
            <tbody>
              {#each (summary.neoIdCampusStats || []) as stat}
                <tr>
                  <td>
                    <span class="campus-badge {stat.campus ? stat.campus.toLowerCase() : 'unknown'}">{stat.campus}</span>
                  </td>
                  <td><strong>{stat.total || 0}</strong></td>
                  <td class="text-success"><strong>{stat.placed || 0}</strong></td>
                  <td>
                    <div class="rate-bar-container">
                      <span class="rate-text">{stat.placedRate || "0.00"}%</span>
                      <div class="rate-bar">
                        <div
                          class="rate-fill success-fill"
                          style="width: {stat.placed > 0 ? Math.max(5, parseFloat(stat.placedRate || '0')) : 0}%"
                        ></div>
                      </div>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Known Student Branch-wise Placements -->
        <div class="chart-card">
          <h4>📚 Known Student Branch-wise Placements</h4>
          <p class="chart-desc">From temp_students & temp_final_selection</p>
          <table>
            <thead>
              <tr>
                <th>Branch</th>
                <th>Registered</th>
                <th>Placed</th>
                <th>Placement Rate</th>
              </tr>
            </thead>
            <tbody>
              {#each (summary.finalPlacement?.branchStats || []) as stat}
                <tr>
                  <td><strong>{stat.branch}</strong></td>
                  <td>{stat.total || 0}</td>
                  <td class="text-success"><strong>{stat.placed || 0}</strong></td>
                  <td>{stat.total > 0 ? (((stat.placed || 0) / stat.total) * 100).toFixed(1) : '0.0'}%</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- All Companies Final Placements Breakdown Table -->
        <div class="chart-card featured">
          <div class="card-title-row">
            <div>
              <h4>🏆 All Companies Final Offers (Campus Breakdown)</h4>
              <p class="chart-desc">Companies with at least 1 final placement offer</p>
            </div>
            <div class="search-box">
              <input
                type="text"
                placeholder="🔍 Search company..."
                bind:value={finalSearchTerm}
                class="search-input"
              />
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Company Name</th>
                <th>Chennai</th>
                <th>Vellore</th>
                <th>Unknown</th>
                <th>Total Placed</th>
              </tr>
            </thead>
            <tbody>
              {#if filteredFinalCompanies.length === 0}
                <tr>
                  <td colspan="5" class="empty-state">No placement offers found matching your search.</td>
                </tr>
              {:else}
                {#each filteredFinalCompanies as company}
                  <tr>
                    <td><strong>{company.name}</strong></td>
                    <td class="text-info">{company.chennai || 0}</td>
                    <td class="text-info">{company.vellore || 0}</td>
                    <td class="text-muted">{company.unknown || 0}</td>
                    <td><span class="badge badge-success">{company.total || 0} Placed</span></td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- SECTION 2: INTERN SELECTION METRICS (ORDERED BELOW SELECTION) -->
    <div class="section-container intern-section">
      <div class="section-header">
        <h3>💼 Intern Selection Metrics (temp_interns_selected)</h3>
        <span class="badge badge-warning">Internship Offers</span>
      </div>

      <div class="charts-grid">
        <!-- Branch-wise Interns -->
        <div class="chart-card">
          <h4>📚 Branch-wise Intern Selections</h4>
          <p class="chart-desc">Intern Candidates (temp_students)</p>
          <table>
            <thead>
              <tr>
                <th>Branch</th>
                <th>Registered</th>
                <th>Interned</th>
                <th>Intern Rate</th>
              </tr>
            </thead>
            <tbody>
              {#each (summary.internAnalytics?.branchStats || []) as stat}
                <tr>
                  <td><strong>{stat.branch}</strong></td>
                  <td>{stat.total || 0}</td>
                  <td class="text-warning"><strong>{stat.interned || 0}</strong></td>
                  <td>{stat.total > 0 ? (((stat.interned || 0) / stat.total) * 100).toFixed(1) : '0.0'}%</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Campus-wise Interns -->
        <div class="chart-card">
          <h4>🏫 Campus-wise Intern Selections</h4>
          <p class="chart-desc">Intern Candidates by Campus</p>
          <table>
            <thead>
              <tr>
                <th>Campus</th>
                <th>Registered</th>
                <th>Interned</th>
                <th>Intern Rate</th>
              </tr>
            </thead>
            <tbody>
              {#each (summary.internAnalytics?.campusStats || []) as stat}
                <tr>
                  <td>
                    <span class="campus-badge {stat.campus ? stat.campus.toLowerCase() : 'unknown'}">{stat.campus}</span>
                  </td>
                  <td>{stat.total || 0}</td>
                  <td class="text-warning"><strong>{stat.interned || 0}</strong></td>
                  <td>{stat.total > 0 ? (((stat.interned || 0) / stat.total) * 100).toFixed(1) : '0.0'}%</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- All Companies Intern Selections Breakdown Table -->
        <div class="chart-card featured">
          <div class="card-title-row">
            <div>
              <h4>⭐ All Companies Intern Offers (Campus Breakdown)</h4>
              <p class="chart-desc">Companies with at least 1 intern offer</p>
            </div>
            <div class="search-box">
              <input
                type="text"
                placeholder="🔍 Search company..."
                bind:value={internSearchTerm}
                class="search-input"
              />
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Company Name</th>
                <th>Chennai</th>
                <th>Vellore</th>
                <th>Unknown</th>
                <th>Total Interns</th>
              </tr>
            </thead>
            <tbody>
              {#if filteredInternCompanies.length === 0}
                <tr>
                  <td colspan="5" class="empty-state">No intern offers found matching your search.</td>
                </tr>
              {:else}
                {#each filteredInternCompanies as company}
                  <tr>
                    <td><strong>{company.name}</strong></td>
                    <td class="text-info">{company.chennai || 0}</td>
                    <td class="text-info">{company.vellore || 0}</td>
                    <td class="text-muted">{company.unknown || 0}</td>
                    <td><span class="badge badge-warning">{company.total || 0} Interns</span></td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .analytics {
    padding: 1.5rem 2rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  h2 {
    color: #1e293b;
    margin: 0;
    font-size: 1.75rem;
    font-weight: 700;
  }

  .btn-refresh {
    background: #4f46e5;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-refresh:hover {
    background: #4338ca;
  }

  .btn-refresh:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .loading,
  .error-box {
    text-align: center;
    padding: 3rem;
    color: #64748b;
    font-size: 1.1rem;
  }

  .error-box {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 10px;
    color: #991b1b;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1.25rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: white;
    padding: 1.5rem;
    border-radius: 16px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.04);
    border: 1px solid #e2e8f0;
    text-align: left;
    transition: all 0.2s ease;
  }

  .stat-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
  }

  .stat-card.primary {
    border-left: 5px solid #6366f1;
    background: linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%);
  }
  .stat-card.success {
    border-left: 5px solid #10b981;
    background: linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%);
  }
  .stat-card.chennai-highlight {
    border-left: 5px solid #8b5cf6;
    background: linear-gradient(135deg, #ffffff 0%, #f3e8ff 100%);
  }
  .stat-card.warning {
    border-left: 5px solid #f59e0b;
    background: linear-gradient(135deg, #ffffff 0%, #fffbeb 100%);
  }
  .stat-card.dark {
    border-left: 5px solid #3b82f6;
    background: linear-gradient(135deg, #ffffff 0%, #eff6ff 100%);
  }

  .stat-value {
    font-size: 2.5rem;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.1;
    letter-spacing: -0.02em;
  }

  .stat-label {
    color: #334155;
    font-size: 0.9rem;
    font-weight: 700;
    margin-top: 0.4rem;
  }

  .stat-sub {
    color: #64748b;
    font-size: 0.8rem;
    margin-top: 0.25rem;
  }

  /* Section Containers */
  .section-container {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .placement-section {
    border-top: 4px solid #10b981;
  }

  .intern-section {
    border-top: 4px solid #f59e0b;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.25rem;
  }

  .section-header h3 {
    margin: 0;
    font-size: 1.25rem;
    color: #0f172a;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 1.25rem;
  }

  .chart-card {
    background: white;
    padding: 1.25rem;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
  }

  .chart-card.featured {
    grid-column: 1 / -1;
  }

  .card-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .card-title-row h4 {
    margin: 0;
  }

  .card-title-row .chart-desc {
    margin: 0.25rem 0 0 0;
  }

  .search-box {
    min-width: 220px;
  }

  .search-input {
    width: 100%;
    padding: 0.45rem 0.75rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.85rem;
    outline: none;
    transition: border-color 0.2s;
  }

  .search-input:focus {
    border-color: #4f46e5;
  }

  .chart-card h4 {
    margin: 0 0 0.25rem 0;
    color: #1e293b;
    font-size: 1.05rem;
  }

  .chart-desc {
    margin: 0 0 1rem 0;
    color: #64748b;
    font-size: 0.8rem;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  th,
  td {
    padding: 0.6rem 0.75rem;
    text-align: left;
    border-bottom: 1px solid #f1f5f9;
  }

  th {
    background: #f8fafc;
    font-weight: 600;
    color: #475569;
  }

  tbody tr:hover {
    background: #f8fafc;
  }

  .empty-state {
    text-align: center;
    color: #94a3b8;
    padding: 1.5rem;
    font-style: italic;
  }

  .badge {
    padding: 0.25rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .badge-success {
    background: #d1fae5;
    color: #065f46;
  }
  .badge-warning {
    background: #fef3c7;
    color: #92400e;
  }

  .campus-badge {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-weight: 600;
    font-size: 0.8rem;
  }

  .campus-badge.chennai {
    background: #e0e7ff;
    color: #3730a3;
  }
  .campus-badge.vellore {
    background: #dcfce7;
    color: #166534;
  }
  .campus-badge.unknown {
    background: #f3f4f6;
    color: #4b5563;
  }

  .text-success {
    color: #10b981;
  }
  .text-warning {
    color: #d97706;
  }
  .text-info {
    color: #2563eb;
  }
  .text-muted {
    color: #94a3b8;
  }

  .rate-bar-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .rate-text {
    width: 55px;
    font-weight: 600;
  }

  .rate-bar {
    flex: 1;
    height: 8px;
    background: #e2e8f0;
    border-radius: 4px;
    overflow: hidden;
  }

  .rate-fill {
    height: 100%;
    border-radius: 4px;
  }

  .success-fill {
    background: #10b981;
  }

  /* --- Dark Mode Overrides --- */
  :global(.dark) .analytics h2,
  :global(.dark) .analytics h3,
  :global(.dark) .analytics h4 { color: #f8fafc; }
  
  :global(.dark) .stat-card {
    background: #1e293b;
    border-color: #334155;
  }
  :global(.dark) .stat-card.primary { background: linear-gradient(135deg, #1e293b 0%, #312e81 100%); }
  :global(.dark) .stat-card.success { background: linear-gradient(135deg, #1e293b 0%, #064e3b 100%); }
  :global(.dark) .stat-card.chennai-highlight { background: linear-gradient(135deg, #1e293b 0%, #4c1d95 100%); }
  :global(.dark) .stat-card.warning { background: linear-gradient(135deg, #1e293b 0%, #78350f 100%); }
  :global(.dark) .stat-card.dark { background: linear-gradient(135deg, #1e293b 0%, #1e3a8a 100%); }
  
  :global(.dark) .stat-value { color: #f8fafc; }
  :global(.dark) .stat-label { color: #cbd5e1; }
  :global(.dark) .stat-sub { color: #94a3b8; }

  :global(.dark) .section-container {
    background: #0f172a;
    border-color: #334155;
  }
  
  :global(.dark) .chart-card {
    background: #1e293b;
    border-color: #334155;
  }
  
  :global(.dark) .search-input {
    background: #0f172a;
    border-color: #334155;
    color: #f8fafc;
  }
  :global(.dark) .search-input::placeholder {
    color: #94a3b8;
  }
  :global(.dark) .search-input:focus { border-color: #818cf8; }
  
  :global(.dark) .chart-desc { color: #94a3b8; }
  
  :global(.dark) th {
    background: #0f172a;
    color: #cbd5e1;
    border-bottom-color: #334155;
  }
  
  :global(.dark) td { 
    border-bottom-color: #334155; 
    color: #cbd5e1;
  }
  :global(.dark) tbody tr:hover { background: #334155; }
  
  :global(.dark) .badge-success {
    background: #064e3b;
    color: #34d399;
  }
  :global(.dark) .badge-warning {
    background: #78350f;
    color: #fbbf24;
  }
  
  :global(.dark) .campus-badge.chennai {
    background: #312e81;
    color: #a5b4fc;
  }
  :global(.dark) .campus-badge.vellore {
    background: #064e3b;
    color: #6ee7b7;
  }
  :global(.dark) .campus-badge.unknown {
    background: #334155;
    color: #cbd5e1;
  }
  
  :global(.dark) .rate-bar { background: #334155; }
</style>
