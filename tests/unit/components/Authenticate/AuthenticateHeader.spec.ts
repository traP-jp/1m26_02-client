import { mount } from '@vue/test-utils'

import AuthenticateHeader from '/@/components/Authenticate/AuthenticateHeader.vue'

describe('AuthenticateHeader', () => {
  it('shows the regular logo by default', () => {
    const wrapper = mount(AuthenticateHeader)

    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('shows the mystery logo and forwards next-letter events', async () => {
    const wrapper = mount(AuthenticateHeader, {
      props: { loginLetter: 'P' }
    })

    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe('traP logo')

    await button.trigger('click')

    expect(wrapper.emitted('next-letter')).toHaveLength(1)
  })
})
