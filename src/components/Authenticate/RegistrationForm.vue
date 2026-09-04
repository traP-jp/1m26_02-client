<template>
  <div>
    <AuthenticateHeader :class="$style.header" title="新規登録" />
    <AuthenticateInput
      v-model="registerState.name"
      label="traQ ID"
      :class="$style.item"
      autocomplete="username"
      autofocus
    />
    <AuthenticateInput
      v-model="registerState.password"
      label="パスワード"
      type="password"
      :class="$style.item"
      autocomplete="new-password"
      enterkeyhint="done"
    />
    <div :class="$style.error">
      <span v-if="error">{{ error }}</span>
    </div>
    <div :class="$style.buttons">
      <AuthenticateButton
        type="primary"
        label="アカウント作成"
        is-submit
        @click="register"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'

import AuthenticateButton from './AuthenticateButton.vue'
import AuthenticateHeader from './AuthenticateHeader.vue'
import AuthenticateInput from './AuthenticateInput.vue'
import useRegister from './composables/useRegister'
import { LOGIN_LETTER_SESSION_KEY } from './loginLetter'

const storedLoginLetter = sessionStorage.getItem(LOGIN_LETTER_SESSION_KEY)
const isFakeRegistration = ref(
  storedLoginLetter !== null && storedLoginLetter.toUpperCase() !== 'Q'
)
const { registerState, error, register } = useRegister(isFakeRegistration)
</script>

<style lang="scss" module>
.item {
  margin: 24px 0;
  display: block;
}
.header {
  margin-bottom: 48px;
}
.forgotPassword {
  @include color-ui-secondary;
  @include size-caption;
  display: block;
  margin-top: 16px;
}
.buttons {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  margin-top: 48px;
}
.separator {
  margin: 32px 0;
}
.exLoginButtons {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  margin-top: 32px;
}
.exLoginButton {
  margin: 0 8px;
}
.error {
  color: $theme-accent-error-default;
}
</style>
