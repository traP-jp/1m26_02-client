import { mount } from '@vue/test-utils'

import LoginMysteryLogo from '/@/components/Authenticate/LoginMysteryLogo.vue'

describe('LoginMysteryLogo', () => {
  it('shows the current letter in its accessible name', () => {
    const wrapper = mount(LoginMysteryLogo, {
      props: { letter: 'Q' }
    })

    const button = wrapper.get('button')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('aria-label')).toBe('traQ logo')
    expect(wrapper.find('[data-testid="login-logo-letter"]').exists()).toBe(
      false
    )
    expect(
      wrapper.find('[data-testid="login-logo-original-wordmark"]').exists()
    ).toBe(true)
  })

  it('uses a text letter outside Q', () => {
    const wrapper = mount(LoginMysteryLogo, {
      props: { letter: 'A' }
    })

    expect(wrapper.get('[data-testid="login-logo-letter"]').text()).toBe('A')
    expect(
      wrapper.find('[data-testid="login-logo-original-wordmark"]').exists()
    ).toBe(false)
  })

  it('emits next-letter when clicked', async () => {
    const wrapper = mount(LoginMysteryLogo, {
      props: { letter: 'A' }
    })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('next-letter')).toHaveLength(1)
  })
})
