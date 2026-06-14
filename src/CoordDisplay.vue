<template>
  <div class="coord-display">
    <span class="inner"><i class="iconfont icon-crosshairs"></i> {{ `${selectedCell ? selectedCell.row + 1 : '-'}, ${selectedCell ? selectedCell.col + 1 : '-'}` }}</span>
    <span class="inner"><i class="iconfont icon-hashtag"></i> {{ hoveredCode }}</span>
    <span class="inner"><i class="iconfont icon-expand"></i> {{ canvasSizeText }}</span>
  </div>
</template>

<script setup>
defineProps({
  selectedCell: { type: Object },
  hoveredCode: { type: String, default: '' },
  canvasSizeText: { type: String, default: '— × —' },
});
</script>

<style scoped>
.coord-display {
  font-size: clamp(0.6rem, 1.8vw, 0.75rem);
  color: #5e4b3c;
  font-weight: 600;
  background: #f3ede7;
  padding: 0.2rem 0.6rem;
  border-radius: 2rem;
  border: 1px solid #e2d4c8;
  white-space: nowrap;
  display: flex;
  gap: 8px;
  cursor: pointer;
}

.coord-display span.inner {
  font-family: Consolas, monospace;
  color: #b45f4c;
}
</style>
