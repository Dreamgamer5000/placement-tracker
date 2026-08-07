<script lang="ts">
  import { onMount } from 'svelte';
  import StudentList from './components/StudentList.svelte';
  import CompanyList from './components/CompanyList.svelte';
  import Analytics from './components/Analytics.svelte';
  import AddShortlist from './components/AddShortlist.svelte';
  import AddSelection from './components/AddSelection.svelte';
  import PredictCompanies from './components/PredictCompanies.svelte';

  let currentView = 'analytics';
  let mobileMenuOpen = false;
  let isDarkMode = false;

  onMount(() => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      isDarkMode = true;
      document.documentElement.classList.add('dark');
    } else {
      isDarkMode = false;
      document.documentElement.classList.remove('dark');
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
    { id: 'analytics', label: 'Analytics', icon: '📊' },
    { id: 'students', label: 'Students', icon: '🎓' },
    { id: 'companies', label: 'Companies', icon: '🏢' },
    { id: 'shortlist', label: 'Add Shortlist', icon: '📝' },
    { id: 'selection', label: 'Add Selection', icon: '✅' },
    { id: 'predict', label: 'Predict Companies', icon: '🎯' }
  ];
  
  function navigate(view: string) {
    currentView = view;
    mobileMenuOpen = false;
  }
</script>

<main class="min-h-screen bg-slate-50/80 dark:bg-slate-950 transition-colors duration-300">
  <!-- Glassmorphic Premium Navbar -->
  <header class="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-white shadow-xl">
    <div class="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-20">
        
        <!-- Brand Logo -->
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center text-2xl shadow-lg shadow-purple-500/20">
            🎓
          </div>
          <div>
            <span class="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-purple-200 bg-clip-text text-transparent">
              Placement Tracker
            </span>
            <span class="hidden sm:inline-block ml-2.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-full">
              2027 Batch
            </span>
          </div>
        </div>

        <!-- Desktop Navigation Tabs & Dark Mode Toggle -->
        <div class="hidden md:flex items-center gap-4">
          <nav class="flex items-center gap-1.5 bg-slate-800/70 p-1.5 rounded-2xl border border-slate-700/60 shadow-inner">
            {#each navItems as item}
              <button 
                on:click={() => navigate(item.id)}
                class="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2 {currentView === item.id ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-900/30' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'}"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            {/each}
          </nav>
          
          <button 
            on:click={toggleDarkMode} 
            class="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center justify-center border border-slate-700/60"
            title="Toggle Dark Mode"
            aria-label="Toggle Dark Mode"
          >
            {#if isDarkMode}
              ☀️
            {:else}
              🌙
            {/if}
          </button>
        </div>

        <!-- Mobile Menu Toggle Button -->
        <div class="flex items-center gap-2 md:hidden">
          <button 
            on:click={toggleDarkMode} 
            class="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            aria-label="Toggle Dark Mode"
          >
            {#if isDarkMode}☀️{:else}🌙{/if}
          </button>
          
          <button 
            on:click={() => mobileMenuOpen = !mobileMenuOpen}
            class="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            aria-label="Toggle navigation menu"
          >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div class="md:hidden py-4 border-t border-slate-800 space-y-2">
          {#each navItems as item}
            <button 
              on:click={() => navigate(item.id)}
              class="w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center gap-3 {currentView === item.id ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-800'}"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </header>

  <!-- Main View Container -->
  <div class="py-6">
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
    {/if}
  </div>
</main>
