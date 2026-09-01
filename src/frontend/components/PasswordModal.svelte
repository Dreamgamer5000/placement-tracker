<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let show = false;
  export let isOpen = false;
  export let title = 'Authentication Required';
  export let message = 'Please enter the admin password to proceed.';

  $: visible = show || isOpen;

  let password = '';
  let inputRef: HTMLInputElement;

  $: if (visible && inputRef) {
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

{#if visible}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div 
    use:portal
    class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
    style="z-index: 9999;"
    on:click|self={handleCancel}
  >
    <div class="bg-[#0F172A] rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-700 relative overflow-hidden">
      
      <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-[#BBF351] to-amber-500"></div>

      <div class="flex items-center gap-3 mb-3 text-amber-400">
        <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-lg">
          🔒
        </div>
        <div>
          <h3 class="text-base font-display font-bold text-white leading-tight">
            {title}
          </h3>
          <span class="text-[10px] font-mono text-slate-400 uppercase">Admin Authorization</span>
        </div>
      </div>

      <p class="text-xs text-slate-300 mb-5 leading-relaxed font-sans">
        {message}
      </p>

      <div class="mb-5">
        <input 
          bind:this={inputRef}
          bind:value={password}
          on:keydown={handleKeydown}
          type="password" 
          placeholder="Enter authorization password..."
          class="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-[#080C14] text-white placeholder-slate-500 text-xs font-mono focus:border-[#BBF351]/60 focus:shadow-[0_0_16px_rgba(187,243,81,0.2)]"
        />
      </div>

      <div class="flex justify-end gap-2.5">
        <button 
          on:click={handleCancel}
          class="neon-btn-ghost px-4 py-2 text-xs font-semibold rounded-xl touch-press"
        >
          Cancel
        </button>
        <button 
          on:click={handleSubmit}
          class="neon-btn-primary px-4 py-2 text-xs font-bold rounded-xl touch-press"
        >
          Authorize & Proceed
        </button>
      </div>

    </div>
  </div>
{/if}
