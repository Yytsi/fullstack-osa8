import { useState } from 'react'
import { LOGIN } from '../queries'
import { useMutation } from '@apollo/client'

const Login = ({ show, setToken }) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [loginToService] = useMutation(LOGIN, {})

  const submit = async (e) => {
    e.preventDefault()

    try {
      const result = await loginToService({
        variables: { username, password },
      })
      if (result) {
        const token = result.data.login.value
        setToken(token)
        localStorage.setItem('library-user-token', token)
      }
    } catch (error) {
      console.log(error)
      alert('login failed for some reason... could be username or password!')
    }
  }

  return (
    <div style={{ display: show ? '' : 'none' }}>
      <h2>login</h2>
      <form onSubmit={submit}>
        <div>
          username
          <input
            value={username}
            onChange={({ target }) => setUsername(target.value)}
          />
        </div>
        <div>
          password
          <input
            type="password"
            value={password}
            onChange={({ target }) => setPassword(target.value)}
          />
        </div>
        <button type="submit">login</button>
      </form>
    </div>
  )
}

export default Login
