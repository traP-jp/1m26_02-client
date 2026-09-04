import { ref } from 'vue'

import useRegister from '/@/components/Authenticate/composables/useRegister'
import apis from '/@/lib/apis'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() })
}))

vi.mock('/@/lib/apis', () => ({
  default: {
    createUser: vi.fn(),
    login: vi.fn()
  }
}))

describe('useRegister', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects registration without creating an account for a non-Q logo', async () => {
    const { register, registerState, error } = useRegister(ref(true))
    registerState.name = 'user'
    registerState.password = 'password'

    await register()

    expect(error.value).toBe('エラーが発生しました')
    expect(apis.createUser).not.toHaveBeenCalled()
    expect(apis.login).not.toHaveBeenCalled()
  })

  it('creates an account for the Q logo', async () => {
    const { register, registerState } = useRegister(ref(false))
    registerState.name = 'user'
    registerState.password = 'password'

    await register()

    expect(apis.createUser).toHaveBeenCalledWith(registerState)
    expect(apis.login).toHaveBeenCalledWith(undefined, registerState)
  })
})
