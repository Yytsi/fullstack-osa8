import { useEffect, useState } from 'react'
import { useQuery } from '@apollo/client'
import { GET_LOGGED_USER, GET_BOOKS_WITH_GENRE } from '../queries'

const Recommendations = (props) => {
  const [userFavoriteGenre, setUserFavoriteGenre] = useState(null)
  const result = useQuery(GET_LOGGED_USER)
  const booksForGenre = useQuery(GET_BOOKS_WITH_GENRE, {
    variables: {
      genre: userFavoriteGenre,
    },
  })

  useEffect(() => {
    const favGenrePerhaps = result?.data?.me?.favoriteGenre
    if (favGenrePerhaps) {
      setUserFavoriteGenre(favGenrePerhaps)
    }
  }, [result?.data?.me?.favoriteGenre])

  if (!props.show) {
    return null
  }

  if (result.loading || booksForGenre.loading) {
    return <div>loading...</div>
  }

  return (
    <div>
      <h1>recommendations</h1>
      <div>
        books in your favorite genre <strong>{userFavoriteGenre}</strong>
      </div>
      <table>
        <tbody>
          <tr>
            <th>book</th>
            <th>author</th>
            <th>published</th>
          </tr>
          {booksForGenre.data.allBooks.map((book) => (
            <tr key={book.title + book.published}>
              <td>{book.title}</td>
              <td>{book.author.name}</td>
              <td>{book.published}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default Recommendations
