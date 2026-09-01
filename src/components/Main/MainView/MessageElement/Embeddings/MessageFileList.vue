<template>
  <div>
    <div :class="$style.imageContainer">
      <MessageFileListImage
        v-for="meta in fileMetaDataState.images"
        :key="meta.id"
        :channel-id="channelId"
        :file-id="meta.id"
        :is-large="showLargeImage"
      />
    </div>
    <MessageFileListVideo
      v-for="meta in fileMetaDataState.videos"
      :key="meta.id"
      :channel-id="channelId"
      :file-id="meta.id"
    />
    <MessageFileListAudio
      v-for="meta in fileMetaDataState.audios"
      :key="meta.id"
      :channel-id="channelId"
      :file-id="meta.id"
    />
    <MessageFileListFile
      v-for="meta in fileMetaDataState.files"
      :key="meta.id"
      :class="$style.item"
      :channel-id="channelId"
      :file-id="meta.id"
    />
    <div
      v-for="fileId in deletedFileIds"
      :key="`deleted-${fileId}`"
      :class="$style.deleted"
      aria-disabled="true"
    >
      この添付ファイルは削除されました
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, reactive } from 'vue'

import useFileMetaList from '/@/composables/message/useFileMetaList'
import { useQBotStore } from '/@/store/domain/qbot'
import type {
  ChannelId,
  DMChannelId,
  FileId,
  MessageId
} from '/@/types/entity-ids'

import MessageFileListAudio from './MessageFileListAudio.vue'
import MessageFileListFile from './MessageFileListFile.vue'
import MessageFileListImage from './MessageFileListImage.vue'
import MessageFileListVideo from './MessageFileListVideo.vue'

const props = withDefaults(
  defineProps<{
    channelId: ChannelId | DMChannelId
    messageId: MessageId
    fileIds?: FileId[]
  }>(),
  {
    fileIds: () => []
  }
)

const { isAttachmentDeleted } = useQBotStore()
const visibleFileIds = computed(() =>
  props.fileIds.filter(fileId => !isAttachmentDeleted(props.messageId, fileId))
)
const deletedFileIds = computed(() =>
  props.fileIds.filter(fileId => isAttachmentDeleted(props.messageId, fileId))
)
const fileListProps = reactive({ fileIds: visibleFileIds })
const { fileMetaDataState } = useFileMetaList(fileListProps)
const showLargeImage = computed(() => fileMetaDataState.images.length === 1)
</script>

<style lang="scss" module>
.imageContainer {
  display: flex;
  flex-flow: row wrap;
  gap: 16px;
}
.item {
  flex-shrink: 0;
  &:not(:last-child) {
    margin-bottom: 16px;
  }
}
.deleted {
  color: $theme-ui-secondary-default;
  border: 2px dashed $theme-background-secondary-border;
  border-radius: 4px;
  padding: 16px;
  max-width: 400px;
  cursor: not-allowed;
}
</style>
