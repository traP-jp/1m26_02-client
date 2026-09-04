import type { Channel } from '@traptitech/traq'

import { nilUuid } from '/@/lib/basic/uuid'
import { channelIdToPathString } from '/@/lib/channel'
import type {
  CreateLightsOutEvent,
  LightsOutChannel
} from '/@/lib/websocket/events'
import type { ChannelId } from '/@/types/entity-ids'

const toggle = (activeChannelIds: Set<ChannelId>, channelId: ChannelId) => {
  if (activeChannelIds.has(channelId)) {
    activeChannelIds.delete(channelId)
  } else {
    activeChannelIds.add(channelId)
  }
}

export const getLightsOutNeighbours = (
  channels: LightsOutChannel[],
  channelId: ChannelId
): ChannelId[] => {
  const channelMap = new Map(channels.map(channel => [channel.id, channel]))
  const channel = channelMap.get(channelId)
  if (!channel) return []

  const neighbours = channel.children.filter(id => channelMap.has(id))
  if (channelMap.has(channel.parent_id)) {
    neighbours.unshift(channel.parent_id)
  }
  return neighbours
}

export const initLightsOut = (
  channels: LightsOutChannel[],
  random: () => number = Math.random
): Set<ChannelId> => {
  const allChannelIds = channels.map(channel => channel.id)
  const activeChannelIds = new Set<ChannelId>(allChannelIds)
  for (const channel of channels) {
    if (random() >= 0.5) continue

    toggle(activeChannelIds, channel.id)
    for (const neighbour of getLightsOutNeighbours(channels, channel.id)) {
      toggle(activeChannelIds, neighbour)
    }
  }
  return activeChannelIds.size > 0
    ? activeChannelIds
    : new Set<ChannelId>(allChannelIds)
}

export const getLightsOutMoveLimit = (channelCount: number): number =>
  channelCount + 10

export const formatLightsOutBoard = (event: CreateLightsOutEvent): string =>
  event.channels
    .map(channel => `:${channel.stamp_name}: #${channel.path}`)
    .join('\n')

export const isLightsOutChannelLocked = (
  event: CreateLightsOutEvent | undefined,
  activeChannelIds: ReadonlySet<ChannelId>,
  channelId: ChannelId
): boolean =>
  event?.channels.some(channel => channel.id === channelId) === true &&
  !activeChannelIds.has(channelId)

export const parseLightsOutBoard = (
  content: string,
  rootChannelId: ChannelId,
  boardChannelId: ChannelId,
  channelsMap: ReadonlyMap<ChannelId, Channel>
): CreateLightsOutEvent | undefined => {
  const root = channelsMap.get(rootChannelId)
  if (!root || root.name.toLowerCase() !== 'random') return undefined

  const subtreeIds = new Set<ChannelId>()
  const visit = (channelId: ChannelId) => {
    if (subtreeIds.has(channelId)) return
    const channel = channelsMap.get(channelId)
    if (!channel || channel.archived) return
    subtreeIds.add(channelId)
    channel.children.forEach(visit)
  }
  visit(rootChannelId)

  const pathToId = new Map(
    [...subtreeIds].map(id => [channelIdToPathString(id, channelsMap), id])
  )
  const lines = content.split('\n')
  if (lines.length !== subtreeIds.size) return undefined

  const usedChannelIds = new Set<ChannelId>()
  const usedStampNames = new Set<string>()
  const channels: LightsOutChannel[] = []
  for (const line of lines) {
    const match = /^:([^:\s]+): #(.+)$/.exec(line)
    if (!match) return undefined
    const [, stampName, path] = match
    if (!stampName || !path || usedStampNames.has(stampName)) return undefined

    const id = pathToId.get(path)
    const channel = id ? channelsMap.get(id) : undefined
    if (!id || !channel || usedChannelIds.has(id)) return undefined

    usedChannelIds.add(id)
    usedStampNames.add(stampName)
    channels.push({
      id,
      path,
      parent_id:
        channel.parentId && subtreeIds.has(channel.parentId)
          ? channel.parentId
          : nilUuid,
      children: channel.children.filter(childId => subtreeIds.has(childId)),
      stamp_name: stampName,
      stamp: ''
    })
  }

  if (usedChannelIds.size !== subtreeIds.size) return undefined
  return {
    root_channel_id: rootChannelId,
    board_channel_id: boardChannelId,
    channels
  }
}
