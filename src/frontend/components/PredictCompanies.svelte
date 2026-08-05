<script lang="ts">
  let cgpa = '';
  let tenth = '';
  let twelfth = '';
  let eligibleCompanies: any[] = [];
  let loading = false;
  let searched = false;

  async function predictCompanies() {
    if (!cgpa || !tenth || !twelfth) {
      alert('Please fill in all fields (CGPA, 10th %, 12th %)');
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

<div class="p-8 max-w-[1600px] mx-auto space-y-8">
  <!-- Header -->
  <div>
    <h2 class="text-3xl font-bold text-gray-900 flex items-center gap-2">
      🔮 Predict Eligible Companies
    </h2>
    <p class="text-gray-500 text-sm mt-1">
      Analyze candidate academic profiles against historical cutoff thresholds to predict placement eligibility.
    </p>
  </div>

  <!-- Form Card -->
  <div class="bg-white rounded-2xl shadow-md p-6 border border-purple-100 space-y-6">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div>
        <label for="cgpa" class="block text-xs font-bold text-gray-700 uppercase mb-1">Cumulative CGPA (0 - 10) *</label>
        <input 
          id="cgpa"
          type="number" 
          step="0.01" 
          min="0" 
          max="10"
          placeholder="e.g. 8.75" 
          bind:value={cgpa}
          class="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-base font-semibold"
        />
      </div>

      <div>
        <label for="tenth" class="block text-xs font-bold text-gray-700 uppercase mb-1">10th Marks (%) *</label>
        <input 
          id="tenth"
          type="number" 
          step="0.1" 
          min="0" 
          max="100"
          placeholder="e.g. 92.5" 
          bind:value={tenth}
          class="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-base font-semibold"
        />
      </div>

      <div>
        <label for="twelfth" class="block text-xs font-bold text-gray-700 uppercase mb-1">12th Marks (%) *</label>
        <input 
          id="twelfth"
          type="number" 
          step="0.1" 
          min="0" 
          max="100"
          placeholder="e.g. 89.0" 
          bind:value={twelfth}
          class="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-base font-semibold"
        />
      </div>
    </div>

    <button 
      class="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
      on:click={predictCompanies}
      disabled={loading}
    >
      {#if loading}
        <span class="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
        Analyzing Cutoffs...
      {:else}
        ⚡ Calculate Eligible Companies
      {/if}
    </button>
  </div>

  {#if loading}
    <div class="text-center py-16 text-gray-600 bg-white rounded-2xl shadow-sm border border-gray-100">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      <p class="mt-4 text-base font-medium">Analyzing historical eligibility thresholds...</p>
    </div>
  {:else if searched}
    <div class="bg-white rounded-2xl shadow-md p-6 border border-gray-100 space-y-6">
      <div class="flex justify-between items-center border-b border-gray-100 pb-4">
        <h3 class="text-2xl font-bold text-gray-900 flex items-center gap-2">
          🎯 Matching Companies
        </h3>
        <span class="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded-full">
          {eligibleCompanies.length} Companies Match
        </span>
      </div>

      {#if eligibleCompanies.length === 0}
        <div class="py-12 text-center text-gray-500 space-y-2">
          <p class="text-lg font-semibold">No companies found matching these academic cutoffs.</p>
          <p class="text-sm">Try adjusting the CGPA or percentage parameters to expand candidate eligibility.</p>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          {#each eligibleCompanies as company}
            <div class="bg-slate-50/70 rounded-2xl border border-slate-200 p-6 space-y-3 hover:border-purple-300 transition-all hover:shadow-md">
              <div class="flex justify-between items-start">
                <h4 class="text-xl font-bold text-gray-900">{company.name}</h4>
                {#if company.ctc}
                  <span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                    💰 {company.ctc}
                  </span>
                {/if}
              </div>

              {#if company.notes}
                <p class="text-xs text-gray-600 line-clamp-2">{company.notes}</p>
              {/if}

              <div class="pt-3 border-t border-slate-200 space-y-2">
                <span class="text-xs font-bold text-purple-700 uppercase tracking-wider block">Historical Cutoffs</span>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {#if company.min_cgpa}
                    <div class="bg-white p-2 rounded-lg border border-slate-200">
                      <span class="text-gray-500 block text-[10px]">Min CGPA</span>
                      <span class="font-bold text-gray-900">{company.min_cgpa.toFixed(2)}</span>
                    </div>
                  {/if}
                  {#if company.avg_cgpa}
                    <div class="bg-white p-2 rounded-lg border border-slate-200">
                      <span class="text-gray-500 block text-[10px]">Avg CGPA</span>
                      <span class="font-bold text-gray-900">{company.avg_cgpa.toFixed(2)}</span>
                    </div>
                  {/if}
                  {#if company.min_tenth}
                    <div class="bg-white p-2 rounded-lg border border-slate-200">
                      <span class="text-gray-500 block text-[10px]">Min 10th</span>
                      <span class="font-bold text-gray-900">{company.min_tenth.toFixed(1)}%</span>
                    </div>
                  {/if}
                  {#if company.min_twelfth}
                    <div class="bg-white p-2 rounded-lg border border-slate-200">
                      <span class="text-gray-500 block text-[10px]">Min 12th</span>
                      <span class="font-bold text-gray-900">{company.min_twelfth.toFixed(1)}%</span>
                    </div>
                  {/if}
                  {#if company.total_shortlisted}
                    <div class="bg-white p-2 rounded-lg border border-slate-200">
                      <span class="text-gray-500 block text-[10px]">Shortlisted</span>
                      <span class="font-bold text-purple-700">{company.total_shortlisted}</span>
                    </div>
                  {/if}
                  {#if company.gender_ratio}
                    <div class="bg-white p-2 rounded-lg border border-slate-200">
                      <span class="text-gray-500 block text-[10px]">Gender (M:F)</span>
                      <span class="font-bold text-gray-900">{company.gender_ratio}</span>
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
