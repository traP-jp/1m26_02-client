import type { Message } from '@traptitech/traq'

import { ref, watch } from 'vue'

import { acceptHMRUpdate, defineStore } from 'pinia'

import apis from '/@/lib/apis'
import {
  formatLightsOutBoard,
  getLightsOutMoveLimit,
  getLightsOutNeighbours,
  initLightsOut,
  parseLightsOutBoard
} from '/@/lib/lightsOut'
import { stampUpdateMitt } from '/@/lib/updater/stamp'
import { wsListener } from '/@/lib/websocket'
import type {
  CreateLightsOutEvent,
  MessageStampedEvent,
  MessageUnstampedEvent
} from '/@/lib/websocket/events'
import { useMeStore } from '/@/store/domain/me'
import { useChannelsStore } from '/@/store/entities/channels'
import { useMessagesStore } from '/@/store/entities/messages'
import { useStampsStore } from '/@/store/entities/stamps'
import { convertToRefsStore } from '/@/store/utils/convertToRefsStore'
import type { ChannelId, MessageId, StampId } from '/@/types/entity-ids'

type StampAction = 'add' | 'remove'

const initializedBoardStorageKey = (messageId: MessageId) =>
  `lights-out-initialized:${messageId}`
const moveCountStorageKey = (messageId: MessageId) =>
  `lights-out-move-count:${messageId}`

