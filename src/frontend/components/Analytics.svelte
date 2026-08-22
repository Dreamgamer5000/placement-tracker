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

  // Pie chart computations
  const pieColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f43f5e', '#6366f1',
    '#0ea5e9', '#84cc16'
  ];

  $: branchChartData = (summary?.finalPlacement?.branchStats || [])
    .filter((s: any) => s.placed > 0)
    .sort((a: any, b: any) => b.placed - a.placed);

  $: branchTotalPlaced = branchChartData.reduce((sum: number, s: any) => sum + s.placed, 0);

  $: branchConicGradient = branchChartData.length > 0
    ? (() => {
        let currentPercent = 0;
        return branchChartData.map((s: any, i: number) => {
          const start = currentPercent;
          currentPercent += (s.placed / branchTotalPlaced) * 100;
          return `${pieColors[i % pieColors.length]} ${start}% ${currentPercent}%`;
        }).join(', ');
      })()
    : 'transparent';

  function parseCTC(ctcStr: string) {
    if (!ctcStr) return null;
    const s = ctcStr.toLowerCase().replace(/,/g, '');
    let match = s.match(/(\d+(?:\.\d+)?)\s*cr/);
    if (match) return parseFloat(match[1]) * 100;
    match = s.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*lpa/);
    if (match) return (parseFloat(match[1]) + parseFloat(match[2])) / 2;
    match = s.match(/(\d+(?:\.\d+)?)\s*lpa/);
    if (match) return parseFloat(match[1]);
    match = s.match(/(\d{5,})/);
    if (match) return parseFloat(match[1]) / 100000;
    return null;
  }

  $: ctcBuckets = (() => {
    const buckets = [
      { label: '< 10 LPA', count: 0, color: '#f87171' },
      { label: '10 - 15 LPA', count: 0, color: '#fbbf24' },
      { label: '15 - 20 LPA', count: 0, color: '#34d399' },
      { label: '20 - 30 LPA', count: 0, color: '#38bdf8' },
      { label: '> 30 LPA', count: 0, color: '#818cf8' },
      { label: 'Not Disclosed', count: 0, color: '#94a3b8' }
    ];
    
    (summary?.finalPlacement?.companiesBreakdown || []).forEach((c: any) => {
      // Use the total selected students for this company to weight the CTC bucket
      const studentsSelected = c.total || 0;
      if (studentsSelected === 0) return;

      const val = parseCTC(c.ctc);
      if (val === null) {
        buckets[5].count += studentsSelected;
      } else if (val < 10) {
        buckets[0].count += studentsSelected;
      } else if (val < 15) {
        buckets[1].count += studentsSelected;
      } else if (val < 20) {
        buckets[2].count += studentsSelected;
      } else if (val <= 30) {
        buckets[3].count += studentsSelected;
      } else {
        buckets[4].count += studentsSelected;
      }
    });
    
    return buckets.filter(b => b.count > 0);
  })();

  $: ctcTotalPlaced = ctcBuckets.reduce((sum, b) => sum + b.count, 0);

  $: ctcConicGradient = ctcBuckets.length > 0
    ? (() => {
        let currentPercent = 0;
        return ctcBuckets.map(b => {
          const start = currentPercent;
          currentPercent += (b.count / ctcTotalPlaced) * 100;
          return `${b.color} ${start}% ${currentPercent}%`;
        }).join(', ');
      })()
    : 'transparent';
</script>

