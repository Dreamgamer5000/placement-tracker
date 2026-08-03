<script lang="ts">
  import { onMount } from 'svelte';
  import StudentList from './components/TempStudentList.svelte';
  import CompanyList from './components/CompanyList.svelte';
  import Analytics from './components/Analytics.svelte';
  import AddShortlist from './components/AddShortlist.svelte';
  import AddSelection from './components/AddSelection.svelte';
  import PredictCompanies from './components/PredictCompanies.svelte';

  let currentView = 'analytics';
  
  function navigate(view: string) {
    currentView = view;
  }
</script>

<main class="min-h-screen bg-gray-50">
  <nav class="bg-purple-600 text-white shadow-lg">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <h1 class="text-2xl sm:text-3xl font-bold mb-4">🎓 Placement Tracker</h1>
      <div class="flex flex-wrap gap-2 sm:gap-3">
        <button 
          class="px-4 py-2 rounded-full border-2 transition-all duration-300 {currentView === 'analytics' ? 'bg-white text-purple-600 font-semibold' : 'border-white/30 bg-white/10 hover:bg-white/20'}"
          on:click={() => navigate('analytics')}>
          Analytics
        </button>
        <button 
          class="px-4 py-2 rounded-full border-2 transition-all duration-300 {currentView === 'students' ? 'bg-white text-purple-600 font-semibold' : 'border-white/30 bg-white/10 hover:bg-white/20'}"
          on:click={() => navigate('students')}>
          Students
        </button>
        <button 
          class="px-4 py-2 rounded-full border-2 transition-all duration-300 {currentView === 'companies' ? 'bg-white text-purple-600 font-semibold' : 'border-white/30 bg-white/10 hover:bg-white/20'}"
          on:click={() => navigate('companies')}>
          Companies
        </button>
        <button 
          class="px-4 py-2 rounded-full border-2 transition-all duration-300 {currentView === 'shortlist' ? 'bg-white text-purple-600 font-semibold' : 'border-white/30 bg-white/10 hover:bg-white/20'}"
          on:click={() => navigate('shortlist')}>
          Add Shortlist
        </button>
        <button 
          class="px-4 py-2 rounded-full border-2 transition-all duration-300 {currentView === 'selection' ? 'bg-white text-purple-600 font-semibold' : 'border-white/30 bg-white/10 hover:bg-white/20'}"
          on:click={() => navigate('selection')}>
          Add Selection
        </button>
        <button 
          class="px-4 py-2 rounded-full border-2 transition-all duration-300 {currentView === 'predict' ? 'bg-white text-purple-600 font-semibold' : 'border-white/30 bg-white/10 hover:bg-white/20'}"
          on:click={() => navigate('predict')}>
          Predict Companies
        </button>
      </div>
    </div>
  </nav>

  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