const useLightsOutStorePinia = defineStore('domain/lightsOut', () => {
  const { myId } = useMeStore()
  const { channelsMap, bothChannelsMapInitialFetchPromise } = useChannelsStore()
  const { extendMessagesMap, fetchMessage, messagesMap } = useMessagesStore()
  const { getStampByName, stampsMapInitialFetchPromise } = useStampsStore()

  const puzzle = ref<CreateLightsOutEvent>()
  const boardMessageId = ref<MessageId>()
  const activeChannelIds = ref(new Set<ChannelId>())
  const initializationComplete = ref(false)
  const cleared = ref(false)
  const stampToChannelId = new Map<StampId, ChannelId>()
  const channelToStampId = new Map<ChannelId, StampId>()
  const pendingEvents = new Map<string, number>()
  let resetInProgress = false
  let ignoredResetDeletePending = false

  const pendingKey = (action: StampAction, stampId: StampId) =>
    `${action}:${stampId}`
  const addPending = (action: StampAction, stampId: StampId) => {
    const key = pendingKey(action, stampId)
    pendingEvents.set(key, (pendingEvents.get(key) ?? 0) + 1)
  }
  const consumePending = (action: StampAction, stampId: StampId) => {
    const key = pendingKey(action, stampId)
    const count = pendingEvents.get(key) ?? 0
    if (count === 0) return false
    if (count === 1) pendingEvents.delete(key)
    else pendingEvents.set(key, count - 1)
    return true
  }

  const clear = () => {
    puzzle.value = undefined
    boardMessageId.value = undefined
    activeChannelIds.value = new Set()
    stampToChannelId.clear()
    channelToStampId.clear()
    pendingEvents.clear()
    cleared.value = false
  }

  const prepareStampMapping = async (event: CreateLightsOutEvent) => {
    await stampsMapInitialFetchPromise
    if (puzzle.value?.root_channel_id !== event.root_channel_id) return false

    stampToChannelId.clear()
    channelToStampId.clear()
    for (const channel of event.channels) {
      const stamp = getStampByName(channel.stamp_name)
      if (!stamp) {
        // eslint-disable-next-line no-console
        console.error(`Lights Out stamp not found: ${channel.stamp_name}`)
        return false
      }
      stampToChannelId.set(stamp.id, channel.id)
      channelToStampId.set(channel.id, stamp.id)
    }
    return true
  }

  const setChannelActive = async (channelId: ChannelId, active: boolean) => {
    const messageId = boardMessageId.value
    const stampId = channelToStampId.get(channelId)
    if (!messageId || !stampId) return false

    const wasActive = activeChannelIds.value.has(channelId)
    if (wasActive === active) return true

    if (active) activeChannelIds.value.add(channelId)
    else activeChannelIds.value.delete(channelId)

    const action: StampAction = active ? 'add' : 'remove'
    addPending(action, stampId)
    try {
      if (active) await apis.addMessageStamp(messageId, stampId)
      else await apis.removeMessageStamp(messageId, stampId)
      window.setTimeout(() => consumePending(action, stampId), 10_000)
      return true
    } catch (error) {
      consumePending(action, stampId)
      if (wasActive) activeChannelIds.value.add(channelId)
      else activeChannelIds.value.delete(channelId)
      // eslint-disable-next-line no-console
      console.error('Failed to update a Lights Out stamp', error)
      return false
    }
  }

  const applyInitialState = async (
    event: CreateLightsOutEvent,
    currentChannelIds: ReadonlySet<ChannelId> = new Set()
  ) => {
    if (!(await prepareStampMapping(event))) return
    if (
      puzzle.value?.root_channel_id !== event.root_channel_id ||
      !boardMessageId.value
    ) {
      return
    }

    const desiredChannelIds = new Set(activeChannelIds.value)
    activeChannelIds.value = new Set(currentChannelIds)
    let succeeded = true
    for (const channel of event.channels) {
      if (
        !(await setChannelActive(channel.id, desiredChannelIds.has(channel.id)))
      ) {
        succeeded = false
      }
    }
    if (succeeded && boardMessageId.value) {
      localStorage.setItem(
        initializedBoardStorageKey(boardMessageId.value),
        '1'
      )
    }
    resetInProgress = false
  }

  const requestClearIfSolved = async (
    messageId: MessageId,
    currentPuzzle: CreateLightsOutEvent
  ) => {
    if (cleared.value) return
    const board = await fetchMessage({ messageId, ignoreCache: true })
    const stampIds = new Set(channelToStampId.values())
    const solved =
      stampIds.size === currentPuzzle.channels.length &&
      [...stampIds].every(stampId => {
        const ownStamp = board.stamps.find(
          stamp => stamp.stampId === stampId && stamp.userId === myId.value
        )
        return ownStamp?.count === 1
      })
    if (!solved) return

    const response = await fetch(
      `/api/v3/channels/${encodeURIComponent(currentPuzzle.root_channel_id)}/clearlightsout`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
      }
    )
    if (!response.ok) throw new Error(`clear lights out: ${response.status}`)
    cleared.value = true
  }

  const fetchReadyBoard = async (
    messageId: MessageId,
    event: CreateLightsOutEvent
  ): Promise<Message | undefined> => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const message = await fetchMessage({ messageId })
      if (
        message.channelId !== event.board_channel_id ||
        message.content !== formatLightsOutBoard(event)
      ) {
        return undefined
      }
      if (message.stamps.length >= event.channels.length) return message
      await new Promise(resolve => window.setTimeout(resolve, 100))
    }
    return undefined
  }

  const initializeCreatedBoard = async (event: CreateLightsOutEvent) => {
    try {
      const { data: messages } = await apis.getMessages(
        event.board_channel_id,
        20,
        undefined,
        undefined,
        undefined,
        undefined,
        'desc'
      )
      extendMessagesMap(messages)
      const boardSummary = messages.find(
        message => message.content === formatLightsOutBoard(event)
      )
      if (
        !boardSummary ||
        boardMessageId.value ||
        puzzle.value?.root_channel_id !== event.root_channel_id
      ) {
        return
      }
      const board = await fetchReadyBoard(boardSummary.id, event)
      if (
        !board ||
        boardMessageId.value ||
        puzzle.value?.root_channel_id !== event.root_channel_id
      ) {
        return
      }
      boardMessageId.value = board.id
      await applyInitialState(event)
    } catch (error) {
      // MESSAGE_CREATED will retry initialization when the board is posted later.
      // eslint-disable-next-line no-console
      console.error(
        'Failed to initialize a newly-created Lights Out board',
        error
      )
    }
  }

  const onCreate = (event: CreateLightsOutEvent) => {
    clear()
    puzzle.value = event
    activeChannelIds.value = initLightsOut(event.channels)
    initializationComplete.value = true
    void initializeCreatedBoard(event)
  }

  const onMessageCreated = async (messageId: MessageId) => {
    const currentPuzzle = puzzle.value
    if (!currentPuzzle) return

    if (boardMessageId.value) {
      if (!cleared.value) {
        const message = await fetchMessage({ messageId, ignoreCache: true })
        if (message.content === 'チャンネルシステムが復旧しました') {
          const boardChannel = channelsMap.value.get(
            currentPuzzle.board_channel_id
          )
          if (message.channelId === boardChannel?.parentId) {
            cleared.value = true
          }
        }
      }
      return
    }

    try {
      const message = await fetchReadyBoard(messageId, currentPuzzle)
      if (
        !message ||
        puzzle.value?.root_channel_id !== currentPuzzle.root_channel_id ||
        boardMessageId.value
      ) {
        return
      }
      boardMessageId.value = message.id
      await applyInitialState(currentPuzzle)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to inspect a Lights Out board message', error)
    }
  }

  const restoreFromBoard = async (message: Message) => {
    if (puzzle.value) return false
    await Promise.all([
      bothChannelsMapInitialFetchPromise,
      stampsMapInitialFetchPromise
    ])
    if (puzzle.value) return false

    const boardChannel = channelsMap.value.get(message.channelId)
    const generalChannel =
      boardChannel?.name === '1' && boardChannel.parentId
        ? channelsMap.value.get(boardChannel.parentId)
        : undefined
    if (!generalChannel || generalChannel.name.toLowerCase() !== 'general') {
      return false
    }
    const accountRoot = generalChannel.parentId
      ? channelsMap.value.get(generalChannel.parentId)
      : undefined
    const rootChannel = generalChannel.parentId
      ? accountRoot?.children
          .map(channelId => channelsMap.value.get(channelId))
          .find(channel => channel?.name.toLowerCase() === 'random')
      : [...channelsMap.value.values()].find(
          channel =>
            channel.parentId === null && channel.name.toLowerCase() === 'random'
        )
    if (!rootChannel) return false

    const event = parseLightsOutBoard(
      message.content,
      rootChannel.id,
      message.channelId,
      channelsMap.value
    )
    if (!event) return false

    clear()
    puzzle.value = event
    boardMessageId.value = message.id
    if (!(await prepareStampMapping(event))) {
      clear()
      return false
    }

    activeChannelIds.value = new Set(
      message.stamps
        .filter(stamp => stamp.userId === myId.value)
        .map(stamp => stampToChannelId.get(stamp.stampId))
        .filter((id): id is ChannelId => id !== undefined)
    )

    const storageKey = initializedBoardStorageKey(message.id)
    if (localStorage.getItem(storageKey) === null) {
      const currentChannelIds = new Set(activeChannelIds.value)
      activeChannelIds.value = initLightsOut(event.channels)
      await applyInitialState(event, currentChannelIds)
    } else {
      localStorage.setItem(storageKey, '1')
    }
    initializationComplete.value = true
    await requestClearIfSolved(message.id, event)
    return true
  }

  const restoreFromLoadedMessages = async () => {
    if (puzzle.value) return
    const newestFirst = [...messagesMap.value.values()].toSorted((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    )
    for (const message of newestFirst) {
      if (await restoreFromBoard(message)) return
    }
  }

  const initializeFromGeneral = async () => {
    try {
      await Promise.all([
        bothChannelsMapInitialFetchPromise,
        stampsMapInitialFetchPromise
      ])
      if (puzzle.value) return

      const generalChannel = [...channelsMap.value.values()].find(
        channel =>
          channel.parentId === null && channel.name.toLowerCase() === 'general'
      )
      if (!generalChannel) return

      const boardChannel = generalChannel.children
        .map(channelId => channelsMap.value.get(channelId))
        .find(channel => !channel?.archived && channel?.name === '1')
      if (!boardChannel) return

      const { data: messages } = await apis.getMessages(
        boardChannel.id,
        100,
        undefined,
        undefined,
        undefined,
        undefined,
        'desc'
      )
      extendMessagesMap(messages)
      await restoreFromLoadedMessages()
      if (boardMessageId.value) {
        const { data: generalMessages } = await apis.getMessages(
          generalChannel.id,
          100,
          undefined,
          undefined,
          undefined,
          undefined,
          'desc'
        )
        cleared.value = generalMessages.some(
          message => message.content === 'チャンネルシステムが復旧しました'
        )
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to initialize Lights Out from #general', error)
    } finally {
      initializationComplete.value = true
    }
  }

  const onStampChanged = (
    event: MessageStampedEvent | MessageUnstampedEvent,
    action: StampAction
  ) => {
    if (
      event.message_id !== boardMessageId.value ||
      event.user_id !== myId.value
    )
      return

    const channelId = stampToChannelId.get(event.stamp_id)
    const currentPuzzle = puzzle.value
    if (!channelId || !currentPuzzle) return
    if (consumePending(action, event.stamp_id)) return

    if (action === 'add') activeChannelIds.value.add(channelId)
    else activeChannelIds.value.delete(channelId)
  }

  const onLocalStampUpdated = async ({
    action,
    messageId,
    stampId
  }: {
    action: StampAction
    messageId: MessageId
    stampId: StampId
  }) => {
    if (messageId !== boardMessageId.value || cleared.value) return

    const channelId = stampToChannelId.get(stampId)
    const currentPuzzle = puzzle.value
    if (!channelId || !currentPuzzle) return

    if (action === 'add') activeChannelIds.value.add(channelId)
    else activeChannelIds.value.delete(channelId)

    const storageKey = moveCountStorageKey(messageId)
    const moveCount = Number.parseInt(localStorage.getItem(storageKey) ?? '0')
    const nextMoveCount = (Number.isFinite(moveCount) ? moveCount : 0) + 1
    localStorage.setItem(storageKey, String(nextMoveCount))
    if (
      nextMoveCount >= getLightsOutMoveLimit(currentPuzzle.channels.length) &&
      !resetInProgress
    ) {
      resetInProgress = true
      ignoredResetDeletePending = true
      try {
        const endpoint = `/api/v3/channels/${encodeURIComponent(currentPuzzle.root_channel_id)}`
        const deleteResponse = await fetch(`${endpoint}/deletelightsout`, {
          method: 'POST',
          credentials: 'include'
        })
        if (!deleteResponse.ok) {
          throw new Error(`delete lights out: ${deleteResponse.status}`)
        }
        const createResponse = await fetch(`${endpoint}/createlightsout`, {
          method: 'POST',
          credentials: 'include'
        })
        if (!createResponse.ok) {
          throw new Error(`create lights out: ${createResponse.status}`)
        }
        localStorage.removeItem(storageKey)
        window.setTimeout(() => {
          for (const key of Object.keys(localStorage)) {
            if (key.startsWith('lights-out-initialized:')) {
              localStorage.removeItem(key)
            }
          }
          window.location.reload()
        }, 1_000)
      } catch (error) {
        // Allow the next direct click to retry the reset.
        resetInProgress = false
        ignoredResetDeletePending = false
        // eslint-disable-next-line no-console
        console.error('Failed to reset Lights Out', error)
      }
      return
    }

    await Promise.all(
      getLightsOutNeighbours(currentPuzzle.channels, channelId).map(
        neighbourId =>
          setChannelActive(
            neighbourId,
            !activeChannelIds.value.has(neighbourId)
          )
      )
    )

    try {
      await requestClearIfSolved(messageId, currentPuzzle)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to clear Lights Out', error)
    }
  }

  wsListener.on('CREATE_LIGHTS_OUT', onCreate)
  wsListener.on('DELETE_LIGHTS_OUT', event => {
    if (
      ignoredResetDeletePending &&
      puzzle.value?.root_channel_id === event.root_channel_id
    ) {
      ignoredResetDeletePending = false
      return
    }
    if (puzzle.value?.root_channel_id === event.root_channel_id) clear()
  })
  wsListener.on('MESSAGE_CREATED', ({ id }) => onMessageCreated(id))
  wsListener.on('MESSAGE_STAMPED', event => onStampChanged(event, 'add'))
  wsListener.on('MESSAGE_UNSTAMPED', event => onStampChanged(event, 'remove'))
  stampUpdateMitt.on('updated', onLocalStampUpdated)
  watch(messagesMap, () => restoreFromLoadedMessages(), {
    deep: true,
    immediate: true
  })
  void initializeFromGeneral()

  return {
    puzzle,
    boardMessageId,
    cleared,
    activeChannelIds,
    initializationComplete
  }
})

export const useLightsOutStore = convertToRefsStore(useLightsOutStorePinia)

if (import.meta.hot) {
  import.meta.hot.accept(
    acceptHMRUpdate(useLightsOutStorePinia, import.meta.hot)
  )
}