<div id="analytics-page" class="analytics">
  <div class="header">
    <h2>📊 Placement & Internship Analytics</h2>
    <button class="btn-refresh" on:click={() => loadSummary(true)} disabled={loading}>
      {loading ? 'Recalculating...' : '🔄 Recalculate Analytics'}
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
        <span class="badge badge-success">Placement Offer / Likely Internship to Conversion</span>
      </div>

      <div class="charts-grid">
        <!-- NeoID Campus Placement Metrics Table -->
        <div class="chart-card featured">
          <h4>🏫 NeoID Campus Placement Breakdown</h4>
          <p class="chart-desc">Placement rate of NeoIDs campus-wise (Chennai, Vellore, Unknown)</p>
          <div class="table-responsive">
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
        </div>

        <!-- Known Student Branch-wise Placements & Pie Charts -->
        <div class="chart-card featured">
          <h4>📚 Placement Distribution</h4>
          <p class="chart-desc">Branch & Campus level placement breakdown</p>
          
          <div class="distribution-grid">
            <div class="table-container">
              <h5>Branch-wise Details</h5>
              <div class="table-responsive" style="max-height: 350px;">
                <table class="compact-table">
                  <thead>
                    <tr>
                      <th>Branch</th>
                      <th>Registered</th>
                      <th>Placed</th>
                      <th class="hide-mobile">Placement Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each (summary.finalPlacement?.branchStats || []) as stat}
                      <tr>
                        <td><strong>{stat.branch}</strong></td>
                        <td>{stat.total || 0}</td>
                        <td class="text-success"><strong>{stat.placed || 0}</strong></td>
                        <td class="hide-mobile">{stat.total > 0 ? (((stat.placed || 0) / stat.total) * 100).toFixed(1) : '0.0'}%</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="charts-container">
              <div class="pie-card">
                <h5>Selections by Branch</h5>
                <p class="chart-desc" style="font-size: 0.75rem; margin-top: -0.5rem; margin-bottom: 1rem;">Pie chart showing the proportion of total hires contributed by each branch.</p>
                {#if branchChartData.length > 0}
                  <div class="pie-wrapper">
                    <div class="pie-chart" style="background: conic-gradient({branchConicGradient})"></div>
                    <div class="pie-legend">
                      {#each branchChartData as s, i}
                        <div class="legend-item">
                          <span class="legend-color" style="background: {pieColors[i % pieColors.length]}"></span>
                          <span class="legend-text">{s.branch} ({((s.placed / branchTotalPlaced) * 100).toFixed(1)}% of hires)</span>
                        </div>
                      {/each}
                    </div>
                  </div>
                {:else}
                  <p class="empty-state">No data available</p>
                {/if}
              </div>

              <div class="pie-card">
                <h5>Salary Distribution (CTC)</h5>
                <p class="chart-desc" style="font-size: 0.75rem; margin-top: -0.5rem; margin-bottom: 1rem;">Pie chart showing placed students grouped by their CTC (LPA) packages.</p>
                {#if ctcBuckets.length > 0}
                  <div class="pie-wrapper">
                    <div class="pie-chart" style="background: conic-gradient({ctcConicGradient})"></div>
                    <div class="pie-legend">
                      {#each ctcBuckets as b}
                        <div class="legend-item">
                          <span class="legend-color" style="background: {b.color}"></span>
                          <span class="legend-text">{b.label} ({((b.count / ctcTotalPlaced) * 100).toFixed(1)}%)</span>
                        </div>
                      {/each}
                    </div>
                  </div>
                {:else}
                  <p class="empty-state">No CTC data available</p>
                {/if}
              </div>
            </div>
          </div>
        </div>

        <!-- All Companies Final Placements Table -->
        <div class="chart-card featured">
          <div class="card-title-row">
            <div>
              <h4>🏆 All Companies Placement Offers</h4>
              <p class="chart-desc">Companies with at least 1 placement offer / likely internship to conversion</p>
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
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Company Name</th>
                  <th>Total Placed</th>
                </tr>
              </thead>
              <tbody>
                {#if filteredFinalCompanies.length === 0}
                  <tr>
                    <td colspan="2" class="empty-state">No placement offers found matching your search.</td>
                  </tr>
                {:else}
                  {#each filteredFinalCompanies as company}
                    <tr>
                      <td><strong>{company.name}</strong></td>
                      <td><span class="badge badge-success">{company.total || 0} Placed</span></td>
                    </tr>
                  {/each}
                {/if}
              </tbody>
            </table>
          </div>
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
          <div class="table-responsive">
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
        </div>

        <!-- Campus-wise Interns -->
        <div class="chart-card">
          <h4>🏫 Campus-wise Intern Selections</h4>
          <p class="chart-desc">Intern Candidates by Campus</p>
          <div class="table-responsive">
            <table class="compact-table">
              <thead>
                <tr>
                  <th>Campus</th>
                  <th>Registered</th>
                  <th>Interned</th>
                  <th class="hide-mobile">Intern Rate</th>
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
                    <td class="hide-mobile">{stat.total > 0 ? (((stat.interned || 0) / stat.total) * 100).toFixed(1) : '0.0'}%</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>

        <!-- All Companies Intern Selections Table -->
        <div class="chart-card featured">
          <div class="card-title-row">
            <div>
              <h4>⭐ All Companies Intern Offers</h4>
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
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Company Name</th>
                  <th>Total Interns</th>
                </tr>
              </thead>
              <tbody>
                {#if filteredInternCompanies.length === 0}
                  <tr>
                    <td colspan="2" class="empty-state">No intern offers found matching your search.</td>
                  </tr>
                {:else}
                  {#each filteredInternCompanies as company}
                    <tr>
                      <td><strong>{company.name}</strong></td>
                      <td><span class="badge badge-warning">{company.total || 0} Interns</span></td>
                    </tr>
                  {/each}
                {/if}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .analytics {
    padding: 0.5rem;
    max-width: 1400px;
    margin: 0 auto;
  }
  @media (min-width: 640px) {
    .analytics {
      padding: 1.5rem;
    }
  }

  .header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }
  @media (min-width: 640px) {
    .header {
      flex-direction: row;
      align-items: center;
      margin-bottom: 2rem;
    }
  }

  h2 {
    margin: 0;
    color: #1e293b;
    font-size: 1.35rem;
    font-weight: 800;
  }
  @media (min-width: 640px) {
    h2 {
      font-size: 1.75rem;
    }
  }

  .btn-refresh {
    background: #4f46e5;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85rem;
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
    padding: 2.5rem 1rem;
    color: #64748b;
    font-size: 1rem;
  }

  .error-box {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 10px;
    color: #991b1b;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  @media (min-width: 768px) {
    .stats-grid {
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2rem;
    }
  }

  .stat-card {
    background: white;
    padding: 1rem 0.85rem;
    border-radius: 14px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
    border: 1px solid #e2e8f0;
    text-align: left;
    transition: all 0.2s ease;
  }
  @media (min-width: 640px) {
    .stat-card {
      padding: 1.5rem;
      border-radius: 16px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.04);
    }
  }

  .stat-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
  }

  .stat-card.primary {
    border-left: 4px solid #6366f1;
    background: linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%);
  }
  .stat-card.success {
    border-left: 4px solid #10b981;
    background: linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%);
  }
  .stat-card.chennai-highlight {
    border-left: 4px solid #8b5cf6;
    background: linear-gradient(135deg, #ffffff 0%, #f3e8ff 100%);
  }
  .stat-card.warning {
    border-left: 4px solid #f59e0b;
    background: linear-gradient(135deg, #ffffff 0%, #fffbeb 100%);
  }
  .stat-card.dark {
    border-left: 4px solid #3b82f6;
    background: linear-gradient(135deg, #ffffff 0%, #eff6ff 100%);
  }

  .stat-value {
    font-size: 1.6rem;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.1;
    letter-spacing: -0.02em;
  }
  @media (min-width: 640px) {
    .stat-value {
      font-size: 2.5rem;
    }
  }

  .stat-label {
    color: #334155;
    font-size: 0.8rem;
    font-weight: 700;
    margin-top: 0.35rem;
  }
  @media (min-width: 640px) {
    .stat-label {
      font-size: 0.9rem;
      margin-top: 0.4rem;
    }
  }

  .stat-sub {
    color: #64748b;
    font-size: 0.72rem;
    margin-top: 0.2rem;
  }
  @media (min-width: 640px) {
    .stat-sub {
      font-size: 0.8rem;
      margin-top: 0.25rem;
    }
  }

  /* Section Containers */
  .section-container {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 0.85rem;
    margin-bottom: 1.5rem;
  }
  @media (min-width: 640px) {
    .section-container {
      border-radius: 14px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
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
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .section-header h3 {
    margin: 0;
    font-size: 1.25rem;
    color: #0f172a;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
    gap: 1.25rem;
  }

  .chart-card {
    background: white;
    padding: 1.25rem;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
    overflow: hidden;
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
    flex-wrap: wrap;
  }

  .table-responsive {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
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
    margin: 0 0 0.5rem 0;
    font-size: 1.15rem;
    color: #1e293b;
  }

  .chart-desc {
    margin: 0 0 1rem 0;
    font-size: 0.85rem;
    color: #64748b;
  }

  /* --- Distribution Layout & Pie Charts --- */
  .distribution-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 2rem;
    margin-top: 1.5rem;
  }

  .distribution-grid > div {
    min-width: 0;
  }

  @media (min-width: 1024px) {
    .distribution-grid {
      grid-template-columns: minmax(0, 5fr) minmax(0, 4fr);
    }
  }

  .distribution-grid h5 {
    margin: 0 0 1rem 0;
    color: #334155;
    font-size: 1rem;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .charts-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .pie-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 1.25rem;
  }

  .pie-wrapper {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex-direction: column;
  }

  @media (min-width: 640px) {
    .pie-wrapper {
      flex-direction: row;
      align-items: flex-start;
    }
  }

  .pie-chart {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 4px 10px rgba(0,0,0,0.05), inset 0 2px 5px rgba(255,255,255,0.5);
    border: 4px solid white;
  }
  
  @media (min-width: 640px) {
    .pie-chart {
      width: 140px;
      height: 140px;
    }
  }

  .pie-legend {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
    padding-right: 0.5rem;
  }
  
  @media (min-width: 640px) {
    .pie-legend {
      flex: 1;
      min-width: 160px;
      max-height: 140px;
      width: auto;
    }
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: #475569;
  }

  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .legend-color.bg-chennai { background: #3730a3; }
  .legend-color.bg-vellore { background: #166534; }
  .legend-color.bg-unknown { background: #4b5563; }
  /* ---------------------------------------- */

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

  .compact-table {
    font-size: 0.75rem; /* slightly smaller for cramped spaces */
  }

  @media (max-width: 640px) {
    .hide-mobile {
      display: none;
    }
    .compact-table th, .compact-table td {
      padding: 0.5rem 0.4rem; /* tighter padding on mobile */
    }
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
    white-space: nowrap;
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
  :global(.dark) #analytics-page h2,
  :global(.dark) #analytics-page h3,
  :global(.dark) #analytics-page h4 { color: #f8fafc; }
  
  :global(.dark) #analytics-page .stat-card {
    background: #1e293b;
    border-color: #334155;
  }
  :global(.dark) #analytics-page .stat-card.primary { background: linear-gradient(135deg, #1e293b 0%, #312e81 100%); }
  :global(.dark) #analytics-page .stat-card.success { background: linear-gradient(135deg, #1e293b 0%, #064e3b 100%); }
  :global(.dark) #analytics-page .stat-card.chennai-highlight { background: linear-gradient(135deg, #1e293b 0%, #4c1d95 100%); }
  :global(.dark) #analytics-page .stat-card.warning { background: linear-gradient(135deg, #1e293b 0%, #78350f 100%); }
  :global(.dark) #analytics-page .stat-card.dark { background: linear-gradient(135deg, #1e293b 0%, #1e3a8a 100%); }
  
  :global(.dark) #analytics-page .stat-value { color: #f8fafc; }
  :global(.dark) #analytics-page .stat-label { color: #cbd5e1; }
  :global(.dark) #analytics-page .stat-sub { color: #94a3b8; }

  :global(.dark) #analytics-page .section-container {
    background: #0f172a;
    border-color: #334155;
  }
  
  :global(.dark) #analytics-page .chart-card {
    background: #1e293b;
    border-color: #334155;
  }
  
  :global(.dark) #analytics-page .search-input {
    background: #0f172a;
    border-color: #334155;
    color: #f8fafc;
  }
  :global(.dark) #analytics-page .search-input::placeholder {
    color: #94a3b8;
  }
  :global(.dark) #analytics-page .search-input:focus { border-color: #818cf8; }
  
  :global(.dark) #analytics-page .chart-desc { color: #94a3b8; }
  
  :global(.dark) #analytics-page th {
    background: #0f172a;
    color: #cbd5e1;
    border-bottom-color: #334155;
  }
  
  :global(.dark) #analytics-page td { 
    border-bottom-color: #334155; 
    color: #cbd5e1;
  }
  :global(.dark) #analytics-page tbody tr:hover { background: #334155; }
  
  :global(.dark) #analytics-page .badge-success {
    background: #064e3b;
    color: #34d399;
  }
  :global(.dark) #analytics-page .badge-warning {
    background: #78350f;
    color: #fbbf24;
  }
  
  :global(.dark) #analytics-page .campus-badge.chennai {
    background: #312e81;
    color: #a5b4fc;
  }
  :global(.dark) #analytics-page .campus-badge.vellore {
    background: #064e3b;
    color: #6ee7b7;
  }
  :global(.dark) #analytics-page .campus-badge.unknown {
    background: #334155;
    color: #cbd5e1;
  }
  
  :global(.dark) #analytics-page .distribution-grid h5 {
    color: #f8fafc;
    border-bottom-color: #334155;
  }
  
  :global(.dark) #analytics-page .pie-card {
    background: #1e293b;
    border-color: #334155;
  }
  
  :global(.dark) #analytics-page .pie-chart {
    border-color: #0f172a;
    box-shadow: 0 4px 10px rgba(0,0,0,0.2);
  }
  
  :global(.dark) #analytics-page .legend-item {
    color: #cbd5e1;
  }
  
  :global(.dark) #analytics-page .rate-bar { background: #334155; }
</style>
