import { computed, ref } from 'vue'

import { acceptHMRUpdate, defineStore } from 'pinia'

import { wsListener } from '/@/lib/websocket'
import type { QBotState } from '/@/lib/websocket/events'
import router, { constructFilesPath, constructMessagesPath } from '/@/router'
import { useUsersStore } from '/@/store/entities/users'
import { MainViewComponentState, useMainViewStore } from '/@/store/ui/mainView'
import { useModalStore } from '/@/store/ui/modal'
import { defaultSelectHandler, useStampPicker } from '/@/store/ui/stampPicker'
import { useToastStore } from '/@/store/ui/toast'
import { convertToRefsStore } from '/@/store/utils/convertToRefsStore'
import type { FileId, MessageId } from '/@/types/entity-ids'

const attachmentKey = (messageId: string, fileId: string) =>
  `${messageId}:${fileId}`

const useQBotStorePinia = defineStore('domain/qbot', () => {
  const cleared = ref(false)
  const revision = ref(0)
  const initialized = ref(false)
  const deletedAttachmentKeys = ref(new Set<string>())
  const { currentMainViewComponentState } = useMainViewStore()
  const { fetchUserByName } = useUsersStore()
  const { pushModal } = useModalStore()
  const { position, alignment, selectHandler, isEffectEnabled } =
    useStampPicker()
  const { addSuccessToast } = useToastStore()

  const applyState = async (state: QBotState, executeAction: boolean) => {
    const isNewAction = state.revision > revision.value
    cleared.value = state.cleared
    deletedAttachmentKeys.value = new Set(
      state.deletedAttachments.map(item =>
        attachmentKey(item.messageId, item.fileId)
      )
    )
    revision.value = state.revision

    if (!executeAction || !isNewAction) return

    const payload = state.actionPayload
    switch (state.action) {
      case 'open_bot':
      case 'open_user':
        if (payload['userName']) {
          const user = await fetchUserByName({
            userName: payload['userName'],
            cacheStrategy: 'useCache'
          })
          if (user) {
            pushModal({ type: 'user', id: user.id })
          }
        }
        break
      case 'open_message':
      case 'open_file':
        if (payload['messageId']) {
          await router.push(constructMessagesPath(payload['messageId']))
        }
        break
      case 'open_image':
        if (payload['fileId']) {
          await router.push(constructFilesPath(payload['fileId']))
        }
        break
      case 'open_channel':
        currentMainViewComponentState.value =
          MainViewComponentState.SidebarShown
        break
      case 'open_stamp':
        position.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
        alignment.value = 'top-right'
        selectHandler.value = defaultSelectHandler
        isEffectEnabled.value = false
        break
      case 'reset_bot':
        addSuccessToast('BOTが復旧しました')
        break
    }
  }

  const fetchState = async (executeAction = false) => {
    const response = await fetch('/api/v3/qbot/state')
    if (!response.ok) {
      throw new Error(`q_bot state request failed: ${response.status}`)
    }
    await applyState((await response.json()) as QBotState, executeAction)
  }

  const initialize = async () => {
    if (initialized.value) return
    await fetchState(false)
    initialized.value = true
  }

  const isAttachmentDeleted = (messageId: MessageId, fileId: FileId) =>
    deletedAttachmentKeys.value.has(attachmentKey(messageId, fileId))

  wsListener.on('QBOT_ACTION', state => {
    void applyState(state, true)
  })
  wsListener.on('reconnect', () => {
    void fetchState(true).catch(error => {
      // eslint-disable-next-line no-console
      console.warn('Failed to restore q_bot state', error)
    })
  })

  return {
    cleared: computed(() => cleared.value),
    revision: computed(() => revision.value),
    deletedAttachmentKeys,
    initialize,
    fetchState,
    isAttachmentDeleted
  }
})

export const useQBotStore = convertToRefsStore(useQBotStorePinia)

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useQBotStorePinia, import.meta.hot))
}
