import axios from 'axios'

import { postFakeLogin } from '/@/lib/apis'

vi.mock('axios', () => ({
  default: {
    post: vi.fn()
  }
}))

describe('postFakeLogin', () => {
  it('posts to the mystery login endpoint without a request body', async () => {
    const post = vi.mocked(axios.post)

    await postFakeLogin()

    expect(post).toHaveBeenCalledOnce()
    expect(post).toHaveBeenCalledWith('/api/v3/1ogin')
  })
})
