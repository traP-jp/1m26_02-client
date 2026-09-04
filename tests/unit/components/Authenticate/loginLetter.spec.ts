import {
  LOGIN_LETTERS,
  getNextLoginLetter,
  getRandomLoginLetter
} from '/@/components/Authenticate/loginLetter'

describe('getRandomLoginLetter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns A for the minimum random value', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    expect(getRandomLoginLetter()).toBe('A')
  })

  it('returns Z for a random value close to one', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999999)

    expect(getRandomLoginLetter()).toBe('Z')
  })

  it('returns a login letter', () => {
    expect(LOGIN_LETTERS).toContain(getRandomLoginLetter())
  })
})

describe('getNextLoginLetter', () => {
  it.each([
    { current: 'A', expected: 'B' },
    { current: 'P', expected: 'Q' },
    { current: 'Z', expected: 'A' }
  ] as const)('returns $expected after $current', ({ current, expected }) => {
    expect(getNextLoginLetter(current)).toBe(expected)
  })
})
