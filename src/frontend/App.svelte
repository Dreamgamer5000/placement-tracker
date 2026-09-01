<script lang="ts">
  import { onMount } from 'svelte';
  import StudentList from './components/StudentList.svelte';
  import CompanyList from './components/CompanyList.svelte';
  import Analytics from './components/Analytics.svelte';
  import AddShortlist from './components/AddShortlist.svelte';
  import AddSelection from './components/AddSelection.svelte';
  import PredictCompanies from './components/PredictCompanies.svelte';
  import NeoIdManager from './components/NeoIdManager.svelte';

  let currentView = 'analytics';
  let mobileMenuOpen = false;
  let isDarkMode = true;

  onMount(() => {
    if (localStorage.theme === 'light') {
      isDarkMode = false;
      document.documentElement.classList.remove('dark');
    } else {
      isDarkMode = true;
      document.documentElement.classList.add('dark');
    }
  });

  function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
    }
  }

  const navItems = [
    { id: 'analytics', label: 'Analytics' },
    { id: 'students', label: 'Students' },
    { id: 'companies', label: 'Companies' },
    { id: 'shortlist', label: 'Add Shortlist' },
    { id: 'selection', label: 'Add Selection' },
    { id: 'predict', label: 'Predictor' },
    { id: 'neoids', label: 'Neo ID Map' }
  ];
  
  function navigate(view: string) {
    currentView = view;
    mobileMenuOpen = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
</script>

<main class="min-h-screen ambient-canvas text-zinc-100 relative selection:bg-[#a3e635]/20 selection:text-[#a3e635] pb-16 md:pb-10">
  
  <!-- Minimalist High-Craft Navbar -->
  <header class="sticky top-0 z-40 bg-[#090a0f]/85 backdrop-blur-xl border-b border-white/[0.08]">
    <div class="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
      <div class="flex items-center justify-between h-16 sm:h-18">
        
        <!-- Brand Logo & Live Pulse -->
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center font-display font-black text-sm sm:text-base text-[#a3e635] shadow-sm shrink-0">
            PT
          </div>
          <div class="truncate flex flex-col justify-center">
            <div class="flex items-center gap-2">
              <span class="text-base sm:text-lg font-display font-bold tracking-tight text-white">
                Placement Tracker
              </span>
            </div>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span class="relative flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#a3e635] opacity-60"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-[#a3e635]"></span>
              </span>
              <span class="text-[11px] font-mono font-medium text-zinc-400">
                2027 Batch • Live
              </span>
            </div>
          </div>
        </div>

        <!-- Desktop Navigation Tabs -->
        <div class="hidden md:flex items-center gap-2 lg:gap-3">
          <nav class="flex items-center gap-1 bg-zinc-900/90 p-1.5 rounded-2xl border border-white/[0.08] backdrop-blur-md">
            {#each navItems as item}
              <button 
                on:click={() => navigate(item.id)}
                class="px-3.5 lg:px-4 py-1.5 lg:py-2 rounded-xl text-xs lg:text-sm font-medium transition-all duration-150 touch-press min-h-[36px]
                  {currentView === item.id 
                    ? 'bg-white/10 text-white font-semibold shadow-sm border border-white/10' 
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'}"
              >
                {item.label}
              </button>
            {/each}
          </nav>
          
          <button 
            on:click={toggleDarkMode} 
            class="w-9 h-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors flex items-center justify-center border border-white/[0.08] shrink-0 touch-press text-xs"
            title="Toggle Visual Mode"
            aria-label="Toggle Visual Mode"
          >
            {#if isDarkMode}🌙{:else}☀️{/if}
          </button>
        </div>

        <!-- Mobile Controls -->
        <div class="flex items-center gap-2 md:hidden shrink-0">
          <button 
            on:click={toggleDarkMode} 
            class="w-9 h-9 min-w-[36px] min-h-[36px] rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 transition-colors flex items-center justify-center touch-press text-xs"
            aria-label="Toggle Dark Mode"
          >
            {#if isDarkMode}🌙{:else}☀️{/if}
          </button>
          
          <button 
            on:click={() => mobileMenuOpen = !mobileMenuOpen}
            class="w-9 h-9 min-w-[36px] min-h-[36px] rounded-xl bg-zinc-900 border border-white/10 text-zinc-200 transition-colors flex items-center justify-center touch-press"
            aria-label="Toggle navigation menu"
          >
            <svg class="w-5 h-5 text-[#a3e635]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {#if mobileMenuOpen}
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              {:else}
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              {/if}
            </svg>
          </button>
        </div>
      </div>

      <!-- Mobile Navigation Drawer -->
      {#if mobileMenuOpen}
        <div class="md:hidden py-3 border-t border-white/[0.08] grid grid-cols-2 gap-1.5 max-h-[75vh] overflow-y-auto pb-3 animate-in fade-in duration-150">
          {#each navItems as item}
            <button 
              on:click={() => navigate(item.id)}
              class="w-full px-3.5 py-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center touch-press min-h-[44px]
                {currentView === item.id 
                  ? 'bg-white/10 text-white font-bold border border-white/15' 
                  : 'bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800/80 border border-white/[0.06]'}"
            >
              {item.label}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </header>

  <!-- Main Showcase Container -->
  <div class="py-6 sm:py-8 lg:py-10 max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
    {#if currentView === 'analytics'}
      <Analytics />
    {:else if currentView === 'students'}
      <StudentList />
    {:else if currentView === 'companies'}
      <CompanyList />
    {:else if currentView === 'shortlist'}
      <AddShortlist />
    {:else if currentView === 'selection'}
      <AddSelection />
    {:else if currentView === 'predict'}
      <PredictCompanies />
    {:else if currentView === 'neoids'}
      <NeoIdManager />
    {/if}
  </div>
</main>
