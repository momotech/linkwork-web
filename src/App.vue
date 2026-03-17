<script setup lang="ts">
</script>

<style>
/* Global Scrollbar Styling */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: oklch(0.552 0.016 285.938 / 0.2);
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: oklch(0.552 0.016 285.938 / 0.4);
}

/* For Firefox */
* {
  scrollbar-width: thin;
  scrollbar-color: oklch(0.552 0.016 285.938 / 0.2) transparent;
}
</style>

<template>
  <router-view />
</template>