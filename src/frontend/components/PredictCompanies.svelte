<script lang="ts">
  let cgpa = '';
  let tenth = '';
  let twelfth = '';
  let eligibleCompanies: any[] = [];
  let loading = false;
  let searched = false;

  async function predictCompanies() {
    if (!cgpa || !tenth || !twelfth) {
      alert('Please fill in all fields');
      return;
    }

    loading = true;
    searched = true;
    try {
      const response = await fetch('/api/predict-companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cgpa: parseFloat(cgpa),
          tenth: parseFloat(tenth),
          twelfth: parseFloat(twelfth)
        })
      });

      eligibleCompanies = await response.json();
    } catch (error) {
      console.error('Error predicting companies:', error);
    } finally {
      loading = false;
    }
  }
</script>

<div class="predict-companies">
  <h2>🔮 Predict Eligible Companies</h2>

  <div class="form-container">
    <p class="description">
      Enter a student's academic details to see which companies they might be eligible for based on historical data.
    </p>

    <div class="input-grid">
      <div class="form-group">
        <label for="cgpa">CGPA *</label>
        <input 
          id="cgpa"
          type="number" 
          step="0.01" 
          min="0" 
          max="10"
          placeholder="e.g., 8.5" 
          bind:value={cgpa}
        />
      </div>

      <div class="form-group">
        <label for="tenth">10th Marks (%) *</label>
        <input 
          id="tenth"
          type="number" 
          step="0.1" 
          min="0" 
          max="100"
          placeholder="e.g., 90" 
          bind:value={tenth}
        />
      </div>

      <div class="form-group">
        <label for="twelfth">12th Marks (%) *</label>
        <input 
          id="twelfth"
          type="number" 
          step="0.1" 
          min="0" 
          max="100"
          placeholder="e.g., 85" 
          bind:value={twelfth}
        />
      </div>
    </div>

    <button class="btn-primary" on:click={predictCompanies}>
      Find Eligible Companies
    </button>
  </div>

  {#if loading}
    <div class="loading">Analyzing eligibility...</div>
  {:else if searched}
    <div class="results-container">
      <h3>Eligible Companies ({eligibleCompanies.length})</h3>
      
      {#if eligibleCompanies.length === 0}
        <div class="no-results">
          <p>No companies found matching these criteria.</p>
          <p>This might mean:</p>
          <ul>
            <li>No companies have been added to the system yet</li>
            <li>No historical data available for cutoff analysis</li>
            <li>The entered marks are below all known cutoffs</li>
          </ul>
        </div>
      {:else}
        <div class="companies-list">
          {#each eligibleCompanies as company}
            <div class="company-card">
              <h4>{company.name}</h4>
              
              {#if company.notes}
                <p class="notes">{company.notes}</p>
              {/if}

              <div class="cutoffs">
                <h5>Cutoffs (based on shortlisted students)</h5>
                <div class="cutoff-grid">
                  {#if company.min_cgpa}
                    <div class="cutoff-item">
                      <span class="label">Min CGPA:</span>
                      <span class="value">{company.min_cgpa.toFixed(2)}</span>
                    </div>
                  {/if}
                  {#if company.avg_cgpa}
                    <div class="cutoff-item">
                      <span class="label">Avg CGPA:</span>
                      <span class="value">{company.avg_cgpa.toFixed(2)}</span>
                    </div>
                  {/if}
                  {#if company.min_tenth}
                    <div class="cutoff-item">
                      <span class="label">Min 10th:</span>
                      <span class="value">{company.min_tenth.toFixed(1)}%</span>
                    </div>
                  {/if}
                  {#if company.min_twelfth}
                    <div class="cutoff-item">
                      <span class="label">Min 12th:</span>
                      <span class="value">{company.min_twelfth.toFixed(1)}%</span>
                    </div>
                  {/if}
                  {#if company.total_shortlisted}
                    <div class="cutoff-item">
                      <span class="label">Total Shortlisted:</span>
                      <span class="value">{company.total_shortlisted}</span>
                    </div>
                  {/if}
                  {#if company.gender_ratio}
                    <div class="cutoff-item">
                      <span class="label">Gender Ratio (M:F):</span>
                      <span class="value">{company.gender_ratio}</span>
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .predict-companies {
    padding: 2rem;
  }

  h2 {
    color: #333;
    margin-bottom: 2rem;
  }

  .form-container {
    background: white;
    padding: 2rem;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    margin-bottom: 2rem;
  }

  .description {
    color: #666;
    margin-bottom: 1.5rem;
  }

  .input-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
  }

  label {
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: #333;
  }

  input {
    padding: 0.75rem;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
  }

  input:focus {
    outline: none;
    border-color: #667eea;
  }

  .btn-primary {
    padding: 1rem 2rem;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    width: 100%;
  }

  .btn-primary:hover {
    background: #5568d3;
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: #666;
    background: white;
    border-radius: 10px;
  }

  .results-container {
    background: white;
    padding: 2rem;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  }

  .results-container h3 {
    color: #333;
    margin-top: 0;
    margin-bottom: 1.5rem;
  }

  .no-results {
    padding: 2rem;
    text-align: center;
    color: #666;
  }

  .no-results ul {
    text-align: left;
    margin: 1rem auto;
    max-width: 500px;
  }

  .companies-list {
    display: grid;
    gap: 1.5rem;
  }

  .company-card {
    border: 2px solid #eee;
    border-radius: 10px;
    padding: 1.5rem;
    transition: border-color 0.2s;
  }

  .company-card:hover {
    border-color: #667eea;
  }

  .company-card h4 {
    margin: 0 0 0.5rem 0;
    color: #333;
    font-size: 1.3rem;
  }

  .notes {
    color: #666;
    font-size: 0.9rem;
    margin: 0.5rem 0 1rem 0;
  }

  .cutoffs {
    margin-top: 1rem;
  }

  .cutoffs h5 {
    color: #667eea;
    margin: 0 0 1rem 0;
    font-size: 1rem;
  }

  .cutoff-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
  }

  .cutoff-item {
    background: #f8f9fa;
    padding: 0.75rem;
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .cutoff-item .label {
    color: #666;
    font-size: 0.9rem;
  }

  .cutoff-item .value {
    color: #333;
    font-weight: 600;
    font-size: 1.1rem;
  }
</style>
