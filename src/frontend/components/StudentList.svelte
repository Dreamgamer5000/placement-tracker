<script lang="ts">
  import { onMount } from 'svelte';

  let students: any[] = [];
  let loading = true;
  let searchTerm = '';
  let selectedStudent: any = null;
  let sortBy: 'default' | 'shortlists' = 'default';

  onMount(async () => {
    await loadStudents();
  });

  async function loadStudents(sortByShortlists = false) {
    loading = true;
    try {
      const endpoint = sortByShortlists ? '/api/students/by-shortlists' : '/api/students';
      const response = await fetch(endpoint);
      const data = await response.json();
      // Ensure we always have an array
      students = Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error loading students:', error);
      students = [];
    } finally {
      loading = false;
    }
  }

  async function viewStudent(id: number) {
    try {
      const response = await fetch(`/api/students/${id}`);
      selectedStudent = await response.json();
    } catch (error) {
      console.error('Error loading student details:', error);
    }
  }

  async function toggleSort() {
    if (sortBy === 'default') {
      sortBy = 'shortlists';
      await loadStudents(true);
    } else {
      sortBy = 'default';
      await loadStudents(false);
    }
  }

  $: filteredStudents = Array.isArray(students) ? students.filter(s => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.regno?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.branch?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];
</script>

<div class="student-list">
  <h2>👥 Students</h2>
  
  <input 
    type="text" 
    class="search-box"
    placeholder="Search by name, regno, or branch..." 
    bind:value={searchTerm}
  />

  {#if loading}
    <div class="loading">Loading students...</div>
  {:else}
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Reg No</th>
            <th>Name</th>
            <th>Branch</th>
            <th>Campus</th>
            <th>CGPA</th>
            <th class="sortable" on:click={toggleSort}>
              Shortlists 
              {#if sortBy === 'shortlists'}
                <span class="sort-icon">⬇</span>
              {:else}
                <span class="sort-icon">⬍</span>
              {/if}
            </th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredStudents as student}
            <tr>
              <td>{student.regno}</td>
              <td>{student.name}</td>
              <td>{student.branch}</td>
              <td>{student.campus}</td>
              <td>{student.cgpa || 'N/A'}</td>
              <td>
                <span class="shortlist-count" class:has-shortlists={student.shortlist_count > 0}>
                  {student.shortlist_count || 0}
                </span>
              </td>
              <td>
                <span class="status" class:placed={student.placed}>
                  {student.placed ? '✓ Placed' : 'Not Placed'}
                </span>
              </td>
              <td>
                <button class="btn-small" on:click={() => viewStudent(student.id)}>
                  View Details
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

{#if selectedStudent}
  <div class="modal" on:click={() => selectedStudent = null}>
    <div class="modal-content" on:click|stopPropagation>
      <button class="close-btn" on:click={() => selectedStudent = null}>×</button>
      
      <h3>{selectedStudent.name}</h3>
      
      <div class="details-grid">
        <div class="detail-item">
          <strong>Registration No:</strong> {selectedStudent.regno}
        </div>
        <div class="detail-item">
          <strong>Email:</strong> {selectedStudent.email}
        </div>
        <div class="detail-item">
          <strong>Phone:</strong> {selectedStudent.phone || 'N/A'}
        </div>
        <div class="detail-item">
          <strong>Gender:</strong> {selectedStudent.gender || 'N/A'}
        </div>
        <div class="detail-item">
          <strong>Branch:</strong> {selectedStudent.branch}
        </div>
        <div class="detail-item">
          <strong>Campus:</strong> {selectedStudent.campus}
        </div>
        <div class="detail-item">
          <strong>CGPA:</strong> {selectedStudent.cgpa || 'N/A'}
        </div>
        <div class="detail-item">
          <strong>10th Marks:</strong> {selectedStudent.tenth_marks || 'N/A'}
        </div>
        <div class="detail-item">
          <strong>12th Marks:</strong> {selectedStudent.twelfth_marks || 'N/A'}
        </div>
      </div>

      {#if selectedStudent.resume_link}
        <div class="detail-item">
          <strong>Resume:</strong> 
          <a href={selectedStudent.resume_link} target="_blank">View Resume</a>
        </div>
      {/if}

      {#if selectedStudent.shortlists && selectedStudent.shortlists.length > 0}
        <h4>📋 Shortlisted Companies ({selectedStudent.shortlists.length})</h4>
        <ul class="company-list">
          {#each selectedStudent.shortlists as shortlist}
            <li>{shortlist.name}</li>
          {/each}
        </ul>
      {/if}

      {#if selectedStudent.selections && selectedStudent.selections.length > 0}
        <h4>✅ Final Selections ({selectedStudent.selections.length})</h4>
        <ul class="company-list selection-list">
          {#each selectedStudent.selections as selection}
            <li>{selection.name}</li>
          {/each}
        </ul>
      {/if}

      {#if selectedStudent.finalCompany}
        <div class="placed-info">
          <h4>✓ Placed at {selectedStudent.finalCompany.name}</h4>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .student-list {
    padding: 2rem;
  }

  h2 {
    color: #333;
    margin-bottom: 2rem;
  }

  .search-box {
    width: 100%;
    padding: 1rem;
    margin-bottom: 1.5rem;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
  }

  .search-box:focus {
    outline: none;
    border-color: #667eea;
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: #666;
  }

  .table-container {
    background: white;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th, td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid #eee;
  }

  th {
    background: #f8f9fa;
    font-weight: 600;
    color: #555;
    position: sticky;
    top: 0;
  }

  .sortable {
    cursor: pointer;
    user-select: none;
    transition: background 0.2s;
  }

  .sortable:hover {
    background: #e9ecef;
  }

  .sort-icon {
    font-size: 0.8rem;
    margin-left: 0.25rem;
    opacity: 0.7;
  }

  .shortlist-count {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    background: #e9ecef;
    color: #666;
    font-weight: 600;
    min-width: 2rem;
    text-align: center;
  }

  .shortlist-count.has-shortlists {
    background: #667eea;
    color: white;
  }

  tbody tr:hover {
    background: #f8f9fa;
  }

  .status {
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.875rem;
    background: #ffc107;
    color: white;
  }

  .status.placed {
    background: #28a745;
  }

  .btn-small {
    padding: 0.5rem 1rem;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .btn-small:hover {
    background: #5568d3;
  }

  .modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: white;
    padding: 2rem;
    border-radius: 10px;
    max-width: 800px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
  }

  .close-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: #999;
  }

  .close-btn:hover {
    color: #333;
  }

  .details-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin: 1.5rem 0;
  }

  .detail-item {
    padding: 0.5rem 0;
  }

  .detail-item strong {
    color: #667eea;
  }

  .detail-item a {
    color: #667eea;
    text-decoration: none;
  }

  .detail-item a:hover {
    text-decoration: underline;
  }

  h4 {
    color: #333;
    margin-top: 1.5rem;
  }

  ul {
    list-style: none;
    padding: 0;
  }

  ul li {
    padding: 0.5rem;
    background: #f8f9fa;
    margin: 0.5rem 0;
    border-radius: 5px;
  }

  .company-list li {
    background: #f3f4f6;
    border-left: 3px solid #667eea;
  }

  .selection-list li {
    background: #f0fdf4;
    border-left: 3px solid #10b981;
    font-weight: 600;
  }

  .placed-info {
    margin-top: 1.5rem;
    padding: 1rem;
    background: #d4edda;
    border-radius: 8px;
    border-left: 4px solid #28a745;
  }

  .placed-info h4 {
    margin: 0;
    color: #155724;
  }
</style>
