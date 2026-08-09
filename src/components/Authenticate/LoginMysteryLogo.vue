<template>
  <button
    type="button"
    :class="$style.container"
    :aria-label="`tra${letter} logo`"
    @click="emit('next-letter')"
  >
    <img :src="logoUrl" :class="$style.mark" alt="" aria-hidden="true" />
    <LogoText
      v-if="letter === 'Q'"
      :class="$style.originalWordmark"
      data-testid="login-logo-original-wordmark"
      aria-hidden="true"
    />
    <span v-else :class="$style.wordmark" aria-hidden="true">
      <TraLogoText :class="$style.tra" />
      <span :class="$style.letter" data-testid="login-logo-letter">
        {{ letter }}
      </span>
    </span>
  </button>
</template>

<script lang="ts" setup>
import TraLogoText from '/@/assets/tra-logo-text.svg?component'
import LogoText from '/@/assets/traq-logo-text.svg?component'
import logoUrl from '/@/assets/traq-logo.svg?url'

import type { LoginLetter } from './loginLetter'

defineProps<{
  letter: LoginLetter
}>()

const emit = defineEmits<{
  (e: 'next-letter'): void
}>()
</script>

<style lang="scss" module>
.container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 132px;
  height: 48px;
  margin: 0 auto;
  padding: 0;
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 0.8;
  }

  &:focus-visible {
    outline: 2px solid $theme-accent-primary-default;
    outline-offset: 4px;
  }
}

.mark {
  width: auto;
  height: 48px;
}

.wordmark {
  position: relative;
  flex: 0 0 66px;
  width: 66px;
  height: 48px;
  margin-left: 10px;
}

.originalWordmark {
  flex: 0 0 66px;
  width: 66px;
  height: 48px;
  margin-left: 10px;
}

.tra {
  position: absolute;
  inset: 0;
  width: 66px;
  height: 48px;
}

.letter {
  position: absolute;
  top: 12px;
  left: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 32px;
  font-family: 'M PLUS 1p', sans-serif;
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
}
</style>
