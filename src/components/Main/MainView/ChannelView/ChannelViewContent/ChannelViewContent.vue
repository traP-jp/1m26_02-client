<template>
  <div
    :class="$style.container"
    @dragstart.stop="onDragStart"
    @dragover.prevent.stop="onDragOver"
    @drop.prevent.stop="onContentDrop"
  >
    <div
      v-if="isWaitingForLightsOut"
      :class="$style.statusPanel"
      data-testid="lights-out-loading"
      aria-live="polite"
    >
      <LoadingSpinner color="ui-secondary" />
      <p>チャンネルの復旧状態を確認しています…</p>
    </div>
    <div
      v-else-if="isLightsOutLocked"
      :class="[$style.statusPanel, $style.errorPanel]"
      data-testid="lights-out-error"
      role="alert"
    >
      <AIcon mdi name="alert" :size="48" :class="$style.errorIcon" />
      <div :class="$style.errorCode">ERROR: CHANNEL_DATA_CORRUPTED</div>
      <h2>このチャンネルは復旧していません</h2>
      <p>対応するスタンプを点灯させると、内容を閲覧できます。</p>
    </div>
    <template v-else>
      <ChannelViewContentFileUploadOverlay
        v-if="canDrop"
        :class="$style.fileUploadOverlay"
      />
      <ChannelViewContentMain
        :key="renderKey"
        :channel-id="channelId"
        :entry-message-id="entryMessageId"
        :pinned-messages="pinnedMessages"
        :typing-users="typingUsers"
      />
    </template>
  </div>
</template>

<script lang="ts">
import type { Ref } from 'vue'
import { computed, ref, toRef } from 'vue'

import { debounce, throttle } from 'throttle-debounce'

import { useRenderKey } from '/@/composables/dom/useRenderKey'
import useMessageInputStateAttachment from '/@/composables/messageInputState/useMessageInputStateAttachment'
import { useToastStore } from '/@/store/ui/toast'
import type { ChannelId, UserId } from '/@/types/entity-ids'

const { key: renderKey } = useRenderKey('messages')

const useDragDrop = (channelId: Ref<ChannelId>) => {
  const { addErrorToast } = useToastStore()
  const { addTextToLast, addAttachment } = useMessageInputStateAttachment(
    channelId,
    addErrorToast
  )

  // itemsはsafariには存在しない
  const hasFilesOrItems = (dt: DataTransfer) =>
    dt.files.length > 0 || dt.items?.length > 0

  const isDragging = ref(false)
  /** ドラッグがtraQの画面からスタートしたかどうか */
  const isDragStartInside = ref(false)
  const canDrop = computed(() => isDragging.value && !isDragStartInside.value)

  const onDrop = async (event: DragEvent) => {
    const droppable = canDrop.value // isDraggingなどに依存しているので退避しておく
    isDragging.value = false
    isDragStartInside.value = false

    if (droppable && event.dataTransfer) {
      const result = await getTextOrFile(event.dataTransfer)
      if (result) {
        if (typeof result === 'string') {
          addTextToLast(result)
        } else {
          for (const file of result) {
            await addAttachment(file)
          }
        }
      }
    }
  }
  const onDragStart = (_event: DragEvent) => {
    isDragStartInside.value = true
  }

  /** ドラッグ終了判定するまでにdragoverが何ms開けばいいか */
  const dragoverResetDurationMs = 150
  const resetDraggingState = debounce(dragoverResetDurationMs, () => {
    isDragging.value = false
    isDragStartInside.value = false
  })
  const onDragOver = throttle(50, (event: DragEvent) => {
    if (event.dataTransfer && hasFilesOrItems(event.dataTransfer)) {
      isDragging.value = true
    }
    resetDraggingState()
  })
  return {
    canDrop,
    onDrop,
    onDragStart,
    onDragOver
  }
}
</script>

<script lang="ts" setup>
import type { Pin } from '@traptitech/traq'

import AIcon from '/@/components/UI/AIcon.vue'
import LoadingSpinner from '/@/components/UI/LoadingSpinner.vue'
import { getTextOrFile } from '/@/lib/dom/dataTransfer'
import { isLightsOutChannelLocked as checkLightsOutChannelLocked } from '/@/lib/lightsOut'
import { useLightsOutStore } from '/@/store/domain/lightsOut'
import { useChannelsStore } from '/@/store/entities/channels'

import ChannelViewContentFileUploadOverlay from './ChannelViewContentFileUploadOverlay.vue'
import ChannelViewContentMain from './ChannelViewContentMain.vue'

const props = defineProps<{
  channelId: ChannelId
  entryMessageId?: ChannelId
  pinnedMessages: Pin[]
  typingUsers: UserId[]
}>()

const { canDrop, onDrop, onDragStart, onDragOver } = useDragDrop(
  toRef(props, 'channelId')
)

const { channelsMap } = useChannelsStore()
const { activeChannelIds, initializationComplete, puzzle } = useLightsOutStore()

const isInRandomSubtree = computed(() => {
  const visited = new Set<ChannelId>()
  let current = channelsMap.value.get(props.channelId)
  while (current && !visited.has(current.id)) {
    if (current.name.toLowerCase() === 'random') return true
    visited.add(current.id)
    current = current.parentId
      ? channelsMap.value.get(current.parentId)
      : undefined
  }
  return false
})
const isWaitingForLightsOut = computed(
  () => isInRandomSubtree.value && !initializationComplete.value
)
const isLightsOutLocked = computed(() =>
  checkLightsOutChannelLocked(
    puzzle.value,
    activeChannelIds.value,
    props.channelId
  )
)
const onContentDrop = (event: DragEvent) => {
  if (isWaitingForLightsOut.value || isLightsOutLocked.value) return
  return onDrop(event)
}
</script>

<style lang="scss" module>
.container {
  @include color-ui-primary;
  display: flex;
  flex-direction: row;
  position: relative;
  height: 100%;
  background: var(--specific-main-view-background);
}

.fileUploadOverlay {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  z-index: $z-index-file-upload-overlay;
}

.statusPanel {
  display: flex;
  flex: 1 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  text-align: center;

  p,
  h2 {
    margin: 0;
  }
}

.errorPanel {
  align-self: center;
  flex: 0 1 auto;
  width: min(520px, calc(100% - 48px));
  margin: auto;
  padding: 40px 32px;
  border: 1px solid $theme-accent-error-default;
  border-left-width: 5px;
  border-radius: 6px;
  background: var(--specific-main-view-background);
  box-shadow: 0 0 24px rgb(255 64 64 / 12%);
}

.errorIcon,
.errorCode {
  color: $theme-accent-error-default;
}

.errorCode {
  font-family: monospace;
  font-size: 0.875rem;
  letter-spacing: 0.08em;
}

.header {
  font: {
    size: 30px;
    weight: bold;
  }
}
</style>
