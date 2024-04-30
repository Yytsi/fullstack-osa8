import { useState } from 'react'
import { gql, useQuery } from '@apollo/client'

import { ALL_BOOKS, GET_BOOKS_WITH_GENRE } from '../queries'

const Books = (props) => {
  const [genre, setGenre] = useState('all genres')

  const result = useQuery(GET_BOOKS_WITH_GENRE, {
    variables: genre ? { genre: genre === 'all genres' ? '' : genre } : {},
  })

  const resultAllBooks = useQuery(ALL_BOOKS)

  if (!props.show) {
    return null
  }

  if (result.loading || resultAllBooks.loading) {
    return <div>loading...</div>
  }

  const books = result.data.allBooks
  const allBooks = resultAllBooks.data.allBooks

  const allGenres = allBooks
    .map((book) => [...book.genres])
    .reduce((a, currentGenres) => {
      for (let genre of currentGenres) {
        if (!a.includes(genre)) {
          a.push(genre)
        }
      }
      return a
    }, [])
    .concat(['all genres'])

  return (
    <div>
      <h2>books</h2>
      {genre === 'all genres' ? (
        <p>all genres</p>
      ) : (
        <p>
          in genre <strong>{genre}</strong>
        </p>
      )}
      <table>
        <tbody>
          <tr>
            <th>book name</th>
            <th>author</th>
            <th>published</th>
          </tr>
          {books.map((a) => (
            <tr key={a.title}>
              <td>{a.title}</td>
              <td>{a.author.name}</td>
              <td>{a.published}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {allGenres.map((genre) => (
        <button
          key={genre + '.'}
          value={genre}
          onClick={(e) => {
            setGenre(e.target.value)
          }}
        >
          {genre}
        </button>
      ))}
    </div>
  )
}

export default Books
