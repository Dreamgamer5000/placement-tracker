<script lang="ts">
  import { onMount } from 'svelte';

  let summary: any = null;
  let loading = true;

  onMount(async () => {
    await loadSummary();
  });

  async function loadSummary() {
    loading = true;
    try {
      const response = await fetch('/api/analytics/summary');
      summary = await response.json();
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      loading = false;
    }
  }
</script>

<div class="analytics">
  <h2>📊 Analytics Dashboard</h2>
  
  {#if loading}
    <div class="loading">Loading analytics...</div>
  {:else if summary}
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{summary.totalStudents}</div>
        <div class="stat-label">Total Students</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-value">{summary.placedStudents}</div>
        <div class="stat-label">Interned Students</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-value">{summary.placementRate}%</div>
        <div class="stat-label">Internship Rate</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-value">{summary.totalCompanies}</div>
        <div class="stat-label">Total Companies</div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="chart-card">
        <h3>Branch-wise Statistics</h3>
        <table>
          <thead>
            <tr>
              <th>Branch</th>
              <th>Total</th>
              <th>Interned</th>
              <th>Rate</th>
            </tr>
          </thead>
          <tbody>
            {#each summary.branchStats as stat}
              <tr>
                <td>{stat.branch}</td>
                <td>{stat.total}</td>
                <td>{stat.placed}</td>
                <td>{((stat.placed / stat.total) * 100).toFixed(1)}%</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="chart-card">
        <h3>Campus-wise Statistics</h3>
        <table>
          <thead>
            <tr>
              <th>Campus</th>
              <th>Total</th>
              <th>Interned</th>
              <th>Rate</th>
            </tr>
          </thead>
          <tbody>
            {#each summary.campusStats as stat}
              <tr>
                <td>{stat.campus}</td>
                <td>{stat.total}</td>
                <td>{stat.placed}</td>
                <td>{((stat.placed / stat.total) * 100).toFixed(1)}%</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="chart-card">
        <h3>Top Companies</h3>
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Placements</th>
            </tr>
          </thead>
          <tbody>
            {#each summary.topCompanies as company}
              <tr>
                <td>{company.name}</td>
                <td>{company.placed_count}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<style>
  .analytics {
    padding: 2rem;
  }

  h2 {
    color: #333;
    margin-bottom: 2rem;
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: #666;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: white;
    padding: 2rem;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    text-align: center;
  }

  .stat-value {
    font-size: 3rem;
    font-weight: bold;
    color: #667eea;
    margin-bottom: 0.5rem;
  }

  .stat-label {
    color: #666;
    font-size: 1rem;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 1.5rem;
  }

  .chart-card {
    background: white;
    padding: 1.5rem;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  }

  .chart-card h3 {
    color: #333;
    margin-top: 0;
    margin-bottom: 1rem;
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
</style>
