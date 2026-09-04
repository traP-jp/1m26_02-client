export const LOGIN_LETTERS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z'
] as const

export type LoginLetter = (typeof LOGIN_LETTERS)[number]

export const LOGIN_LETTER_SESSION_KEY = 'login-mystery-letter'

export const getRandomLoginLetter = (): LoginLetter => {
  const index = Math.floor(Math.random() * LOGIN_LETTERS.length)
  return LOGIN_LETTERS[index] ?? 'A'
}

export const getNextLoginLetter = (letter: LoginLetter): LoginLetter => {
  const index = LOGIN_LETTERS.indexOf(letter)
  return LOGIN_LETTERS[(index + 1) % LOGIN_LETTERS.length] ?? 'A'
}
