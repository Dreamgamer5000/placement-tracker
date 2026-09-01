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

<div class="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
  
  <!-- Header -->
  <div class="neon-card p-5 sm:p-6 space-y-1">
    <div class="flex items-center justify-between">
      <h1 class="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
        Company Cutoff Predictor
      </h1>
      <span class="text-xs font-mono text-zinc-400">2027 Batch Intelligence</span>
    </div>
    <p class="text-xs sm:text-sm text-zinc-400 font-normal">
      Evaluate company eligibility and shortlist cutoff thresholds based on your CGPA and 10th/12th academic percentages.
    </p>
  </div>

  <!-- Form Input Card -->
  <div class="neon-card p-5 sm:p-7 space-y-5">
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div>
        <label for="cgpa" class="block text-xs font-mono font-medium uppercase text-zinc-400 mb-1.5">
          CGPA (0 - 10) *
        </label>
        <input 
          id="cgpa"
          type="number" 
          step="0.01" 
          min="0" 
          max="10" 
          placeholder="e.g. 8.75" 
          bind:value={cgpa}
          class="w-full px-4 py-2.5 rounded-xl font-mono text-sm font-semibold text-white bg-zinc-900 border border-white/10 focus:border-[#a3e635] focus:outline-none"
        />
      </div>

      <div>
        <label for="tenth" class="block text-xs font-mono font-medium uppercase text-zinc-400 mb-1.5">
          10th Standard (%) *
        </label>
        <input 
          id="tenth"
          type="number" 
          step="0.1" 
          min="0" 
          max="100" 
          placeholder="e.g. 92.5" 
          bind:value={tenth}
          class="w-full px-4 py-2.5 rounded-xl font-mono text-sm font-semibold text-white bg-zinc-900 border border-white/10 focus:border-[#a3e635] focus:outline-none"
        />
      </div>

      <div>
        <label for="twelfth" class="block text-xs font-mono font-medium uppercase text-zinc-400 mb-1.5">
          12th / Diploma (%) *
        </label>
        <input 
          id="twelfth"
          type="number" 
          step="0.1" 
          min="0" 
          max="100" 
          placeholder="e.g. 89.0" 
          bind:value={twelfth}
          class="w-full px-4 py-2.5 rounded-xl font-mono text-sm font-semibold text-white bg-zinc-900 border border-white/10 focus:border-[#a3e635] focus:outline-none"
        />
      </div>
    </div>

    <button 
      class="w-full neon-btn-primary py-3 rounded-xl text-xs sm:text-sm font-semibold uppercase tracking-wider touch-press min-h-[44px] disabled:opacity-50 cursor-pointer"
      on:click={predictCompanies}
      disabled={loading}
    >
      {loading ? 'Evaluating Cutoffs…' : 'Calculate Company Eligibility'}
    </button>
  </div>

  <!-- Results Section -->
  {#if loading}
    <div class="neon-card p-12 text-center flex flex-col items-center justify-center gap-3">
      <div class="w-10 h-10 rounded-full border-2 border-[#a3e635]/20 border-t-[#a3e635] animate-spin"></div>
      <p class="text-xs font-mono text-zinc-400">Scanning recruitment dataset and cutoff thresholds…</p>
    </div>
  {:else if searched}
    <div class="neon-card p-5 sm:p-7 space-y-5">
      <div class="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <div>
          <h2 class="text-base sm:text-lg font-display font-bold text-white flex items-center gap-2">
            <span>🎯</span> Matched Opportunities
          </h2>
          <p class="text-xs text-zinc-400 mt-0.5">
            Companies where your academic profile meets or exceeds historical cutoffs.
          </p>
        </div>
        <span class="neon-badge-lime px-3 py-1 rounded-full text-xs font-mono font-semibold">
          {eligibleCompanies.length} Drives Eligible
        </span>
      </div>

      {#if eligibleCompanies.length === 0}
        <div class="py-12 text-center text-zinc-400 space-y-1">
          <p class="text-sm font-semibold text-white">No historical drives match these specific academic cutoffs.</p>
          <p class="text-xs text-zinc-500 font-mono">Adjust CGPA or percentage parameters to evaluate alternative tiers.</p>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {#each eligibleCompanies as company}
            <div class="bg-zinc-900/90 rounded-2xl border border-white/[0.08] p-5 space-y-3.5 hover:border-white/20 transition-all">
              
              <!-- Company Header & Tags -->
              <div class="flex justify-between items-start gap-2">
                <div>
                  <h3 class="text-base font-display font-bold text-white tracking-tight">{company.name}</h3>
                  {#if company.role}
                    <p class="text-xs font-mono text-[#38bdf8] mt-0.5">{company.role}</p>
                  {/if}
                </div>
                {#if company.ctc}
                  <span class="neon-badge-lime px-2.5 py-1 rounded-full text-[11px] font-mono font-bold whitespace-nowrap">
                    💰 {company.ctc}
                  </span>
                {/if}
              </div>

              <!-- Notes or Criteria Snippet -->
              {#if company.eligibility_criteria}
                <div class="text-xs bg-zinc-950/80 p-2.5 rounded-lg border border-white/[0.06] text-zinc-300 font-mono">
                  <span class="text-[10px] text-zinc-500 uppercase block mb-0.5">Criteria</span>
                  {company.eligibility_criteria}
                </div>
              {:else if company.notes}
                <p class="text-xs text-zinc-400 line-clamp-2">{company.notes}</p>
              {/if}

              <!-- Branches if available -->
              {#if company.eligible_branches}
                <div class="text-[11px] text-zinc-400">
                  <span class="font-mono text-zinc-500 uppercase text-[10px]">Branches:</span> {company.eligible_branches}
                </div>
              {/if}

              <!-- Computed Academic Thresholds -->
              <div class="pt-2 border-t border-white/[0.06]">
                <span class="text-[10px] font-mono font-semibold uppercase text-zinc-400 block mb-2">Calculated Academic Range</span>
                <div class="grid grid-cols-4 gap-2 text-center font-mono text-xs">
                  <div class="bg-zinc-950/70 p-2 rounded-xl border border-white/[0.06]">
                    <span class="text-[9px] text-zinc-500 uppercase block">Min CGPA</span>
                    <span class="font-bold text-[#a3e635] tabular-nums">
                      {company.min_cgpa !== null && company.min_cgpa !== undefined ? company.min_cgpa.toFixed(2) : 'Open'}
                    </span>
                  </div>
                  <div class="bg-zinc-950/70 p-2 rounded-xl border border-white/[0.06]">
                    <span class="text-[9px] text-zinc-500 uppercase block">Avg CGPA</span>
                    <span class="font-bold text-[#38bdf8] tabular-nums">
                      {company.avg_cgpa !== null && company.avg_cgpa !== undefined ? company.avg_cgpa.toFixed(2) : '—'}
                    </span>
                  </div>
                  <div class="bg-zinc-950/70 p-2 rounded-xl border border-white/[0.06]">
                    <span class="text-[9px] text-zinc-500 uppercase block">Max CGPA</span>
                    <span class="font-bold text-purple-300 tabular-nums">
                      {company.max_cgpa !== null && company.max_cgpa !== undefined ? company.max_cgpa.toFixed(2) : '—'}
                    </span>
                  </div>
                  <div class="bg-zinc-950/70 p-2 rounded-xl border border-white/[0.06]">
                    <span class="text-[9px] text-zinc-500 uppercase block">Shortlisted</span>
                    <span class="font-bold text-white tabular-nums">{company.total_shortlisted || 0}</span>
                  </div>
                </div>
              </div>

            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

</div>
