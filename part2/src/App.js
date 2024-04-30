import { useState, useEffect } from 'react'
import Authors from './components/Authors'
import Books from './components/Books'
import NewBook from './components/NewBook'
import Login from './components/Login'
import Recommendations from './components/Recommendations'

const App = () => {
  const [page, setPage] = useState('authors')
  const [token, setToken] = useState(null)

  useEffect(() => {
    const tokenFromStorage = localStorage.getItem('library-user-token')
    if (tokenFromStorage) {
      setToken(tokenFromStorage)
    }
  })

  return (
    <div>
      <div>
        <button onClick={() => setPage('authors')}>authors</button>
        <button onClick={() => setPage('books')}>books</button>
        {token ? (
          <button onClick={() => setPage('add')}>add book</button>
        ) : null}
        {!token ? (
          <button onClick={() => setPage('login')}>login</button>
        ) : null}
        {token ? (
          <button onClick={() => setPage('recommendations')}>recommend</button>
        ) : null}
        {token ? (
          <button
            onClick={() => {
              setToken(null)
              localStorage.clear()
              setPage('authors')
            }}
          >
            logout
          </button>
        ) : null}
      </div>

      <Authors show={page === 'authors'} />

      <Books show={page === 'books'} />

      <NewBook show={page === 'add'} />

      <Login show={page === 'login'} setToken={setToken} />

      <Recommendations show={page === 'recommendations'} />
    </div>
  )
}

export default App
