import { nextTick, ref } from 'vue'

import useLogin from '/@/components/Authenticate/composables/useLogin'
import type { LoginLetter } from '/@/components/Authenticate/loginLetter'
import { postFakeLogin } from '/@/lib/apis'

vi.mock('/@/lib/apis', () => ({
  default: {
    login: vi.fn()
  },
  postFakeLogin: vi.fn()
}))

vi.mock('/@/store/domain/me', () => ({
  useMeStore: () => ({
    fetchMe: vi.fn()
  })
}))

vi.mock('/@/components/Authenticate/composables/useCredentialManager', () => ({
  default: () => ({
    getPass: vi.fn().mockResolvedValue(null),
    savePass: vi.fn()
  })
}))

vi.mock('/@/components/Authenticate/composables/useRedirectParam', () => ({
  default: () => ({
    redirect: vi.fn(),
    setRedirectSessionStorage: vi.fn()
  })
}))

describe('useLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    {
      name: '',
      pass: '',
      error: 'IDとパスワードを入力してください'
    },
    { name: '', pass: 'password', error: 'IDを入力してください' },
    { name: 'user', pass: '', error: 'パスワードを入力してください' }
  ])('validates blank fields without calling the fake API', async fields => {
    const { login, loginState } = useLogin(ref<LoginLetter>('A'))
    loginState.name = fields.name
    loginState.pass = fields.pass
    await nextTick()

    await login()

    expect(loginState.error).toBe(fields.error)
    expect(postFakeLogin).not.toHaveBeenCalled()
  })

  it('calls the fake API without credentials when both fields are present', async () => {
    const { login, loginState } = useLogin(ref<LoginLetter>('A'))
    loginState.name = 'user'
    loginState.pass = 'password'
    await nextTick()

    await login()

    expect(postFakeLogin).toHaveBeenCalledOnce()
    expect(postFakeLogin).toHaveBeenCalledWith()
  })
})
