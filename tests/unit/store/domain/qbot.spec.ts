import { createPinia, setActivePinia } from 'pinia'
import { vi } from 'vitest'

import type { QBotState } from '/@/lib/websocket/events'
import { useQBotStore } from '/@/store/domain/qbot'

const mocks = vi.hoisted(() => ({
  fetchUserByName: vi.fn(),
  pushModal: vi.fn(),
  routerPush: vi.fn(),
  currentMainViewComponentState: { value: 'hidden' },
  position: { value: undefined },
  alignment: { value: 'top-right' },
  selectHandler: { value: vi.fn() },
  isEffectEnabled: { value: false }
}))

vi.mock('/@/lib/websocket', () => ({
  wsListener: { on: vi.fn() }
}))
vi.mock('/@/router', () => ({
  default: { push: mocks.routerPush },
  constructFilesPath: (id: string) => `/files/${id}`,
  constructMessagesPath: (id: string) => `/messages/${id}`
}))
vi.mock('/@/store/entities/users', () => ({
  useUsersStore: () => ({ fetchUserByName: mocks.fetchUserByName })
}))
vi.mock('/@/store/ui/mainView', () => ({
  MainViewComponentState: { SidebarShown: 'sidebar-shown' },
  useMainViewStore: () => ({
    currentMainViewComponentState: mocks.currentMainViewComponentState
  })
}))
vi.mock('/@/store/ui/modal', () => ({
  useModalStore: () => ({ pushModal: mocks.pushModal })
}))
vi.mock('/@/store/ui/stampPicker', () => ({
  defaultSelectHandler: vi.fn(),
  useStampPicker: () => ({
    position: mocks.position,
    alignment: mocks.alignment,
    selectHandler: mocks.selectHandler,
    isEffectEnabled: mocks.isEffectEnabled
  })
}))
vi.mock('/@/store/ui/toast', () => ({
  useToastStore: () => ({ addSuccessToast: vi.fn() })
}))

describe('useQBotStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    ['open_bot', 'BOT_MAI', '11111111-1111-4111-8111-111111111111'],
    ['open_user', 'player', '22222222-2222-4222-8222-222222222222']
  ])(
    'opens the user profile modal for %s',
    async (action, userName, userId) => {
      const pinia = createPinia()
      setActivePinia(pinia)

      mocks.fetchUserByName.mockResolvedValue({ id: userId, name: userName })

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => qBotState(action, userName)
        })
      )

      const qBotStore = useQBotStore(pinia)

      await qBotStore.fetchState(true)

      expect(mocks.fetchUserByName).toHaveBeenCalledWith({
        userName,
        cacheStrategy: 'useCache'
      })
      expect(mocks.pushModal).toHaveBeenCalledWith({ type: 'user', id: userId })
      expect(mocks.routerPush).not.toHaveBeenCalled()
    }
  )
})

const qBotState = (action: string, userName: string): QBotState => ({
  cleared: false,
  revision: 1,
  action,
  actionPayload: { userName },
  deletedAttachments: []
})
