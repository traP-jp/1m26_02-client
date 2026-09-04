import type { Channel } from '@traptitech/traq'

import { describe, expect, it } from 'vitest'

import {
  formatLightsOutBoard,
  getLightsOutMoveLimit,
  getLightsOutNeighbours,
  initLightsOut,
  isLightsOutChannelLocked,
  parseLightsOutBoard
} from '/@/lib/lightsOut'
import type { CreateLightsOutEvent } from '/@/lib/websocket/events'

const event: CreateLightsOutEvent = {
  root_channel_id: 'root',
  board_channel_id: 'general',
  channels: [
    {
      id: 'root',
      path: 'random',
      parent_id: '00000000-0000-0000-0000-000000000000',
      children: ['child-a', 'child-b'],
      stamp_name: 'thumbsup',
      stamp: '👍'
    },
    {
      id: 'child-a',
      path: 'random/a',
      parent_id: 'root',
      children: ['grandchild'],
      stamp_name: 'white_check_mark',
      stamp: '✅'
    },
    {
      id: 'grandchild',
      path: 'random/a/dev',
      parent_id: 'child-a',
      children: [],
      stamp_name: 'tada',
      stamp: '🎉'
    },
    {
      id: 'child-b',
      path: 'random/b',
      parent_id: 'root',
      children: [],
      stamp_name: 'one',
      stamp: '1️⃣'
    }
  ]
}

const channelsMap = new Map<string, Channel>([
  [
    'root',
    {
      id: 'root',
      parentId: null,
      archived: false,
      force: false,
      topic: '',
      name: 'random',
      children: ['child-a', 'child-b']
    }
  ],
  [
    'child-a',
    {
      id: 'child-a',
      parentId: 'root',
      archived: false,
      force: false,
      topic: '',
      name: 'a',
      children: ['grandchild']
    }
  ],
  [
    'grandchild',
    {
      id: 'grandchild',
      parentId: 'child-a',
      archived: false,
      force: false,
      topic: '',
      name: 'dev',
      children: []
    }
  ],
  [
    'child-b',
    {
      id: 'child-b',
      parentId: 'root',
      archived: false,
      force: false,
      topic: '',
      name: 'b',
      children: []
    }
  ]
])

describe('Lights Out', () => {
  it('limits moves to the channel count plus ten', () => {
    expect(getLightsOutMoveLimit(event.channels.length)).toBe(14)
  })

  it('returns only in-puzzle parents and children as neighbours', () => {
    expect(getLightsOutNeighbours(event.channels, 'root')).toEqual([
      'child-a',
      'child-b'
    ])
    expect(getLightsOutNeighbours(event.channels, 'child-a')).toEqual([
      'root',
      'grandchild'
    ])
  })

  it('initializes by applying each selected channel move', () => {
    const values = [0.1, 0.9, 0.1, 0.9]
    const active = initLightsOut(event.channels, () => values.shift() ?? 1)

    expect([...active]).toEqual(['child-a'])
  })

  it('starts with every channel active before applying random moves', () => {
    const active = initLightsOut(event.channels, () => 1)

    expect([...active].sort()).toEqual([
      'child-a',
      'child-b',
      'grandchild',
      'root'
    ])
  })

  it('keeps a non-empty initial state when random moves turn everything off', () => {
    const values = [0.9, 0.9, 0.1, 0.1]
    const active = initLightsOut(event.channels, () => values.shift() ?? 1)

    expect([...active].sort()).toEqual([
      'child-a',
      'child-b',
      'grandchild',
      'root'
    ])
  })

  it('locks only puzzle channels without the corresponding user stamp', () => {
    const active = new Set(['root', 'child-a'])

    expect(isLightsOutChannelLocked(event, active, 'root')).toBe(false)
    expect(isLightsOutChannelLocked(event, active, 'grandchild')).toBe(true)
    expect(isLightsOutChannelLocked(event, active, 'general')).toBe(false)
    expect(isLightsOutChannelLocked(undefined, active, 'grandchild')).toBe(
      false
    )
  })

  it('formats the mapping message posted by the bot', () => {
    expect(formatLightsOutBoard(event)).toBe(
      ':thumbsup: #random\n:white_check_mark: #random/a\n:tada: #random/a/dev\n:one: #random/b'
    )
  })

  it('restores an event from an already-posted mapping message', () => {
    const restored = parseLightsOutBoard(
      formatLightsOutBoard(event),
      'root',
      'general',
      channelsMap
    )

    expect(restored).toEqual({
      ...event,
      channels: event.channels.map(channel => ({ ...channel, stamp: '' }))
    })
  })

  it('rejects messages that do not map the entire subtree', () => {
    expect(
      parseLightsOutBoard(':thumbsup: #random', 'root', 'general', channelsMap)
    ).toBeUndefined()
  })

  it('ignores archived descendants when restoring a regenerated board', () => {
    const mapWithArchivedGrandchild = new Map(channelsMap)
    const grandchild = channelsMap.get('grandchild')
    expect(grandchild).toBeDefined()
    if (!grandchild) return
    mapWithArchivedGrandchild.set('grandchild', {
      ...grandchild,
      archived: true
    })
    const regeneratedEvent = {
      ...event,
      channels: event.channels.filter(channel => channel.id !== 'grandchild')
    }

    expect(
      parseLightsOutBoard(
        formatLightsOutBoard(regeneratedEvent),
        'root',
        'general',
        mapWithArchivedGrandchild
      )
    ).toEqual({
      ...regeneratedEvent,
      channels: regeneratedEvent.channels.map(channel => ({
        ...channel,
        children: channel.children.filter(id => id !== 'grandchild'),
        stamp: ''
      }))
    })
  })
})
