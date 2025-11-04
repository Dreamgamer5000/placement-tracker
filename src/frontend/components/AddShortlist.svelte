<script lang="ts">
  import { onMount } from 'svelte';

  let companies: any[] = [];
  let selectedCompanyId = '';
  let regnos = '';
  let message = '';
  let messageType: 'success' | 'error' = 'success';
  
  // New company form
  let showNewCompanyForm = false;
  let newCompany = { 
    name: '', 
    notes: '', 
    rounds: '', 
    experience_required: '' 
  };

  onMount(async () => {
    await loadCompanies();
  });

  async function loadCompanies() {
    try {
      const response = await fetch('/api/companies');
      companies = await response.json();
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  }

  async function createCompany() {
    if (!newCompany.name.trim()) {
      message = 'Company name is required';
      messageType = 'error';
      return;
    }

    try {
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCompany.name,
          notes: newCompany.notes || null,
          rounds: newCompany.rounds ? parseInt(newCompany.rounds) : null,
          experience_required: newCompany.experience_required || null
        })
      });

      if (response.ok) {
        const created = await response.json();
        message = `Company "${newCompany.name}" created successfully!`;
        messageType = 'success';
        
        newCompany = { name: '', notes: '', rounds: '', experience_required: '' };
        showNewCompanyForm = false;
        
        await loadCompanies();
        selectedCompanyId = created.id.toString();
      } else {
        const error = await response.json();
        message = error.error || 'Failed to create company';
        messageType = 'error';
      }
    } catch (error) {
      message = 'Error creating company';
      messageType = 'error';
      console.error(error);
    }

    setTimeout(() => {
      message = '';
    }, 5000);
  }

  async function addShortlist() {
    if (!selectedCompanyId || !regnos.trim()) {
      message = 'Please select a company and enter registration numbers';
      messageType = 'error';
      return;
    }

    const regnoList = regnos.split('\n').map(r => r.trim()).filter(r => r);

    if (regnoList.length === 0) {
      message = 'Please enter at least one registration number';
      messageType = 'error';
      return;
    }

    try {
      const response = await fetch(`/api/companies/${selectedCompanyId}/shortlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regnos: regnoList })
      });

      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        message = 'Server error: Expected JSON response but got something else';
        messageType = 'error';
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        message = result.error || 'Failed to add students';
        messageType = 'error';
        return;
      }

      console.log('API Response:', result); // Debug log
      
      const successCount = result.results ? result.results.filter((r: any) => r.success).length : 0;
      const errorCount = result.errors ? result.errors.length : 0;
      
      if (successCount > 0) {
        message = `Successfully added ${successCount} student(s) to shortlist.`;
        if (errorCount > 0) {
          message += ` ${errorCount} error(s) occurred (students not found).`;
        }
        messageType = 'success';
        regnos = '';
      } else if (errorCount > 0) {
        message = `Failed to add students. ${errorCount} registration number(s) not found in database.`;
        messageType = 'error';
      } else {
        message = 'No students were added. Please check the registration numbers.';
        messageType = 'error';
      }
    } catch (error) {
      message = 'Error adding students to shortlist';
      messageType = 'error';
      console.error('Error:', error);
    }

    setTimeout(() => {
      message = '';
    }, 5000);
  }
</script>

<div>
  <h2 class="text-3xl font-bold text-gray-800 mb-6">📝 Add Students to Company Shortlist</h2>
  
  <div class="bg-white rounded-lg shadow-md p-6 mb-6">
    <div class="mb-6">
      <label for="company" class="block text-sm font-semibold text-gray-700 mb-2">
        Select Company *
      </label>
      <div class="flex gap-3">
        <select 
          id="company" 
          bind:value={selectedCompanyId}
          class="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">-- Select a company --</option>
          {#each companies as company}
            <option value={company.id}>{company.name}</option>
          {/each}
        </select>
        <button 
          on:click={() => showNewCompanyForm = !showNewCompanyForm}
          class="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors duration-200"
        >
          {showNewCompanyForm ? 'Cancel' : '+ New Company'}
        </button>
      </div>
    </div>

    {#if showNewCompanyForm}
      <div class="border-2 border-green-200 rounded-lg p-6 mb-6 bg-green-50">
        <h3 class="text-xl font-bold text-gray-800 mb-4">Create New Company</h3>
        
        <div class="space-y-4">
          <div>
            <label for="companyName" class="block text-sm font-semibold text-gray-700 mb-2">
              Company Name *
            </label>
            <input 
              id="companyName"
              type="text" 
              placeholder="e.g., Google, Microsoft, Amazon" 
              bind:value={newCompany.name}
              class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label for="notes" class="block text-sm font-semibold text-gray-700 mb-2">
              Notes (optional)
            </label>
            <textarea 
              id="notes"
              placeholder="Add notes about the company, role, or requirements"
              bind:value={newCompany.notes}
              rows="3"
              class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-vertical"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="rounds" class="block text-sm font-semibold text-gray-700 mb-2">
                Number of Rounds (optional)
              </label>
              <input 
                id="rounds"
                type="number" 
                placeholder="e.g., 3"
                bind:value={newCompany.rounds}
                class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label for="experience" class="block text-sm font-semibold text-gray-700 mb-2">
                Experience Required (optional)
              </label>
              <input 
                id="experience"
                type="text" 
                placeholder="e.g., 0-1 years, Internship"
                bind:value={newCompany.experience_required}
                class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          <button 
            on:click={createCompany}
            class="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors duration-200"
          >
            Create Company
          </button>
        </div>
      </div>
    {/if}

    <div class="mb-6">
      <label for="regnos" class="block text-sm font-semibold text-gray-700 mb-2">
        Registration Numbers (one per line) *
      </label>
      <textarea 
        id="regnos"
        bind:value={regnos}
        placeholder="Enter one registration number per line:&#10;23BAI1001&#10;23BAI1002&#10;23BAI1003"
        rows="10"
        class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono resize-vertical"
      />
      <div class="mt-2 text-sm text-gray-600">
        <p>Enter one registration number per line</p>
        <p class="mt-1 text-xs text-gray-500">
          <strong>Example student IDs:</strong> 23BAI1001, 23BAI1002, 23BAI1003, 23BAI0002, 23BAI0003
        </p>
      </div>
    </div>

    <button 
      on:click={addShortlist}
      class="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
    >
      Add to Shortlist
    </button>

    {#if message}
      <div class="mt-6 p-4 rounded-lg border-l-4 {messageType === 'success' ? 'bg-green-50 border-green-500 text-green-800' : 'bg-red-50 border-red-500 text-red-800'}">
        <p class="font-semibold">{message}</p>
      </div>
    {/if}
  </div>

  <div class="bg-white rounded-lg shadow-md p-6">
    <h3 class="text-xl font-bold text-gray-800 mb-4">ℹ️ Instructions</h3>
    <ul class="space-y-2 text-gray-700">
      <li class="flex items-start">
        <span class="text-primary-600 mr-2">•</span>
        <span>Select an existing company or create a new one using the "+ New Company" button</span>
      </li>
      <li class="flex items-start">
        <span class="text-primary-600 mr-2">•</span>
        <span>Enter registration numbers of students who got shortlisted</span>
      </li>
      <li class="flex items-start">
        <span class="text-primary-600 mr-2">•</span>
        <span>Each registration number should be on a new line</span>
      </li>
      <li class="flex items-start">
        <span class="text-primary-600 mr-2">•</span>
        <span>The system will automatically update company analytics (cutoffs, gender ratio, etc.)</span>
      </li>
    </ul>
  </div>
</div>
