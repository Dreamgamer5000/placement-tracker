<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  const dispatch = createEventDispatcher();

  export let show = false;
  export let title = 'Authentication Required';
  export let message = 'Please enter the admin password to proceed with this destructive action.';

  let password = '';
  let inputRef: HTMLInputElement;

  $: if (show && inputRef) {
    // Focus input automatically when modal is shown
    setTimeout(() => inputRef.focus(), 50);
  }

  function handleCancel() {
    password = '';
    dispatch('cancel');
  }

  function handleSubmit() {
    const pwd = password;
    password = '';
    dispatch('submit', pwd);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  }

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    };
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div 
    use:portal
    class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
    style="z-index: 9999;"
    on:click|self={handleCancel}
  >
    <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
      
      <div class="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        <h3 class="text-lg font-bold text-slate-900 dark:text-white leading-tight">
          {title}
        </h3>
      </div>

      <p class="text-sm text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
        {message}
      </p>

      <div class="mb-6">
        <input 
          bind:this={inputRef}
          bind:value={password}
          on:keydown={handleKeydown}
          type="password" 
          placeholder="Enter admin password..."
          class="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono"
        />
      </div>

      <div class="flex justify-end gap-3">
        <button 
          on:click={handleCancel}
          class="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
        >
          Cancel
        </button>
        <button 
          on:click={handleSubmit}
          class="px-5 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 rounded-xl transition-all shadow-sm"
        >
          Authorize & Proceed
        </button>
      </div>

    </div>
  </div>
{/if}
