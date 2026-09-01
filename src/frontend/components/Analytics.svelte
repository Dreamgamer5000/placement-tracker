<script lang="ts">
  import { onMount } from 'svelte';

  let summary: any = null;
  let loading = true;
  let errorMessage: string | null = null;

  // Search filter terms for company breakdown tables
  let finalSearchTerm = '';
  let internSearchTerm = '';

  // Interactive Hover state for visual charts
  let hoveredBranch: any = null;
  let hoveredCtc: any = null;

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

  // High-Energy & Elegant Pie chart color palette
  const pieColors = [
    '#a3e635', // Lime
    '#38bdf8', // Sky / Cyan
    '#c084fc', // Purple
    '#f59e0b', // Amber
    '#fb7185', // Rose
    '#34d399', // Emerald
    '#818cf8', // Indigo
    '#f472b6', // Pink
    '#2dd4bf', // Teal
    '#94a3b8'  // Slate
  ];

  $: branchChartData = (summary?.finalPlacement?.branchStats || [])
    .filter((s: any) => s.placed > 0)
    .sort((a: any, b: any) => b.placed - a.placed)
    .map((s: any, idx: number) => ({
      ...s,
      color: pieColors[idx % pieColors.length]
    }));

  $: branchTotalPlaced = branchChartData.reduce((sum: number, s: any) => sum + s.placed, 0);

  $: branchConicGradient = branchChartData.length > 0
    ? (() => {
        let currentPercent = 0;
        return branchChartData.map((s: any) => {
          const start = currentPercent;
          const share = (s.placed / branchTotalPlaced) * 100;
          currentPercent += share;
          return `${s.color} ${start}% ${currentPercent}%`;
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
      { label: '< 10 LPA', count: 0, color: '#fb7185' },
      { label: '10 - 15 LPA', count: 0, color: '#f59e0b' },
      { label: '15 - 20 LPA', count: 0, color: '#38bdf8' },
      { label: '20 - 30 LPA', count: 0, color: '#a3e635' },
      { label: '> 30 LPA', count: 0, color: '#c084fc' },
      { label: 'Not Disclosed', count: 0, color: '#71717a' }
    ];
    
    (summary?.finalPlacement?.companiesBreakdown || []).forEach((c: any) => {
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

<div class="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
  
  <!-- Header with Refresh / Recalculate Trigger -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/80 border border-white/[0.08] p-5 sm:p-6 rounded-2xl backdrop-blur-xl relative overflow-hidden">
    <div class="space-y-1">
      <h1 class="text-2xl sm:text-3xl font-display font-bold tracking-tight text-white">
        Placement Statistics & Insights
      </h1>
      <p class="text-xs sm:text-sm text-zinc-400 font-normal">
        Real-time metrics for full-time offers and internships across branches, CTC tiers, and campuses.
      </p>
    </div>

    <button 
      class="neon-btn-ghost px-4 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 shrink-0 touch-press min-h-[38px]"
      on:click={() => loadSummary(true)} 
      disabled={loading}
    >
      <span class={loading ? 'animate-spin' : ''}>↻</span>
      <span>{loading ? 'Refreshing…' : 'Refresh data'}</span>
    </button>
  </div>

  {#if loading}
    <div class="neon-card p-16 text-center flex flex-col items-center justify-center gap-4">
      <div class="w-8 h-8 rounded-full border-2 border-white/20 border-t-[#a3e635] animate-spin"></div>
      <p class="text-sm font-mono text-zinc-400">Loading placement metrics…</p>
    </div>
  {:else if errorMessage}
    <div class="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-6 backdrop-blur-md text-center space-y-3">
      <div class="text-2xl text-rose-400 font-mono">⚠️</div>
      <h3 class="text-base font-bold text-rose-300">Unable to Fetch Analytics</h3>
      <p class="text-xs sm:text-sm text-rose-400 font-mono">{errorMessage}</p>
      <button class="neon-btn-primary px-4 py-2 rounded-xl text-xs font-semibold" on:click={() => loadSummary(true)}>
        Retry Sync
      </button>
    </div>
  {:else if summary}

    <!-- Top Bento Grid: High-Impact Metric Widgets -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
      
      <!-- Total NeoID Candidates -->
      <div class="neon-card p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between group">
        <div>
          <span class="text-[11px] font-mono font-medium uppercase tracking-wider text-zinc-400">Total Registered</span>
          <div class="mt-1.5 text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight tabular-nums">
            {summary.totalNeoIds || 0}
          </div>
        </div>
        <div class="mt-3 text-[11px] text-zinc-400 flex items-center gap-1.5 font-mono">
          <span class="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
          Master Directory Candidates
        </div>
      </div>

      <!-- Placed Candidates (Full-Time Offers / Internships) -->
      <div class="neon-card p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between group">
        <div>
          <span class="text-[11px] font-mono font-medium uppercase tracking-wider text-[#38bdf8]">Full-Time / Offers</span>
          <div class="mt-1.5 text-2xl sm:text-3xl font-bold font-mono text-[#38bdf8] tracking-tight tabular-nums">
            {summary.totalPlacedNeoIds || 0}
          </div>
        </div>
        <div class="mt-3 text-[11px] text-zinc-300 flex items-center justify-between font-mono tabular-nums">
          <span>{summary.overallNeoIdPlacementRate || "0.00"}% conversion</span>
          <span class="text-zinc-500">{summary.totalPlacedNeoIds || 0}/{summary.totalNeoIds || 0}</span>
        </div>
      </div>

      <!-- HIGHLIGHT SPOTLIGHT: CHENNAI PLACEMENT RATE -->
      <div class="rounded-2xl border border-[#a3e635]/40 bg-zinc-900/90 p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between shadow-sm group">
        <div class="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#a3e635]/60 via-[#a3e635] to-[#a3e635]/60"></div>
        <div>
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-mono font-medium uppercase tracking-wider text-[#a3e635]">Chennai Conversion</span>
            <span class="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-[#a3e635]/15 text-[#a3e635] rounded-full border border-[#a3e635]/30">Key Metric</span>
          </div>
          <div class="mt-1.5 text-3xl sm:text-4xl font-bold font-mono text-[#a3e635] tracking-tight tabular-nums">
            {summary.chennaiNeoIdStats?.rate || "0.00"}%
          </div>
        </div>
        <div class="mt-3 text-[11px] text-zinc-300 font-mono flex items-center gap-1.5 tabular-nums">
          <span>{summary.chennaiNeoIdStats?.placed || 0} offers / {summary.chennaiNeoIdStats?.total || 0} total</span>
        </div>
      </div>

      <!-- Interns Selected -->
      <div class="neon-card p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between group">
        <div>
          <span class="text-[11px] font-mono font-medium uppercase tracking-wider text-amber-400">Internship Offers</span>
          <div class="mt-1.5 text-2xl sm:text-3xl font-bold font-mono text-amber-300 tracking-tight tabular-nums">
            {summary.internAnalytics?.totalInterns || 0}
          </div>
        </div>
        <div class="mt-3 text-[11px] text-zinc-400 flex items-center gap-1.5 font-mono">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          Chennai Tracked (Others Not Monitored)
        </div>
      </div>

      <!-- Recruiting Companies -->
      <div class="neon-card p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between group">
        <div>
          <span class="text-[11px] font-mono font-medium uppercase tracking-wider text-purple-300">Recruiting Drives</span>
          <div class="mt-1.5 text-2xl sm:text-3xl font-bold font-mono text-purple-200 tracking-tight tabular-nums">
            {summary.totalCompanies || 0}
          </div>
        </div>
        <div class="mt-3 text-[11px] text-zinc-400 flex items-center gap-1.5 font-mono">
          <span class="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
          Active Drive Profiles
        </div>
      </div>

    </div>

    <!-- 📊 VISUAL SHARE & INTERACTIVE ANALYTICS (BIGGER CIRCLES + HOVER STATS) -->
    <div class="space-y-4">
      <div class="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
        <div>
          <h2 class="text-base sm:text-lg font-display font-bold text-white tracking-tight">
            Visual Distribution & Branch Analytics
          </h2>
          <p class="text-xs text-zinc-400">
            Hover over any chart segment or branch row for real-time percentage and candidate count breakdowns.
          </p>
        </div>
        <span class="neon-badge-lime px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium">
          Interactive Charts
        </span>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- 🎯 Chart 1: Branch Distribution with Large Interactive Donut & Percentages -->
        <div class="neon-card p-5 sm:p-7 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-sm font-display font-bold text-white">Branch Hire Distribution</h3>
                <span class="text-xs text-zinc-400">Proportional share of offers across academic branches</span>
              </div>
              <span class="text-xs font-mono text-zinc-400 bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/[0.06] tabular-nums">
                Total: <strong class="text-white">{branchTotalPlaced}</strong> offers
              </span>
            </div>

            <!-- Big Circle & Center Interactive Readout -->
            <div class="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8 my-6">
              
              <!-- Large Interactive Donut (240px) -->
              <div 
                class="w-56 h-56 sm:w-60 sm:h-60 rounded-full flex items-center justify-center relative shadow-lg transition-transform duration-200 hover:scale-105 select-none shrink-0"
                style="background: conic-gradient({branchConicGradient});"
              >
                <!-- Inner Donut Cutout with Live Center Readout -->
                <div class="w-36 h-36 sm:w-40 sm:h-40 rounded-full bg-[#090a0f] border border-white/[0.08] flex flex-col items-center justify-center text-center p-3 z-10 shadow-inner">
                  {#if hoveredBranch}
                    <span 
                      class="text-[10px] font-mono font-bold uppercase tracking-wider truncate max-w-[120px] px-2 py-0.5 rounded"
                      style="color: {hoveredBranch.color}; background: {hoveredBranch.color}15;"
                    >
                      {hoveredBranch.branch}
                    </span>
                    <span class="text-2xl font-bold font-mono text-white mt-1 tabular-nums">
                      {hoveredBranch.placed}
                    </span>
                    <span class="text-[11px] font-mono font-medium text-zinc-400 tabular-nums">
                      {((hoveredBranch.placed / branchTotalPlaced) * 100).toFixed(1)}% share
                    </span>
                  {:else}
                    <span class="text-[10px] font-mono uppercase text-zinc-400 tracking-wider">
                      All Branches
                    </span>
                    <span class="text-2xl sm:text-3xl font-bold font-mono text-white mt-0.5 tabular-nums">
                      {branchTotalPlaced}
                    </span>
                    <span class="text-[10px] font-mono text-[#a3e635] font-semibold mt-0.5">
                      100% Total Hired
                    </span>
                  {/if}
                </div>
              </div>

              <!-- Compact Top Branch Quick Legend -->
              <div class="flex-1 w-full space-y-2">
                <span class="text-[11px] font-mono uppercase text-zinc-400 block mb-1 font-semibold tracking-wider">
                  Top Branches by Hires:
                </span>
                <div class="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {#each branchChartData.slice(0, 5) as branch}
                    <!-- svelte-ignore a11y-mouse-events-have-key-events -->
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <div 
                      class="p-2 rounded-xl transition-all flex items-center justify-between cursor-pointer border
                        {hoveredBranch?.branch === branch.branch 
                          ? 'bg-white/[0.08] border-white/20 shadow-sm' 
                          : 'bg-white/[0.02] border-transparent hover:bg-white/[0.04]'}"
                      on:mouseenter={() => hoveredBranch = branch}
                      on:mouseleave={() => hoveredBranch = null}
                    >
                      <div class="flex items-center gap-2 min-w-0">
                        <span class="w-3 h-3 rounded-full shrink-0" style="background-color: {branch.color};"></span>
                        <span class="text-xs font-semibold text-zinc-200 truncate">{branch.branch}</span>
                      </div>
                      <div class="flex items-center gap-2 shrink-0 font-mono text-xs tabular-nums">
                        <span class="font-bold text-white">{branch.placed}</span>
                        <span class="text-zinc-400 text-[11px]">({((branch.placed / branchTotalPlaced) * 100).toFixed(1)}%)</span>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>

            </div>

            <!-- Complete Branch Table with Proportional Progress Bars -->
            <div class="mt-4 pt-4 border-t border-white/[0.08] space-y-2">
              <div class="flex items-center justify-between text-xs font-mono text-zinc-400 uppercase tracking-wider mb-2">
                <span>All Branches Breakdown ({branchChartData.length} active)</span>
                <span>Proportion / Rate</span>
              </div>

              <div class="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {#each branchChartData as branch}
                  <!-- svelte-ignore a11y-mouse-events-have-key-events -->
                  <!-- svelte-ignore a11y-no-static-element-interactions -->
                  <div 
                    class="p-2.5 rounded-xl border transition-all cursor-pointer space-y-1.5
                      {hoveredBranch?.branch === branch.branch 
                        ? 'bg-white/[0.08] border-white/20' 
                        : 'bg-zinc-900/60 border-white/[0.04] hover:bg-white/[0.04]'}"
                    on:mouseenter={() => hoveredBranch = branch}
                    on:mouseleave={() => hoveredBranch = null}
                  >
                    <div class="flex items-center justify-between text-xs font-mono">
                      <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full" style="background-color: {branch.color};"></span>
                        <span class="font-semibold text-zinc-200">{branch.branch}</span>
                      </div>
                      <div class="flex items-center gap-3 tabular-nums">
                        <span class="text-white font-bold">{branch.placed} offers</span>
                        <span class="text-[#a3e635] font-semibold">{((branch.placed / branchTotalPlaced) * 100).toFixed(1)}%</span>
                        {#if branch.total}
                          <span class="text-zinc-500 text-[11px]">({((branch.placed / branch.total) * 100).toFixed(0)}% batch)</span>
                        {/if}
                      </div>
                    </div>

                    <!-- Visual Share Bar -->
                    <div class="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        class="h-full rounded-full transition-all duration-300"
                        style="width: {((branch.placed / branchTotalPlaced) * 100).toFixed(1)}%; background-color: {branch.color};"
                      ></div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>

          </div>
        </div>

        <!-- 💼 Chart 2: CTC Tier Distribution with Interactive Donut -->
        <div class="neon-card p-5 sm:p-7 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-sm font-display font-bold text-white">Compensation Package Tiers</h3>
                <span class="text-xs text-zinc-400">Breakdown of offers across salary brackets</span>
              </div>
              <span class="text-xs font-mono text-zinc-400 bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/[0.06] tabular-nums">
                Tiers: <strong class="text-white">{ctcTotalPlaced}</strong> placements
              </span>
            </div>

            <!-- Big Circle & Center Interactive Readout -->
            <div class="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8 my-6">
              
              <!-- Large Interactive Donut (240px) -->
              <div 
                class="w-56 h-56 sm:w-60 sm:h-60 rounded-full flex items-center justify-center relative shadow-lg transition-transform duration-200 hover:scale-105 select-none shrink-0"
                style="background: conic-gradient({ctcConicGradient});"
              >
                <!-- Inner Donut Cutout with Live Center Readout -->
                <div class="w-36 h-36 sm:w-40 sm:h-40 rounded-full bg-[#090a0f] border border-white/[0.08] flex flex-col items-center justify-center text-center p-3 z-10 shadow-inner">
                  {#if hoveredCtc}
                    <span 
                      class="text-[10px] font-mono font-bold uppercase tracking-wider truncate max-w-[120px] px-2 py-0.5 rounded"
                      style="color: {hoveredCtc.color}; background: {hoveredCtc.color}15;"
                    >
                      {hoveredCtc.label}
                    </span>
                    <span class="text-2xl font-bold font-mono text-white mt-1 tabular-nums">
                      {hoveredCtc.count}
                    </span>
                    <span class="text-[11px] font-mono font-medium text-zinc-400 tabular-nums">
                      {((hoveredCtc.count / ctcTotalPlaced) * 100).toFixed(1)}% share
                    </span>
                  {:else}
                    <span class="text-[10px] font-mono uppercase text-zinc-400 tracking-wider">
                      All Tiers
                    </span>
                    <span class="text-2xl sm:text-3xl font-bold font-mono text-white mt-0.5 tabular-nums">
                      {ctcTotalPlaced}
                    </span>
                    <span class="text-[10px] font-mono text-[#38bdf8] font-semibold mt-0.5">
                      Max: &gt; 30 LPA
                    </span>
                  {/if}
                </div>
              </div>

              <!-- CTC Tiers Breakdown List -->
              <div class="flex-1 w-full space-y-2">
                <span class="text-[11px] font-mono uppercase text-zinc-400 block mb-1 font-semibold tracking-wider">
                  Package Ranges:
                </span>
                <div class="space-y-2">
                  {#each ctcBuckets as bucket}
                    <!-- svelte-ignore a11y-mouse-events-have-key-events -->
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <div 
                      class="p-2.5 rounded-xl border transition-all cursor-pointer space-y-1.5
                        {hoveredCtc?.label === bucket.label 
                          ? 'bg-white/[0.08] border-white/20' 
                          : 'bg-zinc-900/60 border-white/[0.04] hover:bg-white/[0.04]'}"
                      on:mouseenter={() => hoveredCtc = bucket}
                      on:mouseleave={() => hoveredCtc = null}
                    >
                      <div class="flex items-center justify-between text-xs font-mono">
                        <div class="flex items-center gap-2">
                          <span class="w-2.5 h-2.5 rounded-full" style="background-color: {bucket.color};"></span>
                          <span class="font-semibold text-zinc-200">{bucket.label}</span>
                        </div>
                        <div class="flex items-center gap-2 tabular-nums">
                          <span class="text-white font-bold">{bucket.count}</span>
                          <span class="text-zinc-400 text-[11px]">({((bucket.count / ctcTotalPlaced) * 100).toFixed(1)}%)</span>
                        </div>
                      </div>

                      <!-- Share Bar -->
                      <div class="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          class="h-full rounded-full transition-all duration-300"
                          style="width: {((bucket.count / ctcTotalPlaced) * 100).toFixed(1)}%; background-color: {bucket.color};"
                        ></div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>

            </div>

            <!-- Context Footer -->
            <div class="mt-4 pt-3.5 border-t border-white/[0.08] flex items-center justify-between text-xs font-mono text-zinc-400">
              <span>Top Bracket: <strong class="text-purple-300">&gt; 30 LPA</strong></span>
              <span>Median Band: <strong class="text-[#38bdf8]">15 - 20 LPA</strong></span>
            </div>

          </div>
        </div>

      </div>
    </div>

    <!-- 🎓 SECTION 1: OFFERS & RECRUITMENT PARTNERS -->
    <div class="space-y-4 pt-4">
      <div class="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
        <div>
          <h2 class="text-base sm:text-lg font-display font-bold text-white tracking-tight">
            Full-Time Offers & Internships Breakdown
          </h2>
          <p class="text-xs text-zinc-400">
            Confirmed offers, campus distributions, and hiring company metrics (including PPO tracks).
          </p>
        </div>
        <span class="neon-badge-lime px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium">
          Full-Time Offers / Internships
        </span>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        
        <!-- Campus Placement Breakdown Table -->
        <div class="neon-card p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-1">
              <h3 class="text-sm font-display font-bold text-white">Campus-wise Offers & Rates</h3>
              <span class="text-[10px] font-mono text-zinc-400">NeoID Dataset</span>
            </div>
            <p class="text-xs text-zinc-400 mb-4">Breakdown across Chennai, Vellore, and other campuses.</p>

            <div class="table-responsive rounded-xl border border-white/[0.08] bg-zinc-900/60">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="border-b border-white/[0.08] bg-zinc-900 text-zinc-400 font-mono text-[10px] uppercase">
                    <th class="py-2.5 px-3">Campus</th>
                    <th class="py-2.5 px-2 text-right">Total</th>
                    <th class="py-2.5 px-2 text-right">Offers</th>
                    <th class="py-2.5 px-3 text-right">Rate</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/[0.06] font-mono">
                  {#each (summary.neoIdCampusStats || []) as stat}
                    <tr class="hover:bg-white/[0.03] transition-colors">
                      <td class="py-2.5 px-3">
                        {#if stat.campus?.toLowerCase() === 'chennai'}
                          <span class="neon-badge-cyan px-2 py-0.5 rounded text-[10px] font-medium">Chennai</span>
                        {:else if stat.campus?.toLowerCase() === 'vellore'}
                          <span class="neon-badge-purple px-2 py-0.5 rounded text-[10px] font-medium">Vellore</span>
                        {:else}
                          <span class="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded text-[10px] font-medium border border-white/[0.08]">Unknown</span>
                        {/if}
                      </td>
                      <td class="py-2.5 px-2 text-right text-zinc-300 font-medium tabular-nums">{stat.total || 0}</td>
                      <td class="py-2.5 px-2 text-right text-[#a3e635] font-bold tabular-nums">{stat.placed || 0}</td>
                      <td class="py-2.5 px-3 text-right tabular-nums">
                        <span class="text-xs font-bold {stat.placed > 0 ? 'text-[#a3e635]' : 'text-zinc-500'}">
                          {stat.placedRate || "0.00"}%
                        </span>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Full Placement Companies Table -->
        <div class="neon-card p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 class="text-sm font-display font-bold text-white">
                  Recruiting Partners & Offers
                </h3>
                <p class="text-xs text-zinc-400">Companies with verified candidate offers & PPO pipelines.</p>
              </div>
              
              <div class="relative w-full sm:w-48">
                <input
                  type="text"
                  placeholder="Search company…"
                  bind:value={finalSearchTerm}
                  class="w-full text-xs px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-white/10 text-white placeholder-zinc-500"
                />
              </div>
            </div>

            <div class="table-responsive rounded-xl border border-white/[0.08] bg-zinc-900/60 max-h-[240px] overflow-y-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead class="sticky top-0 z-10">
                  <tr class="border-b border-white/[0.08] bg-zinc-900 text-zinc-400 font-mono text-[10px] uppercase">
                    <th class="py-2.5 px-4">Company Name</th>
                    <th class="py-2.5 px-4 text-right">Offers / Selections</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/[0.06] font-mono">
                  {#if filteredFinalCompanies.length === 0}
                    <tr>
                      <td colspan="2" class="py-8 text-center text-zinc-500">No company records match your search filter.</td>
                    </tr>
                  {:else}
                    {#each filteredFinalCompanies as company}
                      <tr class="hover:bg-white/[0.03] transition-colors">
                        <td class="py-2.5 px-4 font-medium text-zinc-100 font-sans text-xs sm:text-sm">{company.name}</td>
                        <td class="py-2.5 px-4 text-right tabular-nums">
                          <span class="neon-badge-lime px-2.5 py-0.5 rounded-full text-xs font-semibold">
                            {company.total || 0} Offers
                          </span>
                        </td>
                      </tr>
                    {/each}
                  {/if}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- 💼 SECTION 2: INTERN SELECTION METRICS -->
    <div class="space-y-4 pt-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.08] pb-2.5 gap-2">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-base sm:text-lg font-display font-bold text-white tracking-tight">
              Internship Drive Metrics
            </h2>
            <span class="text-[10px] font-mono text-amber-400 bg-amber-400/10 border border-amber-400/25 px-2 py-0.5 rounded">
              Chennai Focused
            </span>
          </div>
          <p class="text-xs text-zinc-400 mt-0.5">
            Internship tracking was conducted primarily for <strong>Chennai campus only</strong>. Vellore and other campus drives were not actively tracked.
          </p>
        </div>
        <span class="neon-badge-amber px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium self-start sm:self-auto">
          Internship Selections
        </span>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        
        <!-- Branch-wise Interns -->
        <div class="neon-card p-4 sm:p-5">
          <h3 class="text-sm font-display font-bold text-white mb-1">Branch-wise Interns</h3>
          <p class="text-xs text-zinc-400 mb-3">Selections across Chennai engineering branches.</p>

          <div class="table-responsive rounded-xl border border-white/[0.08] bg-zinc-900/60 max-h-[220px] overflow-y-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead class="sticky top-0 z-10">
                <tr class="border-b border-white/[0.08] bg-zinc-900 text-zinc-400 font-mono text-[10px] uppercase">
                  <th class="py-2.5 px-3">Branch</th>
                  <th class="py-2.5 px-2 text-right">Reg.</th>
                  <th class="py-2.5 px-2 text-right">Interns</th>
                  <th class="py-2.5 px-3 text-right">Rate</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/[0.06] font-mono">
                {#each (summary.internAnalytics?.branchStats || []) as stat}
                  <tr class="hover:bg-white/[0.03] transition-colors">
                    <td class="py-2 px-3 font-semibold text-zinc-200">{stat.branch}</td>
                    <td class="py-2 px-2 text-right text-zinc-400 tabular-nums">{stat.total || 0}</td>
                    <td class="py-2 px-2 text-right text-amber-300 font-bold tabular-nums">{stat.interned || 0}</td>
                    <td class="py-2 px-3 text-right text-zinc-300 tabular-nums">
                      {stat.total > 0 ? (((stat.interned || 0) / stat.total) * 100).toFixed(1) : '0.0'}%
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Campus-wise Interns -->
        <div class="neon-card p-4 sm:p-5">
          <div class="flex items-center justify-between mb-1">
            <h3 class="text-sm font-display font-bold text-white">Campus-wise Interns</h3>
            <span class="text-[10px] font-mono text-zinc-400">Total: {summary.internAnalytics?.totalInterns || 0}</span>
          </div>
          <p class="text-xs text-zinc-400 mb-3">Selections grouped by campus (mapped & NeoIDs).</p>

          <div class="table-responsive rounded-xl border border-white/[0.08] bg-zinc-900/60 max-h-[220px] overflow-y-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead class="sticky top-0 z-10">
                <tr class="border-b border-white/[0.08] bg-zinc-900 text-zinc-400 font-mono text-[10px] uppercase">
                  <th class="py-2.5 px-3">Campus</th>
                  <th class="py-2.5 px-3 text-right">Interns</th>
                  <th class="py-2.5 px-3 text-right">Share</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/[0.06] font-mono">
                {#each (summary.internAnalytics?.campusStats || []) as stat}
                  <tr class="hover:bg-white/[0.03] transition-colors">
                    <td class="py-2 px-3">
                      {#if stat.campus?.toLowerCase() === 'chennai'}
                        <span class="neon-badge-cyan px-2 py-0.5 rounded text-[10px] font-medium">Chennai</span>
                      {:else if stat.campus?.toLowerCase() === 'vellore'}
                        <span class="neon-badge-purple px-2 py-0.5 rounded text-[10px] font-medium">Vellore</span>
                      {:else}
                        <span class="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded text-[10px] font-medium border border-white/[0.08]">Unknown / External</span>
                      {/if}
                    </td>
                    <td class="py-2 px-3 text-right text-amber-300 font-bold tabular-nums">{stat.interned || 0}</td>
                    <td class="py-2 px-3 text-right text-zinc-300 tabular-nums">
                      {summary.internAnalytics?.totalInterns > 0 ? (((stat.interned || 0) / summary.internAnalytics.totalInterns) * 100).toFixed(1) : '0.0'}%
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>

        <!-- All Companies Intern Offers -->
        <div class="neon-card p-4 sm:p-5">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-display font-bold text-white">Internship Partners</h3>
            <div class="relative w-36">
              <input
                type="text"
                placeholder="Search…"
                bind:value={internSearchTerm}
                class="w-full text-xs px-2.5 py-1.5 rounded-lg bg-zinc-900/90 border border-white/10 text-white placeholder-zinc-500"
              />
            </div>
          </div>

          <div class="table-responsive rounded-xl border border-white/[0.08] bg-zinc-900/60 max-h-[220px] overflow-y-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead class="sticky top-0 z-10">
                <tr class="border-b border-white/[0.08] bg-zinc-900 text-zinc-400 font-mono text-[10px] uppercase">
                  <th class="py-2.5 px-3">Company</th>
                  <th class="py-2.5 px-3 text-right">Interns</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/[0.06] font-mono">
                {#if filteredInternCompanies.length === 0}
                  <tr>
                    <td colspan="2" class="py-6 text-center text-zinc-500">No internship records found.</td>
                  </tr>
                {:else}
                  {#each filteredInternCompanies as company}
                    <tr class="hover:bg-white/[0.03] transition-colors">
                      <td class="py-2 px-3 font-medium text-zinc-200 font-sans text-xs">{company.name}</td>
                      <td class="py-2 px-3 text-right tabular-nums">
                        <span class="neon-badge-amber px-2.5 py-0.5 rounded-full text-[10px] font-semibold">
                          {company.total || 0} Interns
                        </span>
                      </td>
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
